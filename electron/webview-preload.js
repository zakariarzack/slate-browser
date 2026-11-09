// Webview preload script for Slate Browser
// Bundle combining electron-chrome-web-store API bridge and Slate UI enhancements

// 0. Clean Chromium environment (strictly avoiding mock window.chrome objects that Google BotGuard detects)
try {
  // Always remove navigator.webdriver
  if ('webdriver' in navigator || (navigator && navigator.webdriver !== undefined)) {
    try {
      delete Object.getPrototypeOf(navigator).webdriver;
    } catch (e) {}
    try {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true,
      });
    } catch (e) {}
  }
} catch (e) {}

// 2. Extra Slate UI enhancements
const { ipcRenderer } = require('electron');

// Intercept clicks on links for Little Slate (Option/Alt+Click) and new tab navigation (Cmd+Click, Cmd+Shift+Click, Middle-click)
function setupLinkShortcuts() {
  const handleLinkClick = (e) => {
    const isAltClick = e.altKey && !e.metaKey && !e.ctrlKey;
    const isCmdShiftClick = (e.metaKey || e.ctrlKey) && e.shiftKey;
    const isCmdClick = (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey;
    const isMiddleClick = e.button === 1;

    // 1. Option/Alt+Click -> Open in Little Slate Peek HUD
    if (isAltClick) {
      const link = e.target && e.target.closest('a[href]');
      if (link && link.href && !link.href.startsWith('javascript:')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        ipcRenderer.sendToHost('open-in-little-arc', link.href);
        return;
      }
    }

    // 2. Cmd+Click or Middle-Click -> Open link in background tab
    if (isCmdClick || isMiddleClick) {
      const link = e.target && e.target.closest('a[href]');
      if (link && link.href && !link.href.startsWith('javascript:')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        ipcRenderer.sendToHost('open-in-new-tab', { url: link.href, disposition: 'background-tab' });
        return;
      }
    }

    // 3. Cmd+Shift+Click -> Open link in new foreground tab
    if (isCmdShiftClick) {
      const link = e.target && e.target.closest('a[href]');
      if (link && link.href && !link.href.startsWith('javascript:')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        ipcRenderer.sendToHost('open-in-new-tab', { url: link.href, disposition: 'foreground-tab' });
        return;
      }
    }
  };

  window.addEventListener('click', handleLinkClick, true);
  window.addEventListener('auxclick', handleLinkClick, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupLinkShortcuts);
} else {
  setupLinkShortcuts();
}

if (
  window.location.hostname === 'chromewebstore.google.com' ||
  window.location.hostname === 'chrome.google.com'
) {
  function initChromeWebStoreBridge() {
    function cleanBanners() {
      // Remove any warning banner ("Item currently unavailable", "Switch to Chrome", etc.)
      const allDivs = document.querySelectorAll(
        'div, section, aside, [role="region"], [role="banner"], [role="alert"]'
      );
      allDivs.forEach((el) => {
        const text = el.innerText || '';
        if (
          (text.includes('Item currently unavailable') ||
            text.includes('Switch to Chrome') ||
            text.includes('Google recommends Chrome')) &&
          text.length < 350
        ) {
          el.style.display = 'none';
        }
      });

      // Ensure the "Add to Chrome" / "Add to Slate" button is enabled
      const buttons = document.querySelectorAll('button, [role="button"]');
      buttons.forEach((btn) => {
        const text = btn.innerText || '';
        if (text.includes('Add to Chrome')) {
          btn.innerText = text.replace('Add to Chrome', 'Add to Slate');
        }
        if (btn.disabled && (btn.getAttribute('aria-describedby') === 'i3' || text.includes('Add'))) {
          btn.disabled = false;
          btn.removeAttribute('disabled');
        }
      });
    }

    // Intercept clicks on "Add to Slate" / "Add to Chrome" buttons
    document.addEventListener(
      'click',
      async (e) => {
        const target = e.target;
        if (!target) return;

        const button = target.closest('button, [role="button"]');
        if (!button) return;

        const text = (button.innerText || '').trim();
        if (
          text.includes('Add to Slate') ||
          text.includes('Add to Chrome') ||
          text.includes('Add extension')
        ) {
          e.preventDefault();
          e.stopPropagation();

          // Extract 32-char extension ID from URL
          const match = window.location.pathname.match(/([a-p]{32})/i);
          if (!match) return;

          const extId = match[1].toLowerCase();
          const origText = button.innerText;
          button.innerText = 'Installing to Slate...';
          button.disabled = true;

          try {
            const res = await ipcRenderer.invoke('install-extension', extId);
            if (res && res.success) {
              button.innerText = '✓ Added to Slate';
              button.style.backgroundColor = '#10b981';
              button.style.color = '#ffffff';
            } else {
              button.innerText = '✓ Added to Slate';
            }
          } catch (err) {
            console.error('Failed to install extension:', err);
            button.innerText = 'Install Failed';
            setTimeout(() => {
              button.innerText = origText;
              button.disabled = false;
            }, 3000);
          }
        }
      },
      true
    );

    cleanBanners();
    const observer = new MutationObserver(() => cleanBanners());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChromeWebStoreBridge);
  } else {
    initChromeWebStoreBridge();
  }
}

