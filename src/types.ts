export interface TabItem {
  id: string;
  url: string;
  initialUrl?: string;
  title: string;
  favicon?: string;
  spaceId: string;
  isPinned?: boolean;
  isFavorite?: boolean;
  isArchived?: boolean;
  category?: string; // Grouping category (e.g., Development, Articles, Social, or custom user group)
  isUserGroup?: boolean; // Explicitly set by user via "New Group with Tab", "New Group", or "Move to Group"
  isLoading?: boolean; // Loading state for skeleton loading animation
  isMuted?: boolean; // Tab audio muted state
  hasAudio?: boolean; // Whether the tab is currently playing or has played audio
  lastAccessedAt: number;
  createdAt: number;
  themeColor?: string | null;
  isSleeping?: boolean; // Chrome-style Memory Saver: discarded from RAM due to inactivity
  discardedMemoryMB?: number; // Estimated memory freed when discarded (e.g. 85MB)
}

export interface Space {
  id: string;
  name: string;
  icon: string;
  themeColor: string;
}

export interface CustomGroup {
  id: string;
  name: string;
  spaceId: string;
  isLive?: boolean;
  liveType?: 'github' | 'calendar' | 'rss' | 'figma';
  color?: string;
  createdAt: number;
}

export interface AppUpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseName?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  downloadUrl?: string;
  publishedAt?: string;
  message?: string;
  error?: string;
}

