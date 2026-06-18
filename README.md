# Molecular Specimen Viewer

A 3D molecule viewer + personalizable "meditation" player. Search any molecule,
spin it in 3D, build named lists, and play them back with a gentle neural voice
and ambient music. Live at **https://molecules.mymumrecipe.com**.

## Stack
- **Frontend**: vanilla HTML/CSS/JS ES modules — no build step. [3Dmol.js](https://3dmol.org) for rendering (CDN).
- **Data**: 40 molecules with pre-computed 3D coordinates in `data/molecules.json`; any other molecule is fetched live from PubChem.
- **Voice**: pre-rendered neural-TTS MP3s (`audio/`, Microsoft edge-tts "Ava", ffmpeg-smoothed); browser speech as fallback.
- **Backend** (Phase 2): [Supabase](https://supabase.com) — Auth (email magic link) + Postgres (named lists, row-level security). Keys in `js/config.js` (publishable/anon key is safe to commit; RLS protects data).
- **Hosting**: GitHub Pages, custom domain via `CNAME`.

## Project layout
```
index.html             app shell
css/styles.css         all styles
js/                    ES modules: config, util, library, viewer, search,
                       voice, session, fullscreen, api, auth, authui, lists, app
data/molecules.json    offline molecule library (SDF + formula/mw/atoms)
audio/                 per-molecule voice MP3s; audio/tracks/ = music tracks
supabase/migrations/   database schema (profiles, lists, tts_usage + RLS)
```

## Local development
```sh
python3 -m http.server 8771
# open http://localhost:8771/index.html
```

## Deploy
Push to `main`; GitHub Pages builds automatically and serves at the `CNAME` domain.

## Roadmap
- ✅ Phase 1 — modular split, immersive fullscreen, multiple named lists (local)
- ✅ Phase 2 — Supabase accounts + cloud-synced lists
- ⏳ Phase 3 — secured cloud TTS so any searched molecule gets the neural voice
- ⏳ Phase 4 — paid tiers (Stripe)
