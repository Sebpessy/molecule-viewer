// Lists persistence — dual mode.
//   • Signed in with Supabase configured → cloud (Postgres, RLS-protected, syncs across devices)
//   • Otherwise → localStorage (Phase 1 behavior)
// Same async signatures either way, so the rest of the app doesn't care.

import { uid } from "./util.js";
import { sb } from "./supabase.js";
import { isSignedIn, userId } from "./auth.js";

const KEY = "mv_lists_v1";
const BACKUP_KEY = "mv_lists_v1_backup";

export const DEFAULT_SETTINGS = { secondsEach: 20, voice: true, music: true, track: 0, loop: false };

function useCloud(){ return !!sb && isSignedIn(); }

// ---- local backend ----
function lread(){ try{ return JSON.parse(localStorage.getItem(KEY) || "[]"); }catch(e){ return []; } }
function lwrite(arr){ localStorage.setItem(KEY, JSON.stringify(arr)); }
function now(){ return new Date().toISOString(); }

// Shape a DB/local row into the object the UI expects.
function normalize(l){
  return {
    id: l.id, name: l.name,
    molecules: Array.isArray(l.molecules) ? l.molecules : [],
    settings: Object.assign({}, DEFAULT_SETTINGS, l.settings || {}),
    sort_order: l.sort_order || 0,
    created_at: l.created_at, updated_at: l.updated_at
  };
}

export async function listLists(){
  if(useCloud()){
    const { data, error } = await sb.from("lists").select("*").order("sort_order", { ascending: true });
    if(error){ console.error(error); return []; }
    return (data || []).map(normalize);
  }
  return lread()
    .sort((a, b) => (a.sort_order - b.sort_order) || (a.created_at < b.created_at ? -1 : 1))
    .map(normalize);
}

export async function getList(id){
  if(useCloud()){
    const { data, error } = await sb.from("lists").select("*").eq("id", id).maybeSingle();
    if(error){ console.error(error); return null; }
    return data ? normalize(data) : null;
  }
  const l = lread().find(x => x.id === id);
  return l ? normalize(l) : null;
}

export async function createList(name){
  if(useCloud()){
    const existing = await listLists();
    const row = {
      user_id: userId(), name: name || "Untitled list",
      molecules: [], settings: { ...DEFAULT_SETTINGS }, sort_order: existing.length
    };
    const { data, error } = await sb.from("lists").insert(row).select().single();
    if(error){ console.error(error); return null; }
    return normalize(data);
  }
  const arr = lread();
  const t = now();
  const list = normalize({ id: uid(), name: name || "Untitled list", molecules: [], settings: { ...DEFAULT_SETTINGS }, sort_order: arr.length, created_at: t, updated_at: t });
  arr.push(list); lwrite(arr);
  return list;
}

export async function updateList(id, patch){
  if(useCloud()){
    const { data, error } = await sb.from("lists")
      .update({ ...patch, updated_at: now() }).eq("id", id).select().single();
    if(error){ console.error(error); return null; }
    return normalize(data);
  }
  const arr = lread();
  const l = arr.find(x => x.id === id);
  if(!l) return null;
  Object.assign(l, patch, { updated_at: now() });
  lwrite(arr);
  return normalize(l);
}

export async function deleteList(id){
  if(useCloud()){
    const { error } = await sb.from("lists").delete().eq("id", id);
    if(error) console.error(error);
    return;
  }
  lwrite(lread().filter(l => l.id !== id));
}

export async function duplicateList(id){
  const src = await getList(id);
  if(!src) return null;
  const copy = await createList(src.name + " (copy)");
  if(!copy) return null;
  return updateList(copy.id, { molecules: src.molecules, settings: src.settings });
}

export async function reorderLists(ids){
  if(useCloud()){
    for(let i = 0; i < ids.length; i++){
      await sb.from("lists").update({ sort_order: i }).eq("id", ids[i]);
    }
    return;
  }
  const arr = lread();
  ids.forEach((id, i) => { const l = arr.find(x => x.id === id); if(l) l.sort_order = i; });
  lwrite(arr);
}

// ---- one-time local → cloud import ----
export function localListCount(){ return lread().length; }

export async function importLocalToCloud(){
  if(!useCloud()) return 0;
  const local = lread();
  if(!local.length) return 0;
  let n = 0;
  // append after any existing cloud lists, preserving order
  let base = (await listLists()).length;
  for(const l of local){
    const created = await createList(l.name);
    if(created){
      await updateList(created.id, { molecules: l.molecules || [], settings: l.settings || {}, sort_order: base++ });
      n++;
    }
  }
  // keep a backup, clear the active local key so it won't re-import
  localStorage.setItem(BACKUP_KEY, localStorage.getItem(KEY) || "[]");
  localStorage.removeItem(KEY);
  return n;
}
