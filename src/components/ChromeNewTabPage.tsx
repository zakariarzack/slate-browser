import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  X,
  Pen,
  ExternalLink,
  UserPlus,
  LogOut,
  MoreVertical,
  Pencil,
  Globe,
  ArrowUpRight,
} from 'lucide-react';
import { getBundledIcon } from '../bundledIcons';

const ShortcutFavicon: React.FC<{ shortcut: ChromeShortcut; isLight: boolean }> = ({ shortcut, isLight }) => {
  const cleanHost = (shortcut.domain || shortcut.url || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .replace(/^www\./, '');

  const candidates = React.useMemo(() => {
    const list: string[] = [];

    // 1. Cached authentic favicon from localStorage
    if (cleanHost) {
      try {
        const cached = localStorage.getItem(`aura_fav_${cleanHost}`);
        if (cached && !cached.startsWith('blob:') && !list.includes(cached)) {
          list.push(cached);
        }
      } catch (e) {}
    }

    // 2. Google S2 high-res favicon service (exact live web favicon)
    if (cleanHost) {
      const s2 = `https://www.google.com/s2/favicons?domain=${cleanHost}&sz=64`;
      if (!list.includes(s2)) list.push(s2);
    }

    // 3. DuckDuckGo favicon CDN
    if (cleanHost) {
      const ddg = `https://icons.duckduckgo.com/ip3/${cleanHost}.ico`;
      if (!list.includes(ddg)) list.push(ddg);
    }

    // 4. Direct /favicon.ico fallback
    if (cleanHost) {
      const direct = `https://${cleanHost}/favicon.ico`;
      if (!list.includes(direct)) list.push(direct);
    }

    // 5. Emergency offline bundled vector icon
    const bundled = getBundledIcon(cleanHost) || getBundledIcon(shortcut.url) || getBundledIcon(shortcut.title);
    if (bundled && !list.includes(bundled)) {
      list.push(bundled);
    }

    return list;
  }, [cleanHost, shortcut.url, shortcut.title]);

  const [candidateIndex, setCandidateIndex] = useState(0);

  if (candidateIndex >= candidates.length || candidates.length === 0) {
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-sky-500/20 text-sky-400 font-semibold text-xs">
        {shortcut.title.charAt(0).toUpperCase() || <Globe className="w-3.5 h-3.5" />}
      </div>
    );
  }

  const currentSrc = candidates[candidateIndex];

  return (
    <img
      src={currentSrc}
      alt=""
      className="w-6 h-6 object-contain rounded"
      onError={() => setCandidateIndex((prev) => prev + 1)}
      onLoad={() => {
        if (cleanHost && currentSrc && !currentSrc.startsWith('blob:') && !currentSrc.startsWith('data:')) {
          try {
            localStorage.setItem(`aura_fav_${cleanHost}`, currentSrc);
          } catch (e) {}
        }
      }}
    />
  );
};

export interface ChromeShortcut {
  id: string;
  title: string;
  url: string;
  domain: string;
}

const DEFAULT_SHORTCUTS: ChromeShortcut[] = [
  { id: 'sc-1', title: 'YouTube', url: 'https://www.youtube.com/', domain: 'youtube.com' },
  { id: 'sc-2', title: 'Gmail', url: 'https://mail.google.com/', domain: 'mail.google.com' },
  { id: 'sc-3', title: 'Google Drive', url: 'https://drive.google.com/', domain: 'drive.google.com' },
  { id: 'sc-4', title: 'GitHub', url: 'https://github.com/', domain: 'github.com' },
  { id: 'sc-5', title: 'ChatGPT', url: 'https://chatgpt.com/', domain: 'chatgpt.com' },
  { id: 'sc-6', title: 'Google Maps', url: 'https://maps.google.com/', domain: 'maps.google.com' },
  { id: 'sc-7', title: 'Wikipedia', url: 'https://wikipedia.org/', domain: 'wikipedia.org' },
  { id: 'sc-8', title: 'X', url: 'https://x.com/', domain: 'x.com' },
];

