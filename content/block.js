// "Completly block all social media": covers the whole page with the cat.
// overlay instead of redirect, so turning the setting off restores the page instantly.

const BLOCK_ID = "cat-block-screen";
const BLOCK_STYLE_ID = "cat-block-style";

const BLOCKED_DOMAINS = ["x.com", "twitter.com", "instagram.com", "instagr.am", "reddit.com", "redd.it"];

const suggestions = [
  { text: "Play a game of chess", url: "https://chess.com" },
  { text: "Do your Duolingo lesson", url: "https://www.duolingo.com/learn" },
  { text: "Solve today's Wordle", url: "https://www.nytimes.com/games/wordle" },
  { text: "Read a random Wikipedia article", url: "https://en.wikipedia.org/wiki/Special:Random" },
  { text: "Draw something", url: "https://excalidraw.com/" },
  { text: "Write about your day", url: "https://es.anotepad.com/" },
];

export function isBlockedDomain(hostname) {
  return BLOCKED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}

function ensureBlockStyle() {
  if (document.getElementById(BLOCK_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = BLOCK_STYLE_ID;
  style.textContent = `
    html.cat-blocked, html.cat-blocked body { overflow: hidden !important; }
    html.cat-blocked body { visibility: hidden !important; }
    #${BLOCK_ID} {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
      visibility: visible !important;
      background: #15181c; color: #e7e9ea;
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      text-align: center; padding: 24px;
    }
    #${BLOCK_ID} img { width: 128px; height: 128px; }
    #${BLOCK_ID} h1 { margin: 0; font-size: 28px; }
    #${BLOCK_ID} p { margin: 0; color: #8b98a5; }
    #${BLOCK_ID} a { color: #1d9bf0; text-decoration: none; }
    #${BLOCK_ID} a:hover { text-decoration: underline; }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function buildScreen(showSuggestion, text) {
  const screen = document.createElement("div");
  screen.id = BLOCK_ID;
  screen.dataset.text = text;

  const img = document.createElement("img");
  img.src = browser.runtime.getURL("icons/annoying-cat-32-white.avif");
  img.alt = "Annoying Cat";

  const title = document.createElement("h1");
  title.textContent = "The cat is sitting on your keyboard.";

  const body = document.createElement("p");
  body.textContent = text;

  screen.append(img, title, body);

  if (showSuggestion) {
    const { text: s, url } = suggestions[Math.floor(Math.random() * suggestions.length)];
    const line = document.createElement("p");
    const link = document.createElement("a");
    link.href = url;
    link.rel = "noopener noreferrer";
    link.textContent = s;
    line.append("Instead of scrolling: ", link);
    screen.append(line);
  }

  return screen;
}

const DEFAULT_TEXT = "Social media is blocked. Go do something else.";

// who is asking for the screen: "global" (entry.js, full block) or a platform feature
// (e.g. "ig-reels"). the screen stays while anyone needs it, so one owner turning off
// doesn't remove another's block. global wins when choosing the text.
const owners = new Map();

export function applyBlock(enabled, { suggestions: showSuggestion, text } = {}, owner = "global") {
  if (enabled) owners.set(owner, { showSuggestion, text: text || DEFAULT_TEXT });
  else owners.delete(owner);

  const existing = document.getElementById(BLOCK_ID);

  if (owners.size === 0) {
    existing?.remove();
    document.documentElement.classList.remove("cat-blocked");
    return;
  }

  const active = owners.get("global") || owners.values().next().value;

  ensureBlockStyle();
  document.documentElement.classList.add("cat-blocked");

  // attached to <html>, not <body>: at document_start body doesn't exist yet,
  // and SPAs (X, Reddit) re-render body and would wipe it.
  if (!existing || existing.parentElement !== document.documentElement || existing.dataset.text !== active.text) {
    existing?.remove();
    document.documentElement.appendChild(buildScreen(active.showSuggestion, active.text));
  }
}

export function isBlockActive() {
  return owners.size > 0;
}

// pause videos/audio that keep playing behind the overlay
export function pauseMedia() {
  document.querySelectorAll("video, audio").forEach((m) => m.paused || m.pause());
}
