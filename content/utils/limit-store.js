// persisted "seen ids" counter for the hourly/daily limits.
// stored in browser.storage.local under its own key, so reloads and other tabs share the count.
// onChange runs after the first load and whenever another tab updates the count.

function windowKey(period) {
  const now = new Date();
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  return period === "daily" ? `daily:${day}` : `hourly:${day}T${now.getHours()}`;
}

export function createLimitStore(storageKey, onChange) {
  let state = { window: null, ids: [] };
  let loaded = false;
  let loading = null;

  const save = () => browser.storage.local.set({ [storageKey]: state });

  return {
    get loaded() {
      return loaded;
    },

    load() {
      if (loading) return loading;

      loading = browser.storage.local.get(storageKey).then((result) => {
        if (result?.[storageKey]) state = result[storageKey];
        loaded = true;
        onChange();
      });

      browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[storageKey]?.newValue) {
          state = changes[storageKey].newValue;
          onChange();
        }
      });

      return loading;
    },

    // new hour/day (or period changed in the popup) -> fresh count
    sync(period) {
      const win = windowKey(period);
      if (state.window !== win) {
        state = { window: win, ids: [] };
        save();
      }
    },

    has: (id) => state.ids.includes(id),
    count: () => state.ids.length,

    // adds id unless it's already counted or the limit is full. returns true if added.
    add(id, limit) {
      if (!id || state.ids.includes(id) || state.ids.length >= limit) return false;
      state.ids.push(id);
      save();
      return true;
    },
  };
}
