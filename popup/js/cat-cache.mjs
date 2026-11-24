const defaultSettings = {
  enabled: true, //  #global-extension-enable
  blocksocialmedia: false,
  grayscale: false,
  suggestions: true,
  focus: false,
  blacklistEnabled: false,
  keywordsEnabled: true, // #global-keywords-enabled
  keywords: [], // global: applies to every social media

  twitter: {
    allowedListEnabled: false, // #allowed-posts-tw
    allowedList: [], // Datos que cargarás aparte
    onlyFollowing: true, // #only-following-tw
    removeUnnecessary: true, // #remove-stuff-tw
    removeMetrics: true,
    tweetsLimitEnabled: true, // #tweets-limit-tw
    tweetsLimitPeriod: "hourly", // #limit-period-tw ("daily" | "hourly")
    tweetsLimit: 25, // input numerico
  },

  instagram: {
    allowedListEnabled: false, // #allowed-posts-ig
    allowedList: [],
    removeUnnecessary: true, // #remove-stuff-ig
    hideComments: true, // #hide-comments-ig
    hideMetrics: true, // #hide-metrics-ig
    blockReels: false, // #block-reels-ig
    removePosts: false, // #remove-posts-ig
    removeStories: false, // #remove-stories-ig
    postsLimitEnabled: true, // #posts-limit-ig
    postsLimitPeriod: "hourly", // #limit-period-posts-ig
    postsLimit: 25,
    storyLimitEnabled: true, // #story-limit-ig
    storyLimitPeriod: "hourly", // #limit-period-stories-ig
    storyLimit: 25,
  },

  youtube: {
    blockShorts: false, // #block-shorts-yt
    hideComments: true, // #hide-comments-yt
    hideMetrics: true, // #hide-metrics-yt
    shortsLimitEnabled: true, // #shorts-limit-yt
    shortsLimitPeriod: "hourly", // #limit-period-shorts-yt
    shortsLimit: 25,
  },
};

// live binding: importers always see the loaded object, even after loadCache() reassigns it
export let cache = structuredClone(defaultSettings);

export async function loadCache() {
  let result = await browser.storage.local.get("catSettings");
  if (result.catSettings) {
    cache = result.catSettings;
    cache.keywords ??= []; // settings saved before keywords existed
    cache.keywordsEnabled ??= true;
  } else {
    await saveCache();
  }
}

// the only place that writes catSettings: always the whole object, so nothing gets overwritten
export async function saveCache() {
  await browser.storage.local.set({ catSettings: cache });
}

/**
 * reads name="socialmedia.value" on the html for accesing values
 */
export function getVal(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

/**
 * @param {cache} obj - the cache itself
 * @param {*} path - value to change (the name="" property on the html)
 * @param {*} value - new value for updating the caché object
 *
 * example: setVal(cache, "twitter.tweetsLimit", 50);
 */
export function setVal(obj, path, value) {
  const keys = path.split("."); // ["twitter", "tweetsLimit"].
  const lastKey = keys.pop(); // ["twitter"]
  const target = keys.reduce((acc, key) => acc[key], obj); // { tweetsLimit: 25, allowKeywords: true }.
  target[lastKey] = value; // target["tweetsLimit"] = 50;
}
