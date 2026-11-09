// Prevent EIO errors on process.stdout and process.stderr in packaged GUI app
if (process.stdout && typeof process.stdout.on === 'function') {
  process.stdout.on('error', () => {});
}
if (process.stderr && typeof process.stderr.on === 'function') {
  process.stderr.on('error', () => {});
}
process.on('uncaughtException', (err) => {
  if (err && (err.code === 'EIO' || err.message?.includes('EIO'))) return;
  try {
    console.error('Unhandled exception:', err);
  } catch (e) {}
});

const { app, BrowserWindow, Menu, clipboard, ipcMain, session, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');
const { installChromeWebStore } = require('electron-chrome-web-store');
const { ElectronChromeExtensions } = require('electron-chrome-extensions');

// Set application name for macOS and Chrome Web Store branding
app.name = 'Slate';

// Standard Chrome Desktop User-Agent string (stripping Electron tokens globally)
const NATIVE_CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

// Set default fallback User-Agent before any windows or sessions initialize
app.userAgentFallback = NATIVE_CHROME_UA;

// Hardware acceleration & GPU rendering optimization switches for macOS
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Prevent Chromium & macOS QoS from throttling background tabs, timers, and occluded webviews
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// Enable Auto Picture-in-Picture for video playback and web apps
app.commandLine.appendSwitch(
  'enable-features',
  'AutoPictureInPicture,PictureInPicture,DocumentPictureInPictureAPI'
);
app.commandLine.appendSwitch(
  'enable-blink-features',
  'AutoPictureInPicture,PictureInPictureAPI'
);

let mainWindow = null;
let extensionPopupWin = null;
let currentPopupExtensionId = null;

function closeExtensionPopup() {
  if (extensionPopupWin) {
    try {
      if (!extensionPopupWin.isDestroyed()) {
        extensionPopupWin.close();
      }
    } catch (e) {}
    extensionPopupWin = null;
    currentPopupExtensionId = null;
  }
}

function dismissAllPopovers() {
  closeExtensionPopup();
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('dismiss-popovers');
    } catch (e) {}
  }
}

ipcMain.on('close-extension-popup', () => {
  closeExtensionPopup();
});

ipcMain.on('dismiss-popovers', () => {
  dismissAllPopovers();
});