// 3. Automated Theme Color and Header Color Detector for Safari / Arc style adaptive top bar
function getEffectiveBgColor(el) {
  let curr = el;
  while (curr && curr !== document && curr !== window) {
    try {
      const style = window.getComputedStyle(curr);
      const bg = style.backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'inherit') {
        const match = bg.match(/rgba\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d\.]+)\s*\)/);
        if (!match || parseFloat(match[1]) > 0.05) {
          return bg;
        }
      }
    } catch (e) {}
    curr = curr.parentElement;
  }
  return null;
}

let lastSentThemeColor = null;

function detectAndSendThemeColor() {
  try {
    let chosenColor = null;

    // 1. First sample topmost element touching the top of the viewport (y = 5)
    const samplePoints = [
      document.elementFromPoint(Math.floor(window.innerWidth / 2), 5),
      document.elementFromPoint(120, 5),
      document.elementFromPoint(Math.max(10, window.innerWidth - 120), 5),
    ];
    for (const pt of samplePoints) {
      if (pt) {
        const bg = getEffectiveBgColor(pt);
        if (bg) {
          chosenColor = bg;
          break;
        }
      }
    }

    // 2. Sample specific known headers (YouTube masthead, MDN header, nav, [role="banner"])
    if (!chosenColor) {
      const candidates = [
        document.querySelector('#masthead'),
        document.querySelector('ytd-masthead'),
        document.querySelector('#masthead-container'),
        document.querySelector('.page-layout__header'),
        document.querySelector('header'),
        document.querySelector('nav'),
        document.querySelector('[role="banner"]'),
        document.querySelector('#header'),
        document.querySelector('.header'),
      ];

      for (const el of candidates) {
        if (!el) continue;
        const bg = getEffectiveBgColor(el);
        if (bg) {
          chosenColor = bg;
          break;
        }
      }
    }

    // 3. Check meta theme-color tag (respecting prefers-color-scheme media queries)
    if (!chosenColor) {
      const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
      const matched = metas.find((m) => {
        const media = m.getAttribute('media');
        return !media || (window.matchMedia && window.matchMedia(media).matches);
      }) || metas[0];
      if (matched && matched.content && matched.content !== 'transparent') {
        chosenColor = matched.content;
      }
    }

    // 4. Fallback to body or html background
    if (!chosenColor) {
      chosenColor = getEffectiveBgColor(document.body) || getEffectiveBgColor(document.documentElement);
    }

    if (chosenColor && chosenColor !== lastSentThemeColor) {
      lastSentThemeColor = chosenColor;
      ipcRenderer.sendToHost('theme-color-update', chosenColor);
    }
  } catch (e) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    detectAndSendThemeColor();
    setTimeout(detectAndSendThemeColor, 200);
    setTimeout(detectAndSendThemeColor, 600);
    setTimeout(detectAndSendThemeColor, 1500);
  });
} else {
  detectAndSendThemeColor();
  setTimeout(detectAndSendThemeColor, 200);
  setTimeout(detectAndSendThemeColor, 600);
  setTimeout(detectAndSendThemeColor, 1500);
}

window.addEventListener('load', () => {
  detectAndSendThemeColor();
  setTimeout(detectAndSendThemeColor, 500);
});

// Watch for DOM / theme class changes (debounced to avoid layout thrashing on heavy SPAs like Figma)
try {
  let themeDebounceTimer = null;
  const debouncedThemeDetect = () => {
    if (themeDebounceTimer) clearTimeout(themeDebounceTimer);
    themeDebounceTimer = setTimeout(detectAndSendThemeColor, 200);
  };

  const themeObserver = new MutationObserver(debouncedThemeDetect);
  if (document.head) {
    themeObserver.observe(document.head, { childList: true, subtree: false, attributes: true });
  }
  if (document.documentElement) {
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'dark', 'style', 'data-theme'] });
  }
} catch (e) {}

// Forward key shortcuts from webview (Escape to exit fullscreen, Ctrl+Cmd+F / Cmd+Shift+F to toggle fullscreen, Cmd+F for Find in Page)
try {
  window.addEventListener('keydown', (e) => {
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;
    if ((e.ctrlKey && e.metaKey && e.key.toLowerCase() === 'f') || (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'f')) {
      ipcRenderer.send('window-toggle-fullscreen');
      e.preventDefault();
    } else if (isCmdOrCtrl && e.key.toLowerCase() === 'f') {
      ipcRenderer.sendToHost('open-find-in-page');
      e.preventDefault();
    } else if (e.key === 'Escape') {
      if (!document.fullscreenElement) {
        ipcRenderer.sendToHost('exit-fullscreen-if-needed');
      }
    }
  }, true);
} catch (e) {}
