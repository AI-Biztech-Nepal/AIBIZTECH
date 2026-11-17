import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { PORTAL_URL } from "../utils/portalFlag";

// Where "Open app" in AIBIZTECH lands: the signed pass is in the address after the #, so it never reaches a server log.
// Trade it for a Stock Manager session, then go to the page that was asked for (?to=/inventory).
export default function SsoLanding() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    const to = new URLSearchParams(window.location.search).get("to") || "/";
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!token) { navigate("/login", { replace: true }); return; }
    (async () => {
      try {
        const res = await api.post("/auth/sso", { token });
        login({ username: res.data.username, name: res.data.name, role: res.data.role, company_name: res.data.company_name }, res.data.token);
        navigate(to.startsWith("/") && !to.startsWith("//") ? to : "/", { replace: true });
      } catch (e) {
        setError(e?.response?.data?.detail || "Could not sign you in.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
      {error ? (
        <div className="max-w-sm">
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <a href={PORTAL_URL} className="text-blue-600 font-semibold">Back to AIBIZTECH</a>
        </div>
      ) : (
        <p className="text-slate-500">Signing you in…</p>
      )}
    </div>
  );
}