const GOOGLE_APPS = [
  { name: 'Google Search', url: 'https://www.google.com/', icon: 'https://www.google.com/favicon.ico' },
  { name: 'Gmail', url: 'https://mail.google.com/', icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico' },
  { name: 'Google Drive', url: 'https://drive.google.com/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png' },
  { name: 'YouTube', url: 'https://www.youtube.com/', icon: 'https://www.youtube.com/s/desktop/favicon.ico' },
  { name: 'Google Maps', url: 'https://maps.google.com/', icon: 'https://maps.google.com/favicon.ico' },
  { name: 'Google Calendar', url: 'https://calendar.google.com/', icon: 'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_32.ico' },
  { name: 'Google Meet', url: 'https://meet.google.com/', icon: 'https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v1/web-32dp/logo_meet_2020q4_color_1x_web_32dp.png' },
  { name: 'Google Docs', url: 'https://docs.google.com/', icon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico' },
  { name: 'Google Translate', url: 'https://translate.google.com/', icon: 'https://ssl.gstatic.com/images/branding/product/1x/translate_24dp.png' },
];

interface ChromeNewTabPageProps {
  onNavigate: (url: string) => void;
  searchEngineBaseUrl?: string;
  spaceId?: string;
}

export const ChromeNewTabPage: React.FC<ChromeNewTabPageProps> = ({
  onNavigate,
  searchEngineBaseUrl = 'https://www.google.com/search?q=',
  spaceId,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [googleAccount, setGoogleAccount] = useState<{
    isSignedIn: boolean;
    email: string | null;
    name: string | null;
  }>(() => {
    try {
      const saved = localStorage.getItem(`aura_google_account_${spaceId || 'default'}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { isSignedIn: false, email: null, name: null };
  });

  // Shortcuts & UI settings
  const [showShortcuts, setShowShortcuts] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aura_chrome_show_shortcuts') !== 'false';
    } catch (e) {
      return true;
    }
  });

  const [shortcuts, setShortcuts] = useState<ChromeShortcut[]>(() => {
    try {
      const saved = localStorage.getItem('aura_chrome_shortcuts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_SHORTCUTS;
  });

  const [isAddShortcutOpen, setIsAddShortcutOpen] = useState(false);
  const [newShortcutTitle, setNewShortcutTitle] = useState('');
  const [newShortcutUrl, setNewShortcutUrl] = useState('');

  // 3-dot menu and editing shortcut
  const [activeMenuShortcutId, setActiveMenuShortcutId] = useState<string | null>(null);
  const [editingShortcut, setEditingShortcut] = useState<ChromeShortcut | null>(null);
  const [editShortcutTitle, setEditShortcutTitle] = useState('');
  const [editShortcutUrl, setEditShortcutUrl] = useState('');

  // Drag and drop shortcuts state
  const [draggedShortcutId, setDraggedShortcutId] = useState<string | null>(null);
  const [dragOverShortcutId, setDragOverShortcutId] = useState<string | null>(null);

  // Favicon fallback tracking
  const [failedFaviconIds, setFailedFaviconIds] = useState<Record<string, boolean>>({});

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'classic-dark' | 'classic-light' | 'midnight' | 'emerald'>(() => {
    try {
      return (localStorage.getItem('aura_chrome_theme') as any) || 'classic-dark';
    } catch (e) {
      return 'classic-dark';
    }
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Check Google Auth Status on mount & focus
  useEffect(() => {
    let isMounted = true;
    const partition = `persist:${spaceId || 'default'}`;

    const checkAuth = async () => {
      try {
        if ((window as any).electronAPI?.invoke) {
          const res = await (window as any).electronAPI.invoke('check-google-auth-status', partition);
          if (isMounted && res) {
            setGoogleAccount(res);
            localStorage.setItem(`aura_google_account_${spaceId || 'default'}`, JSON.stringify(res));
          }
        }
      } catch (err) {}
    };

    checkAuth();
    window.addEventListener('focus', checkAuth);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', checkAuth);
    };
  }, [spaceId]);

  // Persist Shortcuts
  useEffect(() => {
    try {
      localStorage.setItem('aura_chrome_shortcuts', JSON.stringify(shortcuts));
    } catch (e) {}
  }, [shortcuts]);

  // Persist Shortcuts visibility
  useEffect(() => {
    try {
      localStorage.setItem('aura_chrome_show_shortcuts', String(showShortcuts));
    } catch (e) {}
  }, [showShortcuts]);

  // Persist Theme & dispatch window event so Top Bar immediately syncs
  useEffect(() => {
    try {
      localStorage.setItem('aura_chrome_theme', themeMode);
      window.dispatchEvent(new CustomEvent('aura-theme-change', { detail: themeMode }));
    } catch (e) {}
  }, [themeMode]);

  // Auto-focus search input on load
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Live Search Suggestions Fetcher
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setSelectedSuggestionIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        let results: string[] = [];
        if ((window as any).electronAPI?.invoke) {
          const res = await (window as any).electronAPI.invoke('fetch-search-suggestions', trimmed);
          if (Array.isArray(res)) results = res;
        } else {
          const res = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(trimmed)}`);
          const data = await res.json();
          if (Array.isArray(data?.[1])) results = data[1].slice(0, 7);
        }

        if (results.length > 0) {
          setSuggestions(results);
          setSelectedSuggestionIndex(-1);
        } else {
          setSuggestions([]);
        }
      } catch (e) {
        setSuggestions([]);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [query]);

  // Global Keyboard Navigation (Escape to dismiss menus & modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAppsMenuOpen(false);
        setIsAccountMenuOpen(false);
        setIsAddShortcutOpen(false);
        setEditingShortcut(null);
        setIsCustomizeOpen(false);
        setActiveMenuShortcutId(null);
        setSuggestions([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search Submission
  const handleSearchSubmit = (e: React.FormEvent, directText?: string) => {
    e.preventDefault();
    const textToSearch = directText !== undefined ? directText : (
      selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]
        ? suggestions[selectedSuggestionIndex]
        : query
    );

    const trimmed = textToSearch.trim();
    if (!trimmed) return;

    setSuggestions([]);

    const isUrl =
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('localhost:') ||
      (trimmed.includes('.') && !trimmed.includes(' '));

    if (isUrl) {
      const target = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
      onNavigate(target);
    } else {
      const target = `${searchEngineBaseUrl}${encodeURIComponent(trimmed)}`;
      onNavigate(target);
    }
  };

  // Input KeyDown Navigation
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : -1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > -1 ? prev - 1 : suggestions.length - 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSuggestions([]);
        setSelectedSuggestionIndex(-1);
      }
    }
  };

  // Add Shortcut Handler
  const handleAddShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShortcutUrl.trim()) return;

    let formattedUrl = newShortcutUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    let domain = 'website.com';
    try {
      domain = new URL(formattedUrl).hostname.replace(/^www\./, '');
    } catch (err) {}

    const title = newShortcutTitle.trim() || domain;
    const newSc: ChromeShortcut = {
      id: `sc-${Date.now()}`,
      title,
      url: formattedUrl,
      domain,
    };

    setShortcuts((prev) => [...prev, newSc]);
    setNewShortcutTitle('');
    setNewShortcutUrl('');
    setIsAddShortcutOpen(false);
  };

  // Edit Shortcut Handler
  const handleSaveEditShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShortcut || !editShortcutUrl.trim()) return;

    let formattedUrl = editShortcutUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    let domain = editingShortcut.domain;
    try {
      domain = new URL(formattedUrl).hostname.replace(/^www\./, '');
    } catch (err) {}

    const title = editShortcutTitle.trim() || domain;

    setShortcuts((prev) =>
      prev.map((s) => (s.id === editingShortcut.id ? { ...s, title, url: formattedUrl, domain } : s))
    );
    setEditingShortcut(null);
  };

  // Remove Shortcut Handler
  const handleRemoveShortcut = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShortcuts((prev) => prev.filter((s) => s.id !== id));
    if (activeMenuShortcutId === id) setActiveMenuShortcutId(null);
  };

  // Drag and drop reordering
  const handleReorderShortcuts = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setShortcuts((prev) => {
      const list = [...prev];
      const fromIndex = list.findIndex((s) => s.id === fromId);
      const toIndex = list.findIndex((s) => s.id === toId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      return list;
    });
  };

  // Theme styling backgrounds
  const themeBackgrounds: Record<string, string> = {
    'classic-dark': 'bg-[#202124] text-[#e8eaed]',
    'classic-light': 'bg-[#ffffff] text-[#202124]',
    'midnight': 'bg-[#0f172a] text-[#f8fafc]',
    'emerald': 'bg-[#064e3b]/90 text-[#ecfdf5]',
  };

  const isLight = themeMode === 'classic-light';

  return (
    <div
      className={`w-full h-full flex flex-col justify-between overflow-y-auto select-none transition-colors duration-200 relative ${
        themeBackgrounds[themeMode] || themeBackgrounds['classic-dark']
      }`}
      onClick={() => {
        if (isAppsMenuOpen) setIsAppsMenuOpen(false);
        if (isAccountMenuOpen) setIsAccountMenuOpen(false);
        if (activeMenuShortcutId) setActiveMenuShortcutId(null);
        if (suggestions.length > 0) setSuggestions([]);
      }}
    >
      {/* 1. TOP HEADER (Google Chrome NTP Navigation - Clean) */}
      <header className="w-full flex items-center justify-end px-6 pt-3.5 pb-2 min-h-[48px]" />

      {/* 2. MAIN CENTER HERO: GOOGLE LOGO + SEARCH BAR + SHORTCUTS */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-10 max-w-3xl mx-auto w-full">
        {/* Official Google Logo (White/Light logo for dark themes, Multi-color logo for light theme) */}
        <div className="mb-7 select-none transition-transform hover:scale-[1.01] duration-200">
          <img
            src={isLight ? '/googlelogo_color_272x92dp.png' : '/googlelogo_light_color_272x92dp.png'}
            alt="Google"
            className="h-[92px] w-[272px] object-contain drop-shadow-sm pointer-events-none"
            onError={(e) => {
              e.currentTarget.src = isLight
                ? 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'
                : 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_light_color_272x92dp.png';
            }}
          />
        </div>

        {/* Chrome-Style Search Box with Live Autocomplete Suggestions */}
        <div ref={searchBoxRef} className="w-full max-w-[584px] relative z-30">
          <form onSubmit={handleSearchSubmit}>
            <div
              className={`w-full h-12 flex items-center px-4 transition-all duration-200 border ${
                suggestions.length > 0
                  ? isLight
                    ? 'rounded-t-2xl bg-white border-zinc-200 shadow-lg text-zinc-900 border-b-0'
                    : 'rounded-t-2xl bg-[#303134] border-white/10 shadow-lg text-white border-b-0'
                  : isLight
                  ? 'rounded-full bg-white border-zinc-200 shadow-md hover:shadow-lg focus-within:shadow-lg focus-within:border-transparent text-zinc-900'
                  : 'rounded-full bg-[#303134] hover:bg-[#3c4043] focus-within:bg-[#303134] border-white/10 hover:border-transparent focus-within:border-transparent focus-within:shadow-[0_1px_6px_rgba(0,0,0,0.5)] text-white'
              }`}
            >
              <Search className={`w-4 h-4 mr-3 shrink-0 ${isLight ? 'text-zinc-400' : 'text-[#9aa0a6]'}`} />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Search Google or type a URL"
                className={`flex-1 bg-transparent text-sm outline-none font-normal ${
                  isLight ? 'text-zinc-900 placeholder:text-zinc-400' : 'text-white placeholder-[#9aa0a6]'
                }`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSuggestions([]);
                    searchInputRef.current?.focus();
                  }}
                  className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>

          {/* Autocomplete Dropdown List */}
          {suggestions.length > 0 && (
            <div
              className={`absolute top-12 left-0 right-0 rounded-b-2xl border shadow-xl overflow-hidden py-1.5 animate-in fade-in duration-100 ${
                isLight ? 'bg-white border-zinc-200 text-zinc-800 border-t-0' : 'bg-[#303134] border-white/10 text-white border-t-0'
              }`}
            >
              <div className="h-[1px] bg-white/10 mx-3 mb-1" />
              {suggestions.map((suggestion, idx) => {
                const isSelected = selectedSuggestionIndex === idx;
                return (
                  <div
                    key={`${suggestion}-${idx}`}
                    onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSearchSubmit(e, suggestion);
                    }}
                    className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer transition-colors ${
                      isSelected
                        ? isLight
                          ? 'bg-zinc-100 font-medium'
                          : 'bg-white/10 font-medium text-white'
                        : isLight
                        ? 'hover:bg-zinc-50 text-zinc-700'
                        : 'hover:bg-white/5 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Search className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`} />
                      <span className="truncate">{suggestion}</span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. MOST VISITED SHORTCUTS GRID (Configurable via Customize Chrome) */}
        {showShortcuts && (
          <div className="w-full max-w-[584px] mt-8">
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-y-4 gap-x-2 justify-items-center">
              {shortcuts.map((sc) => {
                const isMenuOpen = activeMenuShortcutId === sc.id;
                const isDragging = draggedShortcutId === sc.id;
                const isDragOver = dragOverShortcutId === sc.id;
                const isFaviconFailed = !!failedFaviconIds[sc.id];

                return (
                  <div
                    key={sc.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', sc.id);
                      setDraggedShortcutId(sc.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverShortcutId !== sc.id) setDragOverShortcutId(sc.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverShortcutId === sc.id) setDragOverShortcutId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedShortcutId && draggedShortcutId !== sc.id) {
                        handleReorderShortcuts(draggedShortcutId, sc.id);
                      }
                      setDraggedShortcutId(null);
                      setDragOverShortcutId(null);
                    }}
                    onDragEnd={() => {
                      setDraggedShortcutId(null);
                      setDragOverShortcutId(null);
                    }}
                    onClick={() => onNavigate(sc.url)}
                    className={`group relative flex flex-col items-center p-2 rounded-xl cursor-pointer transition-all duration-150 w-[84px] ${
                      isDragging ? 'opacity-40 scale-95' : ''
                    } ${isDragOver ? 'ring-2 ring-sky-400/80 scale-105' : ''} ${
                      isLight ? 'hover:bg-black/[0.06]' : 'hover:bg-white/[0.08]'
                    }`}
                    title={sc.title}
                  >
                    {/* 3-Dot Options Menu Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveMenuShortcutId(isMenuOpen ? null : sc.id);
                      }}
                      className={`absolute top-1 right-1 p-1 rounded-full transition-opacity z-20 ${
                        isMenuOpen ? 'opacity-100 bg-black/70 text-white' : 'opacity-0 group-hover:opacity-100 hover:bg-black/50 text-zinc-300 hover:text-white'
                      }`}
                      title="More options"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </button>

                    {/* 3-Dot Context Dropdown */}
                    {isMenuOpen && (
                      <div
                        className={`absolute top-8 right-1 w-32 rounded-xl p-1 shadow-2xl border z-30 animate-in fade-in zoom-in-95 duration-100 ${
                          isLight ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-[#292a2d] border-white/15 text-white'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuShortcutId(null);
                            setEditingShortcut(sc);
                            setEditShortcutTitle(sc.title);
                            setEditShortcutUrl(sc.url);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                            isLight ? 'hover:bg-zinc-100 text-zinc-700' : 'hover:bg-white/10 text-white'
                          }`}
                        >
                          <Pencil className="w-3.5 h-3.5 text-white" />
                          <span>Edit shortcut</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveShortcut(sc.id, e);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                            isLight ? 'hover:bg-zinc-100 text-zinc-700' : 'hover:bg-white/10 text-white'
                          }`}
                        >
                          <X className="w-3.5 h-3.5 text-white" />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}

                    {/* Circle Icon Container with Favicon Fallback (Web-First Standard) */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm ${
                        isLight ? 'bg-zinc-100 border border-zinc-200' : 'bg-[#292a2d] border border-white/5'
                      }`}
                    >
                      <ShortcutFavicon shortcut={sc} isLight={isLight} />
                    </div>

                    {/* Title */}
                    <span
                      className={`text-[12px] font-normal truncate w-full text-center mt-2 ${
                        isLight ? 'text-zinc-800' : 'text-[#e8eaed]'
                      }`}
                    >
                      {sc.title}
                    </span>
                  </div>
                );
              })}

              {/* "+ Add shortcut" Tile */}
              {shortcuts.length < 10 && (
                <div
                  onClick={() => setIsAddShortcutOpen(true)}
                  className={`group relative flex flex-col items-center p-2 rounded-xl cursor-pointer transition-all duration-150 w-[84px] ${
                    isLight ? 'hover:bg-black/[0.06]' : 'hover:bg-white/[0.08]'
                  }`}
                  title="Add shortcut"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm ${
                      isLight ? 'bg-zinc-100 border border-zinc-200 text-zinc-600' : 'bg-[#292a2d] border border-white/5 text-zinc-300'
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[12px] font-normal truncate w-full text-center mt-2 ${
                      isLight ? 'text-zinc-800' : 'text-[#e8eaed]'
                    }`}
                  >
                    Add shortcut
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 4. BOTTOM-RIGHT FOOTER (Customize Appearance Button - White Icon Only) */}
      <footer className="w-full flex items-center justify-end px-6 pb-4">
        <button
          type="button"
          onClick={() => setIsCustomizeOpen(true)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer border ${
            isLight
              ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'
              : 'bg-[#292a2d] hover:bg-[#3c4043] text-white border-white/10'
          }`}
          title="Customize Appearance"
        >
          <Pen className="w-4 h-4 text-white" />
        </button>
      </footer>

      {/* MODAL: ADD SHORTCUT */}
      {isAddShortcutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-100"
          onClick={() => setIsAddShortcutOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-5 shadow-2xl border ${
              isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-[#292a2d] border-white/15 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-sm mb-4">Add shortcut</h3>
            <form onSubmit={handleAddShortcut} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Google Docs"
                  value={newShortcutTitle}
                  onChange={(e) => setNewShortcutTitle(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs outline-none border ${
                    isLight ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-black/30 border-white/15 text-white'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">URL</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. docs.google.com"
                  value={newShortcutUrl}
                  onChange={(e) => setNewShortcutUrl(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs outline-none border ${
                    isLight ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-black/30 border-white/15 text-white'
                  }`}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddShortcutOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SHORTCUT */}
      {editingShortcut && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-100"
          onClick={() => setEditingShortcut(null)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-5 shadow-2xl border ${
              isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-[#292a2d] border-white/15 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-sm mb-4">Edit shortcut</h3>
            <form onSubmit={handleSaveEditShortcut} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Google Docs"
                  value={editShortcutTitle}
                  onChange={(e) => setEditShortcutTitle(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs outline-none border ${
                    isLight ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-black/30 border-white/15 text-white'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">URL</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. docs.google.com"
                  value={editShortcutUrl}
                  onChange={(e) => setEditShortcutUrl(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs outline-none border ${
                    isLight ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-black/30 border-white/15 text-white'
                  }`}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingShortcut(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOMIZE CHROME (Shortcuts Visibility Toggle & Theme) */}
      {isCustomizeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-100"
          onClick={() => setIsCustomizeOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-5 shadow-2xl border ${
              isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-[#292a2d] border-white/15 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Customize Appearance</h3>
              <button
                type="button"
                onClick={() => setIsCustomizeOpen(false)}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5">
              {/* 1. Shortcuts Visibility Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <div className="text-xs font-medium text-white">Show shortcuts</div>
                  <div className="text-[11px] text-zinc-400">Shortcuts are curated by you</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShortcuts((prev) => !prev)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    showShortcuts ? 'bg-sky-500' : 'bg-zinc-700'
                  }`}
                  title={showShortcuts ? 'Hide shortcuts' : 'Show shortcuts'}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      showShortcuts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 2. Theme Mode */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Theme Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setThemeMode('classic-dark')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border text-left cursor-pointer ${
                      themeMode === 'classic-dark'
                        ? 'border-sky-400 bg-sky-500/10 text-sky-400'
                        : 'border-white/10 hover:bg-white/5 text-zinc-300'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-[#202124] border border-white/30 shrink-0" />
                    <span>Classic Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('classic-light')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border text-left cursor-pointer ${
                      themeMode === 'classic-light'
                        ? 'border-sky-400 bg-sky-500/10 text-sky-400'
                        : 'border-white/10 hover:bg-white/5 text-zinc-300'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-white border border-zinc-400 shrink-0" />
                    <span>Classic Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('midnight')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border text-left cursor-pointer ${
                      themeMode === 'midnight'
                        ? 'border-sky-400 bg-sky-500/10 text-sky-400'
                        : 'border-white/10 hover:bg-white/5 text-zinc-300'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-[#0f172a] border border-sky-400/50 shrink-0" />
                    <span>Midnight Blue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('emerald')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border text-left cursor-pointer ${
                      themeMode === 'emerald'
                        ? 'border-sky-400 bg-sky-500/10 text-sky-400'
                        : 'border-white/10 hover:bg-white/5 text-zinc-300'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-[#064e3b] border border-emerald-400/50 shrink-0" />
                    <span>Emerald Slate</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsCustomizeOpen(false)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
