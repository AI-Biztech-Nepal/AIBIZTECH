import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowUpRight, Clock } from "lucide-react";
import api from "../utils/api";
import { formatNPR } from "../utils/helpers";
import { MODULES } from "../utils/modules";
import { useBusiness } from "../context/BusinessContext";

// One card per service the company has switched on: the one number worth knowing, and a way in.
// Figures come from /reports/dashboard (already loaded by the page) so they match the rest of it.
export default function ServicesOverview({ stats }) {
  const navigate = useNavigate();
  const { has, profile } = useBusiness();
  const { newLeads = 0 } = useOutletContext() || {};
  const [parts, setParts] = useState(null);

  const wantsParts = has("spare-parts");
  useEffect(() => {
    if (wantsParts) api.get("/spare-parts/summary").then(r => setParts(r.data)).catch(() => {});
  }, [wantsParts]);

  const metric = {
    inventory:     { v: stats.available, l: `in stock · ${formatNPR(stats.locked_capital)} tied up`, warn: stats.dead_stock_count > 0 && `${stats.dead_stock_count} dead stock` },
    sales:         { v: stats.sold, l: `sold · ${formatNPR(stats.total_revenue)} revenue` },
    "spare-parts": parts && { v: parts.total_parts, l: `parts · ${formatNPR(parts.total_value)} value`, warn: parts.low_stock_count > 0 && `${parts.low_stock_count} low on stock` },
    jobs:          { v: stats.pending_jobs, l: "pending jobs", warn: stats.in_progress_jobs > 0 && `${stats.in_progress_jobs} in progress` },
    ledger:        { v: stats.total_customers, l: `customers · ${stats.total_vendors} vendors`, warn: stats.total_vendor_due > 0 && `${formatNPR(stats.total_vendor_due)} owed to vendors` },
    marketing:     { v: newLeads, l: "new website leads" },
    warranty:      { v: null, l: "After-sale cover and follow-up" },
    reports:       { v: null, l: "Monthly closing and profit" },
    ai:            { v: null, l: "Ask about your business" },
  };

  const cards = MODULES.filter(m => m.status === "soon" ? profile?.modules?.includes(m.id) : has(m.id));

  return (
    <section aria-label="Your services">
      <h2 className="font-display text-lg font-bold text-slate-900 mb-3">Your services</h2>
      <div className="stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {cards.map(m => {
          const x = metric[m.id];
          const soon = m.status === "soon";
          return (
            <button
              key={m.id} type="button" disabled={soon} onClick={() => navigate(m.path)}
              className={`group text-left rounded-2xl border p-4 transition-all duration-200 ${soon ? "border-dashed border-slate-300 bg-transparent cursor-default" : "border-slate-200 bg-white hover:border-slate-900 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(28,25,23,.35)]"}`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${soon ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white"}`}><m.icon size={17} /></span>
                <span className="font-semibold text-slate-900 flex-1 min-w-0 truncate">{m.label}</span>
                {soon
                  ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full"><Clock size={10} /> Soon</span>
                  : <ArrowUpRight size={16} className="text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-900" />}
              </div>
              {soon ? (
                <p className="text-sm text-slate-500 mt-3">{m.blurb}</p>
              ) : x ? (
                <div className="mt-3">
                  {x.v != null && <div className="font-display text-3xl font-extrabold text-slate-900 leading-none">{x.v}</div>}
                  <div className={`text-sm text-slate-500 ${x.v != null ? "mt-1.5" : ""}`}>{x.l}</div>
                  {x.warn && <div className="text-xs font-semibold text-amber-700 mt-2">{x.warn}</div>}
                </div>
              ) : <div className="h-12 mt-3 rounded-lg bg-slate-100 animate-pulse" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
