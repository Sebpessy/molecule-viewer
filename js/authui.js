// Account area: sign-in form (magic link + Google), signed-in state, and the
// one-time local→cloud import prompt. Hidden entirely when Supabase isn't set up.

import { sb } from "./supabase.js";
import { onAuth, currentUser, signInMagic, verifyOtpCode, signOut } from "./auth.js";
import { localListCount, importLocalToCloud } from "./api.js";
import { render as renderLists } from "./lists.js";
import { esc } from "./util.js";

let formOpen = false;
let codeSent = false;      // step 2: waiting for the 6-digit code
let pendingEmail = "";

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
  if(codeSent){
    return '<div class="signin">' +
      '<p class="acct-muted">Code sent to ' + esc(pendingEmail) + '. Enter it below (or use the link in the email).</p>' +
      '<input id="siCode" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="6-digit code">' +
      '<button class="ctl primary" id="siVerify">Verify &amp; sign in</button>' +
      '<button class="ctl" id="siReset">Use a different email</button>' +
      '<p class="si-msg" id="siMsg"></p>' +
    '</div>';
  }
  return '<div class="signin">' +
    '<input id="siEmail" type="email" placeholder="you@email.com" autocomplete="email" spellcheck="false">' +
    '<button class="ctl primary" id="siSend">Email me a sign-in code</button>' +
    '<p class="si-msg" id="siMsg"></p>' +
  '</div>';
}

function wireForm(){
  if(codeSent){
    document.getElementById("siReset").addEventListener("click", () => { codeSent = false; pendingEmail = ""; renderAccount(); });
    document.getElementById("siVerify").addEventListener("click", async () => {
      const code = document.getElementById("siCode").value.trim();
      const msg = document.getElementById("siMsg");
      if(!code){ msg.textContent = "Enter the code from your email."; return; }
      msg.textContent = "Verifying…";
      try{
        const { error } = await verifyOtpCode(pendingEmail, code);
        if(error){ msg.textContent = "Error: " + error.message; }
        else { codeSent = false; formOpen = false; /* onAuthStateChange re-renders */ }
      }catch(e){ msg.textContent = "Error: " + e.message; }
    });
    return;
  }
  document.getElementById("siSend").addEventListener("click", async () => {
    const email = document.getElementById("siEmail").value.trim();
    const msg = document.getElementById("siMsg");
    if(!email){ msg.textContent = "Enter your email."; return; }
    msg.textContent = "Sending…";
    try{
      const { error } = await signInMagic(email);
      if(error){ msg.textContent = "Error: " + error.message; }
      else { pendingEmail = email; codeSent = true; renderAccount(); }
    }catch(e){ msg.textContent = "Error: " + e.message; }
  });
}
