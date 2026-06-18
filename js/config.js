// App-wide constants. Music tracks and plan caps live here.

export const CHIPS = ["Ipamorelin","Caffeine","Aspirin","Dopamine","Cholesterol",
                     "Testosterone","THC","Glucose","Morphine","Melatonin"];

export const STYLES = ["Ball & Stick","Stick","Space-filling","Wireframe"];

// Add more entries as new files are uploaded to audio/tracks/.
export const TRACKS = [
  { name: "Molecules 1", file: "audio/tracks/molecules-1.mp3" }
];

// Per-plan limits. Phase 1 has no accounts, so everyone is "free" with
// generous caps; Phase 4 (Stripe) flips CURRENT_PLAN per signed-in user.
export const PLAN = {
  free: { maxLists: 20, maxMolecules: 50 },
  pro:  { maxLists: 200, maxMolecules: 50 }
};
export const CURRENT_PLAN = "free";
export const caps = () => PLAN[CURRENT_PLAN] || PLAN.free;

export const prefersReduced = !!(window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches);

// ---- Supabase (Phase 2) ----
// Paste your project's values here (Project Settings → API). The anon key is
// safe to expose in client code — row-level security protects the data.
// Until both are set, the app runs in local-only mode (lists in localStorage).
export const SUPABASE_URL = "https://yyyhialxliqmbvkjbior.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_IrQzfjxAAOCsPc4SVf98Uw_DON0TCIr";
export const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
