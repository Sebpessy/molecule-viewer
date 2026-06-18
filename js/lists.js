// "My Lists" manager: list-of-lists cards + a per-list editor. Backed by api.js
// (localStorage in Phase 1) and played via session.js.

import * as api from "./api.js";
import { playList, stopSession, plState, isPlaying } from "./session.js";
import { getCurrentSpecimen } from "./viewer.js";
import { esc } from "./util.js";
import { TRACKS, caps } from "./config.js";

let editingId = null;

const body = () => document.getElementById("listsBody");

export async function initLists(){
  document.getElementById("newListBtn").addEventListener("click", async () => {
    const all = await api.listLists();
    if(all.length >= caps().maxLists){ flashNewBtn("List limit reached"); return; }
    const l = await api.createList("List " + (all.length + 1));
    editingId = l.id;
    render();
  });
  render();
}

function flashNewBtn(msg){
  const b = document.getElementById("newListBtn");
  const orig = b.innerHTML;
  b.textContent = msg;
  setTimeout(() => { b.innerHTML = orig; }, 1400);
}

export async function render(){
  if(editingId){
    const l = await api.getList(editingId);
    if(!l){ editingId = null; }
    else return renderEditor(l);
  }
  renderCards(await api.listLists());
}

// ---------- cards ----------
function renderCards(lists){
  if(!lists.length){
    body().innerHTML = '<p class="lists-empty">No lists yet. Create one, then add specimens to it.</p>';
    return;
  }
  body().innerHTML = lists.map((l, i) => {
    const playing = isPlaying(l.id);
    const count = l.molecules.length;
    return '<div class="list-card' + (playing ? ' playing' : '') + '" data-id="' + l.id + '">' +
      '<div class="lc-top">' +
        '<span class="lc-name">' + esc(l.name) + '</span>' +
        '<span class="lc-count">' + count + ' ' + (count === 1 ? "specimen" : "specimens") + '</span>' +
      '</div>' +
      '<div class="lc-actions">' +
        '<button class="lc-btn play' + (playing ? ' on' : '') + '" data-act="play">' + (playing ? "&#9632; Stop" : "&#9654; Play") + '</button>' +
        '<button class="lc-btn" data-act="edit">Edit</button>' +
        '<button class="lc-btn" data-act="dup">Duplicate</button>' +
        '<button class="lc-btn" data-act="up" ' + (i === 0 ? "disabled" : "") + '>&#8593;</button>' +
        '<button class="lc-btn" data-act="down" ' + (i === lists.length - 1 ? "disabled" : "") + '>&#8595;</button>' +
        '<button class="lc-btn danger" data-act="del">Delete</button>' +
      '</div>' +
    '</div>';
  }).join("");

  body().querySelectorAll(".list-card").forEach(card => {
    const id = card.getAttribute("data-id");
    card.querySelectorAll("[data-act]").forEach(btn => {
      btn.addEventListener("click", () => onCardAction(btn.getAttribute("data-act"), id, lists));
    });
  });
}

async function onCardAction(act, id, lists){
  if(act === "play"){
    if(isPlaying(id)){ stopSession(); render(); return; }
    const l = await api.getList(id);
    playList(l, { onActive: () => {}, onStop: () => render() });
    render();
  } else if(act === "edit"){
    editingId = id; render();
  } else if(act === "dup"){
    await api.duplicateList(id); render();
  } else if(act === "del"){
    if(isPlaying(id)) stopSession();
    await api.deleteList(id); render();
  } else if(act === "up" || act === "down"){
    const ids = lists.map(l => l.id);
    const idx = ids.indexOf(id);
    const swap = act === "up" ? idx - 1 : idx + 1;
    if(swap < 0 || swap >= ids.length) return;
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    await api.reorderLists(ids);
    render();
  }
}

