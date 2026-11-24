import { createCard } from "./cat-card.js";
import { hide, reveal } from "./utils/helpers.js";
import { LIKE_BUTTON } from "./youtube-long.js";

export const shortsCommentSelectors = [
  'ytd-shorts button[aria-label*="comment" i]',
  'ytd-shorts label.ytSpecButtonShapeWithLabelHost:has(button[aria-label*="comment" i])',
];

const COMMENTS_BUTTON = 'button[aria-label*="comment" i]';

export const shortsMetricSelectors = [
  // shorts: like / comment counts under the buttons (other labels like "Share" aren't metrics)
  `ytd-shorts label:has(${LIKE_BUTTON}) .ytSpecButtonShapeWithLabelLabel`,
  `ytd-shorts label:has(${COMMENTS_BUTTON}) .ytSpecButtonShapeWithLabelLabel`,
  `ytd-shorts :has(> ${LIKE_BUTTON}) .yt-spec-button-shape-with-label__label`,
];

// hidden when shorts are blocked or the limit is reached: shelves in feeds/search + the sidebar entry
const shortsEntrySelectors = [
  "ytd-rich-shelf-renderer[is-shorts]",
  "ytd-reel-shelf-renderer",
  "grid-shelf-view-model:has(ytm-shorts-lockup-view-model)",
  'ytd-guide-entry-renderer:has(a[title="Shorts"])',
  'ytd-mini-guide-entry-renderer:has(a[title="Shorts"])',
];

// === shorts: fully blocked, or limited.
// limit: a short counts when you land on /shorts/<id>. seen ids are persisted per hour/day, goes with the same idea of instagram stories.

const LIMIT_STORAGE_KEY = "catShortsLimit";
const SHORTS_CARD_CLASS = "cat-shorts-card";
const SHORTS_ENTRY_STYLE_ID = "cat-yt-shorts-entries";

let currentSettings = null;
let limitState = { window: null, ids: [] };
let limitStateLoaded = false;
let limitStateLoading = null;
let shortsBlocked = false;
let listenersReady = false;

export function ensureShortsListeners() {
  if (listenersReady) return;
  listenersReady = true;

  // a hidden short keeps playing (and sounding); stop it as soon as it tries
  document.addEventListener(
    "play",
    (e) => {
      if (shortsBlocked && e.target.closest?.("ytd-shorts")) e.target.pause();
    },
    true
  );
}

function getLimit() {
  const n = Number.parseInt(currentSettings?.shortsLimit, 10);
  return Number.isNaN(n) ? null : Math.max(0, n);
}

function currentWindow() {
  const now = new Date();
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  return currentSettings?.shortsLimitPeriod === "daily" ? `daily:${day}` : `hourly:${day}T${now.getHours()}`;
}

function currentShortId() {
  return location.pathname.match(/^\/shorts\/([\w-]+)/)?.[1] || null;
}

function loadLimitState() {
  if (limitStateLoading) return limitStateLoading;

  limitStateLoading = browser.storage.local.get(LIMIT_STORAGE_KEY).then((result) => {
    if (result?.[LIMIT_STORAGE_KEY]) limitState = result[LIMIT_STORAGE_KEY];
    limitStateLoaded = true;
    handleShorts(currentSettings);
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[LIMIT_STORAGE_KEY]?.newValue) {
      limitState = changes[LIMIT_STORAGE_KEY].newValue;
      handleShorts(currentSettings);
    }
  });

  return limitStateLoading;
}

function saveLimitState() {
  browser.storage.local.set({ [LIMIT_STORAGE_KEY]: limitState });
}

function syncLimitWindow() {
  const win = currentWindow();
  if (limitState.window !== win) {
    limitState = { window: win, ids: [] };
    saveLimitState();
  }
}

function setShortsEntriesHidden(hidden) {
  let style = document.getElementById(SHORTS_ENTRY_STYLE_ID);
  if (!hidden) {
    style?.remove();
    return;
  }
  if (style) return;

  style = document.createElement("style");
  style.id = SHORTS_ENTRY_STYLE_ID;
  style.textContent = `${shortsEntrySelectors.join(",\n")} { display: none !important; }`;
  (document.head || document.documentElement).appendChild(style);
}

function unblockShortsPlayer() {
  shortsBlocked = false;
  reveal("shorts");
  document.querySelectorAll(`.${SHORTS_CARD_CLASS}`).forEach((card) => card.remove());
}

// reason: "block" | "limit", so switching settings swaps the card text
function blockShortsPlayer(reason, message) {
  shortsBlocked = true;

  const shorts = document.querySelector("ytd-shorts");
  if (shorts) {
    shorts.querySelectorAll("video").forEach((v) => v.paused || v.pause());
    hide(shorts, "shorts");
  }

  const existing = document.querySelector(`.${SHORTS_CARD_CLASS}`);
  if (existing) {
    if (existing.dataset.reason === reason) return;
    existing.remove();
  }

  const layer = document.createElement("div");
  layer.classList.add(SHORTS_CARD_CLASS);
  layer.dataset.reason = reason;
  Object.assign(layer.style, {
    position: "fixed",
    inset: "56px 0 0 0",
    zIndex: "2000",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    pointerEvents: "none",
  });

  const card = createCard({ message, showSuggestion: Boolean(currentSettings?.suggestions) });
  card.style.margin = "24px auto";
  card.style.maxWidth = "480px";
  card.style.pointerEvents = "auto";

  layer.append(card);
  document.documentElement.append(layer);
}

export function handleShorts(settings) {
  currentSettings = settings;
  const id = currentShortId();

  if (currentSettings?.blockShorts) {
    setShortsEntriesHidden(true);
    if (id) blockShortsPlayer("block", "Shorts are blocked. The cat ate them.");
    else unblockShortsPlayer();
    return;
  }

  const limit = getLimit();
  if (!currentSettings?.shortsLimitEnabled || limit === null) {
    unblockShortsPlayer();
    setShortsEntriesHidden(false);
    return;
  }

  if (!limitStateLoaded) {
    loadLimitState();
    return;
  }

  syncLimitWindow();

  // count the short you're on, as long as there's room left
  if (id && !limitState.ids.includes(id) && limitState.ids.length < limit) {
    limitState.ids.push(id);
    saveLimitState();
  }

  const reached = limitState.ids.length >= limit;
  setShortsEntriesHidden(reached);

  // already counted shorts stay watchable; anything new is covered by the cat
  if (id && reached && !limitState.ids.includes(id)) {
    const period = currentSettings?.shortsLimitPeriod === "daily" ? "today" : "this hour";
    blockShortsPlayer("limit", `You've reached your limit of ${limit} shorts ${period}. The cat is sitting on the rest.`);
  } else {
    unblockShortsPlayer();
  }
}
