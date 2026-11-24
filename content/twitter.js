import { createCard, CARD_CLASS } from "./cat-card.js";
import { ensureHideStyle, hide, reveal, buildKeywordRegexes } from "./utils/helpers.js";

const TW_STYLE_BLOCK_ID = "cat-tw-blocked-elements";

// new X UI (2026 redesign) uses hrefs/aria-labels; data-testid ones are kept as fallback for the old UI.
const unnecessarySelectors = [
  // left nav
  'nav[aria-label="Primary"] a[href="/explore"]',
  'nav[aria-label="Primary"] a[href="/i/chat"]',
  'nav[aria-label="Primary"] a[href="/i/calls"]',
  'nav[aria-label="Primary"] a[href="/i/grok"]',
  'nav[aria-label="Primary"] a[href="/i/jf/creators/studio"]',
  'nav[aria-label="Primary"] a[href="/i/premium_sign_up"]',
  'a#sidebar-compose-post',
  // "Subscribe" button in the page header
  'header[data-page-header] a[href="/i/premium_sign_up"]',
  // floating Grok / Chat dock (bottom right)
  '[data-slot="xds-dock"]',
  // grok "Explain this post" button on every tweet
  'button[aria-label="Explain this post"]',
  // legacy UI
  'a[data-testid="premium-signup-tab"]',
  'a[aria-label="Creator Studio"]',
  'a[data-testid="AppTabBar_Calls_Link"]',
  'a[data-testid="AppTabBar_DirectMessage_Link"]',
  'a[aria-label="Grok"]',
  'a[data-testid="AppTabBar_Explore_Link"]',
  'a[data-testid="SideNav_NewTweet_Button"]',
  'div[data-testid="GrokDrawer"]',
  'div[data-testid="chat-drawer-root"]',
];

const metricSelectors = [
  '.x-animated-count-visual', // reply/repost/like/view counts
  'span[data-testid="app-text-transition-container"]', // legacy UI
];

// right column: new UI has no testid, it's the <aside> holding the search form
const SIDEBAR_SELECTOR = '[data-testid="sidebarColumn"], aside:has(form[role="search"])';

let currentSettings = null;
let keywordRegexes = [];
const revealedTweets = new Set();

export function twitter(twSettings) {
  currentSettings = twSettings;
  keywordRegexes = buildKeywordRegexes(twSettings?.keywords);

  applyStaticCssRules();
  ensureHideStyle();
  runAllCleaners();
}

export function runAllCleaners() {
  cleanTrendingKeepSearch(Boolean(currentSettings?.removeUnnecessary));
  handleFollowingTab(Boolean(currentSettings?.onlyFollowing));
  // keywords first: limit skips tweets that are already keyword-hidden
  replaceTweetsByKeywords(Boolean(currentSettings?.keywordsEnabled));
  limitTweets(Boolean(currentSettings?.tweetsLimitEnabled));
}

// for "non-existing-yet" css 
function applyStaticCssRules() {
  let styleTag = document.getElementById(TW_STYLE_BLOCK_ID);
  const rules = [];

  if (currentSettings?.removeUnnecessary) {
    rules.push(`
      ${unnecessarySelectors.join(",\n")} {
        display: none !important;
      }
      [data-testid="sidebarColumn"] aside,
      [data-testid="sidebarColumn"] section,
      [data-testid="sidebarColumn"] nav[aria-label="Footer"],
      [data-testid="sidebarColumn"] [data-testid="news_sidebar"],
      aside:has(form[role="search"]) section,
      aside:has(form[role="search"]) nav[aria-label="Footer"] {
        display: none !important;
      }
    `);
  }

  if (currentSettings?.removeMetrics) {
    rules.push(`
      ${metricSelectors.join(",\n")} {
        display: none !important;
      }
    `);
  }

  if (rules.length > 0) {
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = TW_STYLE_BLOCK_ID;
      (document.head || document.documentElement).appendChild(styleTag);
    }
    styleTag.textContent = rules.join("\n");
  } else if (styleTag) {
    styleTag.remove();
  }
}

