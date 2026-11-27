// Inside the AI Biz Tech Nepal portal there is one side panel: the portal's. This app does not draw its own; it tells the
// portal what its menu is for the signed-in person (the same role and access rules as always), and opens the page the
// portal asks for. Same address on both sides, and messages from anywhere else are ignored.
import { useEffect, useRef } from "react";
import { IN_PORTAL } from "./portalFlag";
import { accessLevel, canAccessPath, marketingTabsFor, itemsMode } from "./permissions";
import { FINANCE_NAV, financeTab, financeNavKey } from "../pages/finance/nav";

export const PORTAL_PANEL = IN_PORTAL && window.top !== window.self;

export function buildPortalMenu({ items, marketingNav, serviceTabs, role, features, terms, newLeads, pathname, search }) {
  const tab = new URLSearchParams(search).get("tab");
  const under = (path) => (path === "/" ? pathname === "/" : pathname.startsWith(path));
  const node = (key, label, to, active, extra) => ({ key, label, to, active: !!active, ...extra });
  const menu = [];
  for (const { path, label } of items) {
    const key = path.slice(1) || "dashboard";
    if (path === "/finance") {
      const current = under(path) ? financeNavKey(financeTab(tab)) : null;
      const page = (i) => node(`finance-${i.key}`, i.label, `/finance?tab=${i.key}`,
        current === i.key || (i.hideChildren && i.children.some((c) => c.key === current)));
      menu.push(node(key, label, path, under(path), {
        children: FINANCE_NAV.map((i) => (i.children && !i.hideChildren ? { ...page(i), children: i.children.map(page) } : page(i))),
      }));
      continue;
    }
    const parts = under("/inventory") && tab === "spare-parts";
    if (path === "/inventory" && itemsMode(features)) {
      if (canAccessPath(role, "/items")) menu.push(node("items", terms.items, "/items", under("/items")));
      if (canAccessPath(role, "/spare-parts", features)) menu.push(node("spare-parts", "Spare Parts", "/inventory?tab=spare-parts", under("/inventory")));
      continue;
    }
    if (path === "/inventory") {
      const children = [
        accessLevel(role, "inventory") !== "none" && node("inventory-product", "Product", "/inventory", under(path) && !parts),
        canAccessPath(role, "/spare-parts", features) && node("spare-parts", "Spare Parts", "/inventory?tab=spare-parts", parts),
      ].filter(Boolean);
      if (children.length > 1) { menu.push(node(key, label, path, under(path), { children })); continue; }
    }
    if (path === "/jobs" || path === "/warranty") {
      const tabs = serviceTabs.filter((t) => canAccessPath(role, t.to, features));
      if (tabs.length > 1) {
        if (path === tabs[0].to) {
          const children = tabs.map((t) => node(t.key, t.label, t.to, under(t.to)));
          menu.push(node("service", "Service", tabs[0].to, children.some((c) => c.active), { children }));
        }
        continue;
      }
      if (path !== tabs[0]?.to) continue;
    }
    if (path === "/marketing") {
      const tabs = marketingTabsFor(role, features);
      if (tabs.length > 1) {
        const current = tabs.includes(tab) ? tab : tabs[0];
        menu.push(node(key, label, `/marketing?tab=${tabs[0]}`, under(path), {
          badge: newLeads,
          children: tabs.map((t) => node(`marketing-${t}`, marketingNav[t].label, `/marketing?tab=${t}`, under(path) && current === t, { badge: t === "leads" ? newLeads : 0 })),
        }));
        continue;
      }
    }
    menu.push(node(key, label, path, under(path), path === "/marketing" ? { badge: newLeads } : {}));
  }
  return menu;
}

export function usePortalPanel(menu, path, navigate) {
  const message = JSON.stringify({ type: "stock:menu", menu, path });
  const latest = useRef(message); latest.current = message;
  const go = useRef(navigate); go.current = navigate;
  useEffect(() => {
    if (PORTAL_PANEL) window.parent.postMessage(JSON.parse(message), window.location.origin);
  }, [message]);
  useEffect(() => {
    if (!PORTAL_PANEL) return undefined;
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      if (e.data?.type === "stock:hello") window.parent.postMessage(JSON.parse(latest.current), window.location.origin);
      const to = e.data?.to;
      if (e.data?.type === "stock:go" && typeof to === "string" && to.startsWith("/") && !to.startsWith("//")) go.current(to);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
}
