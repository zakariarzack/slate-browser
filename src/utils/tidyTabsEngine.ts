export interface TabItemLike {
  id: string;
  url: string;
  title: string;
  category?: string;
  isUserGroup?: boolean;
}

export interface ProposedGroup {
  groupName: string;
  tabIds: string[];
}

export interface TidyResult {
  groups: ProposedGroup[];
  ungroupedTabIds: string[];
  source: 'gemini' | 'local';
}

/**
 * 1. Clean noisy web titles (Arc's "Tidy Tab Titles" rule)
 * Strips notification counts, badges, and trailing website brand markers.
 */
export function tidyTabTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let title = rawTitle.trim();
  // Strip unread counts: "(26) YouTube", "(1,013) Inbox" -> "YouTube", "Inbox"
  title = title.replace(/^\([\d,+]+\)\s*/, '');
  // Strip trailing site brand separators: "Video Title - YouTube", "Dashboard · GitHub"
  title = title.replace(/\s*[-–—|•·]\s*[^–—|•·]+$/, '');
  return title.trim() || rawTitle;
}

/**
 * 2. High-level Topic Classifiers (Local Heuristic Fallback)
 */
const TOPIC_RULES: Array<{
  name: string;
  test: (url: string, title: string) => boolean;
}> = [
  {
    name: 'Research & Docs',
    test: (u, t) =>
      /docs|developer|wiki|arxiv|mdn|reference|tutorial|guide|learn/.test(u) ||
      /documentation|reference|api|tutorial|guide/i.test(t),
  },
  {
    name: 'Development',
    test: (u) => /github|gitlab|bitbucket|stackoverflow|npm|yarn|localhost|127\.0\.0\.1|vercel|docker/.test(u),
  },
  {
    name: 'Media & Streaming',
    test: (u) => /youtube|youtu\.be|netflix|spotify|twitch|vimeo|podcast|soundcloud/.test(u),
  },
  {
    name: 'Productivity & Work',
    test: (u, t) =>
      /mail|gmail|jira|linear|notion|slack|zoom|meet|teams|figma|trello|calendar|asana/.test(u) ||
      /meeting|agenda|dashboard|inbox/i.test(t),
  },
  {
    name: 'Social & Feeds',
    test: (u) => /x\.com|twitter|reddit|instagram|linkedin|facebook|threads|news\.ycombinator/.test(u),
  },
  {
    name: 'Shopping & Travel',
    test: (u, t) =>
      /amazon|ebay|etsy|airbnb|booking|expedia|flights|shop|store|tokopedia|shopee/.test(u) ||
      /checkout|cart|hotel|flight/i.test(t),
  },
];

/**
 * 3. Local Heuristic Clustering (Default min threshold >= 2 tabs)
 */
export function clusterTabsLocally(tabs: TabItemLike[], minThreshold = 2): TidyResult {
  const eligibleTabs = tabs;
  const buckets: Record<string, string[]> = {};

  for (const tab of eligibleTabs) {
    const url = (tab.url || '').toLowerCase();
    const title = (tab.title || '').toLowerCase();

    let assigned = false;
    for (const rule of TOPIC_RULES) {
      if (rule.test(url, title)) {
        if (!buckets[rule.name]) buckets[rule.name] = [];
        buckets[rule.name].push(tab.id);
        assigned = true;
        break;
      }
    }

    if (!assigned && tab.url && tab.url.startsWith('http')) {
      try {
        const host = new URL(tab.url).hostname.replace(/^www\./, '');
        const root = host.split('.')[0];
        if (root && root.length > 2 && !['google', 'bing', 'duckduckgo'].includes(root)) {
          const capName = root.charAt(0).toUpperCase() + root.slice(1);
          if (!buckets[capName]) buckets[capName] = [];
          buckets[capName].push(tab.id);
          assigned = true;
        }
      } catch (e) {}
    }
  }

  const proposedGroups: ProposedGroup[] = [];
  const groupedTabIdSet = new Set<string>();

  for (const [groupName, tabIds] of Object.entries(buckets)) {
    if (tabIds.length >= minThreshold) {
      proposedGroups.push({ groupName, tabIds });
      tabIds.forEach((id) => groupedTabIdSet.add(id));
    }
  }

  const ungroupedTabIds = tabs
    .map((t) => t.id)
    .filter((id) => !groupedTabIdSet.has(id));

  return {
    groups: proposedGroups,
    ungroupedTabIds,
    source: 'local',
  };
}

/**
 * 4. Gemini AI Intelligent Clustering (Arc Max style)
 * Uses Gemini Flash with fallback to local heuristic
 */
export async function clusterTabsWithGemini(
  tabs: TabItemLike[],
  apiKey: string,
  minThreshold = 2
): Promise<TidyResult> {
  const eligibleTabs = tabs;
  if (eligibleTabs.length < minThreshold) {
    return {
      groups: [],
      ungroupedTabIds: tabs.map((t) => t.id),
      source: 'local',
    };
  }

  if (!apiKey || !apiKey.trim()) {
    return clusterTabsLocally(tabs, minThreshold);
  }

  const cleanTabsPayload = eligibleTabs.map((t) => ({
    id: t.id,
    title: t.title || 'Untitled',
    url: t.url || '',
  }));

  const prompt = `You are an AI tab clustering engine for a modern browser (like Arc Max Tidy Tabs).
Analyze the unpinned tabs and group them by task or semantic context.
RULES:
1. ONLY create a group if there are ${minThreshold} OR MORE tabs belonging to the same task or project. If fewer than ${minThreshold} tabs relate to a topic, DO NOT group them.
2. Group names must be short, human-readable project/task titles (e.g. 'React 19 Learning', 'Tokyo Trip Planning', 'PR Reviews'). Never name a group after a generic single website.
3. Return pure JSON with this exact schema:
{
  "groups": [
    {
      "groupName": "string",
      "tabIds": ["string"]
    }
  ]
}

Tabs:
${JSON.stringify(cleanTabsPayload)}`;

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed?.groups)) {
        const validGroups: ProposedGroup[] = [];
        const groupedIdSet = new Set<string>();

        for (const g of parsed.groups) {
          if (g && typeof g.groupName === 'string' && Array.isArray(g.tabIds)) {
            // Enforce minimum threshold strictly
            const existingTabIds = g.tabIds.filter((id: string) => eligibleTabs.some((t) => t.id === id));
            if (existingTabIds.length >= minThreshold) {
              validGroups.push({
                groupName: g.groupName.trim(),
                tabIds: existingTabIds,
              });
              existingTabIds.forEach((id: string) => groupedIdSet.add(id));
            }
          }
        }

        const ungroupedTabIds = tabs
          .map((t) => t.id)
          .filter((id) => !groupedIdSet.has(id));

        return {
          groups: validGroups,
          ungroupedTabIds,
          source: 'gemini',
        };
      }
    } catch (e) {
      console.warn(`[Gemini Tidy] Model ${model} failed, trying fallback:`, e);
    }
  }

  // If Gemini fails or times out, seamlessly fall back to local clustering
  return clusterTabsLocally(tabs, minThreshold);
}
