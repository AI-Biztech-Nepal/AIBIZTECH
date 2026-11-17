// Opened from the AIBIZTECH portal (its menu adds ?from=aibiztech)? Remember it for this tab, so the side panel can offer a
// way back to the portal. Runs when the app loads, before any redirect to the login page drops the address's query.
export const PORTAL_URL = process.env.REACT_APP_PORTAL_URL || "https://aibiztech.vercel.app";

try {
  if (new URLSearchParams(window.location.search).get("from") === "aibiztech") sessionStorage.setItem("from_aibiztech", "1");
} catch { /* storage blocked: no back link, nothing else changes */ }

export const openedFromPortal = () => {
  try { return sessionStorage.getItem("from_aibiztech") === "1"; } catch { return false; }
};