// Global Context Menu & Navigation Routing for webviews and window pages
app.on('web-contents-created', (event, contents) => {
  // Prevent background timer throttling across all guest webviews
  if (typeof contents.setBackgroundThrottling === 'function') {
    contents.setBackgroundThrottling(false);
  }

  // Auto-close floating extension popup and browser popovers when page navigates or user focuses guest webview (like Chrome)
  contents.on('did-start-loading', () => {
    if (!extensionPopupWin || contents !== extensionPopupWin.webContents) {
      dismissAllPopovers();
    }
  });
  contents.on('did-navigate', () => {
    if (!extensionPopupWin || contents !== extensionPopupWin.webContents) {
      dismissAllPopovers();
    }
  });
  contents.on('did-navigate-in-page', () => {
    if (!extensionPopupWin || contents !== extensionPopupWin.webContents) {
      dismissAllPopovers();
    }
  });
  contents.on('focus', () => {
    // Only close if focus went to a guest webview, not the extension popup itself or main UI chrome
    if (extensionPopupWin && contents !== extensionPopupWin.webContents && contents !== mainWindow?.webContents) {
      closeExtensionPopup();
    }
    if (mainWindow && !mainWindow.isDestroyed() && contents !== mainWindow.webContents && contents !== extensionPopupWin?.webContents) {
      try {
        mainWindow.webContents.send('dismiss-popovers');
      } catch (e) {}
    }
  });

  // Capture crash info for any guest webview or child contents
  contents.on('render-process-gone', (e, details) => {
    console.error('⚠️ [CRASH] Child contents render-process-gone:', details, 'URL:', contents.getURL());
  });

  // Handle Command+Click, Ctrl+Click, middle-click, and window.open as new in-app tabs
  contents.setWindowOpenHandler(({ url, disposition, features }) => {
    if (url && url !== "about:blank") {
      // Check if this is an OAuth popup window (e.g. login.microsoftonline.com, login.microsoft.com, login.live.com, Google auth, GitHub auth)
      const isAuthPopup =
        url.includes("login.microsoftonline.com") ||
        url.includes("login.microsoft.com") ||
        url.includes("login.live.com") ||
        url.includes("account.microsoft.com") ||
        url.includes("msftidentity.com") ||
        url.includes("msauth.net") ||
        url.includes("accounts.google.com") ||
        url.includes("/oauth") ||
        url.includes("/authorize") ||
        url.includes("/saml") ||
        url.includes("/login");

      if (isAuthPopup) {
        // Allow native popup window sharing the parent session so cookies and POST tokens match!
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            width: 520,
            height: 680,
            autoHideMenuBar: true,
            webPreferences: {
              session: contents.session,
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
            },
          },
        };
      }

      const targetWin =
        BrowserWindow.fromWebContents(contents) ||
        BrowserWindow.getFocusedWindow() ||
        mainWindow;
      if (targetWin && targetWin.webContents) {
        // Route new window requests (target="_blank", Cmd+Click, window.open) directly into tabs
        targetWin.webContents.send("open-in-new-tab", url, disposition);
      }
    }
    return { action: "deny" };
  });

  contents.on('context-menu', (e, params) => {
    e.preventDefault();

    const menuItems = [];
    const win = BrowserWindow.fromWebContents(contents) || BrowserWindow.getFocusedWindow();

    // 1. Spellcheck Suggestions (if right-clicking a misspelled word)
    if (params.misspelledWord && params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
      params.dictionarySuggestions.slice(0, 4).forEach((suggestion) => {
        menuItems.push({
          label: suggestion,
          click: () => contents.replaceMisspelling(suggestion),
        });
      });
      menuItems.push({
        label: 'Add to Dictionary',
        click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      menuItems.push({ type: 'separator' });
    }

    // 2. Link Actions
    if (params.linkURL) {
      menuItems.push({
        label: 'Open Link in New Tab',
        click: () => {
          if (win) win.webContents.send('open-in-new-tab', params.linkURL);
        },
      });
      menuItems.push({
        label: 'Open in Little Slate',
        click: () => {
          if (win) win.webContents.send('open-in-little-arc', params.linkURL);
        },
      });
      menuItems.push({
        label: 'Copy Link Address',
        click: () => clipboard.writeText(params.linkURL),
      });
      menuItems.push({
        label: 'Save Link As...',
        click: () => contents.downloadURL(params.linkURL),
      });
      menuItems.push({ type: 'separator' });
    }

    // 3. Media Actions (Images, Videos, Canvas)
    if (params.mediaType === 'image' || params.hasImageContents) {
      if (params.srcURL) {
        menuItems.push({
          label: 'Open Image in New Tab',
          click: () => {
            if (win) win.webContents.send('open-in-new-tab', params.srcURL);
          },
        });
        menuItems.push({
          label: 'Save Image As...',
          click: () => contents.downloadURL(params.srcURL),
        });
        menuItems.push({
          label: 'Copy Image',
          click: () => contents.copyImageAt(params.x, params.y),
        });
        menuItems.push({
          label: 'Copy Image Address',
          click: () => clipboard.writeText(params.srcURL),
        });
        menuItems.push({ type: 'separator' });
      }
    }

    if (params.mediaType === 'video' || params.mediaType === 'audio') {
      if (params.srcURL) {
        menuItems.push({
          label: 'Picture in Picture',
          click: () => {
            contents.executeJavaScript(`
              (() => {
                try {
                  if (document.pictureInPictureElement) {
                    document.exitPictureInPicture().catch(() => {});
                    return;
                  }
                  const allVideos = Array.from(document.querySelectorAll('video'));
                  let video = allVideos.find(v => !v.paused && !v.ended) || allVideos[0] || document.querySelector('video');
                  if (video && typeof video.requestPictureInPicture === 'function') {
                    video.requestPictureInPicture().catch((err) => console.log('PiP error:', err));
                  }
                } catch (err) {}
              })()
            `, true).catch(() => {});
          },
        });
        menuItems.push({
          label: 'Open Media in New Tab',
          click: () => {
            if (win) win.webContents.send('open-in-new-tab', params.srcURL);
          },
        });
        menuItems.push({
          label: 'Save Video As...',
          click: () => contents.downloadURL(params.srcURL),
        });
        menuItems.push({
          label: 'Copy Video Address',
          click: () => clipboard.writeText(params.srcURL),
        });
        menuItems.push({ type: 'separator' });
      }
    } else {
      // Allow Picture in Picture toggle on YouTube and streaming sites even when right-clicking on overlay
      menuItems.push({
        label: 'Picture in Picture',
        click: () => {
          contents.executeJavaScript(`
            (() => {
              try {
                if (document.pictureInPictureElement) {
                  document.exitPictureInPicture().catch(() => {});
                  return;
                }
                const allVideos = Array.from(document.querySelectorAll('video'));
                let video = allVideos.find(v => !v.paused && !v.ended) || allVideos[0] || document.querySelector('video');
                if (video && typeof video.requestPictureInPicture === 'function') {
                  video.requestPictureInPicture().catch((err) => console.log('PiP error:', err));
                }
              } catch (err) {}
            })()
          `, true).catch(() => {});
        },
      });
    }

    // 4. Text Selection Actions (Search, Look Up, Copy)
    if (params.selectionText && params.selectionText.trim().length > 0) {
      const trimmed = params.selectionText.trim();
      const preview = trimmed.length > 25 ? `${trimmed.slice(0, 25)}...` : trimmed;

      menuItems.push({ role: 'copy', label: 'Copy' });
      menuItems.push({
        label: `Search with Google for "${preview}"`,
        click: () => {
          if (win) {
            win.webContents.send(
              'open-in-new-tab',
              `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
            );
          }
        },
      });

      // macOS Dictionary lookup
      if (process.platform === 'darwin') {
        menuItems.push({
          label: `Look Up "${preview}"`,
          click: () => contents.showDefinitionForSelection(),
        });
      }
      menuItems.push({ type: 'separator' });
    }

    // 5. Editable Fields (Inputs, Textareas, Contenteditable)
    if (params.isEditable) {
      menuItems.push({ role: 'undo' });
      menuItems.push({ role: 'redo' });
      menuItems.push({ type: 'separator' });
      menuItems.push({ role: 'cut' });
      menuItems.push({ role: 'copy' });
      menuItems.push({ role: 'paste' });
      menuItems.push({ role: 'pasteAndMatchStyle', label: 'Paste and Match Style' });
      menuItems.push({ role: 'selectAll' });
      menuItems.push({ type: 'separator' });
    }

    // 6. General Page Navigation & Chrome Tools (When clicking page background)
    if (!params.linkURL && !params.selectionText && !params.isEditable && params.mediaType === 'none') {
      if (contents.canGoBack()) {
        menuItems.push({
          label: 'Back',
          accelerator: 'Alt+Left',
          click: () => contents.goBack(),
        });
      }
      if (contents.canGoForward()) {
        menuItems.push({
          label: 'Forward',
          accelerator: 'Alt+Right',
          click: () => contents.goForward(),
        });
      }
      menuItems.push({
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: () => contents.reload(),
      });
      menuItems.push({ type: 'separator' });

      menuItems.push({
        label: 'Save Page As...',
        accelerator: 'CmdOrCtrl+S',
        click: async () => {
          try {
            const { dialog } = require('electron');
            const defaultPath = `${contents.getTitle().replace(/[/\\?%*:|"<>]/g, '_') || 'page'}.html`;
            const { filePath } = await dialog.showSaveDialog(win, {
              defaultPath,
              filters: [{ name: 'Webpage, Complete', extensions: ['html', 'htm'] }],
            });
            if (filePath) {
              await contents.savePage(filePath, 'HTMLComplete');
            }
          } catch (err) {
            console.error('Save page error:', err);
          }
        },
      });

      menuItems.push({
        label: 'Print...',
        accelerator: 'CmdOrCtrl+P',
        click: () => contents.print(),
      });

      menuItems.push({
        label: 'View Page Source',
        accelerator: 'CmdOrCtrl+U',
        click: () => {
          if (win) {
            win.webContents.send('open-in-new-tab', `view-source:${contents.getURL()}`);
          }
        },
      });
      menuItems.push({ type: 'separator' });
    }

    // 7. Developer Tools
    menuItems.push({
      label: 'Inspect Element',
      click: () => contents.inspectElement(params.x, params.y),
    });

    const menu = Menu.buildFromTemplate(menuItems);
    if (win) {
      menu.popup({ window: win });
    }
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // Mac-native traffic light styling
    trafficLightPosition: { x: 16, y: 15 },
    transparent: true,
    vibrancy: 'fullscreen-ui', // Native macOS ultra-smooth frosted glass / wallpaper vibrancy
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Enables <webview> for full web browsing
      backgroundThrottling: false,
    },
  });

  // Open Chromium DevTools to see any rendering or React errors
  // mainWindow.webContents.openDevTools({ mode: 'detach' });
  mainWindow.webContents.on('console-message', (e, level, msg, line, sourceId) => {
    console.log('[RENDERER CONSOLE]', level, msg, line, sourceId);
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      console.log('Dev server not running on 5173, falling back to dist/index.html');
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch(() => {});
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Fullscreen state listeners for native macOS fullscreen
  mainWindow.on('enter-full-screen', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('fullscreen-status-changed', true);
    }
  });

  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('fullscreen-status-changed', false);
    }
  });

  mainWindow.on('enter-html-full-screen', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('fullscreen-status-changed', true);
    }
  });

  mainWindow.on('leave-html-full-screen', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('fullscreen-status-changed', false);
    }
  });

  // Graceful fallback for any connection failures in dev mode
  mainWindow.webContents.on('did-fail-load', (e, errorCode, errorDescription, validatedURL) => {
    if (validatedURL && validatedURL.includes('localhost:5173')) {
      console.log('localhost:5173 failed to load, falling back to dist/index.html');
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch(() => {});
    }
  });

  // Monitor any renderer or webview crashes
  mainWindow.webContents.on('render-process-gone', (e, details) => {
    console.error('⚠️ [CRASH] MainWindow Render process gone:', details);
  });
  mainWindow.webContents.on('unresponsive', () => {
    console.error('⚠️ [UNRESPONSIVE] MainWindow webContents unresponsive');
  });

  // Automatically dismiss floating UI popovers when main window is moved or resized
  mainWindow.on('move', () => dismissAllPopovers());
  mainWindow.on('resize', () => dismissAllPopovers());
}

