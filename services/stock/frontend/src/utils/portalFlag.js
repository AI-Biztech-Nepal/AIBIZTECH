// Opened from the AIBIZTECH portal (its menu adds ?from=aibiztech)? Remember it for this tab, so the side panel can offer a
// way back to the portal. Runs when the app loads, before any redirect to the login page drops the address's query.
export const PORTAL_URL = process.env.REACT_APP_PORTAL_URL || "https://aibiztech.vercel.app";

try {
  if (new URLSearchParams(window.location.search).get("from") === "aibiztech") sessionStorage.setItem("from_aibiztech", "1");
} catch { /* storage blocked: no back link, nothing else changes */ }

// Built into the portal itself (served at /stock-app, shown inside the portal's page area).
export const IN_PORTAL = process.env.PUBLIC_URL === "/stock-app";
const base = process.env.PUBLIC_URL || "";

// Opened on its own address rather than inside the portal: go to the portal page that holds it, which signs in the person
// who is signed in to the portal now (never whoever used this browser before).
if (IN_PORTAL && window.top === window.self) {
  const path = window.location.pathname.slice(base.length);
  if (!path.startsWith("/sso")) window.location.replace(`/app/stock${path}${window.location.search}`);
}

// The session ended: in the portal, ask the portal for a new one (once; if that does not help, show this app's own sign-in).
export function signInAgain() {
  if (IN_PORTAL) {
    const last = Number(sessionStorage.getItem("stock_resignin") || 0);
    if (Date.now() - last > 30000) {
      sessionStorage.setItem("stock_resignin", String(Date.now()));
      const to = window.location.pathname.slice(base.length) + window.location.search;
      window.location.href = `/go/stock?to=${encodeURIComponent(to || "/")}&embed=1`;
      return;
    }
  }
  window.location.href = `${base}/login`;
}

export const openedFromPortal = () => {
  try { return sessionStorage.getItem("from_aibiztech") === "1"; } catch { return false; }
};
