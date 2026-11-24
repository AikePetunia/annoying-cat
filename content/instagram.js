import { createCard } from "./cat-card.js";
import { ensureHideStyle, hide, reveal } from "./utils/helpers.js";
import { createLimitStore } from "./utils/limit-store.js";
import { applyBlock, isBlockActive, pauseMedia } from "./block.js";

// instagram classes are obfuscated atomic css (x1i10hfl, xjbqb8w...) and change on every deploy,
// so everything here hangs from hrefs / aria-labels / data-pagelet instead.

const IG_STYLE_BLOCK_ID = "cat-ig-blocked-elements";

const STORY_TRAY = '[data-pagelet="story_tray"]';

// the action bar is: [like btn] <span role=button>1.3K</span> [comment btn] <span>56</span> [repost btn] <span>6</span> [share]
// so each count is the span right after the element wrapping the icon.
const countAfter = (label) => `:is(span, div):has(svg[aria-label="${label}"]) + span[role="button"]`;

const unnecessarySelectors = [
  // left nav: "Also from Meta" (Threads, Facebook...). english + spanish label
  'div:has(> a svg[aria-label="Also from Meta"])',
  'div:has(> a svg[aria-label="También de Meta"])',
];

const metricSelectors = [
  countAfter("Like"),
  countAfter("Unlike"),
  countAfter("Comment"),
  countAfter("Repost"),
  countAfter("Share"),
];

// left nav "Reels" entry, hidden when reels are blocked
const reelsNavSelectors = ['div:has(> a[href="/reels/"])'];

const commentSelectors = [
  // comment button + its count
  'span:has(> div[role="button"] svg[aria-label="Comment"])',
  countAfter("Comment"),
  // "View all N comments" + "Add a comment…" box under feed posts
  'a[href$="/comments/"]',
  'form:has(textarea[aria-label^="Add a comment"])',
];

// a right column is ~320px; anything wider means we climbed into the feed/page layout
const MAX_SIDEBAR_WIDTH = 450;

let currentSettings = null;
let listenersReady = false;

const postsStore = createLimitStore("catIgPostsLimit", () => runAllCleaners());
const storiesStore = createLimitStore("catIgStoriesLimit", () => runAllCleaners());

export function instagram(igSettings) {
  currentSettings = igSettings;

  ensureHideStyle();
  ensureListeners();
  applyStaticCssRules();
  runAllCleaners();
}

export function runAllCleaners() {
  handleReels(Boolean(currentSettings?.blockReels));
  hideRightColumn(Boolean(currentSettings?.removeUnnecessary));
  handlePosts();
  handleStories();
}

function ensureListeners() {
  if (listenersReady) return;
  listenersReady = true;

  // stories / reels behind the cat keep playing; stop them as soon as they try
  document.addEventListener(
    "play",
    (e) => {
      if (document.getElementById(OVERLAY_ID) || isBlockActive()) e.target.pause?.();
    },
    true
  );
}

function applyStaticCssRules() {
  let styleTag = document.getElementById(IG_STYLE_BLOCK_ID);
  const groups = [];

  if (currentSettings?.removeUnnecessary) groups.push(unnecessarySelectors);
  if (currentSettings?.hideMetrics) groups.push(metricSelectors);
  if (currentSettings?.hideComments) groups.push(commentSelectors);
  if (currentSettings?.removeStories) groups.push([STORY_TRAY]);
  if (currentSettings?.blockReels) groups.push(reelsNavSelectors);

  if (groups.length === 0) {
    styleTag?.remove();
    return;
  }

  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = IG_STYLE_BLOCK_ID;
    (document.head || document.documentElement).appendChild(styleTag);
  }
  styleTag.textContent = groups.map((sels) => `${sels.join(",\n")} { display: none !important; }`).join("\n");
}

const periodText = (period) => (period === "daily" ? "today" : "this hour");

function getLimit(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : Math.max(0, n);
}

// === reels: anything under /reels gets the same full-screen cat as the full social media block.

function handleReels(enabled) {
  const onReels = location.pathname.includes("/reels");
  const blocked = enabled && onReels;

  applyBlock(
    blocked,
    { suggestions: Boolean(currentSettings?.suggestions), text: "Reels are blocked. The cat is watching them for you." },
    "ig-reels"
  );
  if (blocked) pauseMedia();
}

// === right column: your profile ("Switch") + "Suggested for you" + footer.
// no stable id, so start at the "See all" suggestions link and climb while we're still inside the column.

function findRightColumn() {
  const seeAll = document.querySelector('a[href="/explore/people/"]');
  // not laid out yet: every width is 0 and the width check would never stop the climb
  if (!seeAll || seeAll.getBoundingClientRect().width === 0) return null;

  let column = seeAll;
  for (let parent = column.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const tooWide = parent.getBoundingClientRect().width > MAX_SIDEBAR_WIDTH;
    const hasFeed = parent.querySelector("article, main") || parent.matches("main");
    if (tooWide || hasFeed) break;
    column = parent;
  }

  return column === seeAll ? null : column;
}

function hideRightColumn(enabled) {
  if (!enabled || location.pathname !== "/") {
    reveal("ig-sidebar");
    return;
  }

  // the hidden column has width 0, so look for it before measuring a fresh one
  const column = document.querySelector('[data-cat-hide="ig-sidebar"]') || findRightColumn();
  if (column) hide(column, "ig-sidebar");
}

// === feed posts: removed entirely, or limited.
// a post counts once at least half of it is on screen (same as tweets).

const POSTS_CARD_CLASS = "cat-ig-posts-card";
let seenObserver = null;
let observedPosts = new WeakSet();

