// content script (your blacklist timer script), adapted to use user-defined URLs.
// Put this in your content script file (e.g. src/blacklist.ts or src/content/blacklist.ts)

import { triggerDonation } from "../donate"; // adjust path if needed

const BLACKLIST_KEY = "bloomscroll_blacklist";
const SELECTED_CHARITY_KEY = "selectedCharity";

// donation cadence on a blacklisted site
const DONATE_EVERY_SECONDS = 10;

let seconds = 0;
let interval: ReturnType<typeof setInterval> | null = null;
let popup: HTMLElement | null = null;

function hasChromeStorage() {
  return typeof chrome !== "undefined" && !!chrome.storage?.sync;
}

async function getBlacklist(): Promise<string[]> {
  if (hasChromeStorage()) {
    const res = await chrome.storage.sync.get([BLACKLIST_KEY]);
    return Array.isArray(res[BLACKLIST_KEY]) ? res[BLACKLIST_KEY] : [];
  }

  const raw = localStorage.getItem(BLACKLIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getSelectedCharity(): Promise<string> {
  if (hasChromeStorage()) {
    const res = await chrome.storage.sync.get([SELECTED_CHARITY_KEY]);
    const v = res[SELECTED_CHARITY_KEY];
    return typeof v === "string" && v ? v : "rc";
  }
  const v = localStorage.getItem(SELECTED_CHARITY_KEY);
  return v && v.length ? v : "rc";
}

// Matching rules:
// - If entry starts with http(s):// => prefix match against origin+pathname (no query/hash)
// - If entry contains "*" => treat it as "contains" (simple wildcard)
// - Otherwise => match hostname equality OR hostname endsWith("." + entry) OR full URL contains entry
function matchesEntry(entryRaw: string, url: URL): boolean {
  const entry = (entryRaw || "").trim();
  if (!entry) return false;

  const full = (url.origin + url.pathname).toLowerCase();
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const e = entry.toLowerCase();

  if (e.startsWith("http://") || e.startsWith("https://")) {
    try {
      const eu = new URL(e);
      const ep = (eu.origin + eu.pathname).replace(/\/+$/, "").toLowerCase();
      return full.startsWith(ep);
    } catch {
      return full.includes(e);
    }
  }

  if (e.includes("*")) {
    const needle = e.replace(/\*/g, "");
    return needle.length > 0 && (full.includes(needle) || host.includes(needle));
  }

  const normalized = e.replace(/^www\./, "");
  return (
    host === normalized ||
    host.endsWith("." + normalized) ||
    full.includes(normalized)
  );
}

async function isCurrentPageBlacklisted(): Promise<boolean> {
  const list = await getBlacklist();
  const url = new URL(window.location.href);
  return list.some((e) => matchesEntry(e, url));
}

function createPopup() {
  popup = document.createElement("div");
  popup.id = "bloomscroll-timer";
  popup.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 18px;
    border-radius: 12px;
    font-family: sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    pointer-events: none;
  `;
  document.body.appendChild(popup);
  updatePopup();
}

function updatePopup() {
  if (!popup) return;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  popup.textContent =
    mins > 0 ? `🌸 ${mins}m ${secs}s on this site` : `🌸 ${secs}s on this site`;
}

function showDonationNotif() {
  const notif = document.createElement("div");
  notif.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 24px;
    z-index: 999999;
    background: rgba(34, 197, 94, 0.9);
    color: white;
    padding: 10px 16px;
    border-radius: 12px;
    font-family: sans-serif;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    pointer-events: none;
    opacity: 1;
    transition: opacity 1s ease;
  `;
  notif.textContent = "💸 donated $0.50";
  document.body.appendChild(notif);

  setTimeout(() => {
    notif.style.opacity = "0";
    setTimeout(() => notif.remove(), 1000);
  }, 2000);
}

function stopTimer() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

function removePopup() {
  if (popup) {
    popup.remove();
    popup = null;
  }
}

function resetTimer() {
  stopTimer();
  seconds = 0;
}

async function startTimerIfBlacklisted() {
  const blacklisted = await isCurrentPageBlacklisted();
  if (!blacklisted) {
    resetTimer();
    removePopup();
    return;
  }

  if (!popup) createPopup();
  if (interval) return;

  interval = setInterval(async () => {
    seconds++;
    updatePopup();

    if (seconds % DONATE_EVERY_SECONDS === 0) {
      const charity = await getSelectedCharity();
      triggerDonation(charity)
        .then((result) => {
          if (result?.success) showDonationNotif();
        })
        .catch(console.error);
    }
  }, 1000);
}

// --- Boot ---
console.log("BloomScroll content script loaded");

// start if the current page matches
startTimerIfBlacklisted().catch(console.error);

// if user changes blacklist in the popup UI while this tab is open, react immediately
if (hasChromeStorage()) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[BLACKLIST_KEY]) {
      startTimerIfBlacklisted().catch(console.error);
    }
  });
} else {
  // dev fallback: refresh match when tab regains focus
  window.addEventListener("focus", () => {
    startTimerIfBlacklisted().catch(console.error);
  });
}

// Handle tab visibility changes (keep your behavior)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    resetTimer();
    removePopup();
  } else {
    seconds = 0;
    startTimerIfBlacklisted().catch(console.error);
  }
});

/*
// Runs in the context of web pages
console.log("BloomScroll content script loaded");

// Example: manipulate the DOM of the page
document.addEventListener("DOMContentLoaded", () => {
  // your logic here
});

import { triggerDonation } from "../donate";

let seconds = 0;
let interval: ReturnType<typeof setInterval> | null = null;
let popup: HTMLElement | null = null;

function createPopup() {
  popup = document.createElement("div");
  popup.id = "bloomscroll-timer";
  popup.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 18px;
    border-radius: 12px;
    font-family: sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    pointer-events: none;
  `;
  document.body.appendChild(popup);
  updatePopup();
}

function updatePopup() {
  if (!popup) return;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = mins > 0
    ? `🌸 ${mins}m ${secs}s on this site`
    : `🌸 ${secs}s on this site`;
  popup.textContent = display;
}

function showDonationNotif() {
  const notif = document.createElement("div");
  notif.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 24px;
    z-index: 999999;
    background: rgba(34, 197, 94, 0.9);
    color: white;
    padding: 10px 16px;
    border-radius: 12px;
    font-family: sans-serif;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    pointer-events: none;
    opacity: 1;
    transition: opacity 1s ease;
  `;
  notif.textContent = "💸 donated $0.50";
  document.body.appendChild(notif);

  // Trigger fade out after 2s, remove after fade completes
  setTimeout(() => {
    notif.style.opacity = "0";
    setTimeout(() => notif.remove(), 1000);
  }, 2000);
}

function startTimer() {
  if (interval) return;
  interval = setInterval(() => {
    seconds++;
    updatePopup();
  if (seconds % 10 === 0) {
      console.log("Charged");
      triggerDonation("rc")
        .then((result) => {
          if (result.success) showDonationNotif();
        })
        .catch(console.error);
    }
  }, 1000);
}

function stopTimer() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

function removePopup() {
  if (popup) {
    popup.remove();
    popup = null;
  }
}

function resetTimer() {
  stopTimer();
  seconds = 0;
}

// On load: create popup and start timer
createPopup();
startTimer();

// Handle tab visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Left this tab — stop and reset
    resetTimer();
    removePopup();
  } else {
    // Came back — start fresh
    seconds = 0;
    createPopup();
    startTimer();
  }
});
*/