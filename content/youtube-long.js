import { createCard } from "./cat-card.js";
import { hide, reveal } from "./utils/helpers.js";

export const LIKE_BUTTON = 'button[aria-label^="like this video"]';

export const longMetricSelectors = [
  // long videos: like count
  `${LIKE_BUTTON} .ytSpecButtonShapeNextButtonTextContent`,
  `${LIKE_BUTTON} .yt-spec-button-shape-next__button-text-content`,
  // long videos: views (two variants: #view-count, or first span of #info "9.3M views · 1y ago")
  "ytd-watch-info-text #view-count",
  "ytd-watch-info-text #info > span:first-child",
  // long videos: subscribers, comment count
  "#owner-sub-count",
  "ytd-comments-header-renderer #count",
  // views on video cards: home / related (new lockups) and search results
  '.ytContentMetadataViewModelMetadataText[aria-label*="view" i]',
  "ytd-video-meta-block #metadata-line span.inline-metadata-item:first-of-type",
];

// === long-video comments: swapped for a cat card.

const COMMENTS_CARD_CLASS = "cat-comments-card";

export function handleComments(enabled, settings) {
  const comments = document.querySelector("ytd-comments#comments");

  if (!enabled || !comments) {
    reveal("comments");
    document.querySelectorAll(`.${COMMENTS_CARD_CLASS}`).forEach((card) => card.remove());
    return;
  }

  hide(comments, "comments");
  if (comments.previousElementSibling?.classList.contains(COMMENTS_CARD_CLASS)) return;

  const card = createCard({
    message: "Comments are blocked: a cat is sitting here.",
    showSuggestion: Boolean(settings?.suggestions),
  });
  card.classList.add(COMMENTS_CARD_CLASS);
  card.style.marginTop = "24px";
  comments.before(card);
}