export function cleanTrendingKeepSearch(enabled) {
  if (!enabled) {
    reveal("sidebar");
    return;
  }

  const sidebar = document.querySelector(SIDEBAR_SELECTOR);
  if (!sidebar) return;

  const search = sidebar.querySelector('form[role="search"]');

  if (!search) {
    Array.from(sidebar.children).forEach((child) => hide(child, "sidebar"));
    return;
  }

  // i hate css from tw, so we just climb between selectors 
  for (let node = search; node !== sidebar; node = node.parentElement) {
    if (node.dataset.catHide === "sidebar") delete node.dataset.catHide;
    for (const sibling of node.parentElement.children) {
      // skip empty layout spacers (new UI uses them for the sticky offset)
      if (sibling !== node && sibling.childElementCount > 0) hide(sibling, "sidebar");
    }
  }
}

function handleFollowingTab(enabled) {
  if (!enabled || location.pathname !== "/home") {
    reveal("tabs");
    return;
  }

  selectFollowingTab()

  // hide tab selection cuz user it's a bad person
  hideTabSelection();
}

function selectFollowingTab() {
  const followingTab =
    document.querySelector('[role="tab"][data-pinned-timeline="following"]') ||
    document.querySelectorAll('[role="tablist"] [role="tab"]')[1];

  if (followingTab) {
    if (followingTab.getAttribute("aria-selected") !== "true" && !followingTab.dataset.catSwitched) {
      followingTab.click();
      followingTab.dataset.catSwitched = "true";
    }
  }
}

function hideTabSelection() {
  // new UI: header[data-page-header] > div > div > [tablist + "Manage timelines"]
  const tablist = document.querySelector('header[data-page-header] [role="tablist"]');
  if (tablist) {
    const wrapper = tablist.closest("header[data-page-header] > div");
    if (wrapper) hide(wrapper, "tabs");
    return;
  }

  // legacy UI
  const targetChild = document.querySelector(
    '[data-testid="ScrollSnap-SwipeableList"], button[aria-label="Manage timelines"]'
  );
  const headerWrapper =
    targetChild?.closest('div[tabindex="0"] > div') || targetChild?.closest("nav");

  if (headerWrapper) hide(headerWrapper, "tabs");
}

// === tweets handling.

const TWEET_SELECTOR = 'div[role="link"][data-href*="/status/"]:has(> article), article[data-testid="tweet"]';
const TWEET_TEXT_SELECTOR = 'article [dir="auto"][lang], [data-testid="tweetText"]';

// top-level tweets only: quoted tweets match the same selector but live inside another tweet
function getTweets() {
  return Array.from(document.querySelectorAll(TWEET_SELECTOR)).filter(
    (tweet) => !tweet.parentElement?.closest(TWEET_SELECTOR)
  );
}

function getTweetId(tweet, tweetText) {
  return (
    tweet.dataset.href ||
    tweet.querySelector('a[href*="/status/"] time')?.closest("a")?.getAttribute("href") ||
    tweetText
  );
}

function getCard(tweet, tweetId) {
  const prev = tweet.previousElementSibling;
  return prev?.classList.contains(CARD_CLASS) && prev.dataset.tweetId === tweetId ? prev : null;
}

function replaceTweetsByKeywords(enabled) {
  if (!enabled || keywordRegexes.length === 0) {
    reveal("keyword");
    document.querySelectorAll(`.${CARD_CLASS}:not(.${LIMIT_CARD_CLASS})`).forEach((card) => card.remove());
    return;
  }

  const tweets = getTweets();

  tweets.forEach((tweet) => {
    const textNode = tweet.querySelector(TWEET_TEXT_SELECTOR);
    const tweetText = textNode?.innerText || "";
    const tweetId = getTweetId(tweet, tweetText);

    const match = keywordRegexes.find(({ regex }) => regex.test(tweetText));

    if (match && !revealedTweets.has(tweetId)) {
      hide(tweet, "keyword");

      if (!getCard(tweet, tweetId)) {
        const card = createCard({
          message: `This post was hidden because it mentions "${match.keyword}".`,
          showSuggestion: Boolean(currentSettings?.suggestions),
          onReveal: () => {
            revealedTweets.add(tweetId);
            runAllCleaners();
          },
        });
        card.dataset.tweetId = tweetId;
        tweet.before(card);
      }
    } else if (tweet.dataset.catHide === "keyword") {
      delete tweet.dataset.catHide;
    }
  });

  document.querySelectorAll(`.${CARD_CLASS}:not(.${LIMIT_CARD_CLASS})`).forEach((card) => {
    if (card.nextElementSibling?.dataset.catHide !== "keyword") card.remove();
  });
}


// === tweets limit.
// a tweet counts as "seen" when at least half of it enters the viewport.
// seen ids are persisted per time window (hour/day), so reloads and other tabs share the count.

