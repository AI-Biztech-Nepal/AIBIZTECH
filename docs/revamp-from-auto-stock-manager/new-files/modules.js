// The service catalogue. Every service the platform offers is one entry here; adding a new
// service later = one entry (plus its route). `path` is the nav route, `status: "soon"`
// services show in the builder and dashboard but have no page yet.
import {
  Bike, ShoppingBag, Boxes, Wrench, ShieldCheck, BookOpen, Megaphone, BarChart3, Sparkles,
  CalendarCheck, Landmark,
} from "lucide-react";

export const MODULES = [
  { id: "inventory",  label: "Stock & Inventory",  path: "/inventory",   icon: Bike,         blurb: "Every item in stock, its photos, cost and ageing." },
  { id: "sales",      label: "Sales & Dues",       path: "/sales",       icon: ShoppingBag,  blurb: "Record sales, bookings, payments and what customers still owe." },
  { id: "spare-parts",label: "Spare Parts",        path: "/spare-parts", icon: Boxes,        blurb: "Parts stock, vendor bills and what is owed to suppliers." },
  { id: "jobs",       label: "Repairs & Job Cards",path: "/jobs",        icon: Wrench,       blurb: "Work orders, labour, parts used and workshop progress." },
  { id: "warranty",   label: "Warranty",           path: "/warranty",    icon: ShieldCheck,  blurb: "After-sale cover and service follow-up." },
  { id: "ledger",     label: "People & Ledger",    path: "/ledger",      icon: BookOpen,     blurb: "Customers, vendors and staff in one book." },
  { id: "marketing",  label: "Marketing & CRM",    path: "/marketing",   icon: Megaphone,    blurb: "Leads, follow-ups, offers and social sharing." },
  { id: "reports",    label: "Reports",            path: "/reports",     icon: BarChart3,    blurb: "Monthly closing, profit and purchase reports." },
  { id: "ai",         label: "AI Assistant",       path: "/ai",          icon: Sparkles,     blurb: "Ask questions about your business in plain words." },
  { id: "attendance", label: "Attendance",         path: null,           icon: CalendarCheck,blurb: "Staff check-in, leave and payroll basis.", status: "soon" },
  { id: "finance",    label: "Accounts & Finance", path: null,           icon: Landmark,     blurb: "Day book, bills, cash and bank, business summary.", status: "soon" },
];

export const moduleById = Object.fromEntries(MODULES.map(m => [m.id, m]));
export const ALL_MODULE_IDS = MODULES.filter(m => m.status !== "soon").map(m => m.id);

// What the builder asks. `needs` are what the owner wants to manage; each maps to modules.
export const BUSINESS_TYPES = [
  { id: "vehicles", label: "Sell vehicles",        hint: "Showroom, used or new stock",   needs: ["stock", "sales", "customers", "reports"] },
  { id: "workshop", label: "Repair & service",     hint: "Workshop, garage, servicing",   needs: ["repairs", "parts", "warranty", "staff"] },
  { id: "retail",   label: "Sell parts or goods",  hint: "Shop, wholesale, distribution", needs: ["stock", "parts", "sales", "money"] },
  { id: "services", label: "Run a service business",hint: "Staffing, field work, agency", needs: ["staff", "money", "customers"] },
];

export const NEEDS = [
  { id: "stock",     label: "Track stock",                   modules: ["inventory"] },
  { id: "sales",     label: "Record sales & payments due",   modules: ["sales", "ledger"] },
  { id: "parts",     label: "Manage spare parts & vendors",  modules: ["spare-parts", "ledger"] },
  { id: "repairs",   label: "Run repairs & job cards",       modules: ["jobs"] },
  { id: "warranty",  label: "Follow up warranties",          modules: ["warranty"] },
  { id: "customers", label: "Grow customers & follow-ups",   modules: ["marketing", "ledger"] },
  { id: "staff",     label: "Staff attendance & payroll",    modules: ["attendance", "ledger"] },
  { id: "money",     label: "Accounts & finance",            modules: ["finance"] },
  { id: "reports",   label: "Reports & monthly closing",     modules: ["reports"] },
];

export const TEAM_SIZES = ["Just me", "2–5 people", "6–20 people", "20+ people"];

// Turns the answers into the recommended module ids (always includes the AI assistant,
// and Reports once there is a team to report to).
export function recommend({ needs = [], team }) {
  const ids = new Set(["ai"]);
  needs.forEach(n => NEEDS.find(x => x.id === n)?.modules.forEach(m => ids.add(m)));
  if (team && team !== TEAM_SIZES[0]) ids.add("ledger");
  if (team === TEAM_SIZES[2] || team === TEAM_SIZES[3]) ids.add("attendance");
  return MODULES.filter(m => ids.has(m.id)).map(m => m.id);
}
