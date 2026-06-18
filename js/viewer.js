// 3Dmol viewer: rendering, styles, spin, and the current specimen + info panel.

import { STYLES, prefersReduced } from "./config.js";
import { esc } from "./util.js";

let viewer = null;
let styleIdx = 0;
let spinOn = !prefersReduced;
let current = { name: "", source: "lib", cid: null };

const el = id => document.getElementById(id);

export function showStatus(html, spinner){
  const s = el("status");
  s.innerHTML = (spinner ? '<div class="spinner"></div>' : '') + '<div>' + html + '</div>';
  s.classList.add("show");
}
export function hideStatus(){
  const s = el("status");
  s.classList.remove("show");
  s.innerHTML = "";
}

export function getViewer(){
  if(!viewer) viewer = $3Dmol.createViewer("viewer", { backgroundColor: "#0a0f1a" });
  return viewer;
}

export function applyStyle(){
  const v = getViewer();
  v.setStyle({}, {});
  if(styleIdx === 0){
    v.setStyle({}, { stick:{radius:0.13, colorscheme:"Jmol"}, sphere:{scale:0.27, colorscheme:"Jmol"} });
  } else if(styleIdx === 1){
    v.setStyle({}, { stick:{radius:0.16, colorscheme:"Jmol"} });
  } else if(styleIdx === 2){
    v.setStyle({}, { sphere:{colorscheme:"Jmol"} });
  } else {
    v.setStyle({}, { line:{colorscheme:"Jmol"} });
  }
  v.render();
}

export function cycleStyle(){ styleIdx = (styleIdx + 1) % STYLES.length; applyStyle(); }

export function toggleSpin(){
  spinOn = !spinOn;
  const v = getViewer();
  v.spin(spinOn ? "y" : false, 0.6);
  return spinOn;
}
export function setSpin(on){
  spinOn = !!on;
  if(viewer) viewer.spin(spinOn ? "y" : false, 0.6);
}
export function isSpinning(){ return spinOn; }

export function recenter(){ const v = getViewer(); v.zoomTo(); v.render(); }

// Required when the stage size changes (e.g. entering/exiting fullscreen),
// otherwise 3Dmol renders the molecule off-center.
export function resizeViewer(){ if(viewer){ viewer.resize(); viewer.render(); } }

export function getCurrentSpecimen(){ return { ...current }; }

export function showSpecimen(spec){
  hideStatus();
  current = { name: spec.name, source: spec.live ? "pubchem" : "lib", cid: spec.cid || null };

  const v = getViewer();
  v.removeAllModels();
  v.setBackgroundColor("#0a0f1a");
  v.addModel(spec.sdf, "sdf");
  styleIdx = 0;
  applyStyle();
  v.zoomTo();
  v.render();
  v.spin(spinOn ? "y" : false, 0.6);

  const badge = spec.live
    ? '<span class="badge live">Live · PubChem</span>'
    : '<span class="badge local">Local specimen</span>';
  let rows = "";
  rows += '<div class="row"><span class="k">Formula</span><span class="v">' +
    (spec.formula ? esc(spec.formula) : "&mdash;") + '</span></div>';
  rows += '<div class="row"><span class="k">Mol. weight</span><span class="v">' +
    (spec.mw != null && spec.mw !== "" ? esc(spec.mw) + " g/mol" : "&mdash;") + '</span></div>';
  rows += '<div class="row"><span class="k">Atoms</span><span class="v">' +
    (spec.atoms != null && spec.atoms !== "" ? esc(spec.atoms) : "&mdash;") + '</span></div>';
  if(spec.cid){
    rows += '<div class="row"><span class="k">PubChem CID</span><span class="v">' + esc(spec.cid) + '</span></div>';
  }
  el("info").innerHTML = badge +
    '<h2 class="mname">' + esc(spec.name) + '</h2>' +
    (spec.note ? '<p class="note">' + esc(spec.note) + '</p>' : '<p class="note">&mdash;</p>') +
    rows;

  const ov = el("ovName");
  if(ov) ov.textContent = spec.name;
}
