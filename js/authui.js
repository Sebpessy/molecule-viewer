// Account area: sign-in form (magic link + Google), signed-in state, and the
// one-time local→cloud import prompt. Hidden entirely when Supabase isn't set up.

import { sb } from "./supabase.js";
import { onAuth, currentUser, signInMagic, signInGoogle, signOut } from "./auth.js";
import { localListCount, importLocalToCloud } from "./api.js";
import { render as renderLists } from "./lists.js";
import { esc } from "./util.js";

let formOpen = false;

export function initAuthUI(){
  const acct = document.getElementById("account");
  if(!sb){ acct.style.display = "none"; return; }
  onAuth(() => { renderAccount(); renderLists(); });
}

function renderAccount(){
  const acct = document.getElementById("account");
  const u = currentUser();

  if(u){
    const local = localListCount();
    acct.innerHTML =
      '<div class="acct-row">' +
        '<span class="acct-email" title="' + esc(u.email || "") + '">' + esc(u.email || "Signed in") + '</span>' +
        '<button class="btn-mini" id="signOutBtn">Sign out</button>' +
      '</div>' +
      (local > 0
        ? '<div class="acct-import">' + local + ' local list' + (local > 1 ? "s" : "") +
          ' on this device. <button class="btn-mini" id="importBtn">Import to account</button></div>'
        : '');

    document.getElementById("signOutBtn").addEventListener("click", () => signOut());
    const ib = document.getElementById("importBtn");
    if(ib) ib.addEventListener("click", async () => {
      ib.disabled = true; ib.textContent = "Importing…";
      await importLocalToCloud();
      renderAccount(); renderLists();
    });
    return;
  }

  acct.innerHTML =
    '<div class="acct-row">' +
      '<span class="acct-muted">Local mode — lists saved on this device</span>' +
      '<button class="btn-mini" id="signInToggle">Sign in</button>' +
    '</div>' +
    (formOpen ? signinForm() : "");

  document.getElementById("signInToggle").addEventListener("click", () => { formOpen = !formOpen; renderAccount(); });
  if(formOpen) wireForm();
}

function signinForm(){
  return '<div class="signin">' +
    '<input id="siEmail" type="email" placeholder="you@email.com" autocomplete="email" spellcheck="false">' +
    '<button class="ctl" id="siMagic">Send magic link</button>' +
    '<button class="ctl" id="siGoogle">Continue with Google</button>' +
    '<p class="si-msg" id="siMsg"></p>' +
  '</div>';
}

function wireForm(){
  document.getElementById("siMagic").addEventListener("click", async () => {
    const email = document.getElementById("siEmail").value.trim();
    const msg = document.getElementById("siMsg");
    if(!email){ msg.textContent = "Enter your email."; return; }
    msg.textContent = "Sending…";
    try{
      const { error } = await signInMagic(email);
      msg.textContent = error ? ("Error: " + error.message) : "Check your email for the sign-in link.";
    }catch(e){ msg.textContent = "Error: " + e.message; }
  });
  document.getElementById("siGoogle").addEventListener("click", async () => {
    const msg = document.getElementById("siMsg");
    try{ const { error } = await signInGoogle(); if(error) msg.textContent = "Error: " + error.message; }
    catch(e){ msg.textContent = "Error: " + e.message; }
  });
}
