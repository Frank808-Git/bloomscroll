// src/BlacklistTab.tsx
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "bloomscroll_blacklist";

type Store = {
  get: () => Promise<string[]>;
  set: (list: string[]) => Promise<void>;
};

function makeStore(): Store {
  const hasChromeStorage =
    typeof chrome !== "undefined" && !!chrome.storage?.sync;

  if (hasChromeStorage) {
    return {
      get: async () => {
        const res = await chrome.storage.sync.get([STORAGE_KEY]);
        return Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
      },
      set: async (list) => {
        await chrome.storage.sync.set({ [STORAGE_KEY]: list });
      },
    };
  }

  // dev fallback
  return {
    get: async () => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    set: async (list) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    },
  };
}

function normalizeEntry(input: string) {
  let s = input.trim();
  if (!s) return "";

  // Allow:
  // - full URLs: https://example.com/path
  // - domain/host: example.com
  // - substring/wildcard-ish: *twitter.com* (we treat * as "contains")
  s = s.replace(/\s+/g, "");

  // If it looks like a URL, normalize via URL parser
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      // store as origin+path (no query/hash) to reduce accidental mismatches
      return (u.origin + u.pathname).replace(/\/+$/, "");
    } catch {
      return s;
    }
  }

  // If it's a plain host, strip leading www.
  s = s.replace(/^www\./i, "");
  return s;
}

export default function BlacklistTab() {
  const store = useMemo(() => makeStore(), []);
  const [items, setItems] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    store.get().then(setItems).catch(() => setItems([]));
  }, [store]);

  async function persist(next: string[]) {
    setItems(next);
    await store.set(next);
  }

  async function onAdd() {
    setError("");
    const entry = normalizeEntry(value);
    if (!entry) return;

    const exists = items.some((x) => x.toLowerCase() === entry.toLowerCase());
    if (exists) {
      setError("That entry is already in your blacklist.");
      return;
    }

    const next = [entry, ...items];
    await persist(next);
    setValue("");
  }

  async function onRemove(idx: number) {
    const next = items.filter((_, i) => i !== idx);
    await persist(next);
  }

  async function onClear() {
    await persist([]);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Blacklist</h2>
      <p className="text-slate-500 mb-6">
        Add domains or URLs. When you visit a matching site, BloomScroll will trigger donations.
      </p>

      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAdd();
          }}
          placeholder="e.g. twitter.com  or  https://reddit.com/r/all"
          className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        />
        <button
          onClick={onAdd}
          className="px-4 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          Add
        </button>
      </div>

      {error && <div className="mt-3 text-sm font-medium text-red-600">{error}</div>}

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-slate-600">
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </div>
        <button
          onClick={onClear}
          disabled={items.length === 0}
          className="text-sm font-semibold text-slate-500 hover:text-red-600 disabled:opacity-40 disabled:hover:text-slate-500 transition"
        >
          Clear all
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500">
            No blacklisted sites yet.
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={`${item}-${idx}`}
              className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm"
            >
              <div className="text-slate-800 font-medium break-all">{item}</div>
              <button
                onClick={() => onRemove(idx)}
                className="ml-3 px-3 py-1 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}