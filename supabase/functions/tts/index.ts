// Secured neural TTS (Microsoft Edge "Ava") for any molecule.
//
// - Auth-gated: rejects requests without a valid Supabase user (401).
// - Rate-limited per user/day (counts only on cache miss).
// - Caches MP3s in the private "tts" Storage bucket, keyed by voice/slug.
// - Returns a short-lived signed URL (never a permanent public URL).
//
// Deploy with --no-verify-jwt: we verify the user in code so CORS preflight
// (OPTIONS) isn't blocked by the platform JWT gate.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VOICE = "en-US-AvaNeural";
const RATE = "-22%";
const PITCH = "+6Hz";
const BUCKET = "tts";
const DAILY_CAP = 300;
const TRUSTED_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const FMT = "audio-24khz-48kbitrate-mono-mp3";
const GEC_VERSION = "1-131.0.2903.112";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function slugify(n: string){
  return n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function json(body: unknown, status = 200){
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function ssml(text: string){
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${VOICE}'><prosody rate='${RATE}' pitch='${PITCH}'>${esc}</prosody></voice></speak>`;
}

// Microsoft requires a Sec-MS-GEC security token (SHA-256 of a 5-min-rounded
// Windows filetime + the trusted token), passed as a query param.
function gecTicks(): string {
  const WIN_EPOCH = 11644473600n;
  let s = BigInt(Math.floor(Date.now() / 1000)) + WIN_EPOCH;
  s = s - (s % 300n);
  return (s * 10000000n).toString();
}
async function secMsGec(): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(gecTicks() + TRUSTED_TOKEN));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join("");
}

// Direct Edge-TTS websocket protocol (native Deno WebSocket — no npm deps).
async function synthesize(text: string): Promise<Uint8Array> {
  const gec = await secMsGec();
  const wssUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
    `?TrustedClientToken=${TRUSTED_TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${GEC_VERSION}`;
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(wssUrl);
    ws.binaryType = "arraybuffer";
    const chunks: Uint8Array[] = [];
    const timer = setTimeout(() => { try { ws.close(); } catch (_e) {} reject(new Error("tts timeout")); }, 20000);

    ws.onopen = () => {
      const ts = new Date().toISOString();
      ws.send(
        `X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"${FMT}"}}}}`
      );
      const id = crypto.randomUUID().replaceAll("-", "");
      ws.send(
        `X-RequestId:${id}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}\r\nPath:ssml\r\n\r\n${ssml(text)}`
      );
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        if (ev.data.includes("Path:turn.end")) {
          clearTimeout(timer);
          try { ws.close(); } catch (_e) {}
          const total = chunks.reduce((a, c) => a + c.length, 0);
          const out = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) { out.set(c, off); off += c.length; }
          resolve(out);
        }
      } else {
        const buf = new Uint8Array(ev.data as ArrayBuffer);
        const headerLen = (buf[0] << 8) | buf[1]; // 2-byte big-endian header length
        const audio = buf.slice(2 + headerLen);
        if (audio.length) chunks.push(audio);
      }
    };

    ws.onerror = () => { clearTimeout(timer); reject(new Error("ws error")); };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // who is calling?
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { name } = await req.json().catch(() => ({}));
    if (!name || typeof name !== "string") return json({ error: "missing name" }, 400);
    const slug = slugify(name).slice(0, 80);
    if (!slug) return json({ error: "bad name" }, 400);

    const admin = createClient(url, service);
    const path = `${VOICE}/${slug}.mp3`;

    // cache check
    const { data: listed } = await admin.storage.from(BUCKET).list(VOICE, { search: `${slug}.mp3`, limit: 1 });
    const hit = !!listed?.find((f) => f.name === `${slug}.mp3`);

    if (!hit) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: usage } = await admin.from("tts_usage")
        .select("count").eq("user_id", user.id).eq("day", today).maybeSingle();
      const count = usage?.count ?? 0;
      if (count >= DAILY_CAP) return json({ error: "daily limit reached" }, 429);

      const audio = await synthesize(name);
      if (!audio.length) return json({ error: "synthesis failed" }, 502);

      const { error: upErr } = await admin.storage.from(BUCKET)
        .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
      if (upErr) return json({ error: "storage: " + upErr.message }, 500);

      await admin.from("tts_usage")
        .upsert({ user_id: user.id, day: today, count: count + 1 }, { onConflict: "user_id,day" });
    }

    const { data: signed, error: sErr } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (sErr) return json({ error: "sign: " + sErr.message }, 500);
    return json({ url: signed.signedUrl, cached: hit });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
