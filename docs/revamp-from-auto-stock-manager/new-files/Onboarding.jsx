import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Check, Clock } from "lucide-react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useBusiness } from "../context/BusinessContext";
import { BUSINESS_TYPES, NEEDS, TEAM_SIZES, MODULES, recommend } from "../utils/modules";

const STEPS = ["Your business", "What you manage", "Your team", "Your workspace"];

const Choice = ({ selected, onClick, title, hint, multi }) => (
  <button
    type="button" onClick={onClick} aria-pressed={selected}
    className={`relative text-left rounded-2xl border px-5 py-4 pr-12 transition-all duration-200 active:scale-[0.99] ${selected ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-400"}`}
  >
    <span className="block font-semibold text-slate-900">{title}</span>
    {hint && <span className="block text-sm text-slate-500 mt-0.5">{hint}</span>}
    <span className={`absolute top-4 right-4 w-5 h-5 ${multi ? "rounded-md" : "rounded-full"} border flex items-center justify-center transition-colors ${selected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 text-transparent"}`}>
      <Check size={12} strokeWidth={3} />
    </span>
  </button>
);

export default function Onboarding() {
  const { user } = useAuth();
  const { refresh } = useBusiness();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [type, setType] = useState(null);
  const [needs, setNeeds] = useState([]);
  const [team, setTeam] = useState(null);
  const [modules, setModules] = useState([]);
  const [saving, setSaving] = useState(false);

  const pickType = (t) => {
    setType(t.id);
    setNeeds(prev => (prev.length ? prev : t.needs)); // a starting point, never overwrites their picks
  };
  const toggleNeed = (id) => setNeeds(n => n.includes(id) ? n.filter(x => x !== id) : [...n, id]);
  const toggleModule = (id) => setModules(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id]);

  const canNext = [!!type, needs.length > 0, !!team, modules.length > 0][step];
  const next = () => {
    if (step === 2) setModules(recommend({ needs, team }));
    setStep(s => s + 1);
  };

  const finish = async () => {
    setSaving(true);
    try {
      await api.put("/business-profile", { business_type: type, answers: { needs, team }, modules });
      await refresh();
      navigate("/", { replace: true });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not save, try again");
      setSaving(false);
    }
  };

  const recommended = useMemo(() => new Set(recommend({ needs, team })), [needs, team]);

  return (
    <div className="min-h-screen bg-[#F6F4EF] lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Identity panel */}
      <aside className="bg-slate-900 text-white px-6 py-8 lg:px-12 lg:py-14 flex flex-col lg:sticky lg:top-0 lg:h-screen">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-400 text-slate-900 font-display font-extrabold flex items-center justify-center">{(user?.company_name || "A")[0].toUpperCase()}</div>
          <span className="font-display font-bold tracking-tight">{user?.company_name || "Your business"}</span>
        </div>
        <div className="mt-10 lg:mt-auto">
          <p className="text-blue-300 text-sm font-semibold tracking-wide">Let's set up your workspace</p>
          <h1 className="font-display text-3xl lg:text-5xl font-extrabold leading-[1.05] mt-3 text-balance">Tell us how you work. We'll shape the rest.</h1>
          <p className="text-slate-400 mt-4 max-w-sm text-sm lg:text-base">Four quick questions. We switch on the services that fit your business and keep the rest out of your way. You can change this any time.</p>
        </div>
        <ol className="hidden lg:flex mt-12 gap-2">
          {STEPS.map((s, i) => (
            <li key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-blue-400" : "bg-slate-700"}`} title={s} />
          ))}
        </ol>
      </aside>

      {/* Questions */}
      <main className="px-5 py-8 lg:px-16 lg:py-14 flex flex-col lg:min-h-screen">
        <div className="text-sm font-semibold text-slate-500">Step {step + 1} of {STEPS.length} · {STEPS[step]}</div>
        <div key={step} className="route-enter flex-1 mt-5 max-w-2xl w-full">
          {step === 0 && (<>
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-slate-900">What does your business do?</h2>
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              {BUSINESS_TYPES.map(t => <Choice key={t.id} selected={type === t.id} onClick={() => pickType(t)} title={t.label} hint={t.hint} />)}
            </div>
          </>)}
          {step === 1 && (<>
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-slate-900">What do you want to manage?</h2>
            <p className="text-slate-500 mt-1">Pick everything that applies. We pre-selected the usual ones.</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              {NEEDS.map(n => <Choice key={n.id} multi selected={needs.includes(n.id)} onClick={() => toggleNeed(n.id)} title={n.label} />)}
            </div>
          </>)}
          {step === 2 && (<>
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-slate-900">How big is your team?</h2>
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              {TEAM_SIZES.map(t => <Choice key={t} selected={team === t} onClick={() => setTeam(t)} title={t} />)}
            </div>
          </>)}
          {step === 3 && (<>
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-slate-900">Here's what we recommend</h2>
            <p className="text-slate-500 mt-1">Switched on from your answers. Add or remove anything.</p>
            <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              {MODULES.map(m => {
                const on = modules.includes(m.id);
                return (
                  <button key={m.id} type="button" onClick={() => toggleModule(m.id)} aria-pressed={on} className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors">
                    <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors ${on ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}><m.icon size={18} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap font-semibold text-slate-900">{m.label}
                        {recommended.has(m.id) && <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Recommended</span>}
                        {m.status === "soon" && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full"><Clock size={10} /> Coming soon</span>}
                      </span>
                      <span className="block text-sm text-slate-500">{m.blurb}</span>
                    </span>
                    <span className={`w-11 h-6 shrink-0 rounded-full p-0.5 transition-colors duration-200 ${on ? "bg-blue-600" : "bg-slate-300"}`}>
                      <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-5" : ""}`} />
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-3">Coming-soon services are saved to your workspace and appear the day they launch.</p>
          </>)}
        </div>

        <div className="flex items-center justify-between gap-3 pt-8 max-w-2xl w-full">
          <button type="button" onClick={() => setStep(s => s - 1)} disabled={step === 0} className="h-12 px-4 inline-flex items-center gap-2 rounded-xl text-slate-600 hover:bg-slate-200/60 disabled:opacity-0 transition">
            <ArrowLeft size={16} /> Back
          </button>
          {step < 3 ? (
            <button type="button" onClick={next} disabled={!canNext} className="h-12 px-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition">
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={finish} disabled={!canNext || saving} data-testid="finish-onboarding" className="h-12 px-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition">
              {saving ? "Setting up..." : "Open my workspace"} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
