import { cache, saveCache } from "./cat-cache.mjs";

const create = document.getElementById("create");
const inp1 = document.getElementById("inp1");
const kwAddedContainer = document.getElementById("kw__added-container");
// every numeric limit input (tweets, posts, stories, shorts), not just the first one
const limitInputs = document.querySelectorAll("input[data-min]");

// what's typed but not added yet. kept in storage because the popup can close
// before an async save finishes; restoreKeywordDraft() picks it up next time.
const DRAFT_KEY = "catKeywordDraft";

// adds a keyword to the cache. returns true if it was new.
function addKeyword(raw) {
  const kw = (raw || "").trim();
  if (kw === "") return false;

  const exists = cache.keywords.some((k) => k.toLowerCase() === kw.toLowerCase());
  if (exists) return false;

  cache.keywords.push(kw);
  return true;
}

async function commitInput() {
  const value = inp1.value;
  inp1.value = "";

  if (addKeyword(value)) {
    renderKeywords();
    await saveCache();
  }
  // only drop the draft once the keyword is saved; if the popup dies mid-save,
  // the draft survives and gets restored (duplicates are ignored)
  await browser.storage.local.remove(DRAFT_KEY);
}

// call after loadCache(): adds whatever was left typed when the popup closed
export async function restoreKeywordDraft() {
  const result = await browser.storage.local.get(DRAFT_KEY);
  const draft = result?.[DRAFT_KEY];
  if (!draft) return;

  await browser.storage.local.remove(DRAFT_KEY);
  if (addKeyword(draft)) await saveCache();
}

// draws a chip per saved keyword; clicking a chip deletes it
export function renderKeywords() {
  kwAddedContainer.replaceChildren();

  cache.keywords.forEach((kw) => {
    let newELement = document.createElement("span");
    newELement.classList.add("kw__blacklist");
    newELement.textContent = kw;
    kwAddedContainer.append(newELement);

    newELement.addEventListener("click", async () => {
      cache.keywords = cache.keywords.filter((k) => k !== kw);
      renderKeywords();
      await saveCache();
    });
  });
}

export function kwLogic() {
  create.addEventListener("click", commitInput);

  inp1.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitInput();
    }
  });

  inp1.addEventListener("input", () => {
    browser.storage.local.set({ [DRAFT_KEY]: inp1.value });
  });

  // popup closing: try to save right away (the draft covers it if this doesn't finish)
  const saveOnClose = () => {
    if (inp1.value.trim() !== "") commitInput();
  };
  window.addEventListener("pagehide", saveOnClose);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveOnClose();
  });

  limitInputs.forEach((input) => input.addEventListener("input", (e) => {
    const min = Number(e.target.dataset.min);
    const max = Number(e.target.dataset.max);

    let val = e.target.value.replace(/\D/g, "");

    if (val === "") {
      e.target.value = "";
      return;
    }

    let num = Number(val);

    if (num > max) num = max;
    if (num < min) num = min;

    e.target.value = num;
  }));
}
