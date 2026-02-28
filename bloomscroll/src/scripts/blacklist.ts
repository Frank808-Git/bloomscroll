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