// Playback engine. Plays a saved list: cycles its molecules (looping as many
// times as needed) while the chosen music track runs; the track's natural end
// stops the session. The token pattern cancels a stale run when the user stops
// or switches lists — preserve it exactly.

import { loadByName } from "./search.js";
import { speak, startMusic, stopMusic, stopAnnounce } from "./voice.js";
import { sleep } from "./util.js";
import { TRACKS } from "./config.js";

export const plState = { playing: false, token: 0, listId: null };

let _onActive = null, _onStop = null;

export function stopSession(){
  const wasPlaying = plState.playing;
  plState.playing = false;
  plState.token++;
  plState.listId = null;
  if("speechSynthesis" in window) speechSynthesis.cancel();
  stopAnnounce();
  stopMusic();
  const cb = _onStop;
  _onActive = null;
  _onStop = null;
  if(wasPlaying && cb) cb();
}

export function isPlaying(listId){
  return plState.playing && (listId === undefined || plState.listId === listId);
}

// list = { id, molecules:[{name,...}|string], settings:{secondsEach,voice,music,track,loop} }
export function playList(list, hooks){
  if(plState.playing) stopSession();
  if(!list || !Array.isArray(list.molecules) || !list.molecules.length) return;

  plState.playing = true;
  plState.token++;
  plState.listId = list.id || null;
  _onActive = hooks && hooks.onActive;
  _onStop = hooks && hooks.onStop;

  const s = Object.assign({ secondsEach: 20, voice: true, music: true, track: 0, loop: false }, list.settings || {});

  if(s.music){
    const t = TRACKS[(s.track | 0)] || TRACKS[0];
    startMusic({ file: t && t.file, loop: !!s.loop, onEnded: () => stopSession() });
  }
  runSession(list.molecules, s);
}

async function runSession(molecules, s){
  const myToken = plState.token;
  const musicOn = !!s.music, loop = !!s.loop;
  const secs = Math.max(3, parseInt(s.secondsEach, 10) || 20);
  let i = 0;
  do {
    if(myToken !== plState.token) return;
    const item = molecules[i % molecules.length];
    const name = (typeof item === "string") ? item : item.name;
    if(_onActive) _onActive(i % molecules.length);
    loadByName(name);
    if(s.voice){
      await sleep(700);
      if(myToken !== plState.token) return;
      speak(name);
    }
    await sleep(secs * 1000);
    if(myToken !== plState.token) return;
    i++;
    // No music and no repeat → stop after one full pass through the list.
    if(!musicOn && !loop && i >= molecules.length) break;
  } while(myToken === plState.token);
  if(myToken === plState.token) stopSession();
}
