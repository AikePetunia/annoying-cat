let activeSettings = null;
let platformModule = null;
let platformKey = null; // "twitter" | "instagram" | "youtube": settings key + module export name
let blockModule = null;
let debounceTimeout = null;

async function init() {
  const domain = window.location.hostname;
  let loadModule = null;

  switch (true) {
    case domain.includes("x.com") || domain.includes("twitter.com"):
      loadModule = () => import(browser.runtime.getURL("content/twitter.js"));
      platformKey = "twitter";
      break;

    case domain.includes("instagram.com") || domain.includes("instagr.am"):
      loadModule = () => import(browser.runtime.getURL("content/instagram.js"));
      platformKey = "instagram";
      break;

    case domain.includes("youtube.com") || domain.includes("youtu.be"):
      loadModule = () => import(browser.runtime.getURL("content/youtube.js"));
      platformKey = "youtube";
      break;
  }

  // load the blocker before the platform module so the page is covered as early as possible
  const block = await import(browser.runtime.getURL("content/block.js"));
  if (block.isBlockedDomain(domain)) blockModule = block;

  const early = await browser.storage.local.get("catSettings");
  applyBlockSetting(early?.catSettings);

  if (loadModule) {
    platformModule = await loadModule();
  }

  const cache = await browser.storage.local.get("catSettings");
  applySettings(cache?.catSettings);

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.catSettings) {
      applySettings(changes.catSettings.newValue);
    }
  });

  startObserver();
}

function isBlocking(settings) {
  return Boolean(blockModule && settings?.enabled && settings?.blocksocialmedia);
}

function applyBlockSetting(settings) {
  blockModule?.applyBlock(isBlocking(settings), { suggestions: Boolean(settings?.suggestions) });
}

function applySettings(settings) {
  activeSettings = settings;
  const enabled = Boolean(settings?.enabled);

  applyBlockSetting(settings);

  applyGrayScale(enabled && settings.grayscale);

  const applyPlatform = platformModule?.[platformKey];
  if (applyPlatform) {
    applyPlatform(
      enabled
        ? {
            ...settings[platformKey],
            keywords: settings.keywords,
            keywordsEnabled: settings.keywordsEnabled ?? true,
            suggestions: settings.suggestions,
          }
        : null
    );
  }
}

function startObserver() {
  const target = document.body || document.documentElement;
  if (!target) return;

  const observer = new MutationObserver(() => {
    if (!activeSettings?.enabled) return;

    if (isBlocking(activeSettings)) {
      // keep the overlay alive if the SPA wipes it, and silence autoplaying stuff behind it
      applyBlockSetting(activeSettings);
      blockModule.pauseMedia();
      return;
    }

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      if (platformModule?.runAllCleaners) {
        platformModule.runAllCleaners();
      }
    }, 150);
  });

  observer.observe(target, {
    childList: true,
    subtree: true,
  });
}

function applyGrayScale(enabled) {
  const styleId = "cat-grayscale-filter";
  let styleTag = document.getElementById(styleId);

  if (enabled) {
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = styleId;
      styleTag.textContent = "html { filter: grayscale(100%) !important; }";
      (document.head || document.documentElement).appendChild(styleTag);
    }
  } else if (styleTag) {
    styleTag.remove();
  }
}

init();
