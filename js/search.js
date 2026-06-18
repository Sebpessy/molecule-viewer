// Search box, suggestions, quick-pick chips, and molecule loading
// (local library + live PubChem fallback).

import { LIB, LIB_KEYS, libKey } from "./library.js";
import { showSpecimen, showStatus } from "./viewer.js";
import { esc } from "./util.js";
import { CHIPS } from "./config.js";

let reqToken = 0;
let activeIdx = -1;

export function loadByName(name){
  if(!name) return;
  const key = libKey(name);
  if(key){
    const e = LIB[key];
    showSpecimen({ name:key, sdf:e.sdf, formula:e.formula, mw:e.mw, atoms:e.atoms, note:e.note, live:false });
  } else {
    liveLookup(name);
  }
}

export async function liveLookup(query){
  query = (query || "").trim();
  if(!query) return;
  const myToken = ++reqToken;
  showStatus('Searching PubChem for "' + esc(query) + '"…', true);
  const base = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound";
  try{
    const cidRes = await fetch(base + "/name/" + encodeURIComponent(query) + "/cids/JSON");
    if(myToken !== reqToken) return;
    if(!cidRes.ok) throw new Error("no cid");
    const cidJson = await cidRes.json();
    const cid = cidJson.IdentifierList && cidJson.IdentifierList.CID && cidJson.IdentifierList.CID[0];
    if(!cid) throw new Error("no cid");

    let sdf = null;
    const r3 = await fetch(base + "/cid/" + cid + "/SDF?record_type=3d");
    if(myToken !== reqToken) return;
    if(r3.ok){ sdf = await r3.text(); }
    else {
      const r2 = await fetch(base + "/cid/" + cid + "/SDF?record_type=2d");
      if(myToken !== reqToken) return;
      if(r2.ok){ sdf = await r2.text(); }
    }
    if(!sdf) throw new Error("no sdf");

    let formula = "", mw = "", iupac = "";
    try{
      const pr = await fetch(base + "/cid/" + cid + "/property/MolecularFormula,MolecularWeight,IUPACName/JSON");
      if(myToken !== reqToken) return;
      if(pr.ok){
        const pj = await pr.json();
        const p = pj.PropertyTable && pj.PropertyTable.Properties && pj.PropertyTable.Properties[0];
        if(p){ formula = p.MolecularFormula || ""; mw = p.MolecularWeight || ""; iupac = p.IUPACName || ""; }
      }
    }catch(e){ /* best-effort */ }

    let atoms = "";
    const lines = sdf.split("\n");
    if(lines.length >= 4){
      const m = lines[3].match(/\d+/);
      if(m) atoms = parseInt(m[0], 10);
    }

    if(myToken !== reqToken) return;
    const disp = query.charAt(0).toUpperCase() + query.slice(1);
    showSpecimen({ name:disp, sdf, formula, mw, atoms, cid, live:true, note: iupac ? ("IUPAC · " + iupac) : "" });
  }catch(err){
    if(myToken !== reqToken) return;
    showStatus('Couldn’t find "' + esc(query) + '" in PubChem, and it’s ' +
      'not in the local library.<br>Try a different name or check the spelling.', false);
  }
}

export function initSearch(){
  const qEl = document.getElementById("q");
  const suggEl = document.getElementById("sugg");
  const chipsEl = document.getElementById("chips");

  function renderSugg(list){
    if(!list.length){ suggEl.classList.remove("open"); suggEl.innerHTML = ""; return; }
    suggEl.innerHTML = list.map((n, i) =>
      '<div class="item' + (i === activeIdx ? ' active' : '') + '" data-name="' + esc(n) + '">' + esc(n) + '</div>').join("");
    suggEl.classList.add("open");
    Array.from(suggEl.children).forEach(elm => {
      elm.addEventListener("mousedown", ev => {
        ev.preventDefault();
        const nm = elm.getAttribute("data-name");
        qEl.value = nm; closeSugg(); loadByName(nm);
      });
    });
  }
  function closeSugg(){ suggEl.classList.remove("open"); suggEl.innerHTML = ""; activeIdx = -1; }
  function currentList(){ return Array.from(suggEl.querySelectorAll(".item")).map(e => e.getAttribute("data-name")); }

  qEl.addEventListener("input", () => {
    const v = qEl.value.trim().toLowerCase();
    activeIdx = -1;
    if(!v){ closeSugg(); return; }
    renderSugg(LIB_KEYS.filter(k => k.toLowerCase().includes(v)).slice(0, 8));
  });

  qEl.addEventListener("keydown", e => {
    const list = currentList();
    if(e.key === "ArrowDown"){
      if(!list.length) return;
      e.preventDefault(); activeIdx = (activeIdx + 1) % list.length; renderSugg(list);
    } else if(e.key === "ArrowUp"){
      if(!list.length) return;
      e.preventDefault(); activeIdx = (activeIdx - 1 + list.length) % list.length; renderSugg(list);
    } else if(e.key === "Enter"){
      e.preventDefault();
      const pick = (activeIdx >= 0 && list[activeIdx]) ? list[activeIdx] : qEl.value.trim();
      if(activeIdx >= 0) qEl.value = pick;
      closeSugg(); loadByName(pick);
    } else if(e.key === "Escape"){
      closeSugg();
    }
  });

  document.addEventListener("click", e => { if(!e.target.closest(".search")) closeSugg(); });

  chipsEl.innerHTML = CHIPS.map(c => '<button class="chip" data-name="' + esc(c) + '">' + esc(c) + '</button>').join("");
  Array.from(chipsEl.children).forEach(elm => {
    elm.addEventListener("click", () => {
      const nm = elm.getAttribute("data-name");
      qEl.value = nm; closeSugg(); loadByName(nm);
    });
  });
}
