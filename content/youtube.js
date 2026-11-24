import { ensureHideStyle, hide, reveal, buildKeywordRegexes } from "./utils/helpers.js";
import { longMetricSelectors, handleComments } from "./youtube-long.js";
import { shortsCommentSelectors, shortsMetricSelectors, handleShorts, ensureShortsListeners } from "./youtube-shorts.js";

const YT_STYLE_BLOCK_ID = "cat-yt-blocked-elements";

let currentSettings = null;
let keywordRegexes = [];
let listenersReady = false;

export function youtube(ytSettings) {
  currentSettings = ytSettings;
  keywordRegexes = buildKeywordRegexes(ytSettings?.keywords);

  ensureHideStyle();
  ensureListeners();
  applyStaticCssRules();
  runAllCleaners();
}

export function runAllCleaners() {
  handleComments(Boolean(currentSettings?.hideComments), currentSettings);
  hideVideosByKeywords(Boolean(currentSettings?.keywordsEnabled));
  handleShorts(currentSettings);
}

function ensureListeners() {
  if (listenersReady) return;
  listenersReady = true;

  // swiping between shorts doesn't always touch the DOM enough for the observer
  document.addEventListener("yt-navigate-finish", () => runAllCleaners());

  ensureShortsListeners();
}

function applyStaticCssRules() {
  let styleTag = document.getElementById(YT_STYLE_BLOCK_ID);
  const groups = [];

  if (currentSettings?.hideComments) groups.push(shortsCommentSelectors);
  if (currentSettings?.hideMetrics) groups.push([...shortsMetricSelectors, ...longMetricSelectors]);

  if (groups.length === 0) {
    styleTag?.remove();
    return;
  }

  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = YT_STYLE_BLOCK_ID;
    (document.head || document.documentElement).appendChild(styleTag);
  }
  styleTag.textContent = groups.map((sels) => `${sels.join(",\n")} { display: none !important; }`).join("\n");
}

// === keywords: hide videos whose title matches.

const VIDEO_SELECTOR = [
  "ytd-rich-item-renderer", // home / subscriptions grid
  "ytd-video-renderer", // search results
  "ytd-compact-video-renderer", // related (old layout)
  "ytd-grid-video-renderer", // channel pages
  "ytd-playlist-video-renderer",
  "yt-lockup-view-model", // related (new layout)
  "ytm-shorts-lockup-view-model-v2", // shorts shelves
].join(", ");

function getVideoTitle(video) {
  return (
    video.querySelector("h3[title]")?.getAttribute("title") ||
    video.querySelector("a[title]")?.getAttribute("title") ||
    video.querySelector("#video-title")?.textContent ||
    video.querySelector("h3")?.textContent ||
    ""
  ).trim();
}

function hideVideosByKeywords(enabled) {
  if (!enabled || keywordRegexes.length === 0) {
    reveal("keyword");
    return;
  }

  document.querySelectorAll(VIDEO_SELECTOR).forEach((video) => {
    if (video.parentElement?.closest(VIDEO_SELECTOR)) return;

    const title = getVideoTitle(video);
    const match = title && keywordRegexes.some(({ regex }) => regex.test(title));

    if (match) hide(video, "keyword");
    else if (video.dataset.catHide === "keyword") delete video.dataset.catHide;
  });
}
