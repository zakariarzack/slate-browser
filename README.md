# Slate Browser 🪨
> **The fluid, privacy-first workspace browser for power users.** Inspired by Arc’s spatial organization and the Sheikah Slate's modular multi-tool design, built without corporate AI lock-in.

[![Platform](https://img.shields.io/badge/Platform-macOS%20(Apple%20Silicon)-black?style=flat&logo=apple)](https://github.com)
[![Engine](https://img.shields.io/badge/Engine-Chromium%20%7C%20Electron-2b2d42?style=flat&logo=electron)](https://electronjs.org)
[![React](https://img.shields.io/badge/UI-React%2019%20%2B%20Tailwind%20v4-38bdf8?style=flat&logo=react)](https://react.dev)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=flat)](LICENSE)

---

## ✨ Overview

**Slate** is a next-generation workspace browser crafted for knowledge workers, developers, and creators. It combines the spatial elegance of vertical tabs, fluid glass sidebars, and isolated multi-profile spaces with **100% user control, privacy, and full Chrome extension support**.

Unlike modern browsers that force proprietary AI search engines or lock you into cloud subscriptions, Slate keeps AI completely **opt-in, transparent, and local-first** (BYOK & Ollama).

---

## 🚀 Key Features

### 🗂️ Spatial Workspaces & Tabs
* **Collapsible Frosted Glass Sidebar (`⌘S`)**: Fluid, macOS-vibrant sidebar that gives your web pages 100% screen real estate.
* **Isolated Spaces & Profiles**: Effortlessly separate *Work*, *Personal*, and *Dev* with containerized cookies, independent logins, and distinct visual gradient themes.
* **Smart Tab Groups & Accordions**: Reorderable tab clusters with clean title expansion, smooth accordion collapses, and slide-in group actions (`+` / `✕`).
* **Pinned Favorites Grid**: Quick-access top grid for daily tools with unread indicators and drag-and-drop reordering.
* **Sticky New Tab**: Responsive new-tab action button that naturally docks when your tab list scrolls.
* **Tidy Tabs**: One-click AI and heuristic organization that cleans up messy tab clutter in seconds.

### 🧩 Chrome Extensions (MV2 & MV3)
* **Native Extension Ecosystem**: Full support for extensions like **Bitwarden**, **1Password**, **uBlock Origin**, and **Dark Reader**.
* **Toolbar Action Buttons**: Pinned extensions sit directly in the top navigation bar for one-click access.
* **WebAuthn & Passkeys**: Built-in support for Touch ID, passkeys, and multi-factor OAuth popups.
* **Chrome Web Store Integration**: Browse and install extensions directly from the Chrome Web Store.

### 💤 Chromium Memory Saver
* **Native Tab Sleeping Halo**: Inactive background tabs automatically hibernate to reclaim RAM while keeping your sidebar crisp.
* **Subtle Clock Halo**: Pixel-perfect, flat sleeping indicators designed 1:1 with Chrome's native specification, leaving comfortable breathing room around every favicon.
* **0ms Resume**: Waking tabs reload state instantly with zero lag.

### ⚡ Power Navigation & Split View
* **Floating Command Palette (`⌘T` / `⌘L`)**: Instant fuzzy search across open tabs, history, bookmarks, and search engines (Google, DuckDuckGo, Kagi, Ecosia).
* **Dual-Pane Split View**: Tile tabs side-by-side to compare code, review docs, or multi-task without window management clutter.
* **Little Slate / Peek**: Open external links in lightweight floating preview windows before adding them to your workspace.
* **Adaptive Toolbar**: Minimalist top navigation that dynamically matches the active page's background and theme color.

### 🛡️ Private & Opt-in AI
* **Zero Interception**: Default web searches are never hijacked or proxied through third-party servers.
* **Bring-Your-Own-Key (BYOK)**: Connect directly to Claude (Anthropic), OpenAI, DeepSeek, or OpenRouter.
* **100% Offline Local LLMs**: Direct bridge to [Ollama](https://ollama.ai) to run Llama, Mistral, and DeepSeek locally on your Apple Silicon chip.

---

## ⌨️ Essential Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `⌘ T` | Open Command Bar / New Tab |
| `⌘ L` | Focus & Edit Current URL / Search |
| `⌘ S` | Toggle Collapsible Sidebar |
| `⌘ W` | Close Active Tab |
| `⌘ ⇧ T` | Restore Recently Closed Tab |
| `⌘ R` | Reload Page |
| `⌘ [` / `⌘ ]` | History Back / Forward |
| `⌘ ⌥ ←` / `⌘ ⌥ →` | Switch Spaces / Profiles |
| `⌘ F` | Find in Page |

---

## 🛠️ Tech Stack

* **Shell**: [Electron 45](https://www.electronjs.org/) + Native macOS Vibrancy & Titlebar Integration
* **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
* **Styling & Animation**: [Tailwind CSS v4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/)
* **Drag & Drop**: [@dnd-kit](https://dndkit.com/)
* **Extension Bridge**: `electron-chrome-extensions`, `electron-chrome-web-store`
* **Build System**: [Vite 8](https://vitejs.dev/), [electron-builder](https://www.electron.build/)

---

## 📦 Getting Started

### Prerequisites
* macOS 12+ (Apple Silicon `arm64` recommended)
* Node.js 20+ and npm

### Installation & Development

```bash
# Clone repository
git clone https://github.com/zakariarzack/slate-browser.git
cd slate-browser

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Packaging for macOS

```bash
# Fast local build & deploy to /Applications/Slate.app
npm run deploy:fast

# Build distributable DMG (release/Slate-1.0.0-arm64.dmg)
npm run dist:mac
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
