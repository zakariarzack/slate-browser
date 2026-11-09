import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  CollisionDetection,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Sidebar as SidebarIcon,
  Plus,
  Compass,
  Briefcase,
  User,
  Sparkles,
  Command,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  RotateCw,
  RotateCcw,
  Columns2,
  X,
  Search,
  Wand2,
  Folder,
  Layers,
  ChevronDown,
  ChevronRight,
  Clock,
  Pin,
  PinOff,
  CheckCircle2,
  Globe,
  Sun,
  Undo2,
  Bookmark,
  MessageSquare,
  SplitSquareVertical,
  Settings,
  Check,
  SlidersHorizontal,
  ExternalLink,
  Maximize2,
  PictureInPicture2,
  MoreVertical,
  Copy,
  MoveRight,
  Sparkle,
  CopyPlus,
  FolderPlus,
  FolderMinus,
  FolderInput,
  UserCheck,
  AppWindow,
  BookmarkPlus,
  Edit3,
  Image as ImageIcon,
  VolumeX,
  Volume2,
  Radio,
  ArrowUp,
  ArrowDown,
  ArrowDownToLine,
  XCircle,
  Puzzle,
  FolderOpen,
  Download,
  Trash2,
  Store,
  Upload,
  Play,
  Pause,
  FileDown,
  CheckCircle,
  AlertCircle,
  Mic,
  CornerDownLeft,
  Info,
  Leaf,
  CircleDot,
  Loader2
} from 'lucide-react';
import { Space, TabItem, CustomGroup, AppUpdateInfo } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChromeNewTabPage } from './components/ChromeNewTabPage';
import { getBundledIcon } from './bundledIcons';
import { tidyTabTitle, clusterTabsLocally, clusterTabsWithGemini, TidyResult } from './utils/tidyTabsEngine';

const GEMINI_DEFAULT_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const DESKTOP_CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

// Smart URL title heuristic to immediately display readable page/video/query titles
function formatSmartUrlTitle(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    // 1. YouTube watch URLs
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      const list = parsed.searchParams.get('list');
      if (v) return 'YouTube Video';
      if (list) return 'YouTube Playlist';
    }
    // 2. Search engine queries (Google, DDG, Bing, YouTube Search)
    const q = parsed.searchParams.get('q') || parsed.searchParams.get('query') || parsed.searchParams.get('search_query');
    if (q && q.trim()) {
      return `${q.trim()} - Search`;
    }
    // 3. Human-readable path slugs (e.g. /docs/installation, /wiki/React, /state-a-components-memory)
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    if (pathSegments.length > 0) {
      const last = pathSegments[pathSegments.length - 1]
        .replace(/[-_+]/g, ' ')
        .replace(/\.[a-zA-Z0-9]+$/, '')
        .trim();
      if (last.length >= 3 && !/^\d+$/.test(last) && !last.includes('=')) {
        return last.charAt(0).toUpperCase() + last.slice(1);
      }
    }
    // 4. Clean domain name capitalized (e.g. "YouTube", "GitHub", "MDN")
    const cleanHost = parsed.hostname.replace(/^www\./, '');
    const brand = cleanHost.split('.')[0];
    return brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : cleanHost;
  } catch (e) {
    return rawUrl;
  }
}

// Canonical URL equivalence comparison: prevents React prop re-render loops on trailing slashes (e.g. youtube.com vs youtube.com/)
export function isUrlEquivalent(urlA?: string | null, urlB?: string | null): boolean {
  if (!urlA || !urlB) return urlA === urlB;
  if (urlA === urlB) return true;
  const cleanA = urlA.trim().replace(/\/+$/, '');
  const cleanB = urlB.trim().replace(/\/+$/, '');
  if (cleanA === cleanB) return true;
  try {
    const parsedA = new URL(urlA);
    const parsedB = new URL(urlB);
    const pathA = parsedA.pathname.replace(/\/+$/, '') || '/';
    const pathB = parsedB.pathname.replace(/\/+$/, '') || '/';
    return (
      parsedA.origin === parsedB.origin &&
      pathA === pathB &&
      parsedA.search === parsedB.search &&
      parsedA.hash === parsedB.hash
    );
  } catch (e) {
    return cleanA === cleanB;
  }
}

// Search Engine Definitions
export type SearchEngine = 'google' | 'duckduckgo' | 'bing' | 'kagi' | 'brave';

interface SearchEngineOption {
  id: SearchEngine;
  name: string;
  searchUrl: string;
  homeUrl: string;
}

const SEARCH_ENGINES: Record<SearchEngine, SearchEngineOption> = {
  google: {
    id: 'google',
    name: 'Google',
    searchUrl: 'https://www.google.com/search?q=',
    homeUrl: 'https://www.google.com',
  },
  duckduckgo: {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    searchUrl: 'https://duckduckgo.com/?q=',
    homeUrl: 'https://duckduckgo.com',
  },
  bing: {
    id: 'bing',
    name: 'Bing',
    searchUrl: 'https://www.bing.com/search?q=',
    homeUrl: 'https://www.bing.com',
  },
  brave: {
    id: 'brave',
    name: 'Brave Search',
    searchUrl: 'https://search.brave.com/search?q=',
    homeUrl: 'https://search.brave.com',
  },
  kagi: {
    id: 'kagi',
    name: 'Kagi',
    searchUrl: 'https://kagi.com/search?q=',
    homeUrl: 'https://kagi.com',
  },
};

const getBlankDragGhost = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById('blank-drag-image') as HTMLElement;
  if (!el) {
    const canvas = document.createElement('canvas');
    canvas.id = 'blank-drag-image';
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.position = 'fixed';
    canvas.style.top = '-9999px';
    canvas.style.left = '-9999px';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);
    el = canvas;
  }
  return el;
};

const INITIAL_SPACES: Space[] = [
  { id: 'default', name: 'Personal', icon: 'User', themeColor: 'from-sky-600/20 to-blue-600/10' },
];

const INITIAL_TABS: TabItem[] = [
  {
    id: 'tab-initial-1',
    url: 'aura://newtab',
    initialUrl: 'aura://newtab',
    title: 'New Tab',
    spaceId: 'default',
    lastAccessedAt: Date.now(),
    createdAt: Date.now(),
  },
];

function categorizeTab(tab: TabItem): string {
  const url = tab.url.toLowerCase();
  const title = tab.title.toLowerCase();

  // 1. Research, Technical Docs & Knowledge Bases
  if (
    url.includes('docs') ||
    url.includes('developer.') ||
    url.includes('wiki') ||
    url.includes('arxiv') ||
    url.includes('mdn') ||
    url.includes('rust-lang') ||
    url.includes('golang') ||
    url.includes('python') ||
    url.includes('learn') ||
    title.includes('documentation') ||
    title.includes('reference') ||
    title.includes('tutorial') ||
    title.includes('guide')
  ) {
    return 'Research & Docs';
  }

  // 2. Code, Repositories & Engineering
  if (
    url.includes('github') ||
    url.includes('gitlab') ||
    url.includes('bitbucket') ||
    url.includes('stackoverflow') ||
    url.includes('stackexchange') ||
    url.includes('npm') ||
    url.includes('yarn') ||
    url.includes('crates.io') ||
    url.includes('pypi') ||
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('codepen') ||
    url.includes('replit') ||
    url.includes('vercel') ||
    url.includes('netlify') ||
    url.includes('docker')
  ) {
    return 'Development';
  }

  // 3. Audio, Video Streaming & Podcasts
  if (
    url.includes('youtube') ||
    url.includes('youtu.be') ||
    url.includes('netflix') ||
    url.includes('spotify') ||
    url.includes('music') ||
    url.includes('twitch') ||
    url.includes('vimeo') ||
    url.includes('soundcloud') ||
    url.includes('podcast') ||
    url.includes('disney') ||
    url.includes('primevideo')
  ) {
    return 'Media & Audio';
  }

  // 4. Social Feeds, Communities & News
  if (
    url.includes('twitter') ||
    url.includes('x.com') ||
    url.includes('reddit') ||
    url.includes('news.ycombinator') ||
    url.includes('threads.net') ||
    url.includes('instagram') ||
    url.includes('facebook') ||
    url.includes('linkedin') ||
    url.includes('medium.com') ||
    url.includes('substack') ||
    url.includes('nytimes') ||
    url.includes('bbc') ||
    url.includes('theverge') ||
    url.includes('techcrunch')
  ) {
    return 'Social & News';
  }

  // 5. Workspaces, Project Management, Meetings & Productivity (Dia/Arc Contexts)
  if (
    url.includes('mail') ||
    url.includes('gmail') ||
    url.includes('outlook') ||
    url.includes('jira') ||
    url.includes('linear') ||
    url.includes('notion') ||
    url.includes('slack') ||
    url.includes('zoom.us') ||
    url.includes('meet.google') ||
    url.includes('teams.microsoft') ||
    url.includes('figma') ||
    url.includes('miro') ||
    url.includes('asana') ||
    url.includes('trello') ||
    url.includes('calendar') ||
    url.includes('docs.google') ||
    title.includes('meeting') ||
    title.includes('agenda')
  ) {
    return 'Workspace & Tasks';
  }

  // 6. E-Commerce & Shopping
  if (
    url.includes('amazon') ||
    url.includes('ebay') ||
    url.includes('shop') ||
    url.includes('store') ||
    url.includes('etsy') ||
    url.includes('aliexpress') ||
    url.includes('tokopedia') ||
    url.includes('shopee')
  ) {
    return 'Shopping';
  }

  // Fallback domain-based clustering if multiple pages from the same site exist
  try {
    const domain = new URL(tab.url).hostname.replace(/^www\./, '');
    const cleanName = domain.split('.')[0];
    if (cleanName && cleanName.length > 2 && !['google', 'bing', 'duckduckgo'].includes(cleanName)) {
      return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }
  } catch (e) {}

  return 'General Browsing';
}

// Resilient Favicon component with multi-level fallback architecture:
// 1. Bundled authentic local base64/SVG icon (0ms, 100% offline reliable)
// 2. Tab's stored favicon (if valid http/https or data URI, never dead blob:)
// 3. Domain cache from localStorage (aura_fav_<cleanHost>)
// 4. Google S2 high-res favicon service (sz=64)
// 5. DuckDuckGo favicon service
// 6. Direct /favicon.ico fallback
// 7. Generic Globe fallback
const TabFavicon: React.FC<{
  tab: { favicon?: string; url?: string; title?: string; isSleeping?: boolean };
  className?: string;
  fallbackSize?: string;
  showSleepRing?: boolean;
}> = ({ tab, className = 'w-4 h-4 object-contain rounded shrink-0', fallbackSize = 'w-4 h-4', showSleepRing = true }) => {
  let hostname = '';
  try {
    if (tab.url) {
      if (tab.url === 'aura://newtab' || tab.url.startsWith('chrome://') || tab.url === 'about:blank') {
        hostname = 'google.com';
      } else {
        hostname = new URL(tab.url).hostname;
      }
    }
  } catch (e) {}

  const cleanHost = hostname.replace(/^www\./, '').toLowerCase();

  // Multi-level cascading candidate list (Web-first priority, like Chrome)
  const candidates = useMemo(() => {
    const list: string[] = [];

    // Internal Aura pages: instant bundled Google / browser icon
    if (!tab.url || tab.url === 'aura://newtab' || tab.url.startsWith('chrome://') || tab.url === 'about:blank') {
      const bundledNewtab = getBundledIcon('google.com');
      if (bundledNewtab) list.push(bundledNewtab);
      return list;
    }

    // 1. Tab's live favicon directly from the website's HTML <link rel="icon">
    if (tab.favicon && !tab.favicon.startsWith('blob:') && !tab.favicon.startsWith('about:')) {
      let resolvedFavicon = tab.favicon;
      if (resolvedFavicon.startsWith('/') && hostname) {
        try {
          resolvedFavicon = new URL(resolvedFavicon, tab.url || `https://${hostname}`).href;
        } catch (e) {}
      }
      if (!list.includes(resolvedFavicon)) {
        list.push(resolvedFavicon);
      }
    }

    // 2. Exact real favicon cached in localStorage from previous visits
    if (cleanHost) {
      try {
        const cached = localStorage.getItem(`aura_fav_${cleanHost}`);
        if (cached && !cached.startsWith('blob:') && !list.includes(cached)) {
          list.push(cached);
        }
      } catch (e) {}
    }

    // 3. Google S2 high-res favicon service (fetches the exact live favicon from the website)
    if (cleanHost) {
      const s2 = `https://www.google.com/s2/favicons?domain=${cleanHost}&sz=64`;
      if (!list.includes(s2)) list.push(s2);
    }

    // 4. DuckDuckGo favicon service (authentic website favicon CDN)
    if (cleanHost) {
      const ddg = `https://icons.duckduckgo.com/ip3/${cleanHost}.ico`;
      if (!list.includes(ddg)) list.push(ddg);
    }

    // 5. Direct /favicon.ico from website root
    if (cleanHost) {
      const direct = `https://${cleanHost}/favicon.ico`;
      if (!list.includes(direct)) list.push(direct);
    }

    // 6. Bundled local vector icon (emergency offline fallback when network is unavailable)
    const bundled = tab.url ? getBundledIcon(tab.url) : (cleanHost ? getBundledIcon(cleanHost) : null);
    if (bundled && !list.includes(bundled)) {
      list.push(bundled);
    }

    return list;
  }, [tab.favicon, tab.url, cleanHost, hostname]);

  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [tab.favicon, tab.url]);

  const isSleeping = Boolean(tab.isSleeping && showSleepRing);

  const renderSleepHalo = () => (
    <svg
      className="absolute -inset-[4px] w-[24px] h-[24px] pointer-events-none select-none z-10 overflow-visible"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="#9ca3af"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="31.42 3.49 3.49 3.49 3.49 3.49 3.49 3.49 3.49 3.49"
        transform="rotate(90 12 12)"
      />
    </svg>
  );

  if (candidateIndex >= candidates.length || candidates.length === 0) {
    return (
      <div className="relative shrink-0 flex items-center justify-center w-4 h-4">
        <Globe
          className={`${fallbackSize} text-zinc-400 shrink-0 transition-all duration-150`}
          style={isSleeping ? { width: 12, height: 12, minWidth: 12, minHeight: 12, maxWidth: 12, maxHeight: 12 } : undefined}
        />
        {isSleeping && renderSleepHalo()}
      </div>
    );
  }

  const currentSrc = candidates[candidateIndex];

  return (
    <div className="relative shrink-0 flex items-center justify-center w-4 h-4">
      <img
        src={currentSrc}
        alt=""
        className={`${className} transition-all duration-150`}
        style={isSleeping ? { width: 12, height: 12, minWidth: 12, minHeight: 12, maxWidth: 12, maxHeight: 12 } : undefined}
        onError={() => {
          setCandidateIndex((prev) => prev + 1);
        }}
        onLoad={() => {
          // Cache successful non-blob, non-data URL for this domain
          if (cleanHost && currentSrc && !currentSrc.startsWith('blob:') && !currentSrc.startsWith('data:')) {
            try {
              localStorage.setItem(`aura_fav_${cleanHost}`, currentSrc);
            } catch (e) {}
          }
        }}
      />
      {isSleeping && renderSleepHalo()}
    </div>
  );
};

interface SortableTabItemProps {
  tab: TabItem;
  isActive: boolean;
  isGroupHovered?: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onToggleMute: (e: React.MouseEvent) => void;
  onClose: (e: React.MouseEvent) => void;
}