function getPosts() {
  return location.pathname === "/" ? Array.from(document.querySelectorAll("main article")) : [];
}

function getPostId(post) {
  for (const a of post.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
    const id = a.getAttribute("href").match(/\/(?:p|reel)\/([\w-]+)/)?.[1];
    if (id) return id;
  }
  return null;
}

function stopCountingPosts() {
  seenObserver?.disconnect();
  seenObserver = null;
  observedPosts = new WeakSet();
}

function clearPostsBlock() {
  reveal("ig-posts");
  document.querySelectorAll(`.${POSTS_CARD_CLASS}`).forEach((card) => card.remove());
}

// hides every post in `toHide` and puts one cat card above the first of them
function coverPosts(toHide, reason, message) {
  const shown = getPosts().filter((p) => !toHide.includes(p));
  shown.forEach((p) => p.dataset.catHide === "ig-posts" && delete p.dataset.catHide);
  toHide.forEach((p) => hide(p, "ig-posts"));

  const first = toHide[0];
  const existing = document.querySelector(`.${POSTS_CARD_CLASS}`);
  if (!first) {
    existing?.remove();
    return;
  }
  if (existing?.nextElementSibling === first && existing.dataset.reason === reason) return;
  existing?.remove();

  const card = createCard({ message, showSuggestion: Boolean(currentSettings?.suggestions) });
  card.classList.add(POSTS_CARD_CLASS);
  card.dataset.reason = reason;
  first.before(card);
}

function handlePosts() {
  const posts = getPosts();

  if (currentSettings?.removePosts) {
    stopCountingPosts();
    coverPosts(posts, "remove", "Posts are hidden. The cat is lying on your feed.");
    return;
  }

  const limit = getLimit(currentSettings?.postsLimit);
  if (!currentSettings?.postsLimitEnabled || limit === null) {
    stopCountingPosts();
    clearPostsBlock();
    return;
  }

  if (!postsStore.loaded) {
    postsStore.load();
    return;
  }

  const period = currentSettings?.postsLimitPeriod;
  postsStore.sync(period);

  seenObserver ??= new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.target.dataset.catHide) return;
        postsStore.sync(currentSettings?.postsLimitPeriod);
        const added = postsStore.add(getPostId(entry.target), getLimit(currentSettings?.postsLimit) ?? 0);
        if (added && postsStore.count() >= (getLimit(currentSettings?.postsLimit) ?? 0)) runAllCleaners();
      }),
    { threshold: 0.5 }
  );
  posts.forEach((p) => {
    if (observedPosts.has(p)) return;
    seenObserver.observe(p);
    observedPosts.add(p);
  });

  if (postsStore.count() < limit) {
    clearPostsBlock();
    return;
  }

  // already seen posts stay so the feed doesn't jump; everything new is hidden
  const unseen = posts.filter((p) => !postsStore.has(getPostId(p)));
  coverPosts(unseen, "limit", `You've reached your limit of ${limit} posts ${periodText(period)}. The cat is sitting on the rest.`);
}

// === stories: removed entirely, or limited.
// counts how many different users' stories you open (/stories/<user>/...). the viewer is a full-screen layer,
// so when blocked it gets covered by a full-screen cat overlay with a way back to the feed.

const OVERLAY_ID = "cat-ig-story-overlay";

// counts per user: /stories/<user>/ and /stories/<user>/<n> are the same user.
// highlights (/stories/highlights/<id>/) count per highlight.
function currentStoryId() {
  const [, user, sub] = location.pathname.match(/^\/stories\/([^/]+)\/?([^/]*)/) || [];
  if (!user) return null;
  return user === "highlights" ? `highlights/${sub}` : user;
}

function isStoryViewer() {
  return location.pathname.startsWith("/stories/");
}

function removeOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function showOverlay(reason, message) {
  document.querySelectorAll("video").forEach((v) => v.paused || v.pause());

  const existing = document.getElementById(OVERLAY_ID);
  if (existing?.dataset.reason === reason) return;
  existing?.remove();

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.dataset.reason = reason;
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.92)",
  });

  const card = createCard({
    message,
    showSuggestion: Boolean(currentSettings?.suggestions),
    // the overlay covers instagram's own close button, so give a way out
    onReveal: () => location.assign("/"),
  });
  card.querySelector("button").textContent = "Back to feed";
  card.style.maxWidth = "420px";
  card.style.background = "#000";
  card.style.borderRadius = "12px";

  overlay.append(card);
  document.documentElement.append(overlay);
}

function handleStories() {
  if (currentSettings?.removeStories) {
    if (isStoryViewer()) showOverlay("remove", "Stories are hidden. The cat ate them.");
    else removeOverlay();
    return;
  }

  const limit = getLimit(currentSettings?.storyLimit);
  if (!currentSettings?.storyLimitEnabled || limit === null) {
    removeOverlay();
    reveal("ig-stories");
    return;
  }

  if (!storiesStore.loaded) {
    storiesStore.load();
    return;
  }

  const period = currentSettings?.storyLimitPeriod;
  storiesStore.sync(period);

  const id = currentStoryId();
  storiesStore.add(id, limit);

  const reached = storiesStore.count() >= limit;

  // tray hidden once the limit is reached, so there's nothing left to tap
  const tray = document.querySelector(STORY_TRAY);
  if (reached && tray) hide(tray, "ig-stories");
  else reveal("ig-stories");

  // already seen stories stay watchable; a new one gets the cat
  if (isStoryViewer() && reached && id && !storiesStore.has(id)) {
    showOverlay("limit", `You've watched stories from ${limit} people ${periodText(period)}. The cat is sitting on the rest.`);
  } else {
    removeOverlay();
  }
}