const LIMIT_STORAGE_KEY = "catTweetLimit";
const LIMIT_CARD_CLASS = "cat-limit-card";

let limitState = { window: null, ids: [] };
let limitStateLoaded = false;
let limitStateLoading = null;
let observedTweets = new WeakSet();
let seenObserver = null;

function getLimit() {
  const n = Number.parseInt(currentSettings?.tweetsLimit, 10);
  return Number.isNaN(n) ? null : Math.max(0, n);
}

function currentWindow() {
  const now = new Date();
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  return currentSettings?.tweetsLimitPeriod === "daily" ? `daily:${day}` : `hourly:${day}T${now.getHours()}`;
}

function loadLimitState() {
  if (limitStateLoading) return limitStateLoading;

  limitStateLoading = browser.storage.local.get(LIMIT_STORAGE_KEY).then((result) => {
    if (result?.[LIMIT_STORAGE_KEY]) limitState = result[LIMIT_STORAGE_KEY];
    limitStateLoaded = true;
    runAllCleaners();
  });

  // keep the count in sync with other tabs
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[LIMIT_STORAGE_KEY]?.newValue) {
      limitState = changes[LIMIT_STORAGE_KEY].newValue;
      runAllCleaners();
    }
  });

  return limitStateLoading;
}

function saveLimitState() {
  browser.storage.local.set({ [LIMIT_STORAGE_KEY]: limitState });
}

// new hour/day (or period changed in the popup) -> fresh count
function syncLimitWindow() {
  const win = currentWindow();
  if (limitState.window !== win) {
    limitState = { window: win, ids: [] };
    saveLimitState();
  }
}

function markSeen(tweet) {
  const limit = getLimit();
  if (limit === null || tweet.dataset.catHide) return;

  syncLimitWindow();
  const id = getTweetId(tweet, tweet.querySelector(TWEET_TEXT_SELECTOR)?.innerText || "");
  if (!id || limitState.ids.includes(id) || limitState.ids.length >= limit) return;

  limitState.ids.push(id);
  saveLimitState();
  if (limitState.ids.length >= limit) runAllCleaners();
}

function getSeenObserver() {
  seenObserver ??= new IntersectionObserver(
    (entries) => entries.forEach((entry) => entry.isIntersecting && markSeen(entry.target)),
    { threshold: 0.5 }
  );
  return seenObserver;
}

function removeLimitCards() {
  document.querySelectorAll(`.${LIMIT_CARD_CLASS}`).forEach((card) => card.remove());
}

function limitTweets(enabled) {
  const limit = getLimit();

  if (!enabled || limit === null) {
    reveal("limit");
    removeLimitCards();
    seenObserver?.disconnect();
    seenObserver = null;
    observedTweets = new WeakSet();
    return;
  }

  if (!limitStateLoaded) {
    loadLimitState();
    return;
  }

  syncLimitWindow();
  const tweets = getTweets();
  const reached = limitState.ids.length >= limit;
  const seen = new Set(limitState.ids);

  const observer = getSeenObserver();
  tweets.forEach((tweet) => {
    if (observedTweets.has(tweet)) return;
    observer.observe(tweet);
    observedTweets.add(tweet);
  });

  if (!reached) {
    reveal("limit");
    removeLimitCards();
    return;
  }

  // already seen tweets stay so the timeline doesn't jump; everything new is hidden.
  // tweets hidden by keywords keep their own card.
  let firstHidden = null;
  tweets.forEach((tweet) => {
    if (tweet.dataset.catHide === "keyword") return;
    const id = getTweetId(tweet, tweet.querySelector(TWEET_TEXT_SELECTOR)?.innerText || "");

    if (seen.has(id)) {
      if (tweet.dataset.catHide === "limit") delete tweet.dataset.catHide;
    } else {
      hide(tweet, "limit");
      firstHidden ??= tweet;
    }
  });

  const existing = document.querySelector(`.${LIMIT_CARD_CLASS}`);
  if (!firstHidden) {
    existing?.remove();
    return;
  }
  if (existing && existing.nextElementSibling === firstHidden) return;
  existing?.remove();

  const period = currentSettings?.tweetsLimitPeriod === "daily" ? "today" : "this hour";
  const card = createCard({
    message: `You've reached your limit of ${limit} tweets ${period}. The cat is sitting on the rest.`,
    showSuggestion: Boolean(currentSettings?.suggestions),
  });
  card.classList.add(LIMIT_CARD_CLASS);
  firstHidden.before(card);
}