app.whenReady().then(() => {
  const { session } = require('electron');

  // Native macOS WebAuthn & Passkeys Configuration (Apple ASAuthorizationController, iCloud Keychain, Touch ID)
  if (process.platform === 'darwin' && typeof app.configureWebAuthn === 'function') {
    try {
      app.configureWebAuthn({
        platformPasskeys: true,
        touchID: { promptReason: 'verify your passkey for $1' },
      });
      console.log('✓ WebAuthn Platform Passkeys & Touch ID initialized');
    } catch (err) {
      console.warn('WebAuthn configureWebAuthn fallback:', err.message);
      try {
        app.configureWebAuthn({
          platformPasskeys: true,
        });
      } catch (err2) {}
    }
  }

  // Standard Firefox User-Agent string for Google Auth / BotGuard bypass
  const FIREFOX_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0';

  // Native Chrome Desktop User-Agent string for standard web compatibility (Figma, YouTube, Web Store, etc.)
  const CHROME_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

  session.defaultSession.setUserAgent(CHROME_UA);

  const configuredSessions = new WeakSet();

  // Apply User-Agent, permissions, and headers per session
  function setupSessionHeaders(targetSession) {
    if (!targetSession || configuredSessions.has(targetSession)) return;
    configuredSessions.add(targetSession);

    try {
      targetSession.setUserAgent(CHROME_UA);

      targetSession.webRequest.onBeforeSendHeaders(
        {
          urls: [
            "*://*.google.com/*",
            "*://*.googleusercontent.com/*",
            "*://*.googleapis.com/*",
            "*://login.microsoftonline.com/*",
            "*://login.microsoft.com/*",
            "*://login.live.com/*",
            "*://account.microsoft.com/*",
            "*://*.msftidentity.com/*",
            "*://*.msauth.net/*",
          ],
        },
        (details, callback) => {
          try {
            const url = details.url || "";
            const isGoogle =
              url.includes("google.com") ||
              url.includes("google.") ||
              url.includes("googleusercontent.com") ||
              url.includes("googleapis.com");

            if (isGoogle) {
              details.requestHeaders["User-Agent"] = FIREFOX_UA;
              delete details.requestHeaders["Sec-CH-UA"];
              delete details.requestHeaders["sec-ch-ua"];
              delete details.requestHeaders["Sec-CH-UA-Mobile"];
              delete details.requestHeaders["sec-ch-ua-mobile"];
              delete details.requestHeaders["Sec-CH-UA-Platform"];
              delete details.requestHeaders["sec-ch-ua-platform"];
            } else {
              // Genuine Chrome UA for Microsoft and Enterprise SSO
              details.requestHeaders["User-Agent"] = CHROME_UA;
              details.requestHeaders["Sec-CH-UA"] =
                '"Not A(Brand";v="8", "Chromium";v="133", "Google Chrome";v="133"';
              details.requestHeaders["Sec-CH-UA-Mobile"] = "?0";
              details.requestHeaders["Sec-CH-UA-Platform"] = '"macOS"';
            }

            callback({ cancel: false, requestHeaders: details.requestHeaders });
          } catch (e) {
            callback({ cancel: false });
          }
        }
      );
    } catch (err) {
      console.error('Failed to setup session headers:', err);
    }

    // Support WebAuthn / Passkeys / FIDO2 security keys natively across all sessions
    try {
      targetSession.on('select-webauthn-authenticator', (event, callback) => {
        event.preventDefault();
        try {
          const authenticators = event.authenticators || [];
          if (authenticators.includes('platformPasskeys')) {
            return callback('platformPasskeys');
          }
          if (authenticators.includes('touchID')) {
            return callback('touchID');
          }
          if (authenticators.length > 0) {
            return callback(authenticators[0]);
          }
          callback(null);
        } catch (e) {
          if (typeof callback === 'function') callback(null);
        }
      });
    } catch (e) {}

    try {
      targetSession.on('select-webauthn-account', (event, details, callback) => {
        event.preventDefault();
        try {
          const accounts = (details && details.accounts) || [];
          if (!accounts || accounts.length === 0) {
            return callback(null);
          }
          if (accounts.length === 1) {
            return callback(accounts[0].credentialId);
          }

          // If multiple accounts are registered for this domain, present a clean native chooser menu
          const focusedWin = BrowserWindow.getFocusedWindow() || mainWindow;
          const { MenuItem } = require('electron');
          const menu = new Menu();
          menu.append(
            new MenuItem({
              label: `Choose Passkey for ${details.relyingPartyId || 'this site'}:`,
              enabled: false,
            })
          );
          menu.append(new MenuItem({ type: 'separator' }));

          let chosen = false;
          accounts.forEach((acc) => {
            menu.append(
              new MenuItem({
                label: acc.displayName || acc.name || `Passkey (${acc.credentialId.slice(0, 8)}...)`,
                sublabel: acc.name && acc.displayName ? acc.name : undefined,
                click: () => {
                  chosen = true;
                  callback(acc.credentialId);
                },
              })
            );
          });

          menu.on('menu-will-close', () => {
            if (!chosen) {
              callback(null);
            }
          });

          if (focusedWin) {
            menu.popup({ window: focusedWin });
          } else {
            callback(accounts[0].credentialId);
          }
        } catch (err) {
          callback(details?.accounts?.[0]?.credentialId || null);
        }
      });
    } catch (e) {}

    // In Chrome / Arc / Dia, headers are completely natural and unstripped.
    // Preserving genuine response headers ensures cookies, CORS, and POST redirect authentication flows work 100% reliably.
    try {
      targetSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(true);
      });
      targetSession.setPermissionCheckHandler(() => {
        return true;
      });
    } catch (e) {}
  }

  // Native Download Manager Architecture
  const activeDownloads = new Map(); // id -> DownloadItem reference

  function setupSessionDownloads(targetSession) {
    targetSession.on('will-download', (event, item, webContents) => {
      const downloadId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const fileName = item.getFilename();
      const totalBytes = item.getTotalBytes();
      const savePath = path.join(app.getPath('downloads'), fileName);

      // Default save path to standard user Downloads folder
      item.setSavePath(savePath);
      activeDownloads.set(downloadId, item);

      const notifyWindow = () => {
        const targetWin = BrowserWindow.fromWebContents(webContents) || BrowserWindow.getFocusedWindow() || mainWindow;
        return targetWin?.webContents;
      };

      const sendUpdate = (state) => {
        const wc = notifyWindow();
        if (wc) {
          wc.send('download-updated', {
            id: downloadId,
            filename: fileName,
            savePath: item.getSavePath() || savePath,
            receivedBytes: item.getReceivedBytes(),
            totalBytes: item.getTotalBytes(),
            percent: item.getTotalBytes() > 0 ? Math.round((item.getReceivedBytes() / item.getTotalBytes()) * 100) : 0,
            state: state, // 'progressing', 'completed', 'cancelled', 'interrupted'
            canResume: item.canResume(),
            isPaused: item.isPaused(),
            startTime: Date.now(),
          });
        }
      };

      // Emit initial start event
      sendUpdate('progressing');

      item.on('updated', (e, state) => {
        if (state === 'interrupted') {
          sendUpdate('interrupted');
        } else if (state === 'progressing') {
          sendUpdate(item.isPaused() ? 'paused' : 'progressing');
        }
      });

      item.once('done', (e, state) => {
        sendUpdate(state); // 'completed', 'cancelled', 'interrupted'
        activeDownloads.delete(downloadId);
      });
    });
  }

  setupSessionHeaders(session.defaultSession);
  setupSessionDownloads(session.defaultSession);
  ['persist:default', 'persist:dev', 'persist:work', 'persist:personal'].forEach((part) => {
    const ses = session.fromPartition(part);
    setupSessionHeaders(ses);
    setupSessionDownloads(ses);
  });

  // Dynamically configure session headers and downloads for any newly created webContents
  app.on('web-contents-created', (event, contents) => {
    if (contents.session) {
      setupSessionHeaders(contents.session);
      setupSessionDownloads(contents.session);
    }
  });

  // IPC: Set window traffic light control buttons visibility (when sidebar is hidden vs shown)
  ipcMain.on('set-traffic-lights-visible', (event, visible) => {
    if (mainWindow && typeof mainWindow.setWindowButtonVisibility === 'function') {
      try {
        mainWindow.setWindowButtonVisibility(!!visible);
      } catch (e) {}
    }
  });

  // Native macOS Window Controls (Traffic Lights) IPC Handlers
  ipcMain.on('window-close', (event) => {
    const win = (event && event.sender && BrowserWindow.fromWebContents(event.sender)) || mainWindow;
    if (win) win.close();
  });

  ipcMain.on('window-minimize', (event) => {
    const win = (event && event.sender && BrowserWindow.fromWebContents(event.sender)) || mainWindow;
    if (win) win.minimize();
  });

  ipcMain.on('window-toggle-fullscreen', (event) => {
    const win = (event && event.sender && BrowserWindow.fromWebContents(event.sender)) || mainWindow;
    if (win) {
      win.setFullScreen(!win.isFullScreen());
    }
  });

  ipcMain.on('window-zoom', (event) => {
    const win = (event && event.sender && BrowserWindow.fromWebContents(event.sender)) || mainWindow;
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.handle('is-fullscreen', (event) => {
    const win = (event && event.sender && BrowserWindow.fromWebContents(event.sender)) || mainWindow;
    return win ? win.isFullScreen() : false;
  });

  ipcMain.on('show-tab-context-menu', (event, options) => {
    const {
      tabId,
      url,
      isPinned,
      category,
      hasAudio,
      isMuted,
      spaceGroups,
      spacesList,
    } = options;

    const template = [];

    // 1. Pin / Unpin
    template.push({
      label: isPinned ? 'Unpin' : 'Pin',
      click: () => {
        event.sender.send('tab-menu-action', { action: 'toggle-pin', tabId });
      },
    });

    template.push({ type: 'separator' });

    // 2. Open as Split, Duplicate
    template.push({
      label: 'Open as Split',
      click: () => {
        event.sender.send('tab-menu-action', { action: 'open-split', tabId });
      },
    });

    template.push({
      label: 'Duplicate',
      click: () => {
        event.sender.send('tab-menu-action', { action: 'duplicate', tabId });
      },
    });

    template.push({ type: 'separator' });

    // 3. New Group with Tab
    template.push({
      label: 'New Group with Tab',
      click: () => {
        event.sender.send('tab-menu-action', { action: 'new-group', tabId });
      },
    });

    if (category) {
      template.push({
        label: 'Remove from Group',
        click: () => {
          event.sender.send('tab-menu-action', { action: 'remove-group', tabId });
        },
      });
    }

    // Move to Group (only if groups exist in current profile)
    if (spaceGroups && spaceGroups.length > 0) {
      template.push({
        label: 'Move to Group',
        submenu: spaceGroups.map((grp) => ({
          label: grp,
          type: 'checkbox',
          checked: category === grp,
          click: () => {
            event.sender.send('tab-menu-action', {
              action: 'move-group',
              tabId,
              targetCategory: grp,
            });
          },
        })),
      });
    }

    // Move to Profile
    if (spacesList && spacesList.length > 0) {
      template.push({
        label: 'Move to Profile',
        submenu: spacesList.map((sp) => ({
          label: sp.name,
          type: 'checkbox',
          checked: sp.isCurrent,
          click: () => {
            event.sender.send('tab-menu-action', {
              action: 'move-space',
              tabId,
              targetSpaceId: sp.id,
            });
          },
        })),
      });
    }

    // Move to Window
    template.push({
      label: 'Move to Window',
      click: () => {
        event.sender.send('tab-menu-action', { action: 'move-window', tabId, url });
      },
    });

    template.push({ type: 'separator' });

    // 4. Copy Link
    template.push({
      label: 'Copy Link',
      click: () => {
        clipboard.writeText(url);
        event.sender.send('tab-menu-action', { action: 'copied-link' });
      },
    });

    // Sleep Tab / Memory Saver
    if (!isPinned && url && url !== 'aura://newtab' && url !== 'about:blank') {
      template.push({
        label: options.isSleeping ? 'Wake Tab' : 'Sleep Tab (Free Memory)',
        click: () => {
          event.sender.send('tab-menu-action', { action: 'toggle-sleep', tabId });
        },
      });
    }

    // 5. Rename Group (only when in a group) & Mute/Unmute (only when tab has audio)
    if (category || hasAudio || isMuted) {
      template.push({ type: 'separator' });

      if (category) {
        template.push({
          label: 'Rename Group...',
          click: () => {
            event.sender.send('tab-menu-action', { action: 'rename-group', tabId });
          },
        });
      }

      if (hasAudio || isMuted) {
        template.push({
          label: isMuted ? 'Unmute Site' : 'Mute Site',
          click: () => {
            event.sender.send('tab-menu-action', { action: 'toggle-mute', tabId });
          },
        });
      }
    }

    template.push({ type: 'separator' });

    // 6. Close actions
    template.push({
      label: 'Close',
      click: () => {
        event.sender.send('tab-menu-action', { action: 'close-tab', tabId });
      },
    });

    template.push({
      label: 'Close Other Tabs',
      click: () => {
        event.sender.send('tab-menu-action', { action: 'close-other-tabs', tabId });
      },
    });

    template.push({
      label: 'Close Tabs Below',
      click: () => {
        event.sender.send('tab-menu-action', { action: 'close-tabs-below', tabId });
      },
    });

    const menu = Menu.buildFromTemplate(template);
    const win = BrowserWindow.fromWebContents(event.sender);
    menu.popup({ window: win });
  });

  // Empty Sidebar Native macOS Context Menu
  ipcMain.on('show-sidebar-context-menu', (event, options) => {
    const { hasClosedTabs, showTabsInSidebar } = options;

    const template = [
      {
        label: 'New Tab',
        accelerator: 'CmdOrCtrl+T',
        click: () => {
          event.sender.send('sidebar-menu-action', { action: 'new-tab' });
        },
      },
      {
        label: 'Reopen Closed Tab',
        accelerator: 'Shift+CmdOrCtrl+T',
        enabled: !!hasClosedTabs,
        click: () => {
          event.sender.send('sidebar-menu-action', { action: 'reopen-closed-tab' });
        },
      },
      { type: 'separator' },
      {
        label: 'New Group',
        click: () => {
          event.sender.send('sidebar-menu-action', { action: 'new-group' });
        },
      },
      {
        label: 'New Live Group',
        submenu: [
          {
            label: 'GitHub Pull Requests',
            click: () => {
              event.sender.send('sidebar-menu-action', { action: 'new-live-group', type: 'github' });
            },
          },
          {
            label: 'Google Calendar / Events',
            click: () => {
              event.sender.send('sidebar-menu-action', { action: 'new-live-group', type: 'calendar' });
            },
          },
          {
            label: 'RSS / Tech News Feed',
            click: () => {
              event.sender.send('sidebar-menu-action', { action: 'new-live-group', type: 'rss' });
            },
          },
          {
            label: 'Figma Recent Files',
            click: () => {
              event.sender.send('sidebar-menu-action', { action: 'new-live-group', type: 'figma' });
            },
          },
        ],
      },
      { type: 'separator' },
      {
        label: 'New Profile...',
        click: () => {
          event.sender.send('sidebar-menu-action', { action: 'new-profile' });
        },
      },
      { type: 'separator' },
      {
        label: 'Bookmark All Tabs',
        click: () => {
          event.sender.send('sidebar-menu-action', { action: 'bookmark-all-tabs' });
        },
      },
      { type: 'separator' },
      {
        label: 'Show Tabs in Sidebar',
        type: 'checkbox',
        checked: showTabsInSidebar !== false,
        accelerator: 'Shift+CmdOrCtrl+S',
        click: () => {
          event.sender.send('sidebar-menu-action', { action: 'toggle-show-tabs' });
        },
      },
      {
        label: 'Auto-Hide Tabs',
        accelerator: 'CmdOrCtrl+S',
        click: () => {
          event.sender.send('sidebar-menu-action', { action: 'toggle-auto-hide' });
        },
      },
      { type: 'separator' },
      {
        label: 'Close All Tabs',
        accelerator: 'Shift+CmdOrCtrl+K',
        click: () => {
          event.sender.send('sidebar-menu-action', { action: 'close-all-tabs' });
        },
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    const win = BrowserWindow.fromWebContents(event.sender);
    menu.popup({ window: win });
  });

  createWindow();

  // Async fast metadata & title fetcher for background tabs (Dia / Arc model)
  ipcMain.handle('fetch-page-title', async (event, pageUrl) => {
    if (!pageUrl || !pageUrl.startsWith('http')) return null;

    try {
      // 1. YouTube specialized fast oEmbed lookup (Instant <200ms JSON response with real video title)
      if (pageUrl.includes('youtube.com') || pageUrl.includes('youtu.be')) {
        try {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(pageUrl)}&format=json`);
          if (oembedRes.ok) {
            const data = await oembedRes.json();
            if (data && data.title) {
              return data.title;
            }
          }
        } catch (e) {}
      }

      // 2. Fast HTTP request reading the first 16KB of HTML for the <title> tag
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) return null;

      const reader = res.body.getReader();
      let chunks = '';
      const decoder = new TextDecoder();

      while (chunks.length < 32768) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks += decoder.decode(value, { stream: true });
        const match = chunks.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (match && match[1]) {
          controller.abort();
          let title = match[1].trim();
          title = title.replace(/\s*-\s*YouTube\s*$/i, '').trim();
          return title;
        }
      }
    } catch (e) {}

    return null;
  });

  // IPC: Fetch real-time live search suggestions for Arc-style Command Palette
  ipcMain.handle('fetch-search-suggestions', async (event, query) => {
    if (!query || !query.trim()) return [];
    try {
      const res = await fetch(
        `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query.trim())}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          },
        }
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1].slice(0, 7);
      }
    } catch (e) {}
    return [];
  });

  // IPC: Check Google Authentication Status for Partition
  ipcMain.handle('check-google-auth-status', async (event, partition = 'persist:default') => {
    try {
      const ses = session.fromPartition(partition);
      const sidCookies = await ses.cookies.get({ domain: '.google.com', name: 'SID' });
      const isSignedIn = Array.isArray(sidCookies) && sidCookies.length > 0;

      let email = null;
      let name = null;

      // Extract user info if available from cookies or account chooser
      const chooserCookies = await ses.cookies.get({ domain: 'accounts.google.com', name: 'ACCOUNT_CHOOSER' });
      if (chooserCookies && chooserCookies.length > 0) {
        try {
          const val = decodeURIComponent(chooserCookies[0].value);
          const emailMatch = val.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) email = emailMatch[0];
        } catch (e) {}
      }

      if (!email && isSignedIn) {
        email = 'Google Account';
      }

      return {
        isSignedIn,
        email,
        name: name || (email && email !== 'Google Account' ? email.split('@')[0] : 'Google User'),
      };
    } catch (e) {
      return { isSignedIn: false, email: null, name: null };
    }
  });

  // IPC: Clear Google Auth session on Sign Out
  ipcMain.handle('sign-out-google', async (event, partition = 'persist:default') => {
    try {
      const ses = session.fromPartition(partition);
      const googleCookies = await ses.cookies.get({ domain: '.google.com' });
      for (const c of googleCookies) {
        try {
          await ses.cookies.remove(`https://google.com${c.path}`, c.name);
          await ses.cookies.remove(`https://accounts.google.com${c.path}`, c.name);
        } catch (err) {}
      }
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  });

  ipcMain.on('open-new-window', (event, url) => {
    const newWin = new BrowserWindow({
      width: 1200,
      height: 800,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true,
      },
      backgroundColor: '#09090b',
    });
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const queryParams = new URLSearchParams();
    queryParams.set('isNewWindow', 'true');
    if (url && typeof url === 'string' && url.trim()) {
      queryParams.set('initialUrl', url.trim());
    }
    if (isDev) {
      newWin.loadURL(`http://localhost:5173?${queryParams.toString()}`);
    } else {
      newWin.loadFile(path.join(__dirname, '../dist/index.html'), {
        search: queryParams.toString(),
      });
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // --- Chrome Extension Management Engine ---
  const extensionsDir = path.join(app.getPath('userData'), 'extensions');
  if (!fs.existsSync(extensionsDir)) {
    try {
      fs.mkdirSync(extensionsDir, { recursive: true });
    } catch (e) {}
  }

  // Helper to extract CRX (CRX3 or ZIP) to target folder
  function extractCrxToDir(crxPath, outDir) {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const buf = fs.readFileSync(crxPath);
    if (buf.slice(0, 4).toString() === 'Cr24') {
      const headerLen = buf.readUInt32LE(8);
      const zipOffset = 12 + headerLen;
      const zipBuf = buf.slice(zipOffset);
      const zip = new AdmZip(zipBuf);
      zip.extractAllTo(outDir, true);
    } else {
      const zip = new AdmZip(buf);
      zip.extractAllTo(outDir, true);
    }
  }

  // Helper to resolve localized name (e.g. __MSG_extName__)
  function resolveExtensionDisplayName(extPath, manifest) {
    let name = manifest.name;
    if (name && name.startsWith('__MSG_') && name.endsWith('__')) {
      const key = name.slice(6, -2);
      const defaultLocale = manifest.default_locale || 'en';
      const locales = [defaultLocale, 'en', 'en_US', 'en_GB'];
      for (const loc of locales) {
        const msgFile = path.join(extPath, '_locales', loc, 'messages.json');
        if (fs.existsSync(msgFile)) {
          try {
            const messages = JSON.parse(fs.readFileSync(msgFile, 'utf8'));
            if (messages[key] && messages[key].message) {
              return messages[key].message;
            }
          } catch (e) {}
        }
      }
    }
    return name || 'Extension';
  }

  // Helper to download a CRX from Chrome Web Store update server
  function downloadCrxFromStore(extId, destFile) {
    return new Promise((resolve, reject) => {
      const url = `https://clients2.google.com/service/update2/crx?response=redirect&os=mac&arch=arm64&os_arch=arm64&nacl_arch=arm&prod=chromecrx&prodchannel=unknown&prodversion=9999.0.9999.0&acceptformat=crx2,crx3&x=id%3D${extId}%26uc`;

      function requestWithRedirect(targetUrl, depth = 0) {
        if (depth > 6) return reject(new Error('Too many redirects while downloading extension'));
        https.get(targetUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            requestWithRedirect(res.headers.location, depth + 1);
          } else if (res.statusCode === 200) {
            const fileStream = fs.createWriteStream(destFile);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close(() => resolve(destFile));
            });
          } else {
            reject(new Error(`Download failed with status ${res.statusCode}`));
          }
        }).on('error', reject);
      }

      requestWithRedirect(url);
    });
  }

  // Helper to discover all valid extension root folders (including nested version dirs like <extId>/<version>/manifest.json)
  function discoverExtensionDirs(baseDir) {
    if (!fs.existsSync(baseDir)) return [];
    const results = [];
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(baseDir, entry.name);
        if (fs.existsSync(path.join(fullPath, 'manifest.json'))) {
          results.push(fullPath);
        } else {
          // Check 1 level deeper (e.g. nngceckbapebfimnlniiiahkandclblb/2026.10.1_0)
          try {
            const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
            for (const sub of subEntries) {
              if (sub.isDirectory()) {
                const subPath = path.join(fullPath, sub.name);
                if (fs.existsSync(path.join(subPath, 'manifest.json'))) {
                  results.push(subPath);
                }
              }
            }
          } catch (e) {}
        }
      }
    }
    return results;
  }

  // Load all extensions into a target session
  async function loadExtensionsIntoSession(targetSession) {
    const extDirs = discoverExtensionDirs(extensionsDir);
    const loaded = [];
    const getExt = targetSession.extensions?.getExtension || targetSession.getExtension;
    const loadExt = targetSession.extensions?.loadExtension || targetSession.loadExtension;

    for (const extPath of extDirs) {
      try {
        const ext = await loadExt.call(targetSession.extensions || targetSession, extPath, { allowFileAccess: true });
        loaded.push(ext);
      } catch (err) {
        if (!err.message?.includes('already loaded')) {
          console.error(`Failed to load extension from ${extPath}:`, err);
        }
      }
    }
    return loaded;
  }

  // Track pending extension tab creation requests to bridge guest webviews with extensions
  const pendingExtensionTabResolvers = new Map();

  // Active sessions registry & initialized sessions set
  const activeSessions = new Set([session.defaultSession]);
  const initializedSessions = new Set();

  // Initialize full Chrome Extension APIs (webNavigation, contextMenus, notifications, tabs, windows)
  const chromeExtensionsInstances = new Map();
  function initChromeExtensionsForSession(targetSession) {
    try {
      if (!chromeExtensionsInstances.has(targetSession)) {
        const extInstance = new ElectronChromeExtensions({
          session: targetSession,
          createTab(details) {
            return new Promise((resolve) => {
              const reqId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
              pendingExtensionTabResolvers.set(reqId, resolve);
              // Fallback timeout after 8s
              setTimeout(() => {
                if (pendingExtensionTabResolvers.has(reqId)) {
                  pendingExtensionTabResolvers.delete(reqId);
                }
              }, 8000);

              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('open-in-new-tab', details.url || 'about:blank', 'new-tab');
              }
            });
          },
          removeTab(tab, win) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('extension-close-tab', tab.id);
            }
          },
        });
        chromeExtensionsInstances.set(targetSession, extInstance);
      }
    } catch (e) {
      console.warn('ElectronChromeExtensions init warning:', e);
    }
  }

  // Dynamically ensure any session (default or dynamic space partition) is fully initialized with extensions & web store
  async function ensureSessionExtensions(targetSession) {
    if (!targetSession) targetSession = session.defaultSession;
    activeSessions.add(targetSession);

    let extInstance = chromeExtensionsInstances.get(targetSession);
    if (!extInstance) {
      initChromeExtensionsForSession(targetSession);
      extInstance = chromeExtensionsInstances.get(targetSession);
    }

    if (!initializedSessions.has(targetSession)) {
      initializedSessions.add(targetSession);
      await loadExtensionsIntoSession(targetSession);
      try {
        await installChromeWebStore({ session: targetSession, extensionsPath: extensionsDir });
      } catch (e) {}
    }

    return extInstance;
  }

  // Notify renderer whenever extensions are added or removed
  function notifyExtensionsChanged() {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('extensions-updated');
    }
  }

  // Load for default session and all discovered partitions on disk + common presets
  ensureSessionExtensions(session.defaultSession).catch(() => {});

  const partitionsBaseDir = path.join(app.getPath('userData'), 'Partitions');
  const initialPartitions = ['default', 'dev', 'work', 'personal'];
  if (fs.existsSync(partitionsBaseDir)) {
    try {
      const entries = fs.readdirSync(partitionsBaseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !initialPartitions.includes(entry.name)) {
          initialPartitions.push(entry.name);
        }
      }
    } catch (e) {}
  }

  initialPartitions.forEach((pName) => {
    const ses = session.fromPartition(`persist:${pName}`);
    ensureSessionExtensions(ses).catch(() => {});
  });

  // Automatically register attached webviews with the extension system
  function hookMainWindowWebviewAttacher(win) {
    if (!win || win.isDestroyed()) return;
    win.webContents.on('did-attach-webview', async (event, guestWebContents) => {
      if (!guestWebContents || guestWebContents.isDestroyed()) return;
      try {
        const extInstance = await ensureSessionExtensions(guestWebContents.session);
        if (extInstance && !guestWebContents.isDestroyed() && !win.isDestroyed()) {
          extInstance.addTab(guestWebContents, win);
        }
      } catch (e) {}
    });
  }
  if (mainWindow) {
    hookMainWindowWebviewAttacher(mainWindow);
  }

  // IPC: Return the absolute file:// path to webview-preload.js
  ipcMain.handle('get-webview-preload-path', () => {
    const { pathToFileURL } = require('url');
    return pathToFileURL(path.join(__dirname, 'webview-preload.js')).href;
  });

  // App Version & Update Checker (GitHub Releases)
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('open-external-url', async (event, targetUrl) => {
    if (targetUrl && (targetUrl.startsWith('https://') || targetUrl.startsWith('http://'))) {
      shell.openExternal(targetUrl);
      return true;
    }
    return false;
  });

  ipcMain.handle('check-app-update', async () => {
    const currentVersion = app.getVersion();
    try {
      const response = await fetch('https://api.github.com/repos/zakariarzack/slate-browser/releases/latest', {
        headers: {
          'User-Agent': 'Slate-Browser-Update-Checker',
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (response.status === 404) {
        return {
          hasUpdate: false,
          currentVersion,
          message: 'No published releases found yet.'
        };
      }

      if (!response.ok) {
        return {
          hasUpdate: false,
          currentVersion,
          error: `GitHub API error (${response.status})`
        };
      }

      const release = await response.json();
      const latestTag = release.tag_name || '';
      const cleanLatest = latestTag.replace(/^v/i, '').trim();

      // Semver comparison
      const parseSemver = (v) => v.replace(/^v/i, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
      const [lMaj = 0, lMin = 0, lPatch = 0] = parseSemver(cleanLatest);
      const [cMaj = 0, cMin = 0, cPatch = 0] = parseSemver(currentVersion);

      let isNewer = false;
      if (lMaj > cMaj) isNewer = true;
      else if (lMaj === cMaj && lMin > cMin) isNewer = true;
      else if (lMaj === cMaj && lMin === cMin && lPatch > cPatch) isNewer = true;

      // Find DMG asset if attached to release
      const dmgAsset = Array.isArray(release.assets)
        ? release.assets.find(a => a.name && a.name.toLowerCase().endsWith('.dmg'))
        : null;

      const downloadUrl = dmgAsset?.browser_download_url || release.html_url || 'https://github.com/zakariarzack/slate-browser/releases';

      return {
        hasUpdate: isNewer,
        currentVersion,
        latestVersion: cleanLatest,
        releaseName: release.name || latestTag,
        releaseNotes: release.body || '',
        releaseUrl: release.html_url,
        downloadUrl,
        publishedAt: release.published_at
      };
    } catch (err) {
      return {
        hasUpdate: false,
        currentVersion,
        error: err.message
      };
    }
  });

  // IPC: Return list of all installed extensions to renderer
  ipcMain.handle('get-installed-extensions', async () => {
    const resultsMap = new Map();

    // 1. Query loaded extensions from all active sessions
    const sessions = Array.from(activeSessions);
    for (const ses of sessions) {
      const getAll = ses.extensions?.getAllExtensions || ses.getAllExtensions;
      if (typeof getAll === 'function') {
        const loadedList = getAll.call(ses.extensions || ses) || [];
        for (const ext of loadedList) {
          if (!resultsMap.has(ext.id)) {
            let icon = null;
            const manifest = ext.manifest || {};
            const icons = manifest.icons || manifest.action?.default_icon || {};
            const iconKey = Object.keys(icons).sort((a, b) => Number(b) - Number(a))[0];
            if (iconKey && typeof icons === 'object' && icons[iconKey]) {
              const fullIconPath = path.join(ext.path, icons[iconKey]);
              if (fs.existsSync(fullIconPath)) {
                try {
                  const b64 = fs.readFileSync(fullIconPath).toString('base64');
                  icon = `data:image/png;base64,${b64}`;
                } catch (e) {
                  icon = `chrome-extension://${ext.id}/${icons[iconKey]}`;
                }
              } else {
                icon = `chrome-extension://${ext.id}/${icons[iconKey]}`;
              }
            }

            const displayName = resolveExtensionDisplayName(ext.path, manifest);
            resultsMap.set(ext.id, {
              id: ext.id,
              name: displayName,
              version: ext.version,
              description: manifest.description || '',
              iconUrl: icon,
              homepageUrl: manifest.homepage_url || '',
              hasPopup: !!(manifest.action?.default_popup || manifest.browser_action?.default_popup),
            });
          }
        }
      }
    }

    // 2. Discover from extensions directory on disk if not yet loaded
    const diskDirs = discoverExtensionDirs(extensionsDir);
    for (const d of diskDirs) {
      try {
        const manifestPath = path.join(d, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const parts = d.split(path.sep);
          // Directory is either .../<extId>/<version> or .../<extId>
          let extId = parts[parts.length - 1];
          if (/^\d+(\.\d+)*(_\d+)?$/.test(extId)) {
            extId = parts[parts.length - 2];
          }

          if (extId && !resultsMap.has(extId)) {
            let icon = null;
            const icons = manifest.icons || manifest.action?.default_icon || {};
            const iconKey = Object.keys(icons).sort((a, b) => Number(b) - Number(a))[0];
            if (iconKey && typeof icons === 'object' && icons[iconKey]) {
              const fullIconPath = path.join(d, icons[iconKey]);
              if (fs.existsSync(fullIconPath)) {
                try {
                  const b64 = fs.readFileSync(fullIconPath).toString('base64');
                  icon = `data:image/png;base64,${b64}`;
                } catch (e) {
                  icon = `chrome-extension://${extId}/${icons[iconKey]}`;
                }
              }
            }

            const displayName = resolveExtensionDisplayName(d, manifest);
            resultsMap.set(extId, {
              id: extId,
              name: displayName,
              version: manifest.version || '1.0.0',
              description: manifest.description || '',
              iconUrl: icon,
              homepageUrl: manifest.homepage_url || '',
              hasPopup: !!(manifest.action?.default_popup || manifest.browser_action?.default_popup),
            });
          }
        }
      } catch (e) {}
    }

    return Array.from(resultsMap.values());
  });

  // IPC: Install Extension by Chrome Web Store ID or URL
  ipcMain.handle('install-extension', async (event, input) => {
    if (!input || typeof input !== 'string') throw new Error('Invalid extension ID or URL');

    // Extract 32-character ID from string or URL
    let extId = input.trim();
    const urlMatch = extId.match(/([a-p]{32})/i);
    if (urlMatch) {
      extId = urlMatch[1].toLowerCase();
    }

    if (!/^[a-z]{32}$/.test(extId)) {
      throw new Error('Invalid Chrome Extension ID (must be 32 alphanumeric letters)');
    }

    const tempCrx = path.join(app.getPath('temp'), `${extId}-${Date.now()}.crx`);
    const targetDir = path.join(extensionsDir, extId);

    try {
      await downloadCrxFromStore(extId, tempCrx);
      extractCrxToDir(tempCrx, targetDir);

      // Clean up temp CRX file
      try { fs.unlinkSync(tempCrx); } catch (e) {}

      // Load newly unpacked extension into all sessions immediately
      for (const ses of activeSessions) {
        try {
          const loadExt = ses.extensions?.loadExtension || ses.loadExtension;
          await loadExt.call(ses.extensions || ses, targetDir, { allowFileAccess: true });
        } catch (e) {}
      }

      const ext = session.defaultSession.getExtension(extId);
      const manifest = ext?.manifest || {};
      const displayName = resolveExtensionDisplayName(targetDir, manifest);
      notifyExtensionsChanged();

      return {
        success: true,
        id: extId,
        name: displayName,
        version: ext?.version || manifest.version || '1.0.0',
      };
    } catch (err) {
      try { fs.unlinkSync(tempCrx); } catch (e) {}
      throw err;
    }
  });

  // IPC: Uninstall Extension
  ipcMain.handle('uninstall-extension', async (event, extensionId) => {
    if (!extensionId) return { success: false };

    try {
      // Remove from all active sessions
      for (const ses of activeSessions) {
        try {
          const removePartExt = ses.extensions?.removeExtension || ses.removeExtension;
          if (typeof removePartExt === 'function') {
            removePartExt.call(ses.extensions || ses, extensionId);
          }
        } catch (e) {}
      }

      // Delete files from disk
      const targetDir = path.join(extensionsDir, extensionId);
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }

      notifyExtensionsChanged();
      return { success: true };
    } catch (err) {
      console.error('Failed to uninstall extension:', err);
      return { success: false, error: err.message };
    }
  });

  // IPC: Install from local unpacked folder or CRX / ZIP via native file dialog
  ipcMain.handle('install-local-extension', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Unpacked Extension Folder or CRX / ZIP',
      properties: ['openDirectory', 'openFile'],
      filters: [
        { name: 'Extensions & Archives', extensions: ['crx', 'zip'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const selectedPath = result.filePaths[0];
    const stat = fs.statSync(selectedPath);

    if (stat.isDirectory()) {
      const manifestPath = path.join(selectedPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('Selected folder does not contain a manifest.json');
      }
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const extFolderId = path.basename(selectedPath).toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetDir = path.join(extensionsDir, extFolderId);

      // Copy directory recursively
      fs.cpSync(selectedPath, targetDir, { recursive: true });

      for (const ses of activeSessions) {
        try {
          const loadExt = ses.extensions?.loadExtension || ses.loadExtension;
          await loadExt.call(ses.extensions || ses, targetDir, { allowFileAccess: true });
        } catch (e) {}
      }

      notifyExtensionsChanged();
      return { success: true, name: resolveExtensionDisplayName(targetDir, manifest) };
    } else {
      // It's a .crx or .zip file
      const extName = path.basename(selectedPath, path.extname(selectedPath)).toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetDir = path.join(extensionsDir, extName);
      extractCrxToDir(selectedPath, targetDir);

      const manifestPath = path.join(targetDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        throw new Error('Archive does not contain a valid extension manifest.json');
      }
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      for (const ses of activeSessions) {
        try {
          const loadExt = ses.extensions?.loadExtension || ses.loadExtension;
          await loadExt.call(ses.extensions || ses, targetDir, { allowFileAccess: true });
        } catch (e) {}
      }

      notifyExtensionsChanged();
      return { success: true, name: resolveExtensionDisplayName(targetDir, manifest) };
    }
  });

  ipcMain.on('open-extension-popup', async (event, { extensionId, anchorX, anchorY, spaceId }) => {
    // If the same extension icon was clicked while open, toggle close it (just like Chrome)
    if (extensionPopupWin && currentPopupExtensionId === extensionId) {
      closeExtensionPopup();
      return;
    }
    closeExtensionPopup();
    currentPopupExtensionId = extensionId;

    const targetSession = spaceId ? session.fromPartition(`persist:${spaceId}`) : session.defaultSession;
    const extInstance = await ensureSessionExtensions(targetSession);

    const ext = targetSession.getExtension(extensionId) || session.defaultSession.getExtension(extensionId);
    if (!ext) {
      console.error(`Extension not found for popup: ${extensionId}`);
      return;
    }

    const manifest = ext.manifest || {};
    const popupFile = manifest.action?.default_popup || manifest.browser_action?.default_popup;
    if (!popupFile) {
      // For extensions without a popup page, dispatch click action to extension service worker
      if (extInstance?.api?.browserAction) {
        try {
          extInstance.api.browserAction.activateClick({ extensionId });
        } catch (e) {
          console.warn('Failed to activateClick on extension:', e);
        }
      }
      return;
    }

    const popupUrl = `chrome-extension://${extensionId}/${popupFile}`;
    const targetWin = BrowserWindow.getFocusedWindow() || mainWindow;
    const winBounds = targetWin ? targetWin.getBounds() : { x: 100, y: 100, width: 1200, height: 800 };
    const popupW = 380;
    const popupH = 580;

    const { screen } = require('electron');
    const display = screen.getDisplayMatching(winBounds);

    let posX = winBounds.x + winBounds.width - popupW - 16;
    let posY = winBounds.y + 44;

    // If anchorX / anchorY provided from toolbar
    if (anchorX && anchorY) {
      posX = Math.round(winBounds.x + anchorX - popupW / 2);
      posY = Math.round(winBounds.y + anchorY + 8);
    }

    // Constrain strictly within screen work area
    if (posX + popupW > display.workArea.x + display.workArea.width) {
      posX = display.workArea.x + display.workArea.width - popupW - 8;
    }
    if (posX < display.workArea.x) {
      posX = display.workArea.x + 8;
    }
    if (posY + popupH > display.workArea.y + display.workArea.height) {
      posY = display.workArea.y + display.workArea.height - popupH - 8;
    }

    const popupCreatedTime = Date.now();
    extensionPopupWin = new BrowserWindow({
      parent: targetWin,
      width: popupW,
      height: popupH,
      x: Math.round(posX),
      y: Math.round(posY),
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: true,
      roundedCorners: true,
      backgroundColor: '#18181b',
      webPreferences: {
        session: targetSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    extensionPopupWin.webContents.on('did-fail-load', (e, code, desc, failedUrl) => {
      console.error(`[EXTENSION POPUP FAIL] Code: ${code}, ${desc}, URL: ${failedUrl}`);
    });

    // Support WebAuthn / Passkeys inside extension popup
    try {
      if (typeof extensionPopupWin.webContents.session.setWebAuthnHandler === 'function') {
        extensionPopupWin.webContents.session.setWebAuthnHandler((details, callback) => {
          callback({ action: 'allow' });
        });
      }
    } catch (e) {}

    // Allow Bitwarden SSO and OAuth popups (e.g. vault.bitwarden.com, identity providers)
    extensionPopupWin.webContents.setWindowOpenHandler(({ url }) => {
      if (url && url !== 'about:blank') {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            parent: extensionPopupWin,
            width: 520,
            height: 680,
            autoHideMenuBar: true,
            webPreferences: {
              session: targetSession,
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
            },
          },
        };
      }
      return { action: 'deny' };
    });

    extensionPopupWin.loadURL(popupUrl).catch((err) => {
      console.error('[EXTENSION POPUP LOAD ERROR]:', err);
    });

    extensionPopupWin.on('blur', () => {
      // Don't close if within initial 400ms grace period or if child modal is focused
      if (Date.now() - popupCreatedTime < 400) return;
      setTimeout(() => {
        if (extensionPopupWin && !extensionPopupWin.isDestroyed() && !extensionPopupWin.isFocused()) {
          const focused = BrowserWindow.getFocusedWindow();
          if (focused && (focused.getParentWindow() === extensionPopupWin || focused.__isAuthPopup)) {
            return;
          }
          closeExtensionPopup();
        }
      }, 150);
    });

    extensionPopupWin.on('closed', () => {
      extensionPopupWin = null;
      currentPopupExtensionId = null;
    });
  });

  // Open Extensions folder in Finder
  ipcMain.on('open-extensions-folder', () => {
    shell.openPath(extensionsDir);
  });

  // Download Actions IPC
  ipcMain.on('pause-download', (event, id) => {
    const item = activeDownloads.get(id);
    if (item && !item.isPaused()) item.pause();
  });

  ipcMain.on('resume-download', (event, id) => {
    const item = activeDownloads.get(id);
    if (item && item.canResume()) item.resume();
  });

  ipcMain.on('cancel-download', (event, id) => {
    const item = activeDownloads.get(id);
    if (item) item.cancel();
  });

  ipcMain.on('show-download-in-folder', (event, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    } else {
      shell.openPath(app.getPath('downloads'));
    }
  });

  ipcMain.on('open-download-file', (event, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.openPath(filePath);
    }
  });

  ipcMain.on('open-downloads-folder', () => {
    shell.openPath(app.getPath('downloads'));
  });

  // Close browser window or app when last tab is closed
  ipcMain.on('close-app', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.close();
    } else {
      app.quit();
    }
  });

  // Bridge guest webviews with extension tab manager
  ipcMain.on('register-guest-tab', async (event, { webContentsId, tabId, spaceId, isActive }) => {
    const { webContents } = require('electron');
    const guestContents = webContents.fromId(webContentsId);
    if (!guestContents || guestContents.isDestroyed()) return;

    // Use guestContents.session directly so there can NEVER be a session mismatch
    const targetSession = guestContents.session;
    const extInstance = await ensureSessionExtensions(targetSession);
    const targetWin = BrowserWindow.getFocusedWindow() || mainWindow;

    if (extInstance && targetWin) {
      try {
        extInstance.addTab(guestContents, targetWin);
        if (isActive) {
          extInstance.selectTab(guestContents);
        }
      } catch (e) {
        // Tab might already be registered in this session
      }
    }

    // If an extension called chrome.tabs.create and is waiting for the created tab
    if (pendingExtensionTabResolvers.size > 0 && targetWin) {
      const [firstReqId, resolve] = pendingExtensionTabResolvers.entries().next().value;
      pendingExtensionTabResolvers.delete(firstReqId);
      try {
        resolve([guestContents, targetWin]);
      } catch (e) {}
    }
  });

  // Track active tab selection changes for extensions
  ipcMain.on('select-guest-tab', async (event, { webContentsId }) => {
    const { webContents } = require('electron');
    const guestContents = webContents.fromId(webContentsId);
    if (!guestContents || guestContents.isDestroyed()) return;

    const targetSession = guestContents.session;
    const extInstance = await ensureSessionExtensions(targetSession);
    if (extInstance) {
      try {
        extInstance.selectTab(guestContents);
      } catch (e) {}
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