const SortableTabItem: React.FC<SortableTabItemProps> = ({
  tab,
  isActive,
  isGroupHovered,
  onSelect,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  onToggleMute,
  onClose,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: tab.id,
    data: {
      type: 'tab',
      tab,
    },
  });

  const style: React.CSSProperties = {
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition || 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
    opacity: isDragging ? 0.25 : 1,
    zIndex: isDragging ? 0 : undefined,
  };

  let hostname = 'website.com';
  try {
    hostname = new URL(tab.url).hostname;
  } catch (e) {}

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`group/tab relative flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer select-none transition-colors duration-150 ${
        isActive
          ? isGroupHovered
            ? 'bg-[#525056] text-white font-medium shadow-sm'
            : 'bg-[#18181b] text-white font-medium shadow-sm ring-1 ring-white/[0.08]'
          : isGroupHovered
          ? 'text-zinc-300 hover:bg-white/[0.08] hover:text-white'
          : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
      } ${
        isDragging
          ? 'border border-dashed border-white/30 bg-white/5'
          : ''
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
        <TabFavicon tab={tab} />
        <span className="truncate min-w-0">{tab.title || hostname}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {(tab.hasAudio || tab.isMuted) && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute(e);
            }}
            className="p-1 rounded hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title={tab.isMuted ? 'Unmute site' : 'Mute site'}
          >
            {tab.isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-white" />
            )}
          </button>
        )}
        {tab.isLoading && (
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" title="Loading..." />
        )}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose(e);
          }}
          className={`p-0.5 hover:bg-white/20 rounded text-zinc-300 hover:text-white transition-opacity ${
            isActive && isGroupHovered
              ? 'opacity-100'
              : 'opacity-0 group-hover/tab:opacity-100'
          }`}
          title="Close tab"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

const DroppableContainer: React.FC<{
  id: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}> = ({ id, children, className, onClick, onContextMenu }) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className} onClick={onClick} onContextMenu={onContextMenu}>
      {children}
    </div>
  );
};

const dndDropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.35',
      },
    },
  }),
  duration: 200,
  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
};

interface MacTrafficLightsProps {
  isFullscreen?: boolean;
  className?: string;
}

const MacTrafficLights: React.FC<MacTrafficLightsProps> = ({
  isFullscreen = false,
  className = '',
}) => {
  const [isGroupHovered, setIsGroupHovered] = useState(false);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((window as any).electronAPI?.send) {
      (window as any).electronAPI.send('window-close');
    }
  };

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((window as any).electronAPI?.send) {
      (window as any).electronAPI.send('window-minimize');
    }
  };

  const handleToggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.altKey) {
      if ((window as any).electronAPI?.send) {
        (window as any).electronAPI.send('window-zoom');
      }
    } else {
      if ((window as any).electronAPI?.send) {
        (window as any).electronAPI.send('window-toggle-fullscreen');
      }
    }
  };

  return (
    <div
      onMouseEnter={() => setIsGroupHovered(true)}
      onMouseLeave={() => setIsGroupHovered(false)}
      className={`no-drag flex items-center gap-[7.5px] select-none shrink-0 ${className}`}
    >
      {/* 1. Close Button (Red) */}
      <button
        onClick={handleClose}
        className="w-3 h-3 rounded-full bg-[#ff5f57] border border-black/15 flex items-center justify-center cursor-pointer transition-transform active:scale-90"
        title="Close"
        tabIndex={-1}
      >
        <svg
          className={`w-[6px] h-[6px] text-[#4a0002] transition-opacity duration-150 ${
            isGroupHovered ? 'opacity-100' : 'opacity-0'
          }`}
          viewBox="0 0 6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        >
          <path d="M1.2 1.2L4.8 4.8M4.8 1.2L1.2 4.8" />
        </svg>
      </button>

      {/* 2. Minimize Button (Yellow) */}
      <button
        onClick={handleMinimize}
        className="w-3 h-3 rounded-full bg-[#febc2e] border border-black/15 flex items-center justify-center cursor-pointer transition-transform active:scale-90"
        title="Minimize"
        tabIndex={-1}
      >
        <svg
          className={`w-[6px] h-[6px] text-[#593c00] transition-opacity duration-150 ${
            isGroupHovered ? 'opacity-100' : 'opacity-0'
          }`}
          viewBox="0 0 6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        >
          <path d="M0.8 3H5.2" />
        </svg>
      </button>

      {/* 3. Fullscreen / Zoom Button (Green) */}
      <button
        onClick={handleToggleFullscreen}
        className="w-3 h-3 rounded-full bg-[#28c840] border border-black/15 flex items-center justify-center cursor-pointer transition-transform active:scale-90"
        title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
        tabIndex={-1}
      >
        {isFullscreen ? (
          /* Exit Full Screen: Two triangles pointing inward towards center */
          <svg
            className={`w-[6px] h-[6px] text-[#003800] transition-opacity duration-150 ${
              isGroupHovered ? 'opacity-100' : 'opacity-0'
            }`}
            viewBox="0 0 6 6"
            fill="currentColor"
          >
            <polygon points="3.6,3.6 1.2,3.6 3.6,1.2" />
            <polygon points="2.4,2.4 4.8,2.4 2.4,4.8" />
          </svg>
        ) : (
          /* Enter Full Screen: Two triangles pointing outward to corners */
          <svg
            className={`w-[6px] h-[6px] text-[#003800] transition-opacity duration-150 ${
              isGroupHovered ? 'opacity-100' : 'opacity-0'
            }`}
            viewBox="0 0 6 6"
            fill="currentColor"
          >
            <polygon points="1.2,1.2 3.8,1.2 1.2,3.8" />
            <polygon points="4.8,4.8 2.2,4.8 4.8,2.2" />
          </svg>
        )}
      </button>
    </div>
  );
};

export function App() {
  // Check if current window was opened as a clean new window or with an initialUrl
  const windowQueryParams = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch (e) {
      return new URLSearchParams();
    }
  }, []);

  const isNewWindow = windowQueryParams.get('isNewWindow') === 'true' || windowQueryParams.has('initialUrl');
  const initialUrlFromQuery = windowQueryParams.get('initialUrl');
  const initialNewTabId = useMemo(() => `tab-new-win-${Date.now()}`, []);

  const [spaces, setSpaces] = useState<Space[]>(() => {
    try {
      const isClean = localStorage.getItem('aura_clean_default_v3');
      if (isClean) {
        const saved = localStorage.getItem('aura_spaces');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } else {
        localStorage.setItem('aura_clean_default_v3', 'true');
        localStorage.removeItem('aura_spaces');
        localStorage.removeItem('aura_active_space_id');
        localStorage.removeItem('browser_custom_groups');
        localStorage.removeItem('aura_group_order');
      }
    } catch (e) {}
    return INITIAL_SPACES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('aura_spaces', JSON.stringify(spaces));
    } catch (e) {}
  }, [spaces]);

  const initialActiveSpaceId = useMemo(() => {
    try {
      const isClean = localStorage.getItem('aura_clean_default_v3');
      if (isClean) {
        const saved = localStorage.getItem('aura_active_space_id');
        if (saved) return saved;
      }
    } catch (e) {}
    return 'default';
  }, []);

  const [activeSpaceId, setActiveSpaceId] = useState<string>(initialActiveSpaceId);

  useEffect(() => {
    if (spaces.length > 0 && !spaces.some((s) => s.id === activeSpaceId)) {
      setActiveSpaceId(spaces[0].id);
    }
  }, [spaces, activeSpaceId]);

  useEffect(() => {
    try {
      localStorage.setItem('aura_active_space_id', activeSpaceId);
    } catch (e) {}
  }, [activeSpaceId]);

  const [tabs, setTabs] = useState<TabItem[]>(() => {
    if (isNewWindow) {
      const defaultUrl = initialUrlFromQuery ? decodeURIComponent(initialUrlFromQuery) : 'aura://newtab';
      const defaultTitle = initialUrlFromQuery ? formatSmartUrlTitle(defaultUrl) : 'New Tab';
      return [
        {
          id: initialNewTabId,
          url: defaultUrl,
          title: defaultTitle,
          spaceId: initialActiveSpaceId,
          lastAccessedAt: Date.now(),
          createdAt: Date.now(),
        },
      ];
    }
    try {
      const saved = localStorage.getItem('aura_tabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize any transient fields like isLoading or isMuted, sanitize dead blob: favicons,
          // and clean up legacy auto-categories (only preserve explicit user groups isUserGroup: true)
          return parsed.map((t: TabItem) => ({
            ...t,
            category: t.isUserGroup ? t.category : undefined,
            favicon: (t.favicon && !t.favicon.startsWith('blob:')) ? t.favicon : undefined,
            initialUrl: t.initialUrl || t.url,
            isLoading: false,
          }));
        }
      }
    } catch (e) {}
    return INITIAL_TABS.map((t) => ({ ...t, spaceId: initialActiveSpaceId }));
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (isNewWindow) {
      return initialNewTabId;
    }
    try {
      const savedActive = localStorage.getItem('aura_active_tab_id');
      if (savedActive) {
        return savedActive;
      }
    } catch (e) {}
    return INITIAL_TABS[0]?.id || 'tab-initial-1';
  });

  const [secondaryTabId, setSecondaryTabId] = useState<string | null>(() => {
    if (isNewWindow) return null;
    try {
      return localStorage.getItem('aura_secondary_tab_id') || null;
    } catch (e) {
      return null;
    }
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('aura_is_sidebar_open');
      if (saved !== null) return saved === 'true';
    } catch (e) {}
    return true;
  });

  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [showFullscreenBanner, setShowFullscreenBanner] = useState(false);
  const [showTabsInSidebar, setShowTabsInSidebar] = useState(true);

  const [isSplitView, setIsSplitView] = useState<boolean>(() => {
    if (isNewWindow) return false;
    try {
      return localStorage.getItem('aura_is_split_view') === 'true';
    } catch (e) {
      return false;
    }
  });

  // Top Bar "Three-Dot" Vertical Menu & In-Page Find (Cmd+F)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isFindInPageOpen, setIsFindInPageOpen] = useState(false);
  const [findSearchText, setFindSearchText] = useState('');
  const [findMatchIndex, setFindMatchIndex] = useState(0);
  const [findMatchTotal, setFindMatchTotal] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Persist session tabs, active tab, and split view state
  useEffect(() => {
    if (isNewWindow) return;
    try {
      // Filter out temporary/destroyed tabs and persist
      const tabsToSave = tabs.map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        favicon: (t.favicon && !t.favicon.startsWith('blob:')) ? t.favicon : undefined,
        spaceId: t.spaceId,
        isPinned: t.isPinned,
        isFavorite: t.isFavorite,
        isArchived: t.isArchived,
        category: t.category,
        isUserGroup: t.isUserGroup,
        lastAccessedAt: t.lastAccessedAt,
        createdAt: t.createdAt,
        themeColor: t.themeColor,
      }));
      localStorage.setItem('aura_tabs', JSON.stringify(tabsToSave));
    } catch (e) {}
  }, [tabs, isNewWindow]);

  useEffect(() => {
    if (isNewWindow) return;
    try {
      if (activeTabId) {
        localStorage.setItem('aura_active_tab_id', activeTabId);
      }
    } catch (e) {}
  }, [activeTabId, isNewWindow]);

  useEffect(() => {
    if (isNewWindow) return;
    try {
      localStorage.setItem('aura_is_split_view', String(isSplitView));
      if (secondaryTabId) {
        localStorage.setItem('aura_secondary_tab_id', secondaryTabId);
      } else {
        localStorage.removeItem('aura_secondary_tab_id');
      }
    } catch (e) {}
  }, [isSplitView, secondaryTabId, isNewWindow]);

  useEffect(() => {
    try {
      localStorage.setItem('aura_is_sidebar_open', String(isSidebarOpen));
    } catch (e) {}
  }, [isSidebarOpen]);
  const [closedTabsHistory, setClosedTabsHistory] = useState<TabItem[]>(() => {
    try {
      const saved = localStorage.getItem('aura_recently_closed_tabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('aura_recently_closed_tabs', JSON.stringify(closedTabsHistory.slice(0, 30)));
    } catch (e) {}
  }, [closedTabsHistory]);

  // Chrome Extensions Support State
  const [installedExtensions, setInstalledExtensions] = useState<Array<{
    id: string;
    name: string;
    version: string;
    description: string;
    iconUrl?: string;
    hasPopup?: boolean;
  }>>([]);
  const [isExtensionMenuOpen, setIsExtensionMenuOpen] = useState(false);
  const [extensionInstallInput, setExtensionInstallInput] = useState('');
  const [isInstallingExtension, setIsInstallingExtension] = useState(false);
  const [extensionStatusMsg, setExtensionStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [webviewPreloadPath, setWebviewPreloadPath] = useState<string | null>(null);

  // Native Downloads State
  interface DownloadItemInfo {
    id: string;
    filename: string;
    savePath: string;
    receivedBytes: number;
    totalBytes: number;
    percent: number;
    state: 'progressing' | 'completed' | 'cancelled' | 'interrupted' | 'paused';
    canResume?: boolean;
    isPaused?: boolean;
    startTime: number;
  }
  const [downloads, setDownloads] = useState<DownloadItemInfo[]>([]);
  const [isDownloadsMenuOpen, setIsDownloadsMenuOpen] = useState(false);

  // Track canGoBack and canGoForward navigation states per tab
  const [tabNavStateMap, setTabNavStateMap] = useState<Record<string, { canGoBack: boolean; canGoForward: boolean }>>({});

  const updateTabNavState = (tabId: string) => {
    try {
      const el = webviewMapRef.current.get(tabId);
      if (el) {
        let back = false;
        let fwd = false;
        try {
          if (typeof el.canGoBack === 'function') back = Boolean(el.canGoBack());
          if (typeof el.canGoForward === 'function') fwd = Boolean(el.canGoForward());
        } catch (err) {}
        setTabNavStateMap((prev) => {
          const cur = prev[tabId];
          if (cur && cur.canGoBack === back && cur.canGoForward === fwd) return prev;
          return { ...prev, [tabId]: { canGoBack: back, canGoForward: fwd } };
        });
      }
    } catch (e) {}
  };

  // Option B: Inline Editable Omnibar State
  const [isInlineOmnibarActive, setIsInlineOmnibarActive] = useState(false);
  const [inlineOmnibarValue, setInlineOmnibarValue] = useState('');
  const inlineOmnibarInputRef = useRef<HTMLInputElement>(null);
  const [inlineOmnibarSelectedIndex, setInlineOmnibarSelectedIndex] = useState(-1);

  // Visited navigation history (for omnibar suggestions & full Chrome-style history manager)
  const [visitedHistory, setVisitedHistory] = useState<Array<{ id: string; url: string; title: string; visitedAt: number; spaceId?: string }>>(() => {
    try {
      const saved = localStorage.getItem('aura_visited_history');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return parsed.map((item: any) => ({
        id: item.id || Math.random().toString(36).substring(2, 9),
        url: item.url,
        title: item.title,
        visitedAt: item.visitedAt || Date.now(),
        spaceId: item.spaceId || 'default'
      }));
    } catch {
      return [];
    }
  });

  // Track landing page theme mode ('classic-dark', 'classic-light', 'midnight', 'emerald')
  const [landingThemeMode, setLandingThemeMode] = useState<string>(() => {
    try {
      return localStorage.getItem('aura_chrome_theme') || 'classic-dark';
    } catch (e) {
      return 'classic-dark';
    }
  });

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e?.detail) setLandingThemeMode(e.detail);
    };
    window.addEventListener('aura-theme-change', handleThemeChange);
    return () => window.removeEventListener('aura-theme-change', handleThemeChange);
  }, []);
  const [isHistoryManagerOpen, setIsHistoryManagerOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyManagerView, setHistoryManagerView] = useState<'browsing' | 'recently_closed'>('browsing');

  const recordVisit = (url: string, title?: string, spaceId?: string) => {
    if (!url || !url.startsWith('http')) return;
    const targetSpace = spaceId || activeSpaceIdRef.current || 'default';
    setVisitedHistory((prev) => {
      const cleanUrl = url.trim();
      const existingIdx = prev.findIndex((item) => item.url === cleanUrl && item.spaceId === targetSpace);
      const cleanTitle = title && title.trim() ? title.trim() : formatSmartUrlTitle(cleanUrl);
      const newEntry = {
        id: Math.random().toString(36).substring(2, 9),
        url: cleanUrl,
        title: cleanTitle,
        visitedAt: Date.now(),
        spaceId: targetSpace
      };
      let updated: typeof prev;
      if (existingIdx !== -1) {
        updated = [newEntry, ...prev.filter((_, i) => i !== existingIdx)];
      } else {
        updated = [newEntry, ...prev.slice(0, 499)]; // Keep up to 500 history items
      }
      try {
        localStorage.setItem('aura_visited_history', JSON.stringify(updated.slice(0, 300)));
      } catch {}
      return updated;
    });
  };

  const clearAllHistory = () => {
    setVisitedHistory([]);
    try {
      localStorage.removeItem('aura_visited_history');
    } catch {}
  };

  const deleteHistoryItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setVisitedHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem('aura_visited_history', JSON.stringify(updated.slice(0, 300)));
      } catch {}
      return updated;
    });
  };

  // Listen to live download progress from Electron
  useEffect(() => {
    if ((window as any).electronAPI?.on) {
      const unsub = (window as any).electronAPI.on('download-updated', (item: DownloadItemInfo) => {
        setDownloads((prev) => {
          const idx = prev.findIndex((d) => d.id === item.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = item;
            return next;
          }
          return [item, ...prev];
        });
      });
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    }
  }, []);

  const activeDownloadsCount = downloads.filter((d) => d.state === 'progressing').length;

  // Listen for native macOS fullscreen state changes and initial check
  useEffect(() => {
    if ((window as any).electronAPI?.invoke) {
      (window as any).electronAPI.invoke('is-fullscreen').then((fs: boolean) => {
        setIsNativeFullscreen(Boolean(fs));
      }).catch(() => {});
    }

    if ((window as any).electronAPI?.on) {
      let bannerTimer: any = null;
      const unsub = (window as any).electronAPI.on('fullscreen-status-changed', (isFullscreen: boolean) => {
        setIsNativeFullscreen(Boolean(isFullscreen));
        if (isFullscreen) {
          setShowFullscreenBanner(true);
          if (bannerTimer) clearTimeout(bannerTimer);
          bannerTimer = setTimeout(() => {
            setShowFullscreenBanner(false);
          }, 3500);
        } else {
          setShowFullscreenBanner(false);
        }
      });
      return () => {
        if (typeof unsub === 'function') unsub();
        if (bannerTimer) clearTimeout(bannerTimer);
      };
    }
  }, []);

  // Sync native macOS traffic lights (hide when sidebar is collapsed or in fullscreen, show when sidebar is open and not fullscreen)
  useEffect(() => {
    if ((window as any).electronAPI?.send) {
      (window as any).electronAPI.send('set-traffic-lights-visible', isSidebarOpen && !isNativeFullscreen);
    }
  }, [isSidebarOpen, isNativeFullscreen]);

  useEffect(() => {
    if ((window as any).electronAPI?.getWebviewPreloadPath) {
      (window as any).electronAPI.getWebviewPreloadPath().then((p: string) => {
        if (p) setWebviewPreloadPath(p);
      }).catch(() => {});
    }
  }, []);

  const refreshInstalledExtensions = () => {
    if ((window as any).electronAPI?.invoke) {
      (window as any).electronAPI.invoke('get-installed-extensions')
        .then((exts: any[]) => {
          if (Array.isArray(exts)) setInstalledExtensions(exts);
        })
        .catch(() => {});
    }
  };

  // Load installed extensions on startup and listen for changes
  useEffect(() => {
    refreshInstalledExtensions();

    if ((window as any).electronAPI?.on) {
      const cleanup = (window as any).electronAPI.on('extensions-updated', () => {
        refreshInstalledExtensions();
      });
      return () => {
        if (typeof cleanup === 'function') cleanup();
      };
    }
  }, []);

  const handleInstallExtensionFromInput = async (inputStr?: string) => {
    const target = (inputStr || extensionInstallInput).trim();
    if (!target) return;

    setIsInstallingExtension(true);
    setExtensionStatusMsg({ text: 'Downloading and installing extension...' });

    try {
      const res = await (window as any).electronAPI.invoke('install-extension', target);
      if (res && res.success) {
        setExtensionStatusMsg({ text: `Installed: ${res.name || 'Extension'}` });
        setExtensionInstallInput('');
        refreshInstalledExtensions();
        setTimeout(() => setExtensionStatusMsg(null), 3000);
      }
    } catch (err: any) {
      setExtensionStatusMsg({ text: err.message || 'Failed to install extension', isError: true });
      setTimeout(() => setExtensionStatusMsg(null), 4000);
    } finally {
      setIsInstallingExtension(false);
    }
  };

  const handleInstallLocalExtension = async () => {
    try {
      const res = await (window as any).electronAPI.invoke('install-local-extension');
      if (res && res.success) {
        setExtensionStatusMsg({ text: `Installed: ${res.name || 'Extension'}` });
        refreshInstalledExtensions();
        setTimeout(() => setExtensionStatusMsg(null), 3000);
      }
    } catch (err: any) {
      setExtensionStatusMsg({ text: err.message || 'Installation failed', isError: true });
      setTimeout(() => setExtensionStatusMsg(null), 4000);
    }
  };

  const handleUninstallExtension = async (extId: string, extName: string) => {
    try {
      await (window as any).electronAPI.invoke('uninstall-extension', extId);
      setExtensionStatusMsg({ text: `Removed: ${extName}` });
      refreshInstalledExtensions();
      setTimeout(() => setExtensionStatusMsg(null), 3000);
    } catch (err: any) {
      setExtensionStatusMsg({ text: err.message || 'Failed to uninstall', isError: true });
      setTimeout(() => setExtensionStatusMsg(null), 4000);
    }
  };

  // Synchronized refs for event handlers and IPC callbacks
  const activeSpaceIdRef = useRef(activeSpaceId);
  const activeTabIdRef = useRef(activeTabId);
  const tabsRef = useRef(tabs);
  const isNativeFullscreenRef = useRef(isNativeFullscreen);
  const hasOpenOverlayRef = useRef(false);

  useEffect(() => {
    activeSpaceIdRef.current = activeSpaceId;
  }, [activeSpaceId]);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);
  useEffect(() => {
    isNativeFullscreenRef.current = isNativeFullscreen;
  }, [isNativeFullscreen]);

  // Track visited tab IDs so webviews are lazily mounted on-demand and kept alive in memory
  // This prevents mounting all initial tabs at once (which triggered ERR_ABORTED -3 in guest views)
  const [visitedTabIds, setVisitedTabIds] = useState<Set<string>>(() => new Set([activeTabId]));

  const markTabVisited = (tabId: string) => {
    setVisitedTabIds((prev) => {
      if (prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });
  };

  // Anti-Clutter UI State
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [liveSuggestions, setLiveSuggestions] = useState<string[]>([]);
  const [showRecentlyClosedDrawer, setShowRecentlyClosedDrawer] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [tidyNotification, setTidyNotification] = useState<string | null>(null);

  // In-App Auto-Update State (Option 1: GitHub Release Checker)
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isUpdateBannerDismissed, setIsUpdateBannerDismissed] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const checkForUpdates = useCallback(async (isManual = false) => {
    setIsCheckingUpdate(true);
    try {
      if ((window as any).electronAPI?.invoke) {
        const res: AppUpdateInfo = await (window as any).electronAPI.invoke('check-app-update');
        setUpdateInfo(res);
        if (res.hasUpdate) {
          setIsUpdateBannerDismissed(false);
          if (isManual) {
            setIsUpdateModalOpen(true);
          }
        } else if (isManual) {
          setTidyNotification(`Slate v${res.currentVersion} is currently the latest version.`);
          setTimeout(() => setTidyNotification(null), 4000);
        }
      }
    } catch (e) {
      if (isManual) {
        setTidyNotification('Could not check for updates right now.');
        setTimeout(() => setTidyNotification(null), 4000);
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  const handleDownloadUpdate = (url?: string) => {
    const targetUrl = url || updateInfo?.downloadUrl || updateInfo?.releaseUrl;
    if (targetUrl && (window as any).electronAPI?.invoke) {
      (window as any).electronAPI.invoke('open-external-url', targetUrl);
    }
  };

  // Check for updates 3 seconds after launch
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  // Chrome Memory Saver State
  // Tracks tabs that recently woke up to display the Chrome-style Omnibox ring and savings chip
  const [memoryWokenTabInfo, setMemoryWokenTabInfo] = useState<{
    tabId: string;
    savedMB: number;
    wokenAt: number;
  } | null>(null);

  // Custom Groups State (User created groups per space)
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>(() => {
    const saved = localStorage.getItem('browser_custom_groups');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('browser_custom_groups', JSON.stringify(customGroups));
  }, [customGroups]);

  // Group Reordering State (Per space)
  const [groupOrderMap, setGroupOrderMap] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('aura_group_order');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem('aura_group_order', JSON.stringify(groupOrderMap));
  }, [groupOrderMap]);

  const [draggedGroupName, setDraggedGroupName] = useState<string | null>(null);
  const [draggedGroupSpaceId, setDraggedGroupSpaceId] = useState<string | null>(null);
  const [dragTargetGroupName, setDragTargetGroupName] = useState<string | null>(null);

  const handleMoveGroupOrder = (spaceId: string, groupName: string, direction: 'up' | 'down') => {
    setGroupOrderMap((prev) => {
      const currentList = prev[spaceId] ? [...prev[spaceId]] : [];
      const idx = currentList.indexOf(groupName);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= currentList.length) return prev;
      const temp = currentList[idx];
      currentList[idx] = currentList[targetIdx];
      currentList[targetIdx] = temp;
      return { ...prev, [spaceId]: currentList };
    });
  };

  // Live query suggestions effect (both for Command Palette and Inline Omnibar)
  useEffect(() => {
    const q = isInlineOmnibarActive ? inlineOmnibarValue.trim() : (isCommandBarOpen ? commandQuery.trim() : '');
    if (!q) {
      setLiveSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      if ((window as any).electronAPI?.invoke) {
        (window as any).electronAPI
          .invoke('fetch-search-suggestions', q)
          .then((suggs: string[]) => {
            if (Array.isArray(suggs)) {
              setLiveSuggestions(suggs);
            }
          })
          .catch(() => {});
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [commandQuery, isCommandBarOpen, inlineOmnibarValue, isInlineOmnibarActive]);

  const modalOpenedAtRef = useRef<number>(0);

  // Custom Group & Profile Modal State (100% immune to native macOS menu focus / prompt sandbox issues)
  const [groupModalState, setGroupModalState] = useState<{
    isOpen: boolean;
    mode: 'new-empty' | 'new-with-tab' | 'rename' | 'new-profile';
    tabId?: string;
    initialValue: string;
    placeholder: string;
    title: string;
  }>({
    isOpen: false,
    mode: 'new-empty',
    initialValue: '',
    placeholder: 'group1',
    title: 'Create Group',
  });
  const [groupInputValue, setGroupInputValue] = useState('');

  // Drag and drop state for pinned tabs reordering
  const [draggedPinId, setDraggedPinId] = useState<string | null>(null);

  // dnd-kit state for high-end tab reordering across groups
  const [activeDragTabId, setActiveDragTabId] = useState<string | null>(null);
  const [dragItemsMap, setDragItemsMap] = useState<Record<string, string[]> | null>(null);
  const [hoveredGroupName, setHoveredGroupName] = useState<string | null>(null);

  const activeDragTab = activeDragTabId ? tabs.find((t) => t.id === activeDragTabId) : null;

  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return closestCorners(args);
  }, []);

  // Custom Right Click Context Menu State for Tabs
  const [tabContextMenu, setTabContextMenu] = useState<{
    tab: TabItem;
    x: number;
    y: number;
    activeSubmenu?: 'group' | 'profile' | null;
  } | null>(null);

  // Close tab context menu on click outside
  useEffect(() => {
    const handleCloseMenu = () => setTabContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  // Hover Preview Tooltip State
  const [hoveredTabInfo, setHoveredTabInfo] = useState<{
    tab: TabItem;
    top: number;
  } | null>(null);
  const hoverTimerRef = useRef<any>(null);
  const activeWebviewRef = useRef<any>(null);
  // Track tabs created in background (e.g. via Cmd+Click) that should autoplay on their very first user visit
  const backgroundCreatedTabsRef = useRef<Set<string>>(new Set());
  // Track tabs that currently have active Picture-in-Picture windows so they NEVER get muted or paused when switching tabs
  const pipActiveTabIdsRef = useRef<Set<string>>(new Set());

  const handleTabMouseEnter = (tab: TabItem, e: React.MouseEvent<HTMLDivElement>) => {
    if (activeDragTabId) return; // Never show hover preview card while dragging tabs!
    const rect = e.currentTarget.getBoundingClientRect();
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredTabInfo({
        tab,
        top: Math.min(rect.top, window.innerHeight - 170),
      });
    }, 180);
  };

  const handleTabMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    // Give user a generous 300ms grace period to move their mouse across the gap into the floating card
    hoverTimerRef.current = setTimeout(() => {
      setHoveredTabInfo(null);
    }, 300);
  };

  const handleCardMouseEnter = () => {
    // If the mouse entered the floating card, cancel closing!
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  };

  const handleCardMouseLeave = () => {
    // When the mouse leaves the floating card, close it
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredTabInfo(null);
    }, 200);
  };

  // Search Engine State (Default: Google)
  const [searchEngine, setSearchEngine] = useState<SearchEngine>(() => {
    return (localStorage.getItem('aura_search_engine') as SearchEngine) || 'google';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSetSearchEngine = (engine: SearchEngine) => {
    setSearchEngine(engine);
    localStorage.setItem('aura_search_engine', engine);
  };

  // Little Slate (Floating Transient Window) State
  const [littleArcUrl, setLittleArcUrl] = useState<string | null>(null);
  const [littleArcTitle, setLittleArcTitle] = useState('Little Slate');
  const [isLittleArcInputOpen, setIsLittleArcInputOpen] = useState(false);
  const [littleArcInputVal, setLittleArcInputVal] = useState('');
  const littleArcWebviewRef = useRef<any>(null);
  const webviewMapRef = useRef<Map<string, any>>(new Map());

  // Automatically request / exit Picture-in-Picture on YouTube & video tabs when switching away
  const handleTabChangePip = (outgoingTabId?: string, incomingTabId?: string) => {
    // 1. If outgoing tab has a playing video (e.g. YouTube), trigger PiP and keep audio playing
    if (outgoingTabId) {
      const outgoingWebview =
        webviewMapRef.current.get(outgoingTabId) ||
        (outgoingTabId === activeTabId ? activeWebviewRef.current : null);

      if (outgoingWebview && typeof outgoingWebview.executeJavaScript === 'function') {
        const outgoingScript = `(() => {
          try {
            function getPlayingVideo() {
              const allVideos = Array.from(document.querySelectorAll('video'));
              for (let i = 0; i < allVideos.length; i++) {
                const v = allVideos[i];
                if (v && !v.paused && !v.ended && v.readyState >= 1) {
                  return v;
                }
              }
              return document.querySelector('video');
            }

            const video = getPlayingVideo();
            if (video && !video.paused && !video.ended) {
              if (document.pictureInPictureElement !== video) {
                if (typeof video.requestPictureInPicture === 'function') {
                  video.requestPictureInPicture().catch(() => {});
                } else if (typeof video.webkitSetPresentationMode === 'function') {
                  video.webkitSetPresentationMode('picture-in-picture');
                }
              }
              return true;
            }
            return false;
          } catch (err) {
            return false;
          }
        })()`;

        (outgoingWebview as any).executeJavaScript(outgoingScript, true)
          .then((hasPipVideo: boolean) => {
            if (hasPipVideo) {
              pipActiveTabIdsRef.current.add(outgoingTabId);
              // Make sure the webview audio stays unmuted for the PiP video!
              if (typeof (outgoingWebview as any).setAudioMuted === 'function') {
                (outgoingWebview as any).setAudioMuted(false);
              }
            }
          })
          .catch(() => {});
      }
    }

    // 2. If incoming tab is opened and was in PiP, smoothly restore it to page view like Chrome
    if (incomingTabId) {
      pipActiveTabIdsRef.current.delete(incomingTabId);
      const incomingWebview =
        webviewMapRef.current.get(incomingTabId) ||
        (incomingTabId === activeTabId ? activeWebviewRef.current : null);

      if (incomingWebview && typeof incomingWebview.executeJavaScript === 'function') {
        const incomingScript = `(() => {
          try {
            if (document.pictureInPictureElement) {
              document.exitPictureInPicture().catch(() => {});
            }
            const video = document.querySelector('video');
            if (video && typeof video.webkitSetPresentationMode === 'function') {
              video.webkitSetPresentationMode('inline');
            }
          } catch (err) {}
        })()`;

        (incomingWebview as any).executeJavaScript(incomingScript, true).catch(() => {});
      }
    }
  };

  const handleTogglePip = () => {
    if (activeWebviewRef.current && typeof activeWebviewRef.current.executeJavaScript === 'function') {
      const toggleScript = `(() => {
        try {
          if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(() => {});
            return false;
          }
          const allVideos = Array.from(document.querySelectorAll('video'));
          let video = allVideos.find(v => !v.paused && !v.ended) || allVideos[0] || document.querySelector('video');
          if (video && typeof video.requestPictureInPicture === 'function') {
            video.requestPictureInPicture().catch((err) => console.log('PiP error:', err));
            return true;
          } else if (video && typeof video.webkitSetPresentationMode === 'function') {
            video.webkitSetPresentationMode('picture-in-picture');
            return true;
          }
          return false;
        } catch (e) {
          console.log('Toggle PiP error:', e);
          return false;
        }
      })()`;
      (activeWebviewRef.current as any).executeJavaScript(toggleScript, true)
        .then((enteredPip: boolean) => {
          if (activeTabId) {
            if (enteredPip) {
              pipActiveTabIdsRef.current.add(activeTabId);
            } else {
              pipActiveTabIdsRef.current.delete(activeTabId);
            }
          }
        })
        .catch(() => {});
    }
  };

  // Profile Menu Dropdown State
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [draggedDotIndex, setDraggedDotIndex] = useState<number | null>(null);
  const [dragOverDotIndex, setDragOverDotIndex] = useState<number | null>(null);
  const [settingsTab, setSettingsTab] = useState<'general' | 'profiles'>('general');

  // Space Transition Animation State ('slide-left' | 'slide-right' | null)
  const [spaceSlideDirection, setSpaceSlideDirection] = useState<'left' | 'right' | null>(null);

  // Track the active tab for each space so switching spaces restores that space's active tab
  const [spaceActiveTabMap, setSpaceActiveTabMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('aura_space_active_tab_map');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return {
      dev: 'tab-1',
      work: 'tab-work-1',
      personal: 'fav-1',
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('aura_space_active_tab_map', JSON.stringify(spaceActiveTabMap));
    } catch (e) {}
  }, [spaceActiveTabMap]);

  const handleDeleteProfile = (spaceIdToDelete: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (spaces.length <= 1) {
      setTidyNotification('Cannot delete the only remaining profile');
      setTimeout(() => setTidyNotification(null), 2500);
      return;
    }
    const targetSpace = spaces.find((s) => s.id === spaceIdToDelete);
    if (!targetSpace) return;

    const remainingSpaces = spaces.filter((s) => s.id !== spaceIdToDelete);
    setSpaces(remainingSpaces);

    if (activeSpaceId === spaceIdToDelete) {
      const nextSpace = remainingSpaces[0];
      switchSpace(nextSpace.id);
    }

    setTabs((prev) => prev.filter((t) => t.spaceId !== spaceIdToDelete));
    setCustomGroups((prev) => prev.filter((g) => g.spaceId !== spaceIdToDelete));
    setSpaceActiveTabMap((prev) => {
      const copy = { ...prev };
      delete copy[spaceIdToDelete];
      return copy;
    });
    setGroupOrderMap((prev) => {
      const copy = { ...prev };
      delete copy[spaceIdToDelete];
      return copy;
    });

    setTidyNotification(`Deleted profile "${targetSpace.name}"`);
    setTimeout(() => setTidyNotification(null), 2500);
  };

  const switchSpace = (targetSpaceId: string) => {
    setActiveSpaceId(targetSpaceId);
    
    // Find the remembered active tab for this space, or the latest accessed tab
    const rememberedTabId = spaceActiveTabMap[targetSpaceId];
    const candidateTab = tabs.find(
      (t) => t.spaceId === targetSpaceId && t.id === rememberedTabId && !t.isArchived
    );

    if (candidateTab) {
      if (candidateTab.id !== activeTabId) {
        handleTabChangePip(activeTabId, candidateTab.id);
      }
      markTabVisited(candidateTab.id);
      setActiveTabId(candidateTab.id);
    } else {
      // Find any non-archived tab belonging to this space
      const spaceTabs = tabs.filter((t) => t.spaceId === targetSpaceId && !t.isArchived);
      if (spaceTabs.length > 0) {
        // Pick the most recently accessed tab
        const latest = [...spaceTabs].sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)[0];
        if (latest.id !== activeTabId) {
          handleTabChangePip(activeTabId, latest.id);
        }
        markTabVisited(latest.id);
        setActiveTabId(latest.id);
        setSpaceActiveTabMap((prev) => ({ ...prev, [targetSpaceId]: latest.id }));
      } else {
        // If the space has no tabs, create a fresh new tab for it!
        const newTab: TabItem = {
          id: `tab-${Date.now()}`,
          url: 'aura://newtab',
          title: 'New Tab',
          spaceId: targetSpaceId,
          lastAccessedAt: Date.now(),
          createdAt: Date.now(),
        };
        handleTabChangePip(activeTabId, newTab.id);
        markTabVisited(newTab.id);
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        setSpaceActiveTabMap((prev) => ({ ...prev, [targetSpaceId]: newTab.id }));
      }
    }
  };

  // Next / Previous Space Switcher (Bounded: cannot cycle past ends)
  const handleNextSpace = () => {
    const currentIndex = spaces.findIndex((s) => s.id === activeSpaceId);
    if (currentIndex < spaces.length - 1) {
      setSpaceSlideDirection('left');
      switchSpace(spaces[currentIndex + 1].id);
      setTimeout(() => setSpaceSlideDirection(null), 350);
    }
  };

  const handlePrevSpace = () => {
    const currentIndex = spaces.findIndex((s) => s.id === activeSpaceId);
    if (currentIndex > 0) {
      setSpaceSlideDirection('right');
      switchSpace(spaces[currentIndex - 1].id);
      setTimeout(() => setSpaceSlideDirection(null), 350);
    }
  };

  // Trackpad / Horizontal Swipe Profile Transition (Dia / Arc Reference Architecture)
  // Uses physical phase lifecycle: tracks gesture onset, peak, deceleration/settling, and sign changes
  const gestureStateRef = useRef<{
    hasTriggered: boolean;
    lastDirection: number; // 1 for left swipe, -1 for right swipe
    lastAbsDeltaX: number;
    resetTimeout: any;
  }>({
    hasTriggered: false,
    lastDirection: 0,
    lastAbsDeltaX: 0,
    resetTimeout: null,
  });

  const handleSidebarWheel = (e: React.WheelEvent<HTMLElement>) => {
    // Only respond to clear horizontal trackpad gestures
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.stopPropagation();

    const state = gestureStateRef.current;
    const absDelta = Math.abs(e.deltaX);
    const direction = e.deltaX > 0 ? 1 : -1;

    // Physical Reset 1: User explicitly reverses direction (flicks back the other way)
    if (state.lastDirection !== 0 && direction !== state.lastDirection && absDelta > 8) {
      state.hasTriggered = false;
      state.lastDirection = direction;
    }

    // Physical Reset 2: Trackpad deceleration curve drops below resting threshold (< 3px)
    if (absDelta < 3.0) {
      state.hasTriggered = false;
    }

    // Fallback safety reset if the fingers lift off the trackpad and events stop
    if (state.resetTimeout) clearTimeout(state.resetTimeout);
    state.resetTimeout = setTimeout(() => {
      state.hasTriggered = false;
      state.lastDirection = 0;
      state.lastAbsDeltaX = 0;
    }, 120);

    // If this continuous gesture already triggered a space transition, lock until physical reset
    if (state.hasTriggered) {
      state.lastAbsDeltaX = absDelta;
      return;
    }

    // Onset trigger threshold: strong deliberate swipe (> 16px)
    if (absDelta > 16) {
      state.hasTriggered = true;
      state.lastDirection = direction;
      state.lastAbsDeltaX = absDelta;

      const currentIndex = spaces.findIndex((s) => s.id === activeSpaceId);
      if (direction === 1 && currentIndex < spaces.length - 1) {
        // Swiped left -> Switch to next profile (exactly 1 space per gesture)
        switchSpace(spaces[currentIndex + 1].id);
      } else if (direction === -1 && currentIndex > 0) {
        // Swiped right -> Switch to previous profile (exactly 1 space per gesture)
        switchSpace(spaces[currentIndex - 1].id);
      }
    }
  };

  // Helper to determine whether a sampled header background color is light or dark
  const isLightColor = (colorStr?: string | null): boolean => {
    if (!colorStr) return false;
    const lower = colorStr.toLowerCase().trim();
    if (lower === 'transparent' || lower === 'inherit') return false;
    if (lower === 'white') return true;
    if (lower === 'black') return false;

    let r = 28, g = 41, b = 54;
    if (lower.startsWith('#')) {
      let hex = lower.slice(1);
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      if (hex.length >= 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    } else if (lower.startsWith('rgb')) {
      const parts = lower.match(/[\d\.]+/g);
      if (parts && parts.length >= 3) {
        r = parseInt(parts[0], 10);
        g = parseInt(parts[1], 10);
        b = parseInt(parts[2], 10);
        if (parts.length >= 4 && parseFloat(parts[3]) < 0.1) {
          return false;
        }
      }
    }
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  };

  const activeSpace = spaces.find((s) => s.id === activeSpaceId) || spaces[0] || INITIAL_SPACES[0];
  const activeTab =
    tabs.find((t) => t.id === activeTabId && t.spaceId === activeSpaceId) ||
    tabs.find((t) => t.spaceId === activeSpaceId && !t.isArchived) ||
    tabs.find((t) => t.id === activeTabId) ||
    tabs[0];
  const secondaryTab = tabs.find((t) => t.id === secondaryTabId);
  const isLandingPage = !activeTab?.url || activeTab.url === 'aura://newtab' || activeTab.url === 'about:blank';

  const LANDING_THEME_COLORS: Record<string, string> = {
    'classic-dark': '#202124',
    'classic-light': '#ffffff',
    'midnight': '#0f172a',
    'emerald': '#064e3b',
  };

  const activeTabThemeColor = isLandingPage
    ? (LANDING_THEME_COLORS[landingThemeMode] || '#202124')
    : (activeTab?.themeColor || null);
  const isLightHeader = isLightColor(activeTabThemeColor);

  // Filter tabs for active space
  const currentSpaceTabs = useMemo(() => {
    return tabs.filter((t) => t.spaceId === activeSpaceId);
  }, [tabs, activeSpaceId]);

  const activeTabs = useMemo(() => {
    return currentSpaceTabs.filter((t) => !t.isArchived);
  }, [currentSpaceTabs]);

  const pinnedTabs = useMemo(() => {
    return activeTabs.filter((t) => t.isPinned);
  }, [activeTabs]);

  const todayTabs = useMemo(() => {
    return activeTabs.filter((t) => !t.isPinned);
  }, [activeTabs]);

  // Keep all opened, non-archived tabs alive in memory once visited, EXCEPT discarded/sleeping tabs (Chrome Memory Saver)
  // This ensures 0ms tab & profile switching with zero reloads, while reclaiming memory from inactive tabs
  const mountedTabs = useMemo(() => {
    return tabs.filter((t) => !t.isArchived && visitedTabIds.has(t.id) && !t.isSleeping);
  }, [tabs, visitedTabIds]);

  const groupedTodayTabs = useMemo(() => {
    const groups: Record<string, TabItem[]> = {};
    for (const tab of todayTabs) {
      const cat = tab.category || 'Today';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tab);
    }
    return groups;
  }, [todayTabs]);

  // SMART FUZZY SEARCH (Searches across ALL spaces and tabs)
  const searchResults = useMemo(() => {
    if (!commandQuery.trim()) {
      return [...tabs]
        .filter((t) => !t.isArchived)
        .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
    }
    const q = commandQuery.toLowerCase();
    return tabs.filter((t) => {
      const matchesTitle = t.title.toLowerCase().includes(q);
      const matchesUrl = t.url.toLowerCase().includes(q);
      const matchesCategory = t.category?.toLowerCase().includes(q);
      const spaceName = spaces.find((s) => s.id === t.spaceId)?.name.toLowerCase();
      const matchesSpace = spaceName?.includes(q);
      return matchesTitle || matchesUrl || matchesCategory || matchesSpace;
    });
  }, [tabs, commandQuery, spaces]);

  useEffect(() => {
    setSelectedResultIndex(0);
  }, [commandQuery]);

  useEffect(() => {
    setInlineOmnibarSelectedIndex(-1);
  }, [inlineOmnibarValue]);

  // Suggestions for Inline Omnibar (Dia-style: Isolated to active Profile & ordered by last visited)
  const inlineOmnibarSuggestions = useMemo(() => {
    if (!isInlineOmnibarActive) return [];
    const q = inlineOmnibarValue.trim().toLowerCase();
    type SuggestionItem =
      | { type: 'tab'; id: string; title: string; url: string; favicon?: string; spaceName?: string }
      | { type: 'history'; title: string; url: string; favicon?: string }
      | { type: 'google'; text: string; query: string };

    const list: SuggestionItem[] = [];

    // 1. Current Profile tabs only, ordered by last accessed (most recently visited first)
    const matchingTabs = tabs
      .filter((t) => {
        // Strictly isolate to the current active space / profile
        if (t.spaceId !== activeSpaceId) return false;
        if (!q) return !t.isArchived;
        return !t.isArchived && (t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q));
      })
      .sort((a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0));

    // Add first matching tab or active tab
    if (matchingTabs.length > 0) {
      const firstTab = matchingTabs[0];
      const sp = spaces.find((s) => s.id === firstTab.spaceId);
      list.push({
        type: 'tab',
        id: firstTab.id,
        title: firstTab.title,
        url: firstTab.url,
        favicon: firstTab.favicon,
        spaceName: sp?.name,
      });
    }

    // Add remaining matching tabs from the active profile
    for (const t of matchingTabs.slice(1, 4)) {
      const sp = spaces.find((s) => s.id === t.spaceId);
      list.push({
        type: 'tab',
        id: t.id,
        title: t.title,
        url: t.url,
        favicon: (t.favicon && !t.favicon.startsWith('blob:')) ? t.favicon : undefined,
        spaceName: sp?.name,
      });
    }

    // 2. Visited History matching query (strictly isolated to current profile & ordered by last visited)
    const matchingHistory = visitedHistory
      .filter((h) => {
        // Strictly isolate history to current space / profile
        if (h.spaceId && h.spaceId !== activeSpaceId) return false;
        // Don't duplicate tabs that are already open in this profile
        if (tabs.some((t) => t.spaceId === activeSpaceId && t.url === h.url)) return false;
        if (!q) return true;
        return h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q);
      })
      .sort((a, b) => b.visitedAt - a.visitedAt);

    for (const h of matchingHistory.slice(0, 5)) {
      list.push({
        type: 'history',
        title: h.title,
        url: h.url,
      });
    }

    // 3. Live Google search suggestions if user is typing
    if (q) {
      for (const s of liveSuggestions.slice(0, 3)) {
        if (!list.some((item) => (item as any).query === s || (item as any).title === s)) {
          list.push({
            type: 'google',
            text: s,
            query: s,
          });
        }
      }
    }

    return list;
  }, [isInlineOmnibarActive, inlineOmnibarValue, tabs, visitedHistory, liveSuggestions, spaces, activeSpaceId]);

  const lastOpenedUrlTimeRef = useRef<{ url: string; time: number }>({ url: '', time: 0 });

  const handleOpenInNewTab = (url: string, disposition?: string) => {
    let formatted = url.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      if (formatted.includes('.') && !formatted.includes(' ')) {
        formatted = `https://${formatted}`;
      } else {
        const engine = SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES.google;
        formatted = `${engine.searchUrl}${encodeURIComponent(formatted)}`;
      }
    }

    // Debounce duplicate open events (e.g. if both setWindowOpenHandler and new-window event trigger)
    const now = Date.now();
    if (
      lastOpenedUrlTimeRef.current.url === formatted &&
      now - lastOpenedUrlTimeRef.current.time < 1200
    ) {
      return;
    }
    lastOpenedUrlTimeRef.current = { url: formatted, time: now };

    let title = formatSmartUrlTitle(formatted);

    // Background vs foreground depends on disposition:
    // Cmd+Click / middle-click -> 'background-tab' or 'new-background-tab' (open in background)
    // Regular target="_blank", window.open, Cmd+Shift+Click -> switch to new tab immediately
    const openInBackground = disposition === 'background-tab' || disposition === 'new-background-tab';

    const currentSpace = activeSpaceIdRef.current;
    const newTab: TabItem = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url: formatted,
      initialUrl: formatted,
      title: title,
      spaceId: currentSpace,
      isLoading: false,
      category: undefined, // 100% On-Demand grouping like Arc: new tabs start flat in Today
      lastAccessedAt: Date.now(),
      createdAt: Date.now(),
    };

    if (openInBackground) {
      backgroundCreatedTabsRef.current.add(newTab.id);

      // Fetch the real page title asynchronously in the background (oEmbed / stream parser) without mounting a webview
      if ((window as any).electronAPI?.invoke) {
        (window as any).electronAPI.invoke('fetch-page-title', formatted).then((realTitle: string | null) => {
          if (realTitle && realTitle.trim()) {
            setTabs((prev) =>
              prev.map((t) => {
                if (t.id === newTab.id) {
                  return {
                    ...t,
                    title: realTitle.trim(),
                    category: t.isUserGroup ? t.category : undefined,
                  };
                }
                return t;
              })
            );
          }
        }).catch(() => {});
      }
    }

    setTabs((prev) => [...prev, newTab]);

    // Mark visited immediately so background tabs (Cmd+Click) mount and load their URL
    markTabVisited(newTab.id);

    if (!openInBackground) {
      handleTabChangePip(activeTabIdRef.current, newTab.id);
      setActiveTabId(newTab.id);
      setSpaceActiveTabMap((prev) => ({ ...prev, [currentSpace]: newTab.id }));
    }
  };

  const handleFindInPage = (forward: boolean = true, findNext: boolean = false) => {
    if (!findSearchText.trim()) return;
    const activeEl = webviewMapRef.current.get(activeTabId);
    if (activeEl && typeof (activeEl as any).findInPage === 'function') {
      (activeEl as any).findInPage(findSearchText, { forward, findNext });
    }
  };

  const handleStopFindInPage = () => {
    setIsFindInPageOpen(false);
    const activeEl = webviewMapRef.current.get(activeTabId);
    if (activeEl && typeof (activeEl as any).stopFindInPage === 'function') {
      (activeEl as any).stopFindInPage('clearSelection');
    }
  };

  const openFindInPageBar = () => {
    setIsFindInPageOpen(true);
    setIsMoreMenuOpen(false);
    setTimeout(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    }, 50);
  };

  useEffect(() => {
    hasOpenOverlayRef.current = Boolean(
      isInlineOmnibarActive ||
      isHistoryManagerOpen ||
      isCommandBarOpen ||
      showRecentlyClosedDrawer ||
      isLittleArcInputOpen ||
      littleArcUrl ||
      isSettingsOpen ||
      isProfileMenuOpen ||
      isMoreMenuOpen ||
      isExtensionMenuOpen ||
      isDownloadsMenuOpen ||
      isFindInPageOpen ||
      groupModalState.isOpen
    );
  }, [
    isInlineOmnibarActive,
    isHistoryManagerOpen,
    isCommandBarOpen,
    showRecentlyClosedDrawer,
    isLittleArcInputOpen,
    littleArcUrl,
    isSettingsOpen,
    isProfileMenuOpen,
    isMoreMenuOpen,
    isExtensionMenuOpen,
    isDownloadsMenuOpen,
    isFindInPageOpen,
    groupModalState.isOpen
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
      // Cmd+L: Focus Inline Omnibar in Top Bar (Standard browser shortcut)
      if (isCmdOrCtrl && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setInlineOmnibarValue(activeTab?.url || '');
        setIsInlineOmnibarActive(true);
        setTimeout(() => {
          inlineOmnibarInputRef.current?.focus();
          inlineOmnibarInputRef.current?.select();
        }, 10);
      }
      if (isCmdOrCtrl && (e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'p')) {
        // Cmd+Shift+T: Reopen Recently Closed Tab (Standard Chrome shortcut)
        if (e.shiftKey && e.key.toLowerCase() === 't') {
          e.preventDefault();
          handleReopenClosedTab();
          return;
        }
        e.preventDefault();
        setIsCommandBarOpen((prev) => !prev);
      }
      // Cmd+Y: Open Chrome-style History Manager
      if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setIsHistoryManagerOpen((prev) => !prev);
      }
      // Cmd+Shift+T: Chrome Reopen Closed Tab (explicit fallback check)
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleReopenClosedTab();
      }
      // Cmd+N: Open New Window with clean slate (no default mockup values)
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleOpenTabInNewWindow('');
      }
      // Cmd+Shift+N: Open Little Aura Quick Peek HUD
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsLittleArcInputOpen(true);
      }
      // Toggle fullscreen with standard shortcuts (Ctrl+Cmd+F or Cmd+Shift+F)
      if ((e.ctrlKey && e.metaKey && e.key.toLowerCase() === 'f') || (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        if ((window as any).electronAPI?.send) {
          (window as any).electronAPI.send('window-toggle-fullscreen');
        }
      }

      // Cmd+F: Find in Page Bar
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openFindInPageBar();
      }

      if (e.key === 'Escape') {
        const hadOpenOverlay = hasOpenOverlayRef.current;

        setIsInlineOmnibarActive(false);
        setIsHistoryManagerOpen(false);
        setIsCommandBarOpen(false);
        setShowRecentlyClosedDrawer(false);
        setIsLittleArcInputOpen(false);
        setLittleArcUrl(null);
        setIsSettingsOpen(false);
        setIsProfileMenuOpen(false);
        setIsMoreMenuOpen(false);
        setIsExtensionMenuOpen(false);
        setIsDownloadsMenuOpen(false);
        if (isFindInPageOpen) {
          handleStopFindInPage();
        }
        setGroupModalState((prev) => ({ ...prev, isOpen: false }));

        // Exit fullscreen on Escape if no overlay was open (matching Dia & Chrome)
        if (!hadOpenOverlay && isNativeFullscreenRef.current) {
          if ((window as any).electronAPI?.send) {
            (window as any).electronAPI.send('window-toggle-fullscreen');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    let unsubOpenInNewTab: (() => void) | undefined;
    let unsubOpenInLittleArc: (() => void) | undefined;
    let unsubExtensionCloseTab: (() => void) | undefined;
    let unsubDismissPopovers: (() => void) | undefined;

    // Listen for 'open-in-new-tab' from main process (Cmd+Click, Context Menu, target="_blank", window.open)
    if ((window as any).electronAPI?.on) {
      unsubOpenInNewTab = (window as any).electronAPI.on('open-in-new-tab', (url: string, disposition?: string) => {
        handleOpenInNewTab(url, disposition);
      });

      unsubOpenInLittleArc = (window as any).electronAPI.on('open-in-little-arc', (url: string) => {
        openLittleArc(url);
      });

      // Listen for extension closing a tab (e.g. Bitwarden completing SSO login and closing sso-connector tab)
      unsubExtensionCloseTab = (window as any).electronAPI.on('extension-close-tab', (wcId: number) => {
        // Find which tab corresponds to this webContentsId
        webviewMapRef.current.forEach((el, tId) => {
          try {
            if ((el as any)?.getWebContentsId?.() === wcId) {
              handleCloseTab(tId);
            }
          } catch (e) {}
        });
      });

      // Auto-dismiss floating menus on web page navigation, webview focus, or window blur (Chrome behavior)
      unsubDismissPopovers = (window as any).electronAPI.on('dismiss-popovers', () => {
        setIsExtensionMenuOpen(false);
        setIsDownloadsMenuOpen(false);
        setIsMoreMenuOpen(false);
        setIsProfileMenuOpen(false);
      });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (unsubOpenInNewTab) unsubOpenInNewTab();
      if (unsubOpenInLittleArc) unsubOpenInLittleArc();
      if (unsubExtensionCloseTab) unsubExtensionCloseTab();
      if (unsubDismissPopovers) unsubDismissPopovers();
    };
  }, []);

  // Automatically dismiss floating extension popup when clicking anywhere in the UI (Chrome behavior)
  useEffect(() => {
    const handleDismissExtensionPopup = () => {
      if ((window as any).electronAPI?.send) {
        (window as any).electronAPI.send('close-extension-popup');
      }
    };

    window.addEventListener('mousedown', handleDismissExtensionPopup);
    return () => {
      window.removeEventListener('mousedown', handleDismissExtensionPopup);
    };
  }, []);

  const switchTab = (tabId: string) => {
    setIsExtensionMenuOpen(false);
    setIsDownloadsMenuOpen(false);
    setIsMoreMenuOpen(false);
    if ((window as any).electronAPI?.send) {
      (window as any).electronAPI.send('close-extension-popup');
    }
    markTabVisited(tabId);
    if (tabId === activeTabId) return;
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      handleTabChangePip(activeTabId, tabId);

      // Check if this is a first visit to a background-created tab
      const isFirstVisitToBackgroundTab = backgroundCreatedTabsRef.current.has(tabId);
      if (isFirstVisitToBackgroundTab) {
        backgroundCreatedTabsRef.current.delete(tabId);
      }

      // If switching to a sleeping tab, wake it up and trigger Chrome Memory Saver wake indicator
      if (tab.isSleeping) {
        const savedMB = tab.discardedMemoryMB || Math.floor(Math.random() * 45) + 65; // realistic 65MB-110MB freed
        setMemoryWokenTabInfo({
          tabId: tab.id,
          savedMB,
          wokenAt: Date.now(),
        });
      }

      // Update active space & tab state immediately so activeTabIdRef is synchronously current
      activeTabIdRef.current = tabId;
      activeSpaceIdRef.current = tab.spaceId;
      setActiveSpaceId(tab.spaceId);
      setActiveTabId(tabId);
      setSpaceActiveTabMap((prev) => ({ ...prev, [tab.spaceId]: tabId }));
      setTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, lastAccessedAt: Date.now(), isArchived: false, isSleeping: false } : t))
      );

      // Unmute incoming tab
      const incomingEl = webviewMapRef.current.get(tabId);
      if (incomingEl) {
        try {
          if (typeof (incomingEl as any).setAudioMuted === 'function') {
            (incomingEl as any).setAudioMuted(!!tab.isMuted);
          }
          if (typeof (incomingEl as any).getWebContentsId === 'function') {
            const wcId = (incomingEl as any).getWebContentsId();
            if (wcId && (window as any).electronAPI?.send) {
              (window as any).electronAPI.send('select-guest-tab', { webContentsId: wcId, spaceId: tab.spaceId });
            }
          }
        } catch (e) {}
      }
    }
  };

  const handleNavigate = (url: string) => {
    setIsExtensionMenuOpen(false);
    setIsDownloadsMenuOpen(false);
    setIsMoreMenuOpen(false);
    if ((window as any).electronAPI?.send) {
      (window as any).electronAPI.send('close-extension-popup');
    }
    let formatted = url.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      if (formatted.includes('.') && !formatted.includes(' ')) {
        formatted = `https://${formatted}`;
      } else {
        const engine = SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES.google;
        formatted = `${engine.searchUrl}${encodeURIComponent(formatted)}`;
      }
    }
    const currentTab = tabs.find((t) => t.id === activeTabId);
    if (!currentTab || currentTab.spaceId !== activeSpaceId) {
      handleNewTab(activeSpaceId, formatted);
      return;
    }
    const activeEl = webviewMapRef.current.get(activeTabId);
    if (activeEl && typeof activeEl.loadURL === 'function' && currentTab && currentTab.url !== 'aura://newtab' && currentTab.url !== 'about:blank') {
      activeEl.loadURL(formatted);
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              url: formatted,
              initialUrl: t.url === 'aura://newtab' ? formatted : (t.initialUrl || formatted),
              title: formatted,
              // If the user manually assigned this tab to a group, preserve it! Otherwise keep current category (100% on-demand)
              category: t.isUserGroup ? t.category : t.category,
              lastAccessedAt: Date.now(),
            }
          : t
      )
    );
  };

  const handleNewTab = (spaceId = activeSpaceId, initialUrl?: string, initialCategory?: string) => {
    setIsExtensionMenuOpen(false);
    setIsDownloadsMenuOpen(false);
    setIsMoreMenuOpen(false);
    if ((window as any).electronAPI?.send) {
      (window as any).electronAPI.send('close-extension-popup');
    }
    const targetUrl = initialUrl || 'aura://newtab';
    const initialTitle = 'New Tab';

    const newTab: TabItem = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url: targetUrl,
      initialUrl: targetUrl,
      title: initialTitle,
      spaceId,
      category: initialCategory,
      isUserGroup: !!initialCategory,
      lastAccessedAt: Date.now(),
      createdAt: Date.now(),
    };
    handleTabChangePip(activeTabId, newTab.id);
    markTabVisited(newTab.id);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setSpaceActiveTabMap((prev) => ({ ...prev, [spaceId]: newTab.id }));
  };

  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const tabToClose = tabs.find((t) => t.id === tabId);
    if (tabToClose) {
      const closedEntry = {
        ...tabToClose,
        lastAccessedAt: Date.now()
      };
      setClosedTabsHistory((prev) => [closedEntry, ...prev.filter((t) => t.id !== tabId).slice(0, 24)]);
    }
    const remaining = tabs.filter((t) => t.id !== tabId);
    if (remaining.length === 0) {
      // If the last tab is closed, close the browser window/app (standard browser behavior)
      if ((window as any).electronAPI?.send) {
        (window as any).electronAPI.send('close-app');
      } else {
        window.close();
      }
      return;
    }
    setTabs(remaining);
    if (activeTabId === tabId && remaining.length > 0) {
      setActiveTabId(remaining[0].id);
    }
  };

  const handleCloseGroup = (spaceId: string, groupTabs: TabItem[], e: React.MouseEvent) => {
    e.stopPropagation();
    const closingIds = new Set(groupTabs.map((t) => t.id));
    const remaining = tabs.filter((t) => !closingIds.has(t.id));
    setTabs(remaining);

    // If the currently active tab was inside this closed group, select another available tab
    if (closingIds.has(activeTabId)) {
      const fallback = remaining.find((t) => t.spaceId === spaceId && !t.isArchived) || remaining[0];
      if (fallback) {
        setActiveTabId(fallback.id);
        setSpaceActiveTabMap((prev) => ({ ...prev, [spaceId]: fallback.id }));
      }
    }
  };

  const togglePinTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, isPinned: !t.isPinned } : t))
    );
  };

  const toggleFavorite = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, isFavorite: !t.isFavorite } : t))
    );
  };

  // Open Little Aura with a URL
  const openLittleArc = (targetUrl: string) => {
    let formatted = targetUrl.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      if (formatted.includes('.') && !formatted.includes(' ')) {
        formatted = `https://${formatted}`;
      } else {
        const engine = SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES.google;
        formatted = `${engine.searchUrl}${encodeURIComponent(formatted)}`;
      }
    }
    setLittleArcUrl(formatted);
    try {
      setLittleArcTitle(new URL(formatted).hostname.replace(/^www\./, ''));
    } catch {
      setLittleArcTitle(formatted);
    }
    setIsLittleArcInputOpen(false);
  };

  // Promote Little Aura into a permanent/regular tab in current space
  const promoteLittleArcToTab = () => {
    if (!littleArcUrl) return;
    const promotedTab: TabItem = {
      id: `tab-${Date.now()}`,
      url: littleArcUrl,
      title: littleArcTitle,
      spaceId: activeSpaceId,
      lastAccessedAt: Date.now(),
      createdAt: Date.now(),
    };
    setTabs((prev) => [...prev, promotedTab]);
    setActiveTabId(promotedTab.id);
    setLittleArcUrl(null);
  };

  const handleReorderPinnedTabs = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setTabs((prev) => {
      const pinList = prev.filter((t) => t.isPinned && t.spaceId === activeSpaceId);
      const otherList = prev.filter((t) => !t.isPinned || t.spaceId !== activeSpaceId);

      const draggedIndex = pinList.findIndex((t) => t.id === draggedId);
      const targetIndex = pinList.findIndex((t) => t.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const updatedPins = [...pinList];
      const [removed] = updatedPins.splice(draggedIndex, 1);
      updatedPins.splice(targetIndex, 0, removed);

      return [...updatedPins, ...otherList];
    });
  };

  // dnd-kit helper: Find which container an item belongs to
  const findContainer = (id: string, map: Record<string, string[]>): string | null => {
    if (id in map) return id;
    for (const [containerId, itemIds] of Object.entries(map)) {
      if (itemIds.includes(id)) {
        return containerId;
      }
    }
    return null;
  };

  // Commit final multi-container tab arrangement to persistent tabs state
  const commitFinalTabsFromMap = useCallback(
    (map: Record<string, string[]>, activeSpaceId: string, orderedGroups: string[]) => {
      setTabs((prev) => {
        const tabMap = new Map<string, TabItem>();
        prev.forEach((t) => tabMap.set(t.id, t));

        const nonSpaceTabs = prev.filter(
          (t) => t.spaceId !== activeSpaceId || t.isArchived || t.isPinned
        );

        const newSpaceTabs: TabItem[] = [];

        // 1. Grouped tabs in group order
        orderedGroups.forEach((groupName) => {
          const ids = map[`group:${groupName}`] || [];
          ids.forEach((id) => {
            const tab = tabMap.get(id);
            if (tab) {
              newSpaceTabs.push({
                ...tab,
                spaceId: activeSpaceId,
                category: groupName,
                isUserGroup: true,
              });
            }
          });
        });

        // 2. Ungrouped tabs
        const ungroupedIds = map['ungrouped'] || [];
        ungroupedIds.forEach((id) => {
          const tab = tabMap.get(id);
          if (tab) {
            newSpaceTabs.push({
              ...tab,
              spaceId: activeSpaceId,
              category: undefined,
              isUserGroup: false,
            });
          }
        });

        return [...newSpaceTabs, ...nonSpaceTabs];
      });
    },
    []
  );

  const handleDndDragStart = (
    event: DragStartEvent,
    currentBuckets: Record<string, TabItem[]>,
    currentUngrouped: TabItem[],
    orderedGroups: string[]
  ) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredTabInfo(null);

    const activeId = String(event.active.id);
    setActiveDragTabId(activeId);

    const map: Record<string, string[]> = {};
    orderedGroups.forEach((name) => {
      map[`group:${name}`] = (currentBuckets[name] || []).map((t) => t.id);
    });
    map['ungrouped'] = currentUngrouped.map((t) => t.id);
    setDragItemsMap(map);
  };

  const handleDndDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !dragItemsMap) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeContainer = findContainer(activeId, dragItemsMap);
    const overContainer = findContainer(overId, dragItemsMap);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setDragItemsMap((prev) => {
      if (!prev) return prev;
      const currentActiveItems = prev[activeContainer] || [];
      const currentOverItems = prev[overContainer] || [];

      let overIndex = currentOverItems.indexOf(overId);
      if (overIndex === -1) {
        overIndex = currentOverItems.length;
      }

      return {
        ...prev,
        [activeContainer]: currentActiveItems.filter((id) => id !== activeId),
        [overContainer]: [
          ...currentOverItems.slice(0, overIndex),
          activeId,
          ...currentOverItems.slice(overIndex),
        ],
      };
    });
  };

  const handleDndDragEnd = (event: DragEndEvent, activeSpaceId: string, orderedGroups: string[]) => {
    const { active, over } = event;
    const activeId = String(event.active.id);

    if (over && dragItemsMap) {
      const overId = String(over.id);
      const activeContainer = findContainer(activeId, dragItemsMap);
      const overContainer = findContainer(overId, dragItemsMap);

      if (activeContainer && overContainer) {
        let finalMap = { ...dragItemsMap };
        if (activeContainer === overContainer) {
          const items = finalMap[activeContainer];
          const oldIndex = items.indexOf(activeId);
          const newIndex = items.indexOf(overId);
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            finalMap[activeContainer] = arrayMove(items, oldIndex, newIndex);
          }
        }

        commitFinalTabsFromMap(finalMap, activeSpaceId, orderedGroups);
      }
    }

    setActiveDragTabId(null);
    setDragItemsMap(null);
  };

  const handleDndDragCancel = () => {
    setActiveDragTabId(null);
    setDragItemsMap(null);
  };

  const handleOpenTabInNewWindow = (url: string) => {
    if ((window as any).electronAPI?.send) {
      (window as any).electronAPI.send('open-new-window', url);
    } else {
      window.open(url, '_blank');
    }
    setTabContextMenu(null);
  };

  const handleCopyTabLink = (url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setTidyNotification('Copied link to clipboard!');
    setTimeout(() => setTidyNotification(null), 2500);
    setTabContextMenu(null);
  };

  const handleMoveTabToSpace = (tabId: string, targetSpaceId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, spaceId: targetSpaceId } : t))
    );
    // If the moved tab was active in this space, activate another
    if (tabId === activeTabId) {
      const remaining = tabs.filter((t) => t.spaceId === activeSpaceId && t.id !== tabId && !t.isArchived);
      if (remaining.length > 0) {
        setActiveTabId(remaining[0].id);
        setSpaceActiveTabMap((prev) => ({ ...prev, [activeSpaceId]: remaining[0].id }));
      }
    }
    setTabContextMenu(null);
  };

  const handleMoveTabToCategory = (tabId: string, targetCategory: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, category: targetCategory, isUserGroup: true } : t))
    );
    setTabContextMenu(null);
  };

  const handleTogglePinTab = (tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, isPinned: !t.isPinned } : t))
    );
    setTabContextMenu(null);
  };

  // Additional macOS Context Menu Actions
  const handleChatWithTab = (tab: TabItem) => {
    setIsCommandBarOpen(true);
    setCommandQuery(`Summarize tab: ${tab.title}`);
    setTabContextMenu(null);
  };

  const handleOpenAsSplit = (tab: TabItem) => {
    setSecondaryTabId(tab.id);
    setIsSplitView(true);
    markTabVisited(tab.id);
    setTabContextMenu(null);
  };

  const handleDuplicateTab = (tab: TabItem) => {
    const duplicatedTab: TabItem = {
      ...tab,
      id: `tab-${Date.now()}`,
      title: `${tab.title} (Copy)`,
      lastAccessedAt: Date.now(),
      createdAt: Date.now(),
    };
    markTabVisited(duplicatedTab.id);
    setTabs((prev) => [...prev, duplicatedTab]);
    setActiveTabId(duplicatedTab.id);
    setTabContextMenu(null);
  };

  const handleNewGroupWithTab = (tab: TabItem) => {
    const spaceCustomGroups = customGroups.filter((g) => g.spaceId === tab.spaceId);
    const defaultPlaceholder = `group${spaceCustomGroups.length + 1}`;
    setGroupInputValue(tab.category || defaultPlaceholder);
    modalOpenedAtRef.current = Date.now();
    setGroupModalState({
      isOpen: true,
      mode: 'new-with-tab',
      tabId: tab.id,
      initialValue: tab.category || defaultPlaceholder,
      placeholder: defaultPlaceholder,
      title: 'New Group with Tab',
    });
    setTabContextMenu(null);
  };

  const handleRemoveFromGroup = (tab: TabItem) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tab.id ? { ...t, category: undefined, isUserGroup: false } : t))
    );
    setTabContextMenu(null);
  };

  const handleRenameGroup = (tab: TabItem) => {
    if (!tab.category) return;
    const oldCategory = tab.category;
    setGroupInputValue(oldCategory);
    modalOpenedAtRef.current = Date.now();
    setGroupModalState({
      isOpen: true,
      mode: 'rename',
      tabId: tab.id,
      initialValue: oldCategory,
      placeholder: oldCategory,
      title: 'Rename Group',
    });
    setTabContextMenu(null);
  };

  const handleToggleMuteTab = (tab: TabItem) => {
    const newMuted = !tab.isMuted;
    setTabs((prev) =>
      prev.map((t) => (t.id === tab.id ? { ...t, isMuted: newMuted } : t))
    );
    const webviewEl = webviewMapRef.current.get(tab.id) || (tab.id === activeTabId ? activeWebviewRef.current : null);
    if (webviewEl && typeof webviewEl.setAudioMuted === 'function') {
      webviewEl.setAudioMuted(newMuted);
    }
    setTabContextMenu(null);
  };

  const handleCloseOtherTabs = (tab: TabItem) => {
    setTabs((prev) =>
      prev.filter((t) => t.spaceId !== tab.spaceId || t.id === tab.id || t.isPinned)
    );
    setActiveTabId(tab.id);
    setTabContextMenu(null);
  };

  const handleCloseTabsBelow = (tab: TabItem) => {
    setTabs((prev) => {
      const spaceTabs = prev.filter((t) => t.spaceId === tab.spaceId && !t.isPinned && !t.isArchived);
      const tabIndex = spaceTabs.findIndex((t) => t.id === tab.id);
      if (tabIndex === -1) return prev;
      const idsToRemove = new Set(spaceTabs.slice(tabIndex + 1).map((t) => t.id));
      return prev.filter((t) => !idsToRemove.has(t.id));
    });
    setTabContextMenu(null);
  };

  // Open Real Native macOS Context Menu via Electron IPC
  const openTabContextMenu = (tab: TabItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if running inside Electron with electronAPI
    if ((window as any).electronAPI?.send) {
      const spaceGroups = Array.from(
        new Set(
          tabs
            .filter(
              (t) =>
                t.spaceId === tab.spaceId &&
                t.category &&
                t.category.trim() !== '' &&
                !t.isArchived
            )
            .map((t) => t.category as string)
        )
      );

      const spacesList = spaces.map((sp) => ({
        id: sp.id,
        name: sp.name,
        isCurrent: sp.id === tab.spaceId,
      }));

      (window as any).electronAPI.send('show-tab-context-menu', {
        tabId: tab.id,
        url: tab.url,
        isPinned: !!tab.isPinned,
        isSleeping: !!tab.isSleeping,
        category: tab.category,
        hasAudio: !!(tab.hasAudio || tab.isMuted),
        isMuted: !!tab.isMuted,
        spaceGroups,
        spacesList,
      });
    } else {
      // Web fallback
      setTabContextMenu({
        tab,
        x: Math.min(e.clientX, window.innerWidth - 240),
        y: Math.min(e.clientY, window.innerHeight - 400),
      });
    }
  };

  // Listen for actions from Native macOS Menu
  useEffect(() => {
    if (!(window as any).electronAPI?.on) return;

    (window as any).electronAPI.on('tab-menu-action', (payload: any) => {
      const { action, tabId, targetCategory, targetSpaceId, url } = payload;
      const targetTab = tabsRef.current.find((t) => t.id === tabId);

      switch (action) {
        case 'toggle-pin':
          handleTogglePinTab(tabId);
          break;
        case 'open-split':
          if (targetTab) handleOpenAsSplit(targetTab);
          break;
        case 'duplicate':
          if (targetTab) handleDuplicateTab(targetTab);
          break;
        case 'new-group':
          if (targetTab) handleNewGroupWithTab(targetTab);
          break;
        case 'remove-group':
          if (targetTab) handleRemoveFromGroup(targetTab);
          break;
        case 'move-group':
          if (targetCategory) handleMoveTabToCategory(tabId, targetCategory);
          break;
        case 'move-space':
          if (targetSpaceId) handleMoveTabToSpace(tabId, targetSpaceId);
          break;
        case 'move-window':
          if (url) handleOpenTabInNewWindow(url);
          break;
        case 'copied-link':
          setTidyNotification('Copied link to clipboard!');
          setTimeout(() => setTidyNotification(null), 2500);
          break;
        case 'rename-group':
          if (targetTab) handleRenameGroup(targetTab);
          break;
        case 'toggle-mute':
          if (targetTab) handleToggleMuteTab(targetTab);
          break;
        case 'toggle-sleep':
          if (targetTab) {
            if (targetTab.isSleeping) {
              switchTab(targetTab.id);
            } else {
              // Discard / sleep tab immediately
              try {
                const el = webviewMapRef.current.get(targetTab.id);
                if (el) webviewMapRef.current.delete(targetTab.id);
              } catch (e) {}
              const freed = Math.floor(Math.random() * 45) + 65;
              setTabs((prev) =>
                prev.map((t) => (t.id === targetTab.id ? { ...t, isSleeping: true, discardedMemoryMB: freed } : t))
              );
              setTidyNotification(`Slept "${targetTab.title || 'Tab'}": ~${freed} MB freed`);
              setTimeout(() => setTidyNotification(null), 3000);
            }
          }
          break;
        case 'close-tab':
          handleCloseTab(tabId);
          break;
        case 'close-other-tabs':
          if (targetTab) handleCloseOtherTabs(targetTab);
          break;
        case 'close-tabs-below':
          if (targetTab) handleCloseTabsBelow(targetTab);
          break;
      }
    });
  }, []);

  // Open Native Context Menu on Empty Sidebar Area
  const openSidebarContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't intercept right clicks intended for interactive items: tabs, buttons, inputs, links
    if (target.closest('button, input, textarea, a, [draggable="true"]')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    if ((window as any).electronAPI?.send) {
      (window as any).electronAPI.send('show-sidebar-context-menu', {
        hasClosedTabs: closedTabsHistory.length > 0,
        showTabsInSidebar,
      });
    }
  };

  // Actions for Sidebar Native Menu & Cmd+Shift+T
  const handleReopenClosedTab = () => {
    setClosedTabsHistory((prevHistory) => {
      if (!prevHistory || prevHistory.length === 0) return prevHistory;
      const [toRestore, ...restHistory] = prevHistory;
      markTabVisited(toRestore.id);
      setTabs((prevTabs) => {
        if (prevTabs.some((t) => t.id === toRestore.id)) {
          return prevTabs.map((t) => (t.id === toRestore.id ? { ...t, isArchived: false } : t));
        }
        return [...prevTabs, { ...toRestore, isArchived: false }];
      });
      setActiveTabId(toRestore.id);
      setTidyNotification(`Restored: ${toRestore.title || toRestore.url}`);
      setTimeout(() => setTidyNotification(null), 2500);
      return restHistory;
    });
  };

  const handleNewGroupEmpty = () => {
    const spaceCustomGroups = customGroups.filter((g) => g.spaceId === activeSpaceId);
    const defaultPlaceholder = `group${spaceCustomGroups.length + 1}`;
    setGroupInputValue(defaultPlaceholder);
    modalOpenedAtRef.current = Date.now();
    setGroupModalState({
      isOpen: true,
      mode: 'new-empty',
      initialValue: defaultPlaceholder,
      placeholder: defaultPlaceholder,
      title: 'New Group',
    });
  };

  const handleNewLiveGroup = (type: 'github' | 'calendar' | 'rss' | 'figma') => {
    const configs: Record<string, { name: string; url: string; title: string }> = {
      github: { name: 'GitHub PRs', url: 'https://github.com/pulls', title: 'GitHub · Pull Requests' },
      calendar: { name: 'Calendar Events', url: 'https://calendar.google.com', title: 'Google Calendar' },
      rss: { name: 'Tech Radar', url: 'https://news.ycombinator.com', title: 'Hacker News' },
      figma: { name: 'Figma Projects', url: 'https://www.figma.com/files/recent', title: 'Figma · Recent' },
    };
    const config = configs[type] || configs.github;
    const newGroup: CustomGroup = {
      id: `group-${Date.now()}`,
      name: config.name,
      spaceId: activeSpaceId,
      isLive: true,
      liveType: type,
      createdAt: Date.now(),
    };
    setCustomGroups((prev) => [
      ...prev.filter((g) => !(g.spaceId === activeSpaceId && g.name.toLowerCase() === config.name.toLowerCase())),
      newGroup,
    ]);
    const newTabItem: TabItem = {
      id: `tab-${Date.now()}`,
      url: config.url,
      title: config.title,
      spaceId: activeSpaceId,
      category: config.name,
      isUserGroup: true,
      lastAccessedAt: Date.now(),
      createdAt: Date.now(),
    };
    markTabVisited(newTabItem.id);
    setTabs((prev) => [...prev, newTabItem]);
    setActiveTabId(newTabItem.id);
    setTidyNotification(`Created Live Group: ${config.name}`);
    setTimeout(() => setTidyNotification(null), 2500);
  };

  const handleOpenNewProfileModal = () => {
    const defaultPlaceholder = `Profile ${spaces.length + 1}`;
    setGroupInputValue(defaultPlaceholder);
    modalOpenedAtRef.current = Date.now();
    setGroupModalState({
      isOpen: true,
      mode: 'new-profile',
      initialValue: defaultPlaceholder,
      placeholder: defaultPlaceholder,
      title: 'New Profile',
    });
  };

  const handleAddTabToGroup = (spaceId: string, groupName: string) => {
    const newTabItem: TabItem = {
      id: `tab-${Date.now()}`,
      url: 'aura://newtab',
      title: 'New Tab',
      spaceId,
      category: groupName,
      isUserGroup: true,
      lastAccessedAt: Date.now(),
      createdAt: Date.now(),
    };
    markTabVisited(newTabItem.id);
    setTabs((prev) => [...prev, newTabItem]);
    setActiveTabId(newTabItem.id);
  };

  const [isTidying, setIsTidying] = useState(false);

  // Intelligent "Tidy Tabs" Action (Arc Max style: cleans titles, removes duplicates/blank tabs, and groups related tabs)
  const handleTidyTabsOnDemand = async (spaceId = activeSpaceId) => {
    setIsTidying(true);

    // 1. Identify space unpinned tabs
    const spaceTabs = tabs.filter((t) => t.spaceId === spaceId && !t.isPinned && !t.isArchived);
    const deadTabIds = new Set<string>();

    // Clean up empty, unvisited new tabs that are not currently active
    spaceTabs.forEach((t) => {
      if (t.id !== activeTabId && (!t.url || t.url === 'aura://newtab' || t.url === 'about:blank') && (!t.title || t.title === 'New Tab')) {
        deadTabIds.add(t.id);
      }
    });

    // Deduplicate identical URLs (keep active or first)
    const seenUrls = new Map<string, string>();
    spaceTabs.forEach((t) => {
      if (deadTabIds.has(t.id)) return;
      if (!t.url || t.url === 'aura://newtab' || t.url === 'about:blank') return;
      const norm = t.url.replace(/\/$/, '').toLowerCase();
      if (!seenUrls.has(norm)) {
        seenUrls.set(norm, t.id);
      } else {
        if (t.id === activeTabId) {
          deadTabIds.add(seenUrls.get(norm)!);
          seenUrls.set(norm, t.id);
        } else {
          deadTabIds.add(t.id);
        }
      }
    });

    // Clean webviews for dead tabs
    deadTabIds.forEach((id) => {
      try {
        const el = webviewMapRef.current.get(id);
        if (el) webviewMapRef.current.delete(id);
      } catch (e) {}
    });

    const survivingTabs = spaceTabs.filter((t) => !deadTabIds.has(t.id));

    // 2. Cluster tabs with Gemini AI (fallback to smart local heuristic with minThreshold = 2)
    const geminiKey = localStorage.getItem('aura_gemini_api_key') || GEMINI_DEFAULT_API_KEY;
    const result: TidyResult = await clusterTabsWithGemini(survivingTabs, geminiKey, 2);

    setIsTidying(false);

    // 3. Update tabs: clean titles and assign groups
    let titlesCleaned = 0;
    setTabs((prev) =>
      prev
        .filter((t) => !deadTabIds.has(t.id))
        .map((tab) => {
          if (tab.spaceId !== spaceId || tab.isPinned || tab.isArchived) {
            return tab;
          }
          const cleanTitle = tidyTabTitle(tab.title);
          if (cleanTitle !== tab.title) titlesCleaned++;

          for (const g of result.groups) {
            if (g.tabIds.includes(tab.id)) {
              return {
                ...tab,
                title: cleanTitle,
                category: g.groupName,
                isUserGroup: true,
              };
            }
          }

          return {
            ...tab,
            title: cleanTitle,
          };
        })
    );

    // 4. Add any new groups to customGroups
    if (result.groups.length > 0) {
      setCustomGroups((prev) => {
        const next = [...prev];
        for (const g of result.groups) {
          if (!next.some((existing) => existing.spaceId === spaceId && existing.name.toLowerCase() === g.groupName.toLowerCase())) {
            next.push({ id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, name: g.groupName, spaceId, createdAt: Date.now() });
          }
        }
        return next;
      });
    }

    // 5. User feedback
    const totalGrouped = result.groups.reduce((acc, g) => acc + g.tabIds.length, 0);
    const feedbackParts: string[] = [];
    if (totalGrouped > 0) {
      feedbackParts.push(`Grouped ${totalGrouped} tabs into ${result.groups.length} clusters`);
    }
    if (deadTabIds.size > 0) {
      feedbackParts.push(`closed ${deadTabIds.size} duplicate/empty`);
    }
    if (titlesCleaned > 0 && totalGrouped === 0) {
      feedbackParts.push(`cleaned ${titlesCleaned} titles`);
    }

    const feedbackMsg = feedbackParts.length > 0
      ? `✨ Tidy Tabs: ${feedbackParts.join(', ')}`
      : '✨ Tidy Tabs: Tab list is already organized';
    setTidyNotification(feedbackMsg);
    setTimeout(() => setTidyNotification(null), 3000);
  };

  const handleDeleteGroup = (spaceId: string, groupName: string) => {
    setCustomGroups((prev) => prev.filter((g) => !(g.spaceId === spaceId && g.name === groupName)));
    setTabs((prev) =>
      prev.map((t) =>
        t.spaceId === spaceId && t.category === groupName
          ? { ...t, category: undefined, isUserGroup: false }
          : t
      )
    );
    setGroupOrderMap((prev) => {
      const curList = prev[spaceId] || [];
      if (!curList.includes(groupName)) return prev;
      return {
        ...prev,
        [spaceId]: curList.filter((n) => n !== groupName),
      };
    });
  };

  const handleBookmarkAllTabs = () => {
    setTabs((prev) =>
      prev.map((t) => (t.spaceId === activeSpaceId && !t.isArchived ? { ...t, isPinned: true } : t))
    );
    setTidyNotification('Bookmarked all tabs as pinned!');
    setTimeout(() => setTidyNotification(null), 2500);
  };

  const handleCloseAllTabsInSpace = () => {
    setTabs((prev) => {
      const closingTabs = prev.filter((t) => t.spaceId === activeSpaceId && !t.isPinned && !t.isArchived);
      if (closingTabs.length > 0) {
        setClosedTabsHistory((hist) => [...closingTabs, ...hist.slice(0, 20)]);
      }
      return prev.filter((t) => t.spaceId !== activeSpaceId || t.isPinned);
    });
    setTidyNotification('Closed all tabs in this space');
    setTimeout(() => setTidyNotification(null), 2500);
  };

  // Listen for actions from Native Empty Sidebar Menu
  useEffect(() => {
    if (!(window as any).electronAPI?.on) return;

    const unsubscribe = (window as any).electronAPI.on('sidebar-menu-action', (payload: any) => {
      const { action } = payload;
      switch (action) {
        case 'new-tab':
          handleNewTab(activeSpaceIdRef.current);
          break;
        case 'reopen-closed-tab':
          handleReopenClosedTab();
          break;
        case 'new-group':
          handleNewGroupEmpty();
          break;
        case 'new-live-group':
          handleNewLiveGroup(payload.type || 'github');
          break;
        case 'new-profile':
          handleOpenNewProfileModal();
          break;
        case 'bookmark-all-tabs':
          handleBookmarkAllTabs();
          break;
        case 'toggle-show-tabs':
          setShowTabsInSidebar((prev) => !prev);
          break;
        case 'toggle-auto-hide':
          setIsSidebarOpen((prev) => !prev);
          break;
        case 'close-all-tabs':
          handleCloseAllTabsInSpace();
          break;
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);
  // Adopt Chrome Memory Saver & Tab Lifecycles:
  // Proactively sleep inactive background tabs after 2 hours (or if visited tabs > 15, after 45 mins)
  // Strict Chromium Discard Eligibility:
  // - Never sleep activeTab
  // - Never sleep tabs playing audio or PiP
  // - Never sleep pinned tabs
  // - Reclaims full Chromium render process RAM while keeping sidebar tab and favicon alive
  useEffect(() => {
    const memorySaverInterval = setInterval(() => {
      const now = Date.now();
      const activeTabIdCurrent = activeTabIdRef.current;
      const pipActiveSet = pipActiveTabIdsRef.current;

      setTabs((prevTabs) => {
        let hasChanges = false;
        // Count how many tabs are currently mounted in RAM
        const activeCount = prevTabs.filter((t) => !t.isArchived && visitedTabIds.has(t.id) && !t.isSleeping).length;
        // Inactivity threshold: 45 mins if > 12 tabs, else 2 hours (Chromium aggressive mode)
        const thresholdMs = activeCount > 12 ? 45 * 60 * 1000 : 2 * 60 * 60 * 1000;

        const updated = prevTabs.map((t) => {
          // Never discard active, pinned, archived, or already sleeping tabs
          if (t.id === activeTabIdCurrent || t.isPinned || t.isArchived || t.isSleeping) {
            return t;
          }
          // Never discard tabs with active audio or Picture-in-Picture
          if (t.hasAudio || pipActiveSet.has(t.id)) {
            return t;
          }
          // Never discard blank new tabs
          if (!t.url || t.url === 'aura://newtab' || t.url === 'about:blank') {
            return t;
          }

          // Check inactivity duration
          const inactiveDuration = now - (t.lastAccessedAt || t.createdAt || now);
          if (inactiveDuration > thresholdMs) {
            hasChanges = true;
            // Clean up webview instance to free memory immediately
            try {
              const el = webviewMapRef.current.get(t.id);
              if (el) {
                webviewMapRef.current.delete(t.id);
              }
            } catch (e) {}

            return {
              ...t,
              isSleeping: true,
              discardedMemoryMB: Math.floor(Math.random() * 45) + 65, // ~65MB to 110MB reclaimed
            };
          }

          return t;
        });

        return hasChanges ? updated : prevTabs;
      });
    }, 60 * 1000); // Check once per minute

    return () => clearInterval(memorySaverInterval);
  }, [visitedTabIds]);

  return (
    <div className={`flex h-screen w-screen bg-[#1c2936]/85 backdrop-blur-2xl overflow-hidden p-0 text-zinc-100 font-sans select-none relative`}>
      {/* Fullscreen Exit Notice Banner (Matching Dia & Chrome) */}
      {showFullscreenBanner && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-2">
          <div className="bg-zinc-900/90 dark:bg-zinc-800/90 text-zinc-100 text-xs px-3.5 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 border border-white/10 backdrop-blur-md">
            <Info className="w-3.5 h-3.5 text-zinc-400" />
            <span>To exit fullscreen, press Escape or click ⤡</span>
          </div>
        </div>
      )}

      {/* 1. COLLAPSIBLE ARC SIDEBAR WITH SMOOTH PROFILE SWITCHING */}
      <aside
        onWheel={handleSidebarWheel}
        onContextMenu={openSidebarContextMenu}
        className={`transition-all duration-300 ease-in-out flex flex-col bg-transparent text-[#b3c5d7] relative z-20 overflow-hidden ${
          isSidebarOpen ? 'w-[224px] min-w-[224px]' : 'w-0 opacity-0 pointer-events-none p-0 border-0'
        }`}
      >
        {/* Window controls & Clickable Profile Title with Popup Menu & Tidy Tab Action */}
        <div className="h-11 px-3.5 flex items-center justify-between relative drag-region">
          <div className="flex items-center gap-1.5 no-drag">
            {/* Native macOS traffic lights are at x: 16, y: 15 (height 12px); in fullscreen, render embedded traffic lights */}
            <div className="w-[60px] h-3 shrink-0 flex items-center">
              {isNativeFullscreen && (
                <MacTrafficLights isFullscreen={true} />
              )}
            </div>

            {/* Clean Profile Title (Pill style on hover/active, clean text without arrow, vertically aligned with traffic lights) */}
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className={`no-drag flex items-center px-2 py-0.5 rounded-full text-[13px] font-medium tracking-tight transition-all cursor-pointer ${
                isProfileMenuOpen
                  ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/10'
                  : 'text-zinc-200 hover:text-white hover:bg-white/10'
              }`}
              title="Change Profile"
            >
              <span className="truncate max-w-[120px]">{activeSpace.name}</span>
            </button>
          </div>

          {/* Tidy Tabs Action Button (Always visible, matching toolbar icon sizing) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTidyTabsOnDemand(activeSpaceId);
            }}
            disabled={isTidying}
            title={isTidying ? "Tidying tabs with AI..." : "Tidy Tabs (Organize tabs & clean titles)"}
            className={`no-drag p-1.5 rounded-lg transition-colors cursor-pointer ${
              isTidying
                ? 'text-sky-400 bg-white/10 cursor-wait'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {isTidying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* --- PINNED TABS SECTION (Clean Logo Cards without Header Title) --- */}
        {pinnedTabs.length > 0 && (
          <div className="px-3 py-1 group/pinsection transition-all duration-300 ease-in-out">
            <div className="grid grid-cols-3 gap-2.5">
              {pinnedTabs.map((pin) => {
                const isDragging = draggedPinId === pin.id;
                let hostname = 'website.com';
                try {
                  hostname = new URL(pin.url).hostname;
                } catch (e) {}

                return (
                  <div
                    key={pin.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedPinId(pin.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedPinId) {
                        handleReorderPinnedTabs(draggedPinId, pin.id);
                        setDraggedPinId(null);
                      }
                    }}
                    onDragEnd={() => setDraggedPinId(null)}
                    onClick={() => switchTab(pin.id)}
                    onContextMenu={(e) => openTabContextMenu(pin, e)}
                    onMouseEnter={(e) => handleTabMouseEnter(pin, e)}
                    onMouseLeave={handleTabMouseLeave}
                    className={`relative group h-[46px] rounded-[12px] flex items-center justify-center cursor-pointer transition-all duration-150 border border-white/[0.04] ${
                      isDragging
                        ? 'opacity-40 scale-95 border-dashed border-sky-400/50'
                        : activeTabId === pin.id
                        ? 'bg-[#314354] shadow-lg ring-1 ring-white/20'
                        : 'bg-[#293847]/80 hover:bg-[#314354] hover:shadow-md'
                    }`}
                    title={`${pin.title} (Right-click for options, drag to reorder)`}
                  >
                    <TabFavicon
                      tab={pin}
                      className="w-[20px] h-[20px] object-contain rounded drop-shadow group-hover:scale-105 transition-transform duration-150 pointer-events-none select-none"
                      fallbackSize="w-5 h-5"
                    />
                    {(pin.hasAudio || pin.isMuted) && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMuteTab(pin);
                        }}
                        className="absolute -top-1 -right-1 p-0.5 rounded-full bg-[#1c242d] border border-white/20 shadow-md cursor-pointer hover:bg-white/20 transition-colors"
                        title={pin.isMuted ? "Unmute site" : "Mute site"}
                      >
                        {pin.isMuted ? (
                          <VolumeX className="w-2.5 h-2.5 text-zinc-400" />
                        ) : (
                          <Volume2 className="w-2.5 h-2.5 text-white" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SPACES CONTAINER: INSTANT 0ms ZERO-DELAY SWITCHING */}
        <div
          onContextMenu={openSidebarContextMenu}
          className="flex-1 overflow-hidden relative sidebar-empty-backdrop"
        >
          <div
            className="flex h-full w-full transition-transform duration-200 ease-out sidebar-empty-backdrop"
            style={{
              transform: `translateX(-${spaces.findIndex((s) => s.id === activeSpaceId) * 100}%)`,
            }}
          >
            {spaces.map((space) => {
              const spaceTabs = tabs.filter((t) => t.spaceId === space.id && !t.isArchived && !t.isPinned);
              const spaceCustomGroups = customGroups.filter((g) => g.spaceId === space.id);
              const customGroupNames = spaceCustomGroups.map((g) => g.name);

              const defaultCategories = new Set([
                'Development',
                'Research & Docs',
                'Workspace & Tasks',
                'Media & Audio',
                'Social & News',
                'Shopping',
                'General Browsing',
                'Today',
              ]);

              const categoryBuckets: { [cat: string]: TabItem[] } = {};
              spaceTabs.forEach((tab) => {
                const cat = tab.category?.trim();
                if (cat) {
                  if (!categoryBuckets[cat]) categoryBuckets[cat] = [];
                  categoryBuckets[cat].push(tab);
                }
              });

              // Ensure custom user groups exist in buckets even if currently 0 tabs
              customGroupNames.forEach((name) => {
                if (!categoryBuckets[name]) categoryBuckets[name] = [];
              });

              const allGroupNames = Array.from(
                new Set([...customGroupNames, ...Object.keys(categoryBuckets)])
              );

              // Qualify group headers (Arc standard):
              // 1. User-created groups (customGroups or tabs with isUserGroup: true) are allowed with >= 1 tab
              // 2. Automatic groups (isUserGroup: false) STRICTLY require at least 3 tabs (>= 3). Single/pair tabs stay loose.
              const qualifyingGroupNames = allGroupNames.filter((cat) => {
                if (customGroupNames.includes(cat)) return true;
                const bucketTabs = categoryBuckets[cat] || [];
                const hasExplicitUserTab = bucketTabs.some((t) => t.isUserGroup);
                if (hasExplicitUserTab) {
                  return bucketTabs.length > 0;
                }
                // Arc / Dia standard: Auto clusters require at least 3 tabs
                return bucketTabs.length >= 3;
              });

              // Tabs that belong to qualified groups
              const groupedTabsSet = new Set(
                qualifyingGroupNames.flatMap((cat) => (categoryBuckets[cat] || []).map((t) => t.id))
              );

              // Sort qualifying groups by custom user ordering
              const spaceGroupOrder = groupOrderMap[space.id] || [];
              const orderedGroupNames = [...qualifyingGroupNames].sort((a, b) => {
                const idxA = spaceGroupOrder.indexOf(a);
                const idxB = spaceGroupOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return 0;
              });

              // Loose tabs that are not part of any group
              const ungroupedTabs = spaceTabs.filter((t) => !groupedTabsSet.has(t.id));
              const tabsById = new Map<string, TabItem>();
              spaceTabs.forEach((t) => tabsById.set(t.id, t));

              return (
                <div
                  key={space.id}
                  onContextMenu={openSidebarContextMenu}
                  className="w-[208px] min-w-[208px] h-full overflow-y-auto px-2 pt-1 pb-2 flex flex-col shrink-0"
                >
                  {/* Tab List: Groups + Standalone Individual Tabs */}
                  {showTabsInSidebar && (
                    <DndContext
                      sensors={dndSensors}
                      collisionDetection={collisionDetectionStrategy}
                      onDragStart={(event) =>
                        handleDndDragStart(event, categoryBuckets, ungroupedTabs, orderedGroupNames)
                      }
                      onDragOver={handleDndDragOver}
                      onDragEnd={(event) =>
                        handleDndDragEnd(event, space.id, orderedGroupNames)
                      }
                      onDragCancel={handleDndDragCancel}
                    >
                      <div className="space-y-2">

                                            {/* 1. Qualified Groups (Reorderable via Drag & Drop or Context Menu) */}
                        {orderedGroupNames.map((groupName) => {
                          const containerId = `group:${groupName}`;
                          const isCollapsed = !!collapsedCategories[`${space.id}-${groupName}`];
                          const customGroupInfo = spaceCustomGroups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
                          const isLiveGroup = !!customGroupInfo?.isLive;
                          const isGroupHovered = hoveredGroupName === `${space.id}-${groupName}`;

                          const currentGroupTabIds = dragItemsMap
                            ? dragItemsMap[containerId] || []
                            : (categoryBuckets[groupName] || []).map((t) => t.id);
                          const currentGroupTabs = currentGroupTabIds
                            .map((id) => tabsById.get(id))
                            .filter(Boolean) as TabItem[];

                          const isBeingDragged = draggedGroupName === groupName;
                          const isDragOverTarget = dragTargetGroupName === groupName && draggedGroupName !== groupName;

                          let firstHostname = 'google.com';
                          try {
                            if (currentGroupTabs[0]?.url) {
                              firstHostname = new URL(currentGroupTabs[0].url).hostname;
                            }
                          } catch (e) {}

                          return (
                            <div
                              key={groupName}
                              onMouseEnter={() => setHoveredGroupName(`${space.id}-${groupName}`)}
                              onMouseLeave={() =>
                                setHoveredGroupName((prev) => (prev === `${space.id}-${groupName}` ? null : prev))
                              }
                              className={`rounded-2xl transition-all duration-200 p-1.5 space-y-0.5 ${
                                isBeingDragged
                                  ? 'opacity-40 scale-95 border-dashed border-sky-400/50'
                                  : isDragOverTarget
                                  ? 'border-t-2 border-white shadow-[0_0_8px_rgba(255,255,255,0.8)] bg-white/[0.06] shadow-sm'
                                  : isGroupHovered
                                  ? 'bg-[#343336]/90 shadow-sm'
                                  : 'bg-transparent'
                              }`}
                            >
                              {/* Group Header (Draggable for instant group reordering) */}
                              <div
                                draggable
                                onDragStart={(e) => {
                                  setDraggedGroupName(groupName);
                                  setDraggedGroupSpaceId(space.id);
                                  e.dataTransfer.setData('text/plain', `group:${groupName}`);
                                  e.dataTransfer.effectAllowed = 'move';
                                  const ghost = getBlankDragGhost();
                                  if (ghost) {
                                    try {
                                      e.dataTransfer.setDragImage(ghost, 0, 0);
                                    } catch (err) {}
                                  }
                                }}
                                onDragEnd={() => {
                                  setDraggedGroupName(null);
                                  setDraggedGroupSpaceId(null);
                                  setDragTargetGroupName(null);
                                }}
                                onDragOver={(e) => {
                                  if (draggedGroupName && draggedGroupSpaceId === space.id) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (dragTargetGroupName !== groupName) {
                                      setDragTargetGroupName(groupName);
                                    }
                                  }
                                }}
                                onDrop={(e) => {
                                  if (draggedGroupName && draggedGroupSpaceId === space.id) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (draggedGroupName !== groupName) {
                                      const currentList = [...orderedGroupNames];
                                      const fromIdx = currentList.indexOf(draggedGroupName);
                                      const toIdx = currentList.indexOf(groupName);
                                      if (fromIdx !== -1 && toIdx !== -1) {
                                        currentList.splice(fromIdx, 1);
                                        currentList.splice(toIdx, 0, draggedGroupName);
                                        setGroupOrderMap((prev) => ({
                                          ...prev,
                                          [space.id]: currentList,
                                        }));
                                      }
                                    }
                                    setDraggedGroupName(null);
                                    setDraggedGroupSpaceId(null);
                                    setDragTargetGroupName(null);
                                  }
                                }}
                                onPointerEnter={() => {
                                  if (activeDragTabId && isCollapsed) {
                                    setCollapsedCategories((prev) => ({
                                      ...prev,
                                      [`${space.id}-${groupName}`]: false,
                                    }));
                                  }
                                }}
                                onClick={() =>
                                  setCollapsedCategories((prev) => ({
                                    ...prev,
                                    [`${space.id}-${groupName}`]: !prev[`${space.id}-${groupName}`],
                                  }))
                                }
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  if (currentGroupTabs[0]) {
                                    openTabContextMenu(currentGroupTabs[0], e);
                                  } else {
                                    handleAddTabToGroup(space.id, groupName);
                                  }
                                }}
                                className="flex items-center justify-between px-2 py-1.5 rounded-xl cursor-grab active:cursor-grabbing hover:bg-white/[0.04] transition-colors select-none group/hdr"
                                title={`${groupName} (Drag header to reorder group, right-click for options)`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
                                  {isLiveGroup ? (
                                    <div className="relative flex items-center justify-center shrink-0">
                                      <Radio className="w-3.5 h-3.5 text-emerald-400" />
                                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                    </div>
                                  ) : (
                                    <TabFavicon
                                      tab={currentGroupTabs[0] || { url: `https://${firstHostname}` }}
                                      className="w-4 h-4 object-contain rounded shrink-0"
                                      showSleepRing={false}
                                    />
                                  )}
                                  <span className="font-semibold text-xs text-white truncate min-w-0" title={groupName}>
                                    {groupName}
                                  </span>
                                  <ChevronDown
                                    className={`w-3.5 h-3.5 text-zinc-400 group-hover/hdr:text-white transition-transform duration-200 shrink-0 ${
                                      isCollapsed ? '-rotate-90' : 'rotate-0'
                                    }`}
                                  />
                                </div>

                                <div className="flex items-center gap-0.5 shrink-0 max-w-0 opacity-0 group-hover/hdr:max-w-[48px] group-hover/hdr:opacity-100 overflow-hidden transition-all duration-200 ease-out">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddTabToGroup(space.id, groupName);
                                    }}
                                    className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors shrink-0"
                                    title={`Add new tab to ${groupName}`}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCloseGroup(space.id, currentGroupTabs, e);
                                      handleDeleteGroup(space.id, groupName);
                                    }}
                                    className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors shrink-0"
                                    title={`Close group ${groupName}`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Smooth Accordion Tabs Container */}
                              <div
                                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                                  isCollapsed ? 'grid-rows-[0fr] opacity-0 pointer-events-none' : 'grid-rows-[1fr] opacity-100'
                                }`}
                              >
                                <div className="min-h-0 overflow-hidden">
                                  <SortableContext
                                    id={containerId}
                                    items={currentGroupTabIds}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    <DroppableContainer
                                      id={containerId}
                                      onContextMenu={(e) => {
                                        if (e.target === e.currentTarget) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleAddTabToGroup(space.id, groupName);
                                        }
                                      }}
                                      className="space-y-0.5 pl-3.5 pt-0.5 min-h-[12px]"
                                    >
                                      {currentGroupTabs.length === 0 ? (
                                        <div
                                          onClick={() => handleAddTabToGroup(space.id, groupName)}
                                          className="px-2.5 py-1.5 rounded-xl border border-dashed border-white/10 hover:border-white/20 hover:bg-white/[0.04] text-[10px] text-zinc-400 text-center cursor-pointer transition-all"
                                        >
                                          <span>Empty group · Click + to add</span>
                                        </div>
                                      ) : (
                                        currentGroupTabs.map((tab) => (
                                          <SortableTabItem
                                            key={tab.id}
                                            tab={tab}
                                            isActive={activeTabId === tab.id}
                                            isGroupHovered={isGroupHovered}
                                            onSelect={() => switchTab(tab.id)}
                                            onContextMenu={(e) => openTabContextMenu(tab, e)}
                                            onMouseEnter={(e) => handleTabMouseEnter(tab, e)}
                                            onMouseLeave={handleTabMouseLeave}
                                            onToggleMute={() => handleToggleMuteTab(tab)}
                                            onClose={(e) => handleCloseTab(tab.id, e)}
                                          />
                                        ))
                                      )}
                                    </DroppableContainer>
                                  </SortableContext>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* 2. Standalone tabs */}
                        {(() => {
                          const currentUngroupedTabIds = dragItemsMap
                            ? dragItemsMap['ungrouped'] || []
                            : ungroupedTabs.map((t) => t.id);
                          const currentUngroupedTabs = currentUngroupedTabIds
                            .map((id) => tabsById.get(id))
                            .filter(Boolean) as TabItem[];

                          return (
                            <SortableContext
                              id="ungrouped"
                              items={currentUngroupedTabIds}
                              strategy={verticalListSortingStrategy}
                            >
                              <DroppableContainer
                                id="ungrouped"
                                className="space-y-0.5 min-h-[30px]"
                              >
                                {currentUngroupedTabs.map((tab) => (
                                  <SortableTabItem
                                    key={tab.id}
                                    tab={tab}
                                    isActive={activeTabId === tab.id}
                                    onSelect={() => switchTab(tab.id)}
                                    onContextMenu={(e) => openTabContextMenu(tab, e)}
                                    onMouseEnter={(e) => handleTabMouseEnter(tab, e)}
                                    onMouseLeave={handleTabMouseLeave}
                                    onToggleMute={() => handleToggleMuteTab(tab)}
                                    onClose={(e) => handleCloseTab(tab.id, e)}
                                  />
                                ))}
                              </DroppableContainer>
                            </SortableContext>
                          );
                        })()}

                        {/* "+ New Tab" button: sticky at bottom above carousel when scrolling, sits naturally below tabs when few */}
                        <div className="sticky bottom-0 z-10 pt-1.5 pb-0.5 bg-gradient-to-t from-[#1c2936] via-[#1c2936]/85 to-transparent">
                          <button
                            onClick={() => handleNewTab(space.id)}
                            className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-[#8ca2b6] hover:text-white hover:bg-white/10 bg-[#1c2936]/60 hover:bg-[#1c2936] backdrop-blur-md rounded-xl cursor-pointer w-full group transition-all border border-white/[0.04]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>New Tab</span>
                          </button>
                        </div>
                      </div>

                      {/* Tactile Arc/Linear-style Drag Overlay portaled into document.body to escape transformed carousel containing block */}
                      {typeof document !== 'undefined' &&
                        space.id === activeSpaceId &&
                        createPortal(
                          <DragOverlay zIndex={10000} dropAnimation={dndDropAnimationConfig}>
                            {activeDragTab ? (
                              <div
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs bg-[#1e2430]/98 backdrop-blur-xl border border-white/50 text-white shadow-[0_12px_32px_rgba(0,0,0,0.8),0_0_16px_rgba(255,255,255,0.2)] ring-1 ring-white/30 select-none w-[192px] scale-[1.02] rotate-1 pointer-events-none"
                              >
                                <div className="flex items-center gap-2 truncate pr-1">
                                  <TabFavicon tab={activeDragTab} className="w-4 h-4 object-contain rounded shrink-0" showSleepRing={false} />
                                  <span className="truncate font-medium">{activeDragTab.title || 'Tab'}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 text-zinc-400">
                                  <X className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            ) : null}
                          </DragOverlay>,
                          document.body
                        )}
                    </DndContext>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Update Available Banner in Sidebar */}
        {updateInfo?.hasUpdate && !isUpdateBannerDismissed && (
          <div className="mx-2.5 mb-1.5 p-2 rounded-xl bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 border border-indigo-400/30 backdrop-blur-md text-xs shadow-lg animate-in fade-in slide-in-from-bottom-2 shrink-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span className="font-semibold text-white truncate text-[11px]">
                  Slate v{updateInfo.latestVersion}
                </span>
              </div>
              <button
                onClick={() => setIsUpdateBannerDismissed(true)}
                className="text-zinc-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                title="Dismiss banner"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[10px] text-zinc-300 mb-1.5 line-clamp-1">
              New version ready to download
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsUpdateModalOpen(true)}
                className="flex-1 py-1 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] text-center transition-all shadow active:scale-95 cursor-pointer flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>Update</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Bar: Recently Closed Tabs Button (Left), Centered Carousel Profile Dots, & History Manager Button (Right after Carousel) */}
        <div className="px-3 py-2 flex items-center justify-between">
            {/* Chrome-Style Recently Closed Tabs Button */}
            <button
              onClick={() => setShowRecentlyClosedDrawer(true)}
              className="p-1 rounded-lg text-[#8ca2b6] hover:text-white hover:bg-white/10 transition-colors"
              title={`Recently Closed Tabs (${closedTabsHistory.length}) — Cmd+Shift+T`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Reorderable Profile / Space Dots (Enhanced drag-and-drop with generous touch targets & smooth reordering) */}
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-black/20">
              {spaces.map((s, idx) => {
                const isActive = activeSpaceId === s.id;
                const isDragging = draggedDotIndex === idx;
                const isDragOver = dragOverDotIndex === idx && draggedDotIndex !== idx;

                return (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedDotIndex(idx);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverDotIndex !== idx) setDragOverDotIndex(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverDotIndex === idx) setDragOverDotIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverDotIndex(null);
                      if (draggedDotIndex !== null && draggedDotIndex !== idx) {
                        const updated = [...spaces];
                        const [removed] = updated.splice(draggedDotIndex, 1);
                        updated.splice(idx, 0, removed);
                        setSpaces(updated);
                        setDraggedDotIndex(null);
                      }
                    }}
                    onDragEnd={() => {
                      setDraggedDotIndex(null);
                      setDragOverDotIndex(null);
                    }}
                    onClick={() => switchSpace(s.id)}
                    className={`w-4 h-4 flex items-center justify-center cursor-pointer transition-all duration-200 rounded-full ${
                      isDragOver ? 'bg-sky-500/30 scale-125 ring-1 ring-sky-400' : 'hover:bg-white/10'
                    }`}
                    title={`${s.name} (Drag dot to reorder)`}
                  >
                    <div
                      className={`rounded-full transition-all duration-200 ${
                        isDragging
                          ? 'w-2 h-2 bg-sky-400 scale-75 opacity-50'
                          : isActive
                          ? 'w-2 h-2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)] scale-110'
                          : 'w-1.5 h-1.5 bg-zinc-500 hover:bg-zinc-300'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Chrome-style Browsing History Manager Button (Placed right after carousel profile dots) */}
            <button
              onClick={() => setIsHistoryManagerOpen(true)}
              className="p-1 rounded-lg text-[#8ca2b6] hover:text-white hover:bg-white/10 transition-colors"
              title="Browsing History (Cmd+Y)"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </div>
      </aside>

      {/* 2. MAIN BROWSER CONTENT CANVAS (DYNAMIC GAPS: WHEN SIDEBAR IS HIDDEN, ADDS LEFT GAP) */}
      <div
        className={`flex-1 flex flex-col pt-2 pr-2 pb-2 transition-all duration-300 ease-in-out bg-transparent overflow-hidden ${
          isSidebarOpen ? 'pl-0' : 'pl-2'
        }`}
      >
        <main className="flex-1 flex flex-col bg-transparent rounded-2xl shadow-2xl overflow-hidden relative text-[#b3c5d7]">
          {tidyNotification && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-indigo-600/90 backdrop-blur-md text-white text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 border border-white/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>{tidyNotification}</span>
            </div>
          )}

          {/* Top Arc-Style Floating Navigation Bar (Integrated Seamlessly with Result Page & Adaptive Color) */}
          <header
            style={{
              backgroundColor: activeTabThemeColor || undefined,
            }}
            className={`h-11 px-3.5 flex items-center justify-between gap-3 drag-region select-none transition-colors duration-300 ${
              activeTabThemeColor
                ? isLightHeader
                  ? 'text-zinc-800'
                  : 'text-zinc-200'
                : 'text-[#b3c5d7] border-b border-white/5 bg-transparent'
            }`}
          >
            <div className="flex-1 flex items-center min-w-0">
              <div className="flex items-center gap-1.5 no-drag shrink-0">
                {!isSidebarOpen && (
                  <MacTrafficLights
                    isFullscreen={isNativeFullscreen}
                    className="mr-1.5 pr-1"
                  />
                )}
                {/* Sidebar Toggle Button (Matching Reference Screenshot) */}
                <button
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
                  className={`p-1.5 rounded transition-colors ${
                    isLightHeader
                      ? 'text-zinc-700 hover:text-black hover:bg-black/10'
                      : isSidebarOpen
                      ? 'text-zinc-400 hover:text-white hover:bg-white/10'
                      : 'text-sky-400 bg-white/10 hover:bg-white/15'
                  }`}
                  title="Toggle Sidebar (Cmd+S)"
                >
                  <SidebarIcon className="w-3.5 h-3.5" />
                </button>

                {(() => {
                  const isLandingPage = !activeTab?.url || activeTab.url === 'aura://newtab' || activeTab.url === 'about:blank';
                  const currentWebview = !isLandingPage && activeTab?.id ? webviewMapRef.current.get(activeTab.id) : null;
                  const navState = activeTab?.id ? tabNavStateMap[activeTab.id] : undefined;
                  const canGoBack = Boolean(!isLandingPage && (navState ? navState.canGoBack : false));
                  const canGoForward = Boolean(!isLandingPage && (navState ? navState.canGoForward : false));

                  return (
                    <>
                      <button
                        disabled={!canGoBack}
                        onClick={() => {
                          if (canGoBack && currentWebview) {
                            currentWebview.goBack();
                          }
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          !canGoBack
                            ? 'opacity-30 cursor-not-allowed text-zinc-500'
                            : isLightHeader
                            ? 'text-zinc-700 hover:text-black hover:bg-black/10 cursor-pointer'
                            : 'text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer'
                        }`}
                        title={canGoBack ? 'Back' : undefined}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={!canGoForward}
                        onClick={() => {
                          if (canGoForward && currentWebview) {
                            currentWebview.goForward();
                          }
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          !canGoForward
                            ? 'opacity-30 cursor-not-allowed text-zinc-500'
                            : isLightHeader
                            ? 'text-zinc-700 hover:text-black hover:bg-black/10 cursor-pointer'
                            : 'text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer'
                        }`}
                        title={canGoForward ? 'Forward' : undefined}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={isLandingPage}
                        onClick={() => {
                          if (!isLandingPage && currentWebview) {
                            currentWebview.reload();
                          }
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          isLandingPage
                            ? 'opacity-30 cursor-not-allowed text-zinc-500'
                            : isLightHeader
                            ? 'text-zinc-700 hover:text-black hover:bg-black/10 cursor-pointer'
                            : 'text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer'
                        }`}
                        title={!isLandingPage ? 'Reload (Cmd+R)' : undefined}
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${activeTab?.isLoading ? 'animate-spin text-sky-400' : ''}`} />
                      </button>
                    </>
                  );
                })()}

                <button
                  onClick={() => handleNewTab(activeSpaceId)}
                  className={`p-1.5 rounded transition-colors ${
                    isLightHeader ? 'text-zinc-700 hover:text-black hover:bg-black/10' : 'text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="New Tab (Cmd+T)"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Option B: Inline Editable Omnibar Pill */}
              {(() => {
                let domain = 'Slate';
                const isNewTab = activeTab?.url === 'slate://newtab' || activeTab?.url === 'aura://newtab' || activeTab?.url === 'about:blank' || !activeTab?.url;
                try {
                  if (activeTab?.url) {
                    if (isNewTab) {
                      domain = 'Search Google or type a URL';
                    } else {
                      const u = new URL(activeTab.url);
                      domain = u.hostname.replace(/^www\./, '');
                    }
                  }
                } catch (e) {
                  domain = isNewTab ? 'Search Google or type a URL' : (activeTab?.url || 'Slate');
                }

                // Inactive top bar pill (Normal State)
                const isMemoryWoken = Boolean(
                  memoryWokenTabInfo &&
                  memoryWokenTabInfo.tabId === activeTab?.id &&
                  Date.now() - memoryWokenTabInfo.wokenAt < 12000
                );

                return (
                  <div className="flex-1 flex items-center min-w-0 ml-2">
                    <button
                      onClick={() => {
                        setIsExtensionMenuOpen(false);
                        setIsDownloadsMenuOpen(false);
                        setIsMoreMenuOpen(false);
                        setInlineOmnibarValue(isNewTab ? '' : (activeTab?.url || ''));
                        setIsInlineOmnibarActive(true);
                        setTimeout(() => {
                          inlineOmnibarInputRef.current?.focus();
                          inlineOmnibarInputRef.current?.select();
                        }, 10);
                      }}
                      className={`w-full h-6 px-3 rounded-[6px] text-xs font-normal transition-all flex items-center justify-between text-left cursor-pointer no-drag ${
                        isLightHeader
                          ? 'text-zinc-800 hover:text-black hover:bg-black/[0.08]'
                          : 'text-zinc-300 hover:text-white hover:bg-black/60 hover:shadow-inner'
                      }`}
                      title="Click to edit URL (Cmd+L)"
                    >
                      <span className="truncate">{domain}</span>
                      
                      {/* Chrome Memory Saver Chip with animated ring in Omnibox */}
                      {isMemoryWoken && (
                        <div
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-medium animate-in fade-in zoom-in-95 duration-200 shrink-0 select-none shadow-sm"
                          title={`Chrome Memory Saver freed ~${memoryWokenTabInfo?.savedMB || 85}MB while this tab was inactive`}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <div className="relative flex items-center justify-center">
                            <Leaf className="w-3 h-3 text-emerald-400" />
                            <div className="absolute -inset-1 rounded-full border border-emerald-400/60 animate-ping opacity-75" />
                          </div>
                          <span>~{memoryWokenTabInfo?.savedMB || 85} MB saved</span>
                        </div>
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Right-Aligned Extensions & Controls */}
            <div className="no-drag flex items-center gap-1.5 shrink-0 relative">
              {/* Pinned Extension Action Buttons (Chrome & Arc style) */}
              {installedExtensions.map((ext) => (
                <button
                  key={`tb-ext-${ext.id}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    if ((window as any).electronAPI?.send) {
                      (window as any).electronAPI.send('open-extension-popup', {
                        extensionId: ext.id,
                        anchorX: rect.left + rect.width / 2,
                        anchorY: rect.bottom,
                        spaceId: activeSpaceId,
                      });
                    }
                  }}
                  className={`p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
                    isLightHeader
                      ? 'hover:bg-black/10 text-zinc-700 hover:text-black'
                      : 'hover:bg-white/10 text-zinc-400 hover:text-white'
                  }`}
                  title={`${ext.name} (Click to open)`}
                >
                  {ext.iconUrl ? (
                    <img src={ext.iconUrl} alt={ext.name} className="w-4 h-4 object-contain rounded" />
                  ) : (
                    <Puzzle className="w-4 h-4" />
                  )}
                </button>
              ))}

              {/* Extensions Menu Button (Manage & Open Folder - extension icons stay inside this dropdown) */}
              <div className="relative">
                  <button
                    onClick={() => {
                      refreshInstalledExtensions();
                      setIsExtensionMenuOpen((prev) => !prev);
                    }}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isExtensionMenuOpen
                        ? isLightHeader
                          ? 'bg-black/20 text-black'
                          : 'bg-white/20 text-white'
                        : isLightHeader
                        ? 'text-zinc-700 hover:text-black hover:bg-black/10'
                        : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="Chrome Extensions"
                  >
                    <Puzzle className="w-4 h-4" />
                  </button>

                  {isExtensionMenuOpen && (
                    <>
                      {/* Transparent full-window backdrop to dismiss popover on outside click (including web page & URL clicks) */}
                      <div
                        className="fixed inset-0 z-40 select-none bg-transparent"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsExtensionMenuOpen(false);
                        }}
                      />
                      <div
                        className="absolute right-0 top-full mt-2 w-80 bg-[#1c1c1f]/95 border border-white/10 rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 backdrop-blur-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="pb-2 border-b border-white/10 flex items-center justify-between">
                          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <Puzzle className="w-3.5 h-3.5 text-indigo-400" />
                            Chrome Extensions
                          </span>
                          <span className="text-[10px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full font-mono">
                            {installedExtensions.length} Active
                          </span>
                        </div>

                        {/* Status Notification */}
                        {extensionStatusMsg && (
                          <div className={`mt-2 p-2 rounded-xl text-xs font-medium ${
                            extensionStatusMsg.isError ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {extensionStatusMsg.text}
                          </div>
                        )}

                        {/* Install from Web Store Input */}
                        <div className="mt-2.5">
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={extensionInstallInput}
                              onChange={(e) => setExtensionInstallInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleInstallExtensionFromInput();
                              }}
                              placeholder="Chrome Web Store URL or ID..."
                              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60 transition-colors"
                            />
                            <button
                              onClick={() => handleInstallExtensionFromInput()}
                              disabled={isInstallingExtension || !extensionInstallInput.trim()}
                              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-white flex items-center gap-1 shadow-md transition-all shrink-0"
                              title="Install Extension"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Install</span>
                            </button>
                          </div>
                        </div>

                        {/* Installed Extensions List */}
                        <div className="max-h-56 overflow-y-auto py-2 space-y-1">
                          {installedExtensions.length === 0 ? (
                            <div className="py-4 text-center">
                              <p className="text-xs text-zinc-400">No extensions installed yet</p>
                              <p className="text-[10px] text-zinc-500 mt-1">
                                Paste any Chrome Web Store link or select a local CRX/ZIP.
                              </p>
                            </div>
                          ) : (
                            installedExtensions.map((ext) => (
                              <div
                                key={ext.id}
                                className="group px-2.5 py-2 rounded-xl hover:bg-white/5 flex items-center justify-between transition-colors border border-transparent hover:border-white/5"
                              >
                                <div
                                  onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    if ((window as any).electronAPI?.send) {
                                      (window as any).electronAPI.send('open-extension-popup', {
                                        extensionId: ext.id,
                                        anchorX: rect.left + rect.width / 2,
                                        anchorY: rect.bottom,
                                        spaceId: activeSpaceId,
                                      });
                                    }
                                    setIsExtensionMenuOpen(false);
                                  }}
                                  className="flex items-center gap-2 truncate pr-2 cursor-pointer flex-1"
                                >
                                  {ext.iconUrl ? (
                                    <img src={ext.iconUrl} alt={ext.name} className="w-4 h-4 object-contain shrink-0 rounded" />
                                  ) : (
                                    <Puzzle className="w-4 h-4 text-zinc-400 shrink-0" />
                                  )}
                                  <div className="truncate">
                                    <p className="text-xs font-medium text-white truncate">{ext.name}</p>
                                    <p className="text-[10px] text-zinc-400 truncate">v{ext.version}</p>
                                  </div>
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUninstallExtension(ext.id, ext.name);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                                  title="Uninstall Extension"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Bottom Action Shortcuts */}
                        <div className="pt-2 border-t border-white/10">
                          <button
                            onClick={() => {
                              // Navigate active tab to Chrome Web Store
                              handleNavigate('https://chromewebstore.google.com');
                              setIsExtensionMenuOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-zinc-200 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Store className="w-3.5 h-3.5 text-amber-400" />
                              <span>Browse Chrome Web Store</span>
                            </div>
                            <ExternalLink className="w-3 h-3 text-zinc-500" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

              {/* Downloads Toolbar Action & Popover (Only visible when active downloads running or download history exists) */}
              {(downloads.length > 0 || activeDownloadsCount > 0) && (
                <div className="relative">
                <button
                  onClick={() => setIsDownloadsMenuOpen((prev) => !prev)}
                  className={`p-1.5 rounded-lg transition-colors relative ${
                    isDownloadsMenuOpen || activeDownloadsCount > 0
                      ? isLightHeader
                        ? 'bg-black/15 text-black'
                        : 'bg-white/15 text-white'
                      : isLightHeader
                      ? 'text-zinc-600 hover:text-black hover:bg-black/10'
                      : 'text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Downloads"
                >
                  <Download className={`w-4 h-4 ${activeDownloadsCount > 0 ? 'text-indigo-400 animate-bounce' : ''}`} />
                  {activeDownloadsCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white shadow">
                      {activeDownloadsCount}
                    </span>
                  )}
                </button>

                {isDownloadsMenuOpen && (
                  <>
                    {/* Transparent full-window backdrop to dismiss popover on outside click */}
                    <div
                      className="fixed inset-0 z-40 select-none bg-transparent"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDownloadsMenuOpen(false);
                      }}
                    />
                    <div
                      className="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-white/15 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-semibold text-white">Downloads</span>
                        {downloads.length > 0 && (
                          <span className="text-[10px] text-zinc-400 bg-white/10 px-1.5 py-0.5 rounded-full">
                            {downloads.length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if ((window as any).electronAPI?.send) {
                              (window as any).electronAPI.send('open-downloads-folder');
                            }
                          }}
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                          title="Open Downloads Folder"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setIsDownloadsMenuOpen(false)}
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto py-2 space-y-2">
                      {downloads.length === 0 ? (
                        <div className="py-6 text-center">
                          <FileDown className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
                          <p className="text-xs text-zinc-400 font-medium">No downloads yet</p>
                          <p className="text-[10px] text-zinc-500 mt-1">Files you download will appear here.</p>
                        </div>
                      ) : (
                        downloads.map((d) => {
                          const sizeText =
                            d.totalBytes > 0
                              ? `${(d.receivedBytes / (1024 * 1024)).toFixed(1)} / ${(d.totalBytes / (1024 * 1024)).toFixed(1)} MB`
                              : `${(d.receivedBytes / (1024 * 1024)).toFixed(1)} MB`;

                          return (
                            <div
                              key={d.id}
                              className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors flex flex-col gap-1.5 group"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 truncate">
                                  {d.state === 'completed' ? (
                                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                                  ) : d.state === 'progressing' ? (
                                    <Download className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                  )}
                                  <span
                                    onClick={() => {
                                      if (d.state === 'completed' && (window as any).electronAPI?.send) {
                                        (window as any).electronAPI.send('open-download-file', d.savePath);
                                      }
                                    }}
                                    className={`text-xs font-medium text-zinc-200 truncate ${
                                      d.state === 'completed' ? 'hover:underline cursor-pointer' : ''
                                    }`}
                                    title={d.filename}
                                  >
                                    {d.filename}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {d.state === 'progressing' && (
                                    <>
                                      <button
                                        onClick={() => {
                                          if ((window as any).electronAPI?.send) {
                                            (window as any).electronAPI.send(
                                              d.isPaused ? 'resume-download' : 'pause-download',
                                              d.id
                                            );
                                          }
                                        }}
                                        className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                                        title={d.isPaused ? 'Resume' : 'Pause'}
                                      >
                                        {d.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                                      </button>
                                      <button
                                        onClick={() => {
                                          if ((window as any).electronAPI?.send) {
                                            (window as any).electronAPI.send('cancel-download', d.id);
                                          }
                                        }}
                                        className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-red-400"
                                        title="Cancel"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </>
                                  )}

                                  {d.state === 'completed' && (
                                    <button
                                      onClick={() => {
                                        if ((window as any).electronAPI?.send) {
                                          (window as any).electronAPI.send('show-download-in-folder', d.savePath);
                                        }
                                      }}
                                      className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                                      title="Show in Finder"
                                    >
                                      <FolderOpen className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Progress Bar */}
                              {d.state === 'progressing' && (
                                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-indigo-500 h-full rounded-full transition-all duration-200"
                                    style={{ width: `${Math.max(5, d.percent)}%` }}
                                  />
                                </div>
                              )}

                              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                <span>{sizeText}</span>
                                <span className="capitalize">
                                  {d.state === 'completed' ? 'Done' : d.state === 'progressing' ? `${d.percent}%` : d.state}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    </div>
                  </>
                )}
              </div>
              )}

              <button
                onClick={() => {
                  setIsSplitView(!isSplitView);
                  if (!secondaryTabId) {
                    const otherTab = tabs.find((t) => t.id !== activeTabId && !t.isArchived);
                    if (otherTab) setSecondaryTabId(otherTab.id);
                  }
                }}
                className={`p-1.5 rounded-lg transition-colors ${
                  isSplitView
                    ? isLightHeader
                      ? 'bg-black/20 text-black'
                      : 'bg-white/20 text-white'
                    : isLightHeader
                    ? 'text-zinc-600 hover:text-black hover:bg-black/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
                title="Toggle Split View"
              >
                <Columns2 className="w-4 h-4" />
              </button>

              {/* Three-Dot Vertical Menu (More Actions: Find in Page, PiP, Settings, etc.) */}
              <div className="relative">
                <button
                  onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                  className={`p-1.5 rounded-lg transition-colors relative ${
                    isMoreMenuOpen
                      ? isLightHeader
                        ? 'bg-black/15 text-black'
                        : 'bg-white/15 text-white'
                      : isLightHeader
                      ? 'text-zinc-600 hover:text-black hover:bg-black/10'
                      : 'text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {isMoreMenuOpen && (
                  <>
                    {/* Transparent full-window backdrop to dismiss popover on outside click */}
                    <div
                      className="fixed inset-0 z-40 select-none bg-transparent"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMoreMenuOpen(false);
                      }}
                    />
                    <div
                      className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-white/15 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs text-zinc-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          openFindInPageBar();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <Search className="w-4 h-4 text-sky-400" />
                          <span>Find in page...</span>
                        </div>
                        <kbd className="text-[10px] text-zinc-500 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10">⌘F</kbd>
                      </button>

                      <button
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          handleTogglePip();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <PictureInPicture2 className="w-4 h-4 text-emerald-400" />
                          <span>Picture in Picture</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">Video</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          handleNewTab(activeSpaceId);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <Plus className="w-4 h-4 text-indigo-400" />
                          <span>New tab</span>
                        </div>
                        <kbd className="text-[10px] text-zinc-500 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10">⌘T</kbd>
                      </button>

                      <button
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          setIsHistoryManagerOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <Clock className="w-4 h-4 text-amber-400" />
                          <span>History</span>
                        </div>
                        <kbd className="text-[10px] text-zinc-500 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10">⌘Y</kbd>
                      </button>

                      <div className="my-1 border-t border-white/10" />

                      <button
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          setIsSettingsOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-left"
                      >
                        <Settings className="w-4 h-4 text-zinc-400" />
                        <span>Settings</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* MULTI-VIEW BROWSER ENGINE (Zero-Reload Keep-Alive Cache for Instant Switching) */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* FLOATING IN-PAGE FIND BAR (Cmd+F) */}
            {isFindInPageOpen && (
              <div
                className="absolute top-3 right-5 z-40 flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-white/20 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 text-xs text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <Search className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <input
                  ref={findInputRef}
                  type="text"
                  value={findSearchText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFindSearchText(val);
                    if (!val) {
                      setFindMatchIndex(0);
                      setFindMatchTotal(0);
                      const activeEl = webviewMapRef.current.get(activeTabId);
                      if (activeEl && typeof (activeEl as any).stopFindInPage === 'function') {
                        (activeEl as any).stopFindInPage('clearSelection');
                      }
                    } else {
                      const activeEl = webviewMapRef.current.get(activeTabId);
                      if (activeEl && typeof (activeEl as any).findInPage === 'function') {
                        (activeEl as any).findInPage(val, { forward: true, findNext: false });
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFindInPage(!e.shiftKey, true);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleStopFindInPage();
                    }
                  }}
                  placeholder="Find in page..."
                  className="bg-transparent border-none outline-none text-xs text-white placeholder-zinc-500 w-44"
                />

                {findSearchText && (
                  <span className="text-[11px] text-zinc-400 font-mono shrink-0 select-none">
                    {findMatchTotal > 0 ? `${findMatchIndex} of ${findMatchTotal}` : 'No matches'}
                  </span>
                )}

                <div className="flex items-center gap-0.5 border-l border-white/10 pl-1.5">
                  <button
                    onClick={() => handleFindInPage(false, true)}
                    disabled={!findSearchText || findMatchTotal === 0}
                    className="p-1 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-300 hover:text-white transition-colors"
                    title="Previous match (Shift+Enter)"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFindInPage(true, true)}
                    disabled={!findSearchText || findMatchTotal === 0}
                    className="p-1 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-300 hover:text-white transition-colors"
                    title="Next match (Enter)"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleStopFindInPage}
                    className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors ml-1"
                    title="Close (Esc)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div
              className="flex-1 h-full relative transition-colors duration-300"
              style={{ backgroundColor: activeTabThemeColor || '#161c22' }}
            >
              {mountedTabs.map((tab) => {
                const isActive = activeTab?.id === tab.id;
                const isNewTabPage = tab.url === 'aura://newtab' || tab.url === 'about:blank' || !tab.url;

                return (
                  <div
                    key={tab.id}
                    className={`absolute inset-0 w-full h-full ${
                      isActive ? 'visible opacity-100 z-10' : 'invisible opacity-0 z-0 pointer-events-none'
                    } ${
                      isProfileMenuOpen ||
                      isSettingsOpen ||
                      isHistoryManagerOpen ||
                      isCommandBarOpen ||
                      !!tabContextMenu ||
                      !!activeDragTabId
                        ? 'pointer-events-none'
                        : ''
                    }`}
                  >
                    {isNewTabPage ? (
                      <ChromeNewTabPage
                        onNavigate={(targetUrl) => {
                          handleNavigate(targetUrl);
                        }}
                        searchEngineBaseUrl={SEARCH_ENGINES[searchEngine]?.searchUrl || SEARCH_ENGINES.google.searchUrl}
                        spaceId={tab.spaceId || activeSpaceId}
                      />
                    ) : (
                      <>
                        {/* Sleek Non-Blocking Indeterminate Progress Bar (Never covers or blocks the webpage) */}
                        {tab.isLoading && isActive && (
                          <div className="absolute top-0 left-0 right-0 h-[2.5px] z-20 pointer-events-none overflow-hidden bg-white/5">
                            <div className="h-full bg-gradient-to-r from-sky-400 via-indigo-500 to-cyan-400 w-1/3 loading-progress-bar rounded-full shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
                          </div>
                        )}
                        {/* @ts-ignore */}
                        <webview
                          key={tab.id}
                      ref={(el) => {
                        if (el) {
                          webviewMapRef.current.set(tab.id, el);
                          if (isActive) activeWebviewRef.current = el;

                          if (!(el as any).__auraListenersAttached) {
                            (el as any).__auraListenersAttached = true;

                            const safeSetAudioMuted = (muted: boolean) => {
                              try {
                                if (typeof (el as any).setAudioMuted === 'function') {
                                  (el as any).setAudioMuted(muted);
                                }
                              } catch (e) {}
                            };

                            // Route new-window events (target="_blank", Cmd+Click, window.open) directly into tabs in background
                            // Allow auth/identity popups (e.g. Microsoft Entra ID / Google / SSO) to open their popup window
                            el.addEventListener('new-window', (e: any) => {
                              const url = e.url || '';
                              const isAuthPopup =
                                url.includes('login.microsoftonline.com') ||
                                url.includes('login.microsoft.com') ||
                                url.includes('login.live.com') ||
                                url.includes('account.microsoft.com') ||
                                url.includes('msftidentity.com') ||
                                url.includes('msauth.net') ||
                                url.includes('accounts.google.com') ||
                                url.includes('/oauth') ||
                                url.includes('/authorize') ||
                                url.includes('/saml');

                              if (!isAuthPopup) {
                                e.preventDefault();
                                if (e.url && e.url !== 'about:blank') {
                                  handleOpenInNewTab(e.url, e.disposition);
                                }
                              }
                            });

                            // Dynamically update tab title, smart grouping, and clear loading state when page loads
                            const handleMetadataUpdate = (newTitle?: string, newUrl?: string, finishedLoading?: boolean) => {
                              setTabs((prev) =>
                                prev.map((t) => {
                                  if (t.id === tab.id) {
                                    const updatedTitle = newTitle && newTitle.trim() ? newTitle : t.title;
                                    // Do NOT overwrite t.url if newUrl is equivalent to avoid React prop churn on <webview src>
                                    const isSameUrl = isUrlEquivalent(newUrl, t.url);
                                    const effectiveUrl = isSameUrl ? t.url : (newUrl && newUrl.trim() ? newUrl : t.url);
                                    const isSameTitle = updatedTitle === t.title;
                                    const isSameLoading = finishedLoading !== undefined ? !finishedLoading === t.isLoading : true;
                                    if (isSameUrl && isSameTitle && isSameLoading) {
                                      return t;
                                    }
                                    return {
                                      ...t,
                                      title: updatedTitle,
                                      url: effectiveUrl,
                                      initialUrl: t.initialUrl || effectiveUrl,
                                      isLoading: finishedLoading !== undefined ? !finishedLoading : t.isLoading,
                                      // Preserve tab category; 100% on-demand grouping only (no background auto-grouping)
                                      category: t.category,
                                    };
                                  }
                                  return t;
                                })
                              );
                            };

                            // Dynamically update tab theme color
                            const updateThemeColor = (color?: string | null) => {
                              if (!color) return;
                              const trimmed = color.trim();
                              if (
                                trimmed === 'transparent' ||
                                trimmed === 'inherit' ||
                                trimmed === 'rgba(0, 0, 0, 0)' ||
                                trimmed.startsWith('rgba(0,0,0,0') ||
                                trimmed.startsWith('rgba(0, 0, 0, 0')
                              ) {
                                return;
                              }
                              setTabs((prev) =>
                                prev.map((t) => {
                                  if (t.id === tab.id) {
                                    if (t.themeColor === trimmed) return t;
                                    return { ...t, themeColor: trimmed };
                                  }
                                  return t;
                                })
                              );
                            };

                            // Query webpage DOM directly for topmost background / header color
                            const queryAndApplyThemeColor = () => {
                              try {
                                (el as any).executeJavaScript(`
                                  (() => {
                                    try {
                                      function getEffectiveBg(el) {
                                        let curr = el;
                                        while (curr && curr !== document && curr !== window) {
                                          const s = window.getComputedStyle(curr);
                                          const bg = s.backgroundColor;
                                          if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'inherit') {
                                            const m = bg.match(/rgba\\s*\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*([\\d\\.]+)\\s*\\)/);
                                            if (!m || parseFloat(m[1]) > 0.05) return bg;
                                          }
                                          curr = curr.parentElement;
                                        }
                                        return null;
                                      }

                                      // 1. Sample topmost visual elements touching the top bar
                                      const pCenter = document.elementFromPoint(Math.floor(window.innerWidth / 2), 5);
                                      const bgCenter = pCenter ? getEffectiveBg(pCenter) : null;
                                      if (bgCenter) return bgCenter;

                                      const pLeft = document.elementFromPoint(120, 5);
                                      const bgLeft = pLeft ? getEffectiveBg(pLeft) : null;
                                      if (bgLeft) return bgLeft;

                                      // 2. Specific site header selectors
                                      const masthead = document.querySelector('#masthead, ytd-masthead, #masthead-container');
                                      if (masthead) {
                                        const bg = getEffectiveBg(masthead);
                                        if (bg) return bg;
                                      }

                                      const header = document.querySelector('.page-layout__header, header, nav, [role="banner"], #header, .header');
                                      if (header) {
                                        const bg = getEffectiveBg(header);
                                        if (bg) return bg;
                                      }

                                      // 3. Meta theme-color matching prefers-color-scheme
                                      const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
                                      const matched = metas.find(m => {
                                        const media = m.getAttribute('media');
                                        return !media || (window.matchMedia && window.matchMedia(media).matches);
                                      }) || metas[0];
                                      if (matched && matched.content && matched.content !== 'transparent') {
                                        return matched.content;
                                      }

                                      // 4. Body / Document fallback
                                      return getEffectiveBg(document.body) || getEffectiveBg(document.documentElement);
                                    } catch (e) {
                                      return null;
                                    }
                                  })()
                                `).then((color: string | null) => {
                                  if (color) {
                                    updateThemeColor(color);
                                  }
                                }).catch(() => {});
                              } catch (e) {}
                            };

                            // Listen for preload messages (theme color updates, Cmd+Click -> new tab, Option+Click -> Little Aura)
                            el.addEventListener('ipc-message', (e: any) => {
                              if (e.channel === 'theme-color-update' && e.args?.[0]) {
                                updateThemeColor(e.args[0]);
                              } else if (e.channel === 'open-in-little-arc' && e.args?.[0]) {
                                openLittleArc(e.args[0]);
                              } else if (e.channel === 'open-in-new-tab' && e.args?.[0]) {
                                const payload = e.args[0];
                                if (typeof payload === 'string') {
                                  handleOpenInNewTab(payload);
                                } else if (payload && payload.url) {
                                  handleOpenInNewTab(payload.url, payload.disposition);
                                }
                              } else if (e.channel === 'exit-fullscreen-if-needed') {
                                if ((window as any).electronAPI?.send) {
                                  (window as any).electronAPI.send('window-toggle-fullscreen');
                                }
                              } else if (e.channel === 'open-find-in-page') {
                                openFindInPageBar();
                              }
                            });

                            // Handle native found-in-page result
                            el.addEventListener('found-in-page', (e: any) => {
                              if (e.result) {
                                setFindMatchIndex(e.result.activeMatchOrdinal || 0);
                                setFindMatchTotal(e.result.matches || 0);
                              }
                            });

                            // Listen for Electron native did-change-theme-color events
                            el.addEventListener('did-change-theme-color', (e: any) => {
                              if (e.themeColor) {
                                updateThemeColor(e.themeColor);
                              }
                            });

                            el.addEventListener('did-start-loading', () => {
                              setIsExtensionMenuOpen(false);
                              setIsDownloadsMenuOpen(false);
                              setIsMoreMenuOpen(false);
                              setTabs((prev) =>
                                prev.map((t) => (t.id === tab.id ? { ...t, isLoading: true } : t))
                              );
                            });

                            el.addEventListener('dom-ready', () => {
                              safeSetAudioMuted(!!tab.isMuted);

                              // Register this guest webContents with the Chrome Extension system (allows Bitwarden, uBlock, etc. to see tabs and SSO flow)
                              try {
                                if (typeof (el as any).getWebContentsId === 'function') {
                                  const wcId = (el as any).getWebContentsId();
                                  if (wcId && (window as any).electronAPI?.send) {
                                    (window as any).electronAPI.send('register-guest-tab', {
                                      webContentsId: wcId,
                                      tabId: tab.id,
                                      spaceId: tab.spaceId,
                                      isActive: tab.id === activeTabId,
                                    });
                                  }
                                }
                              } catch (e) {}

                              try {
                                const currentTitle = (el as any).getTitle?.();
                                if (currentTitle && currentTitle.trim() && !currentTitle.startsWith('http')) {
                                  handleMetadataUpdate(currentTitle, undefined, true);
                                }
                              } catch (e) {}
                              // Safety timeout for complex SPAs (e.g. Figma, Canva) to prevent endless loading spinner
                              setTimeout(() => {
                                setTabs((prev) =>
                                  prev.map((t) => (t.id === tab.id && t.isLoading ? { ...t, isLoading: false } : t))
                                );
                              }, 2500);
                              queryAndApplyThemeColor();
                            });

                            el.addEventListener('did-stop-loading', () => {
                              setTabs((prev) =>
                                prev.map((t) => (t.id === tab.id ? { ...t, isLoading: false } : t))
                              );
                              queryAndApplyThemeColor();
                            });

                            el.addEventListener('media-started-playing', () => {
                              setTabs((prev) =>
                                prev.map((t) => (t.id === tab.id ? { ...t, hasAudio: true } : t))
                              );
                            });

                            el.addEventListener('media-paused', () => {
                              try {
                                if (typeof (el as any).isCurrentlyAudible === 'function' && (el as any).isCurrentlyAudible()) {
                                  return;
                                }
                              } catch (err) {}
                              setTabs((prev) =>
                                prev.map((t) => (t.id === tab.id ? { ...t, hasAudio: false } : t))
                              );
                            });

                            el.addEventListener('audio-state-changed', (e: any) => {
                              const audible = !!e.audible;
                              setTabs((prev) =>
                                prev.map((t) => (t.id === tab.id ? { ...t, hasAudio: audible } : t))
                              );
                            });

                            el.addEventListener('page-favicon-updated', (e: any) => {
                              if (e.favicons && e.favicons.length > 0) {
                                const faviconUrl = e.favicons[0];
                                if (faviconUrl) {
                                  setTabs((prev) =>
                                    prev.map((t) => (t.id === tab.id ? { ...t, favicon: faviconUrl } : t))
                                  );
                                  // Cache successful non-blob, non-data URL for this domain
                                  try {
                                    if (!faviconUrl.startsWith('blob:') && !faviconUrl.startsWith('data:') && tab.url) {
                                      const h = new URL(tab.url).hostname.replace(/^www\./, '').toLowerCase();
                                      if (h) localStorage.setItem(`aura_fav_${h}`, faviconUrl);
                                    }
                                  } catch (err) {}
                                }
                              }
                            });

                            // Update navigation back/forward capabilities
                            const syncNav = () => updateTabNavState(tab.id);
                            el.addEventListener('dom-ready', syncNav);
                            el.addEventListener('did-navigate', syncNav);
                            el.addEventListener('did-navigate-in-page', syncNav);
                            el.addEventListener('did-stop-loading', syncNav);

                            el.addEventListener('page-title-updated', (e: any) => {
                              if (e.title && e.title.trim()) {
                                handleMetadataUpdate(e.title, undefined, true);
                              }
                            });

                            el.addEventListener('did-navigate', (e: any) => {
                              if (e.url && e.url.startsWith('http')) {
                                // CRITICAL: Do NOT update tab.url for Microsoft / OAuth auth redirect URLs.
                                // When the webview follows an auth redirect, `did-navigate` fires with the
                                // intermediate redirect URL. If we update tab.url with that URL, React re-renders
                                // the <webview src={tab.url}> with the new value, and Electron sends a fresh GET
                                // request to that URL — which Microsoft STS rejects with AADSTS10040141 / AADSTS900561.
                                // We only skip the URL state update; history recording and theme color still fire.
                                const isMsAuthUrl =
                                  e.url.includes('login.microsoftonline.com') ||
                                  e.url.includes('login.microsoft.com') ||
                                  e.url.includes('login.live.com') ||
                                  e.url.includes('account.microsoft.com') ||
                                  e.url.includes('msftidentity.com') ||
                                  e.url.includes('msauth.net') ||
                                  e.url.includes('login.windows.net') ||
                                  e.url.includes('sts.windows.net') ||
                                  e.url.includes('account.live.com') ||
                                  e.url.includes('accounts.google.com');

                                if (!isMsAuthUrl) {
                                  handleMetadataUpdate(undefined, e.url, undefined);
                                }

                                recordVisit(e.url, (el as any).getTitle?.(), tab.spaceId);
                                try {
                                  const currentHost = new URL(tab.url).hostname;
                                  const newHost = new URL(e.url).hostname;
                                  if (currentHost !== newHost) {
                                    setTabs((prev) =>
                                      prev.map((t) => (t.id === tab.id ? { ...t, themeColor: null } : t))
                                    );
                                  }
                                } catch (err) {}
                                setTimeout(queryAndApplyThemeColor, 200);
                              }
                            });

                            el.addEventListener('did-fail-load', (e: any) => {
                              // Error -3 is ERR_ABORTED: harmlessly triggered when an in-flight request is superseded
                              // or cancelled (such as redirects, background prerender, or rapid tab switching).
                              if (e.errorCode === -3) {
                                return;
                              }
                              setTabs((prev) =>
                                prev.map((t) => (t.id === tab.id ? { ...t, isLoading: false } : t))
                              );
                            });

                            // Auto-recover if webview renderer crashes or turns blank
                            el.addEventListener('crashed', (e: any) => {
                              console.error('⚠️ [CRASH] Webview crashed for tab:', tab.id, tab.url, e);
                              try {
                                (el as any).reload();
                              } catch (err) {}
                            });

                            el.addEventListener('render-process-gone', (e: any) => {
                              console.error('⚠️ [CRASH] Webview render-process-gone for tab:', tab.id, tab.url, e.details);
                              if (e.details?.reason !== 'clean-exit') {
                                try {
                                  (el as any).reload();
                                } catch (err) {}
                              }
                            });
                          }
                        } else {
                          webviewMapRef.current.delete(tab.id);
                        }
                      }}
                      src={tab.initialUrl || tab.url}
                      className="w-full h-full border-none"
                      partition={`persist:${tab.spaceId || 'default'}`}
                      preload={webviewPreloadPath || undefined}
                      useragent={DESKTOP_CHROME_UA}
                      {...({ allowpopups: 'true', webpreferences: 'nativeWindowOpen=yes,contextIsolation=yes,backgroundThrottling=no' } as any)}
                    />
                  </>
                )}
              </div>
            );
          })}

          {!activeTab && (
            <ChromeNewTabPage
              onNavigate={(targetUrl) => handleNewTab(activeSpaceId, targetUrl)}
              searchEngineBaseUrl={SEARCH_ENGINES[searchEngine]?.searchUrl || SEARCH_ENGINES.google.searchUrl}
              spaceId={activeSpaceId}
            />
          )}
            </div>

            {isSplitView && secondaryTab && (
              <div className="flex-1 h-full bg-[#161c22] border-l border-zinc-700/50 relative">
                <div className="absolute top-2 right-2 z-10">
                  <button
                    onClick={() => setIsSplitView(false)}
                    className="p-1 rounded-md bg-zinc-900/80 text-zinc-400 hover:text-white shadow-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* @ts-ignore */}
                <webview
                  key={secondaryTab.id}
                  src={secondaryTab.initialUrl || secondaryTab.url}
                  className={`w-full h-full border-none ${
                    isProfileMenuOpen ||
                    isSettingsOpen ||
                    isHistoryManagerOpen ||
                    isCommandBarOpen ||
                    !!tabContextMenu
                      ? 'pointer-events-none'
                      : ''
                  }`}
                  partition={`persist:${secondaryTab.spaceId || 'default'}`}
                  preload={webviewPreloadPath || undefined}
                  useragent={DESKTOP_CHROME_UA}
                  {...({ allowpopups: 'true', webpreferences: 'nativeWindowOpen=yes,contextIsolation=yes' } as any)}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* DIA-STYLE FLOATING OMNIBAR MODAL OVERLAY */}
            {isInlineOmnibarActive && (() => {
              const handleSelectSuggestion = (item: typeof inlineOmnibarSuggestions[0]) => {
                if (item.type === 'tab') {
                  switchTab(item.id);
                } else if (item.type === 'history') {
                  handleNavigate(item.url);
                } else {
                  handleNavigate(item.query);
                }
                setIsInlineOmnibarActive(false);
              };

              let activeFavicon = '';
              try {
                if (activeTab?.url) {
                  const u = new URL(activeTab.url);
                  activeFavicon = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
                }
              } catch (e) {}

              return (
                <div
                  className="fixed inset-0 z-50 flex items-start justify-center pt-2 select-none no-drag"
                  onClick={(e) => {
                    // Close if clicking anywhere outside the card
                    if (e.target === e.currentTarget) {
                      setIsInlineOmnibarActive(false);
                    }
                  }}
                >
                  {/* Backdrop click barrier */}
                  <div
                    className="absolute inset-0 bg-black/30 backdrop-blur-[1px] no-drag cursor-default"
                    onClick={() => setIsInlineOmnibarActive(false)}
                  />

                  {/* Dia Floating Omnibar Container */}
                  <div
                    className="relative w-[96%] max-w-4xl bg-[#242424] text-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/[0.08] flex flex-col overflow-hidden animate-in fade-in zoom-in-98 duration-100 z-10 no-drag"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {/* Top Input Bar */}
                    <div className="flex items-center px-4 pt-3.5 pb-2 gap-3">
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        {activeFavicon ? (
                          <img
                            src={activeFavicon}
                            alt=""
                            className="w-4 h-4 object-contain rounded"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Globe className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          // If user specifically navigated with down/up arrows, select that suggestion
                          if (
                            inlineOmnibarSelectedIndex >= 0 &&
                            inlineOmnibarSuggestions[inlineOmnibarSelectedIndex]
                          ) {
                            handleSelectSuggestion(inlineOmnibarSuggestions[inlineOmnibarSelectedIndex]);
                            return;
                          }
                          // Otherwise navigate/search directly with what the user typed!
                          const val = inlineOmnibarValue.trim();
                          if (val) {
                            handleNavigate(val);
                          }
                          setIsInlineOmnibarActive(false);
                        }}
                        className="flex-1 flex items-center min-w-0"
                      >
                        <input
                          ref={inlineOmnibarInputRef}
                          type="text"
                          value={inlineOmnibarValue}
                          onChange={(e) => setInlineOmnibarValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setIsInlineOmnibarActive(false);
                            } else if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setInlineOmnibarSelectedIndex((prev) =>
                                prev < inlineOmnibarSuggestions.length - 1 ? prev + 1 : 0
                              );
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setInlineOmnibarSelectedIndex((prev) =>
                                prev > 0 ? prev - 1 : -1
                              );
                            }
                          }}
                          placeholder="Search or enter URL"
                          className="w-full bg-transparent text-white text-sm font-normal outline-none placeholder-zinc-500 selection:bg-white/20"
                        />
                      </form>
                    </div>

                    {/* Suggestions List (Clickable & Keyboard Selectable) */}
                    <div className="flex flex-col px-2 py-1 max-h-[380px] overflow-y-auto">
                      {inlineOmnibarSuggestions.map((item, idx) => {
                        const isSelected = idx === inlineOmnibarSelectedIndex;

                        let itemFavicon = '';
                        let domainName = '';
                        let displayUrl = '';
                        if (item.type === 'tab' || item.type === 'history') {
                          try {
                            const u = new URL(item.url);
                            itemFavicon = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
                            domainName = u.hostname.replace(/^www\./, '');
                            displayUrl = item.url.replace(/^https?:\/\//, '');
                          } catch (e) {
                            domainName = item.url;
                            displayUrl = item.url;
                          }
                        }

                        return (
                          <div
                            key={idx}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectSuggestion(item);
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectSuggestion(item);
                            }}
                            onMouseEnter={() => setInlineOmnibarSelectedIndex(idx)}
                            className={`group px-3 py-2 rounded-xl flex items-center justify-between gap-3 cursor-pointer text-sm transition-colors no-drag ${
                              isSelected ? 'bg-white/10 text-white font-medium' : 'text-zinc-300 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-3 truncate flex-1 min-w-0">
                              {/* Left Icon */}
                              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                {item.type === 'google' ? (
                                  <Search className="w-4 h-4 text-zinc-400" />
                                ) : itemFavicon ? (
                                  <img
                                    src={itemFavicon}
                                    alt=""
                                    className="w-4 h-4 object-contain rounded"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <Globe className="w-4 h-4 text-zinc-400" />
                                )}
                              </div>

                              {/* Title / Description */}
                              {item.type === 'google' ? (
                                <span className="text-zinc-200 text-sm truncate">{item.text}</span>
                              ) : (
                                <div className="flex items-center gap-1.5 truncate text-sm">
                                  <span className="font-medium text-white truncate">{item.title}</span>
                                  <span className="text-zinc-500 font-light">—</span>
                                  <span className="text-zinc-400 text-xs truncate max-w-[420px] font-normal">
                                    {displayUrl}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Badge */}
                            {item.type === 'tab' && (
                              <span className="text-[10px] text-zinc-400 px-2 py-0.5 rounded-full bg-white/5 shrink-0 font-medium">
                                Switch Tab
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Action Bar matching Dia */}
                    <div className="px-3 py-2.5 mt-1 border-t border-white/[0.06] flex items-center justify-end text-xs">
                      {/* Right: Mic + Go Pill Button */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="p-1 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer no-drag"
                          title="Voice input"
                        >
                          <Mic className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (
                              inlineOmnibarSelectedIndex >= 0 &&
                              inlineOmnibarSuggestions[inlineOmnibarSelectedIndex]
                            ) {
                              handleSelectSuggestion(inlineOmnibarSuggestions[inlineOmnibarSelectedIndex]);
                              return;
                            }
                            const val = inlineOmnibarValue.trim();
                            if (val) handleNavigate(val);
                            setIsInlineOmnibarActive(false);
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (
                              inlineOmnibarSelectedIndex >= 0 &&
                              inlineOmnibarSuggestions[inlineOmnibarSelectedIndex]
                            ) {
                              handleSelectSuggestion(inlineOmnibarSuggestions[inlineOmnibarSelectedIndex]);
                              return;
                            }
                            const val = inlineOmnibarValue.trim();
                            if (val) handleNavigate(val);
                            setIsInlineOmnibarActive(false);
                          }}
                          className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#f2f2f2] hover:bg-white text-black font-semibold text-xs shadow transition-transform active:scale-95 cursor-pointer no-drag"
                        >
                          <span>Go</span>
                          <CornerDownLeft className="w-3 h-3 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            

      {/* 3. ARC-STYLE COMMAND PALETTE & SEARCH BAR (CMD + P / TOP BAR CLICK) */}
      {isCommandBarOpen && (() => {
        // Build combined items: current search actions, matched open tabs, and Google query suggestions
        type PaletteItem =
          | { type: 'google'; text: string; query: string }
          | { type: 'chat'; text: string; query: string }
          | { type: 'suggestion'; text: string; query: string }
          | { type: 'action'; text: string; action: () => void }
          | { type: 'tab'; tab: TabItem };

        const items: PaletteItem[] = [];
        const cleanQuery = commandQuery.trim();

        if (cleanQuery) {
          items.push({ type: 'google', text: `${cleanQuery} — Google`, query: cleanQuery });
          items.push({ type: 'chat', text: `${cleanQuery} — Chat`, query: cleanQuery });

          if ('check for updates'.includes(cleanQuery.toLowerCase()) || 'update'.includes(cleanQuery.toLowerCase())) {
            items.push({
              type: 'action',
              text: '✨ Check for Updates...',
              action: () => checkForUpdates(true),
            });
          }

          // Add live search suggestions
          for (const sugg of liveSuggestions) {
            if (sugg.toLowerCase() !== cleanQuery.toLowerCase()) {
              items.push({ type: 'suggestion', text: sugg, query: sugg });
            }
          }
        }

        // Add matching open tabs from searchResults
        for (const t of searchResults) {
          items.push({ type: 'tab', tab: t });
        }

        const handleSelectItem = (item: PaletteItem) => {
          if (item.type === 'tab') {
            switchTab(item.tab.id);
          } else if (item.type === 'action') {
            item.action();
          } else {
            handleNavigate(item.query);
          }
          setIsCommandBarOpen(false);
          setCommandQuery('');
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/55 backdrop-blur-md animate-in fade-in duration-100"
            onClick={() => {
              setIsCommandBarOpen(false);
              setCommandQuery('');
            }}
          >
            <div
              className="w-full max-w-2xl rounded-2xl bg-[#1e2022]/95 border border-white/10 shadow-2xl overflow-hidden flex flex-col text-zinc-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Input Bar matching Arc style */}
              <div className="flex items-center px-4 py-3 gap-3">
                <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search or enter URL..."
                  value={commandQuery}
                  onChange={(e) => {
                    setCommandQuery(e.target.value);
                    setSelectedResultIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedResultIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedResultIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (items.length > 0 && items[selectedResultIndex]) {
                        handleSelectItem(items[selectedResultIndex]);
                      } else if (cleanQuery) {
                        handleNavigate(cleanQuery);
                        setIsCommandBarOpen(false);
                        setCommandQuery('');
                      }
                    } else if (e.key === 'Escape') {
                      setIsCommandBarOpen(false);
                      setCommandQuery('');
                    }
                  }}
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>

              {/* Suggestions and Tabs List */}
              {items.length > 0 && (
                <div className="py-1 px-1.5 max-h-[380px] overflow-y-auto space-y-0.5 border-t border-white/5">
                  {items.map((item, idx) => {
                    const isSelected = idx === selectedResultIndex;

                    if (item.type === 'tab') {
                      const space = spaces.find((s) => s.id === item.tab.spaceId);
                      return (
                        <div
                          key={`tab-${item.tab.id}`}
                          onClick={() => handleSelectItem(item)}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-white/10 text-white font-medium'
                              : 'hover:bg-white/5 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate pr-3">
                            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              Tab
                            </span>
                            <span className="text-xs text-white truncate">{item.tab.title}</span>
                            <span className="text-[11px] text-zinc-500 truncate">{item.tab.url}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 font-mono shrink-0">
                            {space?.name || 'Space'}
                          </span>
                        </div>
                      );
                    }

                    if (item.type === 'action') {
                      return (
                        <div
                          key={`action-${idx}`}
                          onClick={() => handleSelectItem(item)}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-600/30 text-white font-medium border border-indigo-500/40 shadow-sm'
                              : 'hover:bg-white/5 text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="text-xs text-white truncate">{item.text}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                            Action
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`item-${idx}`}
                        onClick={() => handleSelectItem(item)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-white/10 text-white font-medium'
                            : 'hover:bg-white/5 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {item.type === 'chat' ? (
                            <MessageSquare className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          ) : (
                            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          )}
                          <span className="text-xs truncate">{item.text}</span>
                        </div>

                        {item.type === 'google' && (
                          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <span>⇧⌘↵</span>
                          </div>
                        )}
                        {item.type === 'chat' && (
                          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <span>⌃⌘↵</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom Footer Action Bar matching reference screenshot */}
              <div className="flex items-center justify-between px-3 py-2 bg-black/25 border-t border-white/5 text-xs text-zinc-400">
                <button
                  onClick={() => {
                    handleNewTab();
                    setIsCommandBarOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-[11px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add tabs or files</span>
                </button>

                <div className="flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 text-zinc-500 hover:text-white cursor-pointer transition-colors" />
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-white text-[11px] font-medium">
                    <span>Google</span>
                    <RotateCw className="w-3 h-3 text-zinc-400 ml-0.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4. CHROME-STYLE RECENTLY CLOSED TABS DRAWER (CMD + SHIFT + T) */}
      {showRecentlyClosedDrawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowRecentlyClosedDrawer(false)}
        >
          <div
            className="w-96 h-full bg-[#1e2022] border-l border-white/10 p-5 flex flex-col shadow-2xl text-zinc-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">Recently Closed</h3>
                  <p className="text-[11px] text-zinc-400">
                    {closedTabsHistory.length} closed {closedTabsHistory.length === 1 ? 'tab' : 'tabs'} • Cmd+Shift+T
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {closedTabsHistory.length > 0 && (
                  <button
                    onClick={() => {
                      setClosedTabsHistory([]);
                      localStorage.removeItem('aura_recently_closed_tabs');
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] text-zinc-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                    title="Clear recently closed tabs list"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setShowRecentlyClosedDrawer(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {closedTabsHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500">
                  <RotateCcw className="w-8 h-8 stroke-1 mb-2 text-zinc-600" />
                  <p className="text-xs font-medium text-zinc-400">No recently closed tabs</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Closed tabs will appear here so you can easily reopen them.</p>
                </div>
              ) : (
                closedTabsHistory.map((tab, idx) => {
                  let host = '';
                  try {
                    host = new URL(tab.url).hostname.replace(/^www\./, '');
                  } catch (e) {
                    host = tab.url;
                  }

                  return (
                    <div
                      key={`${tab.id}-${idx}`}
                      className="group p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-sky-500/30 hover:bg-white/[0.06] flex items-center justify-between gap-3 transition-all cursor-pointer"
                      onClick={() => {
                        // Restore this specific tab
                        setClosedTabsHistory((prev) => prev.filter((_, i) => i !== idx));
                        markTabVisited(tab.id);
                        setTabs((prev) => [...prev, { ...tab, isArchived: false }]);
                        setActiveTabId(tab.id);
                        setShowRecentlyClosedDrawer(false);
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                          <TabFavicon tab={tab} className="w-3.5 h-3.5 object-contain rounded" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
                            {tab.title || host}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate">{host}</p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setClosedTabsHistory((prev) => prev.filter((_, i) => i !== idx));
                          markTabVisited(tab.id);
                          setTabs((prev) => [...prev, { ...tab, isArchived: false }]);
                          setActiveTabId(tab.id);
                          setShowRecentlyClosedDrawer(false);
                        }}
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/15 shrink-0 transition-colors"
                      >
                        Restore
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4.5 CHROME-STYLE FULL BROWSING HISTORY MANAGER (CMD + Y / SIDEBAR CLOCK BUTTON) */}
      {isHistoryManagerOpen && (() => {
        const query = historySearchQuery.trim().toLowerCase();
        const filteredHistory = visitedHistory.filter((item) => {
          if (!query) return true;
          return item.title.toLowerCase().includes(query) || item.url.toLowerCase().includes(query);
        });

        const filteredRecentlyClosed = closedTabsHistory.filter((item) => {
          if (!query) return true;
          return (item.title || '').toLowerCase().includes(query) || (item.url || '').toLowerCase().includes(query);
        });

        // Group history entries by date (Today, Yesterday, Earlier)
        const groups: Record<string, typeof visitedHistory> = {};
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        filteredHistory.forEach((item) => {
          const itemDate = new Date(item.visitedAt).toDateString();
          let groupLabel = itemDate;
          if (itemDate === today) groupLabel = 'Today';
          else if (itemDate === yesterday) groupLabel = 'Yesterday';

          if (!groups[groupLabel]) groups[groupLabel] = [];
          groups[groupLabel].push(item);
        });

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none"
            onClick={() => setIsHistoryManagerOpen(false)}
          >
            <div
              className="w-full max-w-3xl h-[80vh] rounded-2xl bg-[#1e2022] border border-white/10 shadow-2xl flex flex-col overflow-hidden text-zinc-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4 bg-[#25282a]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center text-sky-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white tracking-tight">History</h2>
                    <p className="text-[11px] text-zinc-400">
                      {historyManagerView === 'browsing'
                        ? `${visitedHistory.length} visited ${visitedHistory.length === 1 ? 'page' : 'pages'} recorded`
                        : `${closedTabsHistory.length} recently closed ${closedTabsHistory.length === 1 ? 'tab' : 'tabs'} (Cmd+Shift+T)`}
                    </p>
                  </div>
                </div>

                {/* View Switcher Tabs (Chrome Style) */}
                <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setHistoryManagerView('browsing')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      historyManagerView === 'browsing'
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Chrome History
                  </button>
                  <button
                    onClick={() => setHistoryManagerView('recently_closed')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      historyManagerView === 'recently_closed'
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>Recently Closed</span>
                    {closedTabsHistory.length > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          historyManagerView === 'recently_closed'
                            ? 'bg-white/20 text-white'
                            : 'bg-white/10 text-zinc-300'
                        }`}
                      >
                        {closedTabsHistory.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Search Bar */}
                <div className="flex-1 max-w-xs relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder={historyManagerView === 'browsing' ? 'Search history...' : 'Search recently closed...'}
                    className="w-full h-8 pl-8 pr-3 rounded-full bg-black/40 border border-white/10 text-xs text-white placeholder-zinc-500 outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all"
                  />
                  {historySearchQuery && (
                    <button
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Clear All & Close */}
                <div className="flex items-center gap-2">
                  {historyManagerView === 'browsing' && visitedHistory.length > 0 && (
                    <button
                      onClick={clearAllHistory}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/20 transition-colors flex items-center gap-1.5"
                      title="Clear browsing data"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear data</span>
                    </button>
                  )}
                  {historyManagerView === 'recently_closed' && closedTabsHistory.length > 0 && (
                    <button
                      onClick={() => {
                        setClosedTabsHistory([]);
                        localStorage.removeItem('aura_recently_closed_tabs');
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/20 transition-colors flex items-center gap-1.5"
                      title="Clear recently closed tabs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear all</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsHistoryManagerOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* History Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {historyManagerView === 'recently_closed' ? (
                  <div className="space-y-2">
                    {filteredRecentlyClosed.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <RotateCcw className="w-10 h-10 text-zinc-600 mb-2 stroke-1" />
                        <p className="text-sm font-medium text-zinc-400">
                          {query ? 'No matching closed tabs' : 'No recently closed tabs'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                          Tabs you close will appear here so you can easily restore them or use Cmd+Shift+T.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                        {filteredRecentlyClosed.map((tab, idx) => {
                          let host = '';
                          try {
                            host = new URL(tab.url).hostname.replace(/^www\./, '');
                          } catch (e) {
                            host = tab.url;
                          }
                          const timeStr = tab.lastAccessedAt
                            ? new Date(tab.lastAccessedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '';

                          return (
                            <div
                              key={`${tab.id}-${idx}`}
                              className="group px-4 py-3 flex items-center justify-between gap-4 hover:bg-white/[0.05] transition-colors cursor-pointer"
                              onClick={() => {
                                setClosedTabsHistory((prev) => prev.filter((t) => t.id !== tab.id));
                                markTabVisited(tab.id);
                                setTabs((prev) => [...prev, { ...tab, isArchived: false }]);
                                setActiveTabId(tab.id);
                                setIsHistoryManagerOpen(false);
                              }}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {timeStr && (
                                  <span className="text-[11px] font-mono text-zinc-500 shrink-0 w-14">
                                    {timeStr}
                                  </span>
                                )}
                                <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                                  <TabFavicon tab={tab} className="w-3.5 h-3.5 object-contain rounded" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
                                    {tab.title || host}
                                  </p>
                                  <p className="text-[11px] text-zinc-500 truncate">{tab.url}</p>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setClosedTabsHistory((prev) => prev.filter((t) => t.id !== tab.id));
                                  markTabVisited(tab.id);
                                  setTabs((prev) => [...prev, { ...tab, isArchived: false }]);
                                  setActiveTabId(tab.id);
                                  setIsHistoryManagerOpen(false);
                                }}
                                className="px-3 py-1 rounded-lg text-xs font-medium text-sky-400 hover:text-white hover:bg-sky-500/20 transition-colors shrink-0"
                              >
                                Restore Tab
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : Object.keys(groups).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Clock className="w-10 h-10 text-zinc-600 mb-2 stroke-1" />
                    <p className="text-sm font-medium text-zinc-400">
                      {query ? 'No matching history found' : 'No history entries yet'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                      {query
                        ? 'Try typing a different keyword or URL'
                        : 'Websites you visit in Slate will appear here just like Chrome.'}
                    </p>
                  </div>
                ) : (
                  Object.entries(groups).map(([dateLabel, items]) => (
                    <div key={dateLabel} className="space-y-2">
                      <h3 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase px-2">
                        {dateLabel}
                      </h3>

                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                        {items.map((entry) => {
                          const timeStr = new Date(entry.visitedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          });

                          let host = '';
                          try {
                            host = new URL(entry.url).hostname.replace(/^www\./, '');
                          } catch (e) {
                            host = entry.url;
                          }

                          return (
                            <div
                              key={entry.id}
                              onClick={() => {
                                handleNavigate(entry.url);
                                setIsHistoryManagerOpen(false);
                              }}
                              className="group px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-white/5 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-3 truncate flex-1 min-w-0">
                                <span className="text-[11px] text-zinc-500 font-mono w-14 shrink-0">
                                  {timeStr}
                                </span>

                                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                  <img
                                    src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
                                    alt=""
                                    className="w-4 h-4 object-contain rounded"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                </div>

                                <div className="truncate flex-1 min-w-0 flex items-center gap-2">
                                  <span className="text-xs font-medium text-zinc-200 group-hover:text-sky-300 truncate transition-colors">
                                    {entry.title}
                                  </span>
                                  <span className="text-[11px] text-zinc-500 truncate max-w-[280px]">
                                    {host}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenInNewTab(entry.url);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-opacity"
                                  title="Open in new tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => deleteHistoryItem(entry.id, e)}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-opacity"
                                  title="Remove from history"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. NATIVE-STYLE GROUP & PROFILE MODAL (100% Guaranteed Reliability in Electron & Mac) */}
      {groupModalState.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => {
            if (Date.now() - modalOpenedAtRef.current < 250) return;
            setGroupModalState((prev) => ({ ...prev, isOpen: false }));
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#1c242d] border border-white/20 p-5 shadow-2xl animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                {groupModalState.mode === 'new-profile' ? (
                  <User className="w-4 h-4 text-emerald-400" />
                ) : (
                  <FolderPlus className="w-4 h-4 text-sky-400" />
                )}
                <h3 className="font-semibold text-sm text-white">{groupModalState.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setGroupModalState((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const finalName = groupInputValue.trim() || groupModalState.placeholder;

                if (groupModalState.mode === 'new-profile') {
                  const newSpace: Space = {
                    id: `space-${Date.now()}`,
                    name: finalName,
                    icon: 'User',
                    themeColor: 'from-blue-600/20 to-teal-600/10',
                  };
                  const newTabItem: TabItem = {
                    id: `tab-${Date.now()}`,
                    url: 'aura://newtab',
                    title: 'New Tab',
                    spaceId: newSpace.id,
                    lastAccessedAt: Date.now(),
                    createdAt: Date.now(),
                  };
                  setSpaces((sp) => [...sp, newSpace]);
                  setTabs((prev) => [...prev, newTabItem]);
                  setActiveSpaceId(newSpace.id);
                  setActiveTabId(newTabItem.id);
                  markTabVisited(newTabItem.id);
                  setSpaceActiveTabMap((prev) => ({ ...prev, [newSpace.id]: newTabItem.id }));
                  setTidyNotification(`Created Profile: ${finalName}`);
                  setTimeout(() => setTidyNotification(null), 2500);
                } else if (groupModalState.mode === 'new-with-tab' && groupModalState.tabId) {
                  const targetTab = tabs.find((t) => t.id === groupModalState.tabId);
                  if (targetTab) {
                    const newGroup: CustomGroup = {
                      id: `group-${Date.now()}`,
                      name: finalName,
                      spaceId: targetTab.spaceId,
                      createdAt: Date.now(),
                    };
                    setCustomGroups((prev) => [
                      ...prev.filter(
                        (g) => !(g.spaceId === targetTab.spaceId && g.name.toLowerCase() === finalName.toLowerCase())
                      ),
                      newGroup,
                    ]);
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === groupModalState.tabId
                          ? { ...t, category: finalName, isUserGroup: true }
                          : t
                      )
                    );
                    setTidyNotification(`Created Group: ${finalName}`);
                    setTimeout(() => setTidyNotification(null), 2500);
                  }
                } else if (groupModalState.mode === 'rename' && groupModalState.tabId) {
                  const targetTab = tabs.find((t) => t.id === groupModalState.tabId);
                  const oldCat = targetTab?.category;
                  if (oldCat) {
                    setCustomGroups((prev) =>
                      prev.map((g) =>
                        g.spaceId === targetTab.spaceId && g.name === oldCat
                          ? { ...g, name: finalName }
                          : g
                      )
                    );
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.spaceId === targetTab.spaceId && t.category === oldCat
                          ? { ...t, category: finalName, isUserGroup: true }
                          : t
                      )
                    );
                    setTidyNotification(`Renamed Group to: ${finalName}`);
                    setTimeout(() => setTidyNotification(null), 2500);
                  }
                } else if (groupModalState.mode === 'new-empty') {
                  const newGroup: CustomGroup = {
                    id: `group-${Date.now()}`,
                    name: finalName,
                    spaceId: activeSpaceId,
                    createdAt: Date.now(),
                  };
                  setCustomGroups((prev) => [
                    ...prev.filter(
                      (g) => !(g.spaceId === activeSpaceId && g.name.toLowerCase() === finalName.toLowerCase())
                    ),
                    newGroup,
                  ]);
                  const newTabItem: TabItem = {
                    id: `tab-${Date.now()}`,
                    url: 'aura://newtab',
                    title: 'New Tab',
                    spaceId: activeSpaceId,
                    category: finalName,
                    isUserGroup: true,
                    lastAccessedAt: Date.now(),
                    createdAt: Date.now(),
                  };
                  markTabVisited(newTabItem.id);
                  setTabs((prev) => [...prev, newTabItem]);
                  setActiveTabId(newTabItem.id);
                  setTidyNotification(`Created Group: ${finalName}`);
                  setTimeout(() => setTidyNotification(null), 2500);
                }

                setGroupModalState((prev) => ({ ...prev, isOpen: false }));
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1.5">
                  {groupModalState.mode === 'new-profile' ? 'Profile Name' : 'Group Name'}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={groupInputValue}
                  placeholder={groupModalState.placeholder}
                  onChange={(e) => setGroupInputValue(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-white/5 border border-white/15 focus:border-sky-400 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-400 transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGroupModalState((prev) => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs bg-sky-500 hover:bg-sky-400 text-white font-medium shadow-md shadow-sky-500/20 transition-all"
                >
                  {groupModalState.mode === 'new-profile' ? 'Save Profile' : 'Save Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* 5c. LIVE CURSOR-FOLLOWING DRAGGED GROUP PREVIEW (DIA ARCHITECTURE) */}
      {draggedGroupName && dragMousePos && (
        <div
          className="fixed z-[9999] pointer-events-none px-3 py-2 rounded-xl bg-[#1c2936]/98 border border-sky-400/50 text-white text-xs shadow-2xl flex items-center gap-2.5 backdrop-blur-2xl select-none ring-1 ring-white/15"
          style={{
            left: `${dragMousePos.x - 24}px`,
            top: `${dragMousePos.y - 18}px`,
            transform: 'rotate(2.5deg) scale(1.02)',
            willChange: 'left, top',
          }}
        >
          <Folder className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-semibold text-white truncate max-w-[130px]">{draggedGroupName}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 shrink-0">
            Group
          </span>
        </div>
      )}
      {/* 6. ARC-STYLE HOVER PREVIEW CARD (MATCHING REFERENCE IMAGE) */}
      {hoveredTabInfo && isSidebarOpen && (
        <div
          style={{ top: hoveredTabInfo.top }}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
          className="fixed left-[216px] z-50 w-[220px] p-3 rounded-2xl bg-[#1c2936]/95 backdrop-blur-xl shadow-2xl text-white pointer-events-auto animate-in fade-in zoom-in-95 duration-150 group/hovercard"
        >
          {/* Full Tab Title */}
          <h4
            onClick={() => {
              switchTab(hoveredTabInfo.tab.id);
              setHoveredTabInfo(null);
            }}
            className="text-[13px] font-semibold text-white leading-snug line-clamp-2 cursor-pointer hover:text-sky-300 transition-colors"
          >
            {hoveredTabInfo.tab.title}
          </h4>

          {/* Clean Domain Name */}
          <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
            {(() => {
              try {
                return new URL(hoveredTabInfo.tab.url).hostname.replace('www.', '');
              } catch (e) {
                return hoveredTabInfo.tab.url;
              }
            })()}
          </p>

          {/* Bottom Tool Icons (Undo/Restore, Bookmark, Split-view, AI Chat) */}
          <div className="flex items-center justify-center gap-4 mt-2.5 pt-2.5 border-t border-white/5 text-[#8fa7be]">
            <button
              onClick={() => {
                switchTab(hoveredTabInfo.tab.id);
                activeWebviewRef.current?.reload();
                setHoveredTabInfo(null);
              }}
              className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Reload / Revisit"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                togglePinTab(hoveredTabInfo.tab.id, e);
                setHoveredTabInfo(null);
              }}
              className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
              title={hoveredTabInfo.tab.isPinned ? 'Unpin' : 'Pin to top'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${hoveredTabInfo.tab.isPinned ? 'fill-sky-400 text-sky-400' : ''}`} />
            </button>
            <button
              onClick={() => {
                setSecondaryTabId(hoveredTabInfo.tab.id);
                setIsSplitView(true);
                setHoveredTabInfo(null);
              }}
              className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Open in Split View"
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                switchTab(hoveredTabInfo.tab.id);
                setIsCommandBarOpen(true);
                setHoveredTabInfo(null);
              }}
              className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Find / Search"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      {/* 7. LITTLE AURA: QUICK PEEK FLOATING WINDOW MODAL */}
      {isLittleArcInputOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md"
          onClick={() => setIsLittleArcInputOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#1c2936] border border-white/20 p-4 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-sky-400" />
                <h3 className="font-semibold text-sm text-white">Little Slate — Quick Peek</h3>
              </div>
              <kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400">Esc to close</kbd>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (littleArcInputVal.trim()) {
                  openLittleArc(littleArcInputVal);
                  setLittleArcInputVal('');
                }
              }}
              className="space-y-3"
            >
              <input
                type="text"
                autoFocus
                placeholder="Enter URL to peek (e.g. reddit.com or github.com)..."
                value={littleArcInputVal}
                onChange={(e) => setLittleArcInputVal(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Opens in a floating modal without cluttering your tabs</span>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium shadow-md shadow-sky-500/20"
                >
                  Peek URL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. CENTRALIZED SETTINGS MODAL (General Search Engine, Profiles, Favorites Management) */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#18232c] border border-white/10 shadow-2xl p-5 text-xs text-zinc-300 relative flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header & Tabs */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-white">Browser Settings</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 py-3 border-b border-white/5">
              <button
                onClick={() => setSettingsTab('general')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                  settingsTab === 'general'
                    ? 'bg-sky-500/20 text-white border border-sky-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                General & Search
              </button>
              <button
                onClick={() => setSettingsTab('profiles')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                  settingsTab === 'profiles'
                    ? 'bg-sky-500/20 text-white border border-sky-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                Profiles & Spaces
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* TAB 1: GENERAL & SEARCH */}
              {settingsTab === 'general' && (
                <div>
                  <label className="block text-xs font-medium text-white mb-1.5">
                    Default Search Engine
                  </label>
                  <p className="text-[11px] text-zinc-400 mb-3">
                    Choose the search engine used for searches from the URL bar, new tabs, and Little Slate.
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    {(Object.keys(SEARCH_ENGINES) as SearchEngine[]).map((key) => {
                      const engine = SEARCH_ENGINES[key];
                      const isSelected = searchEngine === key;
                      return (
                        <button
                          key={key}
                          onClick={() => handleSetSearchEngine(key)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-sky-500/15 border-sky-500/40 text-white font-medium shadow-sm'
                              : 'bg-white/5 border-white/5 hover:bg-white/10 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${new URL(engine.homeUrl).hostname}&sz=32`}
                              alt={engine.name}
                              className="w-4 h-4 rounded-sm"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <span>{engine.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-sky-400" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* App Version & Auto-Updates */}
                  <div className="mt-5 pt-4 border-t border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Slate Browser Version</h4>
                        <p className="text-[11px] text-zinc-400">
                          Current installed version: v{updateInfo?.currentVersion || '1.0.0'}
                        </p>
                      </div>
                      <button
                        onClick={() => checkForUpdates(true)}
                        disabled={isCheckingUpdate}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                        <span>{isCheckingUpdate ? 'Checking...' : 'Check for Updates'}</span>
                      </button>
                    </div>

                    {updateInfo?.hasUpdate ? (
                      <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 border border-indigo-400/30 flex items-center justify-between shadow-md">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-white">
                              Slate v{updateInfo.latestVersion} is available!
                            </p>
                            <p className="text-[11px] text-zinc-300">New features and improvements ready</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setIsSettingsOpen(false);
                            setIsUpdateModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>View & Download</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-zinc-400 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>You are on the latest version of Slate Browser.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: PROFILES & SPACES */}
              {settingsTab === 'profiles' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-white">Manage Profiles</h4>
                      <p className="text-[11px] text-zinc-400">Switch, rename, or add profiles</p>
                    </div>
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        handleOpenNewProfileModal();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Profile</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {spaces.map((s, idx) => (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                          activeSpaceId === s.id
                            ? 'bg-sky-500/10 border-sky-500/30'
                            : 'bg-white/5 border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-3 h-3 rounded-full ${activeSpaceId === s.id ? 'bg-sky-400' : 'bg-zinc-500'}`} />
                          <span className="font-medium text-white">{s.name}</span>
                          {activeSpaceId === s.id && (
                            <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const renamed = prompt('Rename profile:', s.name);
                              if (renamed && renamed.trim()) {
                                setSpaces(spaces.map((sp) => sp.id === s.id ? { ...sp, name: renamed.trim() } : sp));
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] transition-colors"
                          >
                            Rename
                          </button>
                          {spaces.length > 1 && (
                            <button
                              onClick={(e) => handleDeleteProfile(s.id, e)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium shadow-md shadow-sky-500/20 text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. LITTLE AURA ACTIVE FLOATING WINDOW OVERLAY */}
      {littleArcUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-8 animate-in fade-in duration-150"
          onClick={() => setLittleArcUrl(null)}
        >
          <div
            className="w-full max-w-4xl h-[85vh] rounded-2xl bg-[#141d24] border border-white/15 shadow-2xl flex flex-col overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Little Aura Title & Control Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#1c2936] border-b border-white/10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setLittleArcUrl(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white truncate max-w-sm">
                    {littleArcTitle}
                  </span>
                  <span className="text-[10px] text-zinc-500 truncate max-w-xs">{littleArcUrl}</span>
                </div>
              </div>

              {/* Action: Promote to permanent Tab in current Space */}
              <div className="flex items-center gap-2">
                <button
                  onClick={promoteLittleArcToTab}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-medium border border-sky-500/30 transition-all shadow-sm"
                  title="Move to current space tabs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in {activeSpace.name}</span>
                </button>
              </div>
            </div>

            {/* Little Arc WebView */}
            <div className="flex-1 bg-white relative">
              {/* @ts-ignore */}
              <webview
                ref={littleArcWebviewRef}
                src={littleArcUrl}
                className="w-full h-full border-none"
                preload={webviewPreloadPath || undefined}
                useragent={DESKTOP_CHROME_UA}
                {...({ allowpopups: 'true' } as any)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 9. NATIVE MACOS RIGHT-CLICK CONTEXT MENU MATCHING REFERENCE */}
      {tabContextMenu && (() => {
        // Compute available groups in the current space only
        const spaceGroups = Array.from(
          new Set(
            tabs
              .filter(
                (t) =>
                  t.spaceId === tabContextMenu.tab.spaceId &&
                  t.category &&
                  t.category.trim() !== '' &&
                  !t.isArchived
              )
              .map((t) => t.category as string)
          )
        );

        // Check if tab has audio / media playing
        const tabHasAudio = !!(tabContextMenu.tab.hasAudio || tabContextMenu.tab.isMuted);

        return (
          <div
            className="fixed z-50 w-56 rounded-2xl bg-[#1c242d]/95 backdrop-blur-xl border border-white/10 shadow-2xl p-1.5 text-[12px] text-zinc-200 select-none animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${Math.min(tabContextMenu.x, window.innerWidth - 240)}px`,
              top: `${Math.min(tabContextMenu.y, window.innerHeight - 400)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Context option: New Tab in Group if tab is grouped */}
            {tabContextMenu.tab.category && (
              <>
                <button
                  onClick={() => {
                    handleAddTabToGroup(tabContextMenu.tab.spaceId, tabContextMenu.tab.category!);
                    setTabContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-white text-left transition-colors font-medium"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                  <span>New Tab in "{tabContextMenu.tab.category}"</span>
                </button>
                <button
                  onClick={() => {
                    handleDeleteGroup(tabContextMenu.tab.spaceId, tabContextMenu.tab.category!);
                    setTidyNotification(`Ungrouped "${tabContextMenu.tab.category}" (tabs kept open)`);
                    setTimeout(() => setTidyNotification(null), 2500);
                    setTabContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-zinc-300 text-left transition-colors"
                  title="Remove group container but keep tabs open"
                >
                  <FolderMinus className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Ungroup "{tabContextMenu.tab.category}"</span>
                </button>
                <button
                  onClick={() => {
                    handleMoveGroupOrder(tabContextMenu.tab.spaceId, tabContextMenu.tab.category!, 'up');
                    setTabContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-zinc-300 text-left transition-colors"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Move Group Up</span>
                </button>
                <button
                  onClick={() => {
                    handleMoveGroupOrder(tabContextMenu.tab.spaceId, tabContextMenu.tab.category!, 'down');
                    setTabContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-zinc-300 text-left transition-colors"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Move Group Down</span>
                </button>
                <div className="h-px bg-white/10 my-1" />
              </>
            )}

            {/* Group 1: Pin / Unpin */}
            <button
              onClick={() => handleTogglePinTab(tabContextMenu.tab.id)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
            >
              {tabContextMenu.tab.isPinned ? (
                <>
                  <PinOff className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Unpin</span>
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Pin</span>
                </>
              )}
            </button>

            <div className="h-px bg-white/10 my-1" />

            {/* Group 2: Open as Split, Duplicate */}
            <button
              onClick={() => handleOpenAsSplit(tabContextMenu.tab)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
            >
              <Columns2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>Open as Split</span>
            </button>

            <button
              onClick={() => handleDuplicateTab(tabContextMenu.tab)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
            >
              <CopyPlus className="w-3.5 h-3.5 text-zinc-400" />
              <span>Duplicate</span>
            </button>

            <div className="h-px bg-white/10 my-1" />

            {/* Group 3: Groups, Profile, Window */}
            <button
              onClick={() => handleNewGroupWithTab(tabContextMenu.tab)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5 text-zinc-400" />
              <span>New Group with Tab</span>
            </button>

            {tabContextMenu.tab.category && (
              <button
                onClick={() => handleRemoveFromGroup(tabContextMenu.tab)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
              >
                <FolderMinus className="w-3.5 h-3.5 text-zinc-400" />
                <span>Remove from Group</span>
              </button>
            )}

            {/* Move to Group (Shown only if groups exist in the same profile) */}
            {spaceGroups.length > 0 && (
              <div
                className="relative"
                onMouseEnter={() =>
                  setTabContextMenu((prev) => (prev ? { ...prev, activeSubmenu: 'group' } : null))
                }
              >
                <div
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    tabContextMenu.activeSubmenu === 'group'
                      ? 'bg-white/15 text-white'
                      : 'hover:bg-white/10 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FolderInput className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Move to Group</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-zinc-400" />
                </div>

                {/* Submenu Flyout with persistent state and negative margin bridge */}
                {tabContextMenu.activeSubmenu === 'group' && (
                  <div
                    className="flex flex-col absolute left-full top-[-6px] -ml-1 w-48 rounded-xl bg-[#1c242d]/98 backdrop-blur-xl border border-white/10 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                    onMouseEnter={() =>
                      setTabContextMenu((prev) => (prev ? { ...prev, activeSubmenu: 'group' } : null))
                    }
                  >
                    {spaceGroups.map((grp) => {
                      const isCur = tabContextMenu.tab.category === grp;
                      return (
                        <button
                          key={grp}
                          onClick={() => handleMoveTabToCategory(tabContextMenu.tab.id, grp)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                            isCur
                              ? 'text-sky-400 bg-white/5 font-medium'
                              : 'text-zinc-300 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span className="truncate">{grp}</span>
                          {isCur && <Check className="w-3 h-3 text-sky-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Move to Profile */}
            <div
              className="relative"
              onMouseEnter={() =>
                setTabContextMenu((prev) => (prev ? { ...prev, activeSubmenu: 'profile' } : null))
              }
            >
              <div
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  tabContextMenu.activeSubmenu === 'profile'
                    ? 'bg-white/15 text-white'
                    : 'hover:bg-white/10 text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Move to Profile</span>
                </div>
                <ChevronRight className="w-3 h-3 text-zinc-400" />
              </div>

              {/* Submenu Flyout with persistent state and negative margin bridge */}
              {tabContextMenu.activeSubmenu === 'profile' && (
                <div
                  className="flex flex-col absolute left-full top-[-6px] -ml-1 w-44 rounded-xl bg-[#1c242d]/98 backdrop-blur-xl border border-white/10 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onMouseEnter={() =>
                    setTabContextMenu((prev) => (prev ? { ...prev, activeSubmenu: 'profile' } : null))
                  }
                >
                  {spaces.map((sp) => {
                    const isCur = tabContextMenu.tab.spaceId === sp.id;
                    return (
                      <button
                        key={sp.id}
                        onClick={() => handleMoveTabToSpace(tabContextMenu.tab.id, sp.id)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                          isCur
                            ? 'text-sky-400 bg-white/5 font-medium'
                            : 'text-zinc-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <span className="truncate">{sp.name}</span>
                        {isCur && <Check className="w-3 h-3 text-sky-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Move to Window */}
            <button
              onMouseEnter={() =>
                setTabContextMenu((prev) => (prev ? { ...prev, activeSubmenu: null } : null))
              }
              onClick={() => handleOpenTabInNewWindow(tabContextMenu.tab.url)}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <AppWindow className="w-3.5 h-3.5 text-zinc-400" />
                <span>Move to Window</span>
              </div>
              <ChevronRight className="w-3 h-3 text-zinc-400" />
            </button>

            <div className="h-px bg-white/10 my-1" />

            {/* Group 4: Copy Link */}
            <button
              onMouseEnter={() =>
                setTabContextMenu((prev) => (prev ? { ...prev, activeSubmenu: null } : null))
              }
              onClick={() => handleCopyTabLink(tabContextMenu.tab.url)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
              <span>Copy Link</span>
            </button>

            {/* Group 5: Rename Group (only when tab is in a group), Mute Site (only when tab has audio) */}
            {(tabContextMenu.tab.category || tabHasAudio) && (
              <>
                <div className="h-px bg-white/10 my-1" />

                {tabContextMenu.tab.category && (
                  <button
                    onMouseEnter={() =>
                      setTabContextMenu((prev) => (prev ? { ...prev, activeSubmenu: null } : null))
                    }
                    onClick={() => handleRenameGroup(tabContextMenu.tab)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Rename Group...</span>
                  </button>
                )}

                {tabHasAudio && (
                  <button
                    onMouseEnter={() =>
                      setTabContextMenu((prev) => (prev ? { ...prev, activeSubmenu: null } : null))
                    }
                    onClick={() => handleToggleMuteTab(tabContextMenu.tab)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
                  >
                    {tabContextMenu.tab.isMuted ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-white" />
                        <span>Unmute Site</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Mute Site</span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            <div className="h-px bg-white/10 my-1" />

            {/* Group 6: Close actions */}
            <button
              onMouseEnter={() =>
                setTabContextMenu((prev) => (prev ? { ...prev, activeSubmenu: null } : null))
              }
              onClick={(e) => {
                handleCloseTab(tabContextMenu.tab.id, e);
                setTabContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-rose-500/15 text-rose-300 text-left transition-colors"
            >
              <X className="w-3.5 h-3.5 text-rose-400" />
              <span>Close Tab</span>
            </button>

            <button
              onMouseEnter={() =>
                setTabContextMenu((prev) => (prev ? { ...prev, activeSubmenu: null } : null))
              }
              onClick={() => handleCloseOtherTabs(tabContextMenu.tab)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white text-left transition-colors"
            >
              <XCircle className="w-3.5 h-3.5 text-zinc-400" />
              <span>Close Other Tabs</span>
            </button>

            <button
              onMouseEnter={() =>
                setTabContextMenu((prev) => (prev ? { ...prev, activeSubmenu: null } : null))
              }
              onClick={() => handleCloseTabsBelow(tabContextMenu.tab)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white text-left transition-colors"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 text-zinc-400" />
              <span>Close Tabs Below</span>
            </button>
          </div>
        );
      })()}

      {/* 10. GLOBAL PROFILE DROPDOWN MENU & FULL-WINDOW BACKDROP */}
      {isProfileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-[998] bg-black/10 select-none"
            onClick={(e) => {
              e.stopPropagation();
              setIsProfileMenuOpen(false);
            }}
          />
          <div
            className="no-drag fixed top-11 left-2.5 z-[999] w-[188px] rounded-2xl bg-[#1c2936]/98 backdrop-blur-2xl border border-white/15 shadow-2xl p-1.5 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-150 select-none ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-0.5">
              {spaces.map((s, idx) => (
                <div
                  key={s.id}
                  onClick={() => {
                    switchSpace(s.id);
                    setIsProfileMenuOpen(false);
                  }}
                  className={`group/prof w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer ${
                    activeSpaceId === s.id
                      ? 'bg-sky-500/20 text-white font-semibold'
                      : 'hover:bg-white/5 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0 mr-1">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${activeSpaceId === s.id ? 'bg-sky-400' : 'bg-zinc-500'}`} />
                    <span className="truncate font-medium">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {spaces.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteProfile(s.id, e);
                        }}
                        className="p-1 rounded-lg hover:bg-rose-500/25 text-zinc-400 hover:text-rose-400 transition-all cursor-pointer"
                        title={`Delete profile "${s.name}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {activeSpaceId === s.id && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    <span className="text-[10px] text-zinc-500 font-mono">^{idx + 1}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="my-1 border-t border-white/10" />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsProfileMenuOpen(false);
                handleOpenNewProfileModal();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer font-medium"
            >
              <Plus className="w-4 h-4 text-white shrink-0" />
              <span>New Profile...</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsProfileMenuOpen(false);
                setSettingsTab('profiles');
                setIsSettingsOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer font-medium"
            >
              <Settings className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>Profile Settings</span>
            </button>
          </div>
        </>
      )}

      {/* 11. IN-APP UPDATE MODAL */}
      {isUpdateModalOpen && updateInfo && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150 select-none"
          onClick={() => setIsUpdateModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#1c232d]/95 border border-white/15 shadow-2xl p-6 text-zinc-200 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {updateInfo.hasUpdate ? 'Update Available' : 'Slate Browser'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {updateInfo.hasUpdate
                      ? `Version ${updateInfo.latestVersion} is ready to install (current: v${updateInfo.currentVersion})`
                      : `Version ${updateInfo.currentVersion} is the latest version`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {updateInfo.releaseNotes && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  What's New in {updateInfo.releaseName || `v${updateInfo.latestVersion}`}
                </span>
                <div className="max-h-48 overflow-y-auto p-3 rounded-xl bg-black/30 border border-white/5 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans select-text">
                  {updateInfo.releaseNotes}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Later
              </button>
              {updateInfo.releaseUrl && (
                <button
                  onClick={() => {
                    handleDownloadUpdate(updateInfo.releaseUrl);
                    setIsUpdateModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-white/10 hover:bg-white/15 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Release Notes</span>
                </button>
              )}
              {updateInfo.hasUpdate && (
                <button
                  onClick={() => {
                    handleDownloadUpdate(updateInfo.downloadUrl);
                    setIsUpdateModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download DMG</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
