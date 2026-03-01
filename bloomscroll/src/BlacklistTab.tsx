// src/BlacklistTab.tsx
import { useEffect, useMemo, useState } from "react";
import InputRow from "./InputRow";

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
      <p className="text-slate-500 mb-6" style={{ textAlign: "left", marginBottom: 8}}>
        If you visit an added site, bloomscroll will start donating to your selected charity.
      </p>

      <InputRow value={value} onChange={setValue} onAdd={onAdd} />

      {error && <div className="mt-3 text-sm font-medium text-red-600">{error}</div>}

      <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </span>
        <button
          onClick={onClear}
          disabled={items.length === 0}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#64748b",
            background: "none",
            border: "none",
            cursor: items.length === 0 ? "default" : "pointer",
            opacity: items.length === 0 ? 0.4 : 1,
          }}
          onMouseEnter={(e) => { if (items.length > 0) e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; }}
        >
          Clear all
        </button>
      </div>

      <div
        style={{
          maxHeight: 280,
          overflowY: "auto",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
        }}
      >
        {items.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            No blacklisted sites yet.
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={`${item}-${idx}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: idx < items.length - 1 ? "1px solid #f1f5f9" : "none",
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", flexShrink: 0
                }} />
                <span style={{ fontSize: 13, color: "#334155", fontFamily: "monospace" }}>{item}</span>
              </div>
              <button
                onClick={() => onRemove(idx)}
                style={{
                  marginLeft: 12,
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#ef4444",
                  background: "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}