// Boot: wire modules and load the default specimen.

import { initSearch, loadByName } from "./search.js";
import { cycleStyle, toggleSpin, recenter, resizeViewer } from "./viewer.js";
import { initLists } from "./lists.js";
import { initFullscreen } from "./fullscreen.js";
import { initAuth } from "./auth.js";
import { initAuthUI } from "./authui.js";

function initControls(){
  document.getElementById("spinBtn").addEventListener("click", toggleSpin);
  document.getElementById("styleBtn").addEventListener("click", cycleStyle);
  document.getElementById("centerBtn").addEventListener("click", recenter);
}

// Keep the 3Dmol canvas correctly sized — critical on mobile, where the stage
// often isn't laid out when the viewer is first created (blank-until-refresh bug).
function initResizeHandling(){
  let t;
  const nudge = () => { clearTimeout(t); t = setTimeout(resizeViewer, 150); };
  window.addEventListener("resize", nudge);
  window.addEventListener("orientationchange", () => setTimeout(resizeViewer, 350));
  window.addEventListener("load", () => setTimeout(resizeViewer, 200));
  // a couple of post-boot nudges for slow first paints on mobile
  setTimeout(resizeViewer, 400);
  setTimeout(resizeViewer, 1200);
}

function boot(){
  initSearch();
  initControls();
  initFullscreen();
  initAuthUI();   // register auth listener before initAuth resolves
  initLists();
  initAuth();     // async; re-renders account + lists when the session resolves
  loadByName("Ipamorelin");
  initResizeHandling();
}

if(document.readyState === "loading"){
  window.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
