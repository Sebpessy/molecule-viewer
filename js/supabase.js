// Supabase client. Loaded over CDN (no build step). Exports `sb` = the client,
// or null when the project isn't configured yet (app stays in local-only mode).

import { SUPABASE_URL, SUPABASE_ANON_KEY, HAS_SUPABASE } from "./config.js";

let sb = null;
if(HAS_SUPABASE){
  try{
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }catch(err){
    console.error("Supabase client failed to load", err);
    sb = null;
  }
}

export { sb };