// ---------- editor ----------
function renderEditor(l){
  const cap = caps().maxMolecules;
  const full = l.molecules.length >= cap;
  const s = l.settings || {};
  const trackOpts = TRACKS.map((t, i) =>
    '<option value="' + i + '"' + ((s.track | 0) === i ? " selected" : "") + '>' + esc(t.name) + '</option>').join("");

  const items = l.molecules.length
    ? l.molecules.map((m, i) =>
        '<div class="ed-item" data-i="' + i + '">' +
          '<span class="ed-num">' + (i + 1) + '</span>' +
          '<span class="ed-iname">' + esc(m.name) + '</span>' +
          '<button class="ed-move" data-act="up" title="Move up">&#8593;</button>' +
          '<button class="ed-move" data-act="down" title="Move down">&#8595;</button>' +
          '<button class="ed-rm" data-act="rm" title="Remove">&#10005;</button>' +
        '</div>').join("")
    : '<p class="ed-empty">Empty. Search a molecule, then “Add current specimen”.</p>';

  const playing = isPlaying(l.id);

  body().innerHTML =
    '<div class="editor">' +
      '<input class="editor-name" id="edName" value="' + esc(l.name) + '" maxlength="60">' +
      '<div class="ed-items" id="edItems">' + items + '</div>' +
      '<p class="cap-note' + (full ? " full" : "") + '">' + l.molecules.length + ' / ' + cap + ' specimens</p>' +
      '<button class="ctl" id="edAdd"' + (full ? " disabled" : "") + '>&#65291;  Add current specimen</button>' +
      '<div class="pl-opt">' +
        '<label>Seconds each <input type="number" id="edDur" min="3" max="180" value="' + (parseInt(s.secondsEach, 10) || 20) + '"></label>' +
        '<label>Music track <select id="edTrack">' + trackOpts + '</select></label>' +
        '<label><input type="checkbox" id="edVoice"' + (s.voice !== false ? " checked" : "") + '> Gentle voice (announce name)</label>' +
        '<label><input type="checkbox" id="edMusic"' + (s.music !== false ? " checked" : "") + '> Play music track</label>' +
        '<label><input type="checkbox" id="edLoop"' + (s.loop ? " checked" : "") + '> Repeat track when it ends</label>' +
      '</div>' +
      '<div class="ed-actions">' +
        '<button class="ctl primary' + (playing ? " on" : "") + '" id="edPlay">' + (playing ? "&#9632;  Stop" : "&#9654;  Play") + '</button>' +
        '<button class="ctl" id="edBack">&#8592;  Done</button>' +
      '</div>' +
      '<div class="ed-actions" style="margin-top:8px">' +
        '<button class="ctl danger" id="edDelete">Delete list</button>' +
      '</div>' +
    '</div>';

  wireEditor(l);
}

function wireEditor(l){
  const nameEl = document.getElementById("edName");
  nameEl.addEventListener("input", () => api.updateList(l.id, { name: nameEl.value.trim() || "Untitled list" }));

  const saveSettings = () => api.updateList(l.id, { settings: {
    secondsEach: Math.max(3, parseInt(document.getElementById("edDur").value, 10) || 20),
    track: parseInt(document.getElementById("edTrack").value, 10) || 0,
    voice: document.getElementById("edVoice").checked,
    music: document.getElementById("edMusic").checked,
    loop: document.getElementById("edLoop").checked
  }});
  ["edDur","edTrack","edVoice","edMusic","edLoop"].forEach(id =>
    document.getElementById(id).addEventListener("change", saveSettings));

  document.getElementById("edAdd").addEventListener("click", async () => {
    const spec = getCurrentSpecimen();
    if(!spec.name) return;
    const cur = await api.getList(l.id);
    if(!cur) return;
    if(cur.molecules.length >= caps().maxMolecules) return;
    if(cur.molecules.some(m => m.name.toLowerCase() === spec.name.toLowerCase())) return;
    cur.molecules.push({ name: spec.name, source: spec.source, cid: spec.cid });
    await api.updateList(l.id, { molecules: cur.molecules });
    renderEditor(await api.getList(l.id));
  });

  document.getElementById("edItems").querySelectorAll(".ed-item").forEach(row => {
    const i = parseInt(row.getAttribute("data-i"), 10);
    row.querySelectorAll("[data-act]").forEach(btn => {
      btn.addEventListener("click", () => editItem(l.id, i, btn.getAttribute("data-act")));
    });
  });

  document.getElementById("edPlay").addEventListener("click", async () => {
    if(isPlaying(l.id)){ stopSession(); renderEditor(await api.getList(l.id)); return; }
    const cur = await api.getList(l.id);
    playList(cur, { onActive: highlightItem, onStop: () => render() });
    renderEditor(await api.getList(l.id));
  });

  document.getElementById("edBack").addEventListener("click", () => { editingId = null; render(); });

  document.getElementById("edDelete").addEventListener("click", async () => {
    if(isPlaying(l.id)) stopSession();
    await api.deleteList(l.id);
    editingId = null;
    render();
  });
}

async function editItem(listId, i, act){
  const l = await api.getList(listId);
  if(!l) return;
  if(act === "rm"){ l.molecules.splice(i, 1); }
  else if(act === "up" && i > 0){ [l.molecules[i-1], l.molecules[i]] = [l.molecules[i], l.molecules[i-1]]; }
  else if(act === "down" && i < l.molecules.length - 1){ [l.molecules[i+1], l.molecules[i]] = [l.molecules[i], l.molecules[i+1]]; }
  await api.updateList(listId, { molecules: l.molecules });
  renderEditor(await api.getList(listId));
}

function highlightItem(idx){
  const items = document.querySelectorAll("#edItems .ed-item");
  items.forEach((el, i) => el.classList.toggle("playing", i === idx));
}
