const CARD_STYLE_ID = "cat-card-style";
export const CARD_CLASS = "cat-card";

// url: null = suggestion without link
const suggestions = [
  { text: "Play a game of chess", url: "https://chess.com" },
  { text: "Do your Duolingo lesson", url: "https://www.duolingo.com/learn" },
  { text: "Solve today's Wordle", url: "https://www.nytimes.com/games/wordle" },
  { text: "Try today's Pedantle", url: "https://pedantle.certitudes.org" },
  { text: "Draw something", url: "https://excalidraw.com/" },
  { text: "Read a random wikipedia Article", url: "https://en.wikipedia.org/wiki/Special:Random" },
  { text: "Write about your day", url: "https://es.anotepad.com/" },
  { text: "Play today's Semantle", url: "https://semantle.pimanrul.es/" },
  { text: "Draw the perfect circle", url: "https://drawtheperfectcircle.com/" },
];

function ensureCardStyle() {
  if (document.getElementById(CARD_STYLE_ID)) return;

  const styleTag = document.createElement("style");
  styleTag.id = CARD_STYLE_ID;
  styleTag.textContent = `
    .${CARD_CLASS} {
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(113, 118, 123, 0.3);
      color: rgb(113, 118, 123);
      font: 15px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .${CARD_CLASS} img { flex-shrink: 0; width: 32px; height: 32px; }
    .${CARD_CLASS} p { margin: 0 0 4px; }
    .${CARD_CLASS} a { color: rgb(29, 155, 240); text-decoration: none; }
    .${CARD_CLASS} a:hover { text-decoration: underline; }
    .${CARD_CLASS} button {
      margin-top: 4px;
      padding: 0;
      border: none;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 13px;
      text-decoration: underline;
      cursor: pointer;
    }
  `;
  (document.head || document.documentElement).appendChild(styleTag);
}

function isDarkTheme() {
  const [r, g, b] = (getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [0, 0, 0]).map(Number);
  return (r + g + b) / 3 < 128;
}

function catIcon() {
  const img = document.createElement("img");
  const color = isDarkTheme() ? "white" : "black";
  img.src = browser.runtime.getURL(`icons/annoying-cat-32-${color}.avif`);
  img.alt = "Annoying Cat";
  return img;
}

function randomSuggestion() {
  return suggestions[Math.floor(Math.random() * suggestions.length)];
}

/**
 * @param {string} message - texto principal ("This post was hidden...")
 * @param {boolean} showSuggestion - setting global "Allow suggestions from the cat"
 * @param {function} onReveal - si viene, se agrega el botón "Show anyway"
 */
export function createCard({ message, showSuggestion, onReveal }) {
  ensureCardStyle();

  const card = document.createElement("div");
  card.classList.add(CARD_CLASS);

  // gato a la izquierda como un avatar, el texto al lado
  const body = document.createElement("div");
  card.append(catIcon(), body);

  const title = document.createElement("p");
  title.textContent = message;
  body.append(title);

  if (showSuggestion) {
    const { text, url } = randomSuggestion();
    const line = document.createElement("p");
    line.append("Instead of scrolling: ");

    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = text;
      line.append(link);
    } else {
      line.append(text);
    }
    body.append(line);
  }

  if (onReveal) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Show anyway";
    button.addEventListener("click", onReveal);
    body.append(button);
  }

  return card;
}
