/**
 * Plays the ka-ching.mp3 donation sound.
 */
export function playCaching(): void {
  const audio = new Audio(chrome.runtime.getURL("ka-ching.mp3"));
  audio.play().catch((err) => console.error("[Sound] Failed to play ka-ching.mp3:", err));
}
