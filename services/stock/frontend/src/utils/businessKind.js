// The portal says what kind of business signed in (see apps/aibiztech/lib/business-kind.ts). A vehicle business keeps
// every vehicle screen and this app's own (automobile) Finance. Others get the general version this app already has for
// shops that do not sell vehicles (generic Items), without this Finance: theirs is the portal's general Finance.
import { ALL_FEATURES_ON } from "./permissions";

const GENERAL = { "stock.vehicles": false, "stock.sanakhat": false, "stock.job_cards": false, "stock.spare_parts": false, "stock.auto_finance": false };
const KIND_FEATURES = { general: GENERAL, workshop: { ...GENERAL, "stock.job_cards": true, "stock.spare_parts": true } };

export const rememberKind = (kind) => {
  if (kind === "auto" || KIND_FEATURES[kind]) localStorage.setItem("gng_kind", kind);
  else localStorage.removeItem("gng_kind");
};

// The feature switches to use: the server's own answer, narrowed to what this kind of business has.
export function forKind(features) {
  const own = KIND_FEATURES[localStorage.getItem("gng_kind")];
  return own ? { ...ALL_FEATURES_ON, ...(features || {}), ...own } : features;
}
