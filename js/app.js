// Boot: wire modules and load the default specimen.

import { initSearch, loadByName } from "./search.js";
import { cycleStyle, toggleSpin, recenter } from "./viewer.js";
import { initLists } from "./lists.js";
import { initFullscreen } from "./fullscreen.js";
import { initAuth } from "./auth.js";
import { initAuthUI } from "./authui.js";

function initControls(){
  document.getElementById("spinBtn").addEventListener("click", toggleSpin);
  document.getElementById("styleBtn").addEventListener("click", cycleStyle);
  document.getElementById("centerBtn").addEventListener("click", recenter);
}

function boot(){
  initSearch();
  initControls();
  initFullscreen();
  initAuthUI();   // register auth listener before initAuth resolves
  initLists();
  initAuth();     // async; re-renders account + lists when the session resolves
  loadByName("Ipamorelin");
}

if(document.readyState === "loading"){
  window.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
