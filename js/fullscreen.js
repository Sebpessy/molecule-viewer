// Immersive focus mode: hide the panel/header, fill the viewport with the
// spinning molecule, and show a minimal auto-fading overlay. Uses the native
// Fullscreen API where available, with a CSS-only fallback (iOS Safari).

import { resizeViewer, recenter, isSpinning, setSpin } from "./viewer.js";
import { prefersReduced } from "./config.js";

let hideTimer = null;

const inFocus = () => document.body.classList.contains("focus");
const nativeFs = () => document.fullscreenElement || document.webkitFullscreenElement;

export function initFullscreen(){
  document.getElementById("focusBtn").addEventListener("click", toggleFocus);
  document.getElementById("ovExit").addEventListener("click", exitFocus);
  document.getElementById("ovSpin").addEventListener("click", () => setSpin(!isSpinning()));
  document.getElementById("ovCenter").addEventListener("click", recenter);

  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);
  document.querySelector(".stage").addEventListener("mousemove", bumpOverlay);

  // Esc also leaves CSS-only focus mode (when no native fullscreen is active).
  document.addEventListener("keydown", e => {
    if(e.key === "Escape" && inFocus() && !nativeFs()) exitFocus();
  });
}

function toggleFocus(){ inFocus() ? exitFocus() : enterFocus(); }

function enterFocus(){
  document.body.classList.add("focus");
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if(req){ try{ req.call(el); }catch(e){} }
  afterLayout();
}

function exitFocus(){
  document.body.classList.remove("focus");
  if(nativeFs()){
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if(exit){ try{ exit.call(document); }catch(e){} }
  }
  hideOverlay();
  afterLayout();
}

function onFsChange(){
  // User left native fullscreen (Esc / system gesture) → drop focus styling too.
  if(!nativeFs() && inFocus()){ document.body.classList.remove("focus"); hideOverlay(); }
  afterLayout();
}

function afterLayout(){
  // Let the CSS settle, then reflow the 3Dmol canvas (it doesn't auto-resize).
  setTimeout(() => { resizeViewer(); recenter(); if(inFocus()) showOverlay(); }, 60);
}

function showOverlay(){
  const o = document.getElementById("overlay");
  o.classList.add("show"); o.classList.remove("hide");
  bumpOverlay();
}
function bumpOverlay(){
  if(!inFocus()) return;
  const o = document.getElementById("overlay");
  o.classList.add("show"); o.classList.remove("hide");
  clearTimeout(hideTimer);
  if(!prefersReduced) hideTimer = setTimeout(() => o.classList.add("hide"), 3000);
}
function hideOverlay(){
  const o = document.getElementById("overlay");
  o.classList.remove("show", "hide");
  clearTimeout(hideTimer);
}
