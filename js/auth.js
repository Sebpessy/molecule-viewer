// Authentication state + actions (Supabase Auth). Magic link + Google OAuth.
// When Supabase isn't configured, everything resolves to "signed out" and the
// app runs in local-only mode.

import { sb } from "./supabase.js";

let _user = null;
let _ready = false;
const listeners = new Set();

function emit(){ listeners.forEach(cb => { try{ cb(_user); }catch(e){} }); }

// Subscribe to auth changes; immediately invoked with the current user (once ready).
export function onAuth(cb){
  listeners.add(cb);
  if(_ready) cb(_user);
  return () => listeners.delete(cb);
}

export async function initAuth(){
  if(!sb){ _user = null; _ready = true; emit(); return; }
  try{
    const { data } = await sb.auth.getSession();
    _user = data && data.session ? data.session.user : null;
  }catch(e){ _user = null; }
  _ready = true;
  emit();
  sb.auth.onAuthStateChange((_evt, session) => {
    _user = session ? session.user : null;
    emit();
  });
}

export function currentUser(){ return _user; }
export function isSignedIn(){ return !!_user; }
export function userId(){ return _user ? _user.id : null; }

const redirect = () => location.origin + location.pathname;

export async function signInMagic(email){
  if(!sb) throw new Error("Supabase not configured");
  return sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
}
export async function signInGoogle(){
  if(!sb) throw new Error("Supabase not configured");
  return sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect() } });
}
export async function signOut(){ if(sb) await sb.auth.signOut(); }
