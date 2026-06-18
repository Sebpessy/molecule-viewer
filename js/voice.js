// Voice announcements (pre-rendered neural MP3 for library molecules, browser
// SpeechSynthesis fallback for the rest) and background music with ducking.
//
// Phase 3 will add a secured cloud-TTS path here so searched molecules also get
// the Ava neural voice (see ttsUrlFor stub below).

import { libKey } from "./library.js";
import { slugify } from "./util.js";

// ---- voice selection (browser fallback) ----
let chosenVoice = null;
function loadVoices(){
  if(!("speechSynthesis" in window)) return;
  const vs = speechSynthesis.getVoices();
  if(!vs.length) return;
  const prefer = ["Ava (Premium)","Allison (Premium)","Serena (Premium)","Zoe (Premium)",
                  "Ava","Allison","Serena","Samantha","Karen","Moira","Tessa","Fiona",
                  "Google UK English Female","Microsoft Zira - English (United States)",
                  "Microsoft Zira","Victoria","Google US English"];
  for(const p of prefer){ const v = vs.find(v => v.name === p); if(v){ chosenVoice = v; return; } }
  chosenVoice = vs.find(v => /en/i.test(v.lang) &&
      /female|samantha|zira|victoria|karen|fiona|tessa|moira|serena|ava/i.test(v.name))
    || vs.find(v => /^en/i.test(v.lang)) || vs[0];
}
if("speechSynthesis" in window){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

// Pre-rendered neural MP3 exists only for local library specimens (Phase 1).
export function audioFileFor(name){
  const key = libKey(name);
  return key ? ("audio/" + slugify(key) + ".mp3") : null;
}

// Phase 3 hook: return a signed cloud-TTS URL for any molecule (auth-gated).
// Stubbed to null for now so non-library molecules fall back to the browser voice.
async function ttsUrlFor(/* name */){ return null; }

let announceAudio = null, webSpeakTimer = null;
export function stopAnnounce(){
  if(webSpeakTimer){ clearTimeout(webSpeakTimer); webSpeakTimer = null; }
  if(announceAudio){ try{ announceAudio.pause(); }catch(e){} announceAudio = null; }
}

function webSpeak(text){
  if(!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  duckMusic(true); // duck immediately — Chrome's onstart event is unreliable
  const u = new SpeechSynthesisUtterance(text);
  if(chosenVoice) u.voice = chosenVoice;
  u.rate = 0.62; u.pitch = 1.18; u.volume = 1;
  const restore = () => { if(webSpeakTimer){ clearTimeout(webSpeakTimer); webSpeakTimer = null; } duckMusic(false); };
  u.onend = restore;
  u.onerror = restore;
  webSpeakTimer = setTimeout(restore, Math.min(12000, 1800 + text.length * 130));
  setTimeout(() => { try{ speechSynthesis.speak(u); }catch(e){ restore(); } }, 60);
}

function playAnnounce(src, name){
  duckMusic(true);
  announceAudio = new Audio(src);
  announceAudio.volume = 1;
  announceAudio.onended = () => duckMusic(false);
  announceAudio.onerror = () => { duckMusic(false); webSpeak(name); };
  announceAudio.play().catch(() => webSpeak(name));
}

export function speak(name){
  if("speechSynthesis" in window) speechSynthesis.cancel();
  stopAnnounce();
  const file = audioFileFor(name);
  if(file){ playAnnounce(file, name); return; }
  // Phase 3: try the secured cloud TTS before falling back to the browser voice.
  ttsUrlFor(name).then(url => {
    if(url){ playAnnounce(url, name); } else { webSpeak(name); }
  }).catch(() => webSpeak(name));
}

// ---- background music ----
const MUSIC_VOL = 0.6, MUSIC_DUCK = 0.2;
let musicAudio = null;

function fadeTo(audio, target, ms){
  if(!audio) return;
  const steps = 14, start = audio.volume, dt = Math.max(10, ms / steps);
  let n = 0;
  const id = setInterval(() => {
    n++;
    const v = start + (target - start) * (n / steps);
    try{ audio.volume = Math.max(0, Math.min(1, v)); }catch(e){}
    if(n >= steps || !musicAudio) clearInterval(id);
  }, dt);
}
export function duckMusic(on){ if(musicAudio) fadeTo(musicAudio, on ? MUSIC_DUCK : MUSIC_VOL, 350); }

// onEnded fires only when the track plays through naturally (not when looping).
export function startMusic({ file, loop, onEnded } = {}){
  stopMusic();
  if(!file) return;
  musicAudio = new Audio(file);
  musicAudio.loop = !!loop;
  musicAudio.volume = MUSIC_VOL;
  musicAudio.onended = () => { if(musicAudio && !musicAudio.loop && onEnded) onEnded(); };
  musicAudio.play().catch(() => {});
}
export function stopMusic(){
  if(!musicAudio) return;
  try{ musicAudio.onended = null; musicAudio.pause(); }catch(e){}
  musicAudio = null;
}
