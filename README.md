# Anaru 📺 — Learn Japanese by watching anime

Free, offline, no-account Japanese learning app that turns anime scenes into
bite-sized lessons. Cross-platform: Web/PWA, Android, iOS, Windows, macOS, Linux.

- Vertical feed of short anime clips with subtitles
- Furigana on every kanji (kuromoji tokenizer + IPA dictionary)
- Five subtitle modes: romaji → Japanese+romaji → Japanese → Japanese+English → video only
- Tap any word → dictionary lookup (JMdict) → save it
- FSRS spaced-repetition review deck with the source scene on each card
- Series library with spoiler protection (hide shows you haven't watched)
- Listening cards, stats, streaks, daily goals
- Content packs: load remote libraries from any URL, or import your own files

## 🛠️ Stack

React 18 + TypeScript + Vite · Dexie/IndexedDB (data) · OPFS (media) ·
kuromoji (tokenization) · JMdict (dictionary) · ts-fsrs (SRS) · PWA (offline)

## ⬇️ Download & install

Prebuilt bundles are published to GitHub Releases on every `v*` tag
(Linux .deb/.rpm/.AppImage, macOS .dmg, Android APK — built by GitHub
Actions). One-line install:

```bash
curl -fsSL https://raw.githubusercontent.com/Mirakelor/Anaru/main/install.sh | bash
# Linux: installs the AppImage to ~/.local/bin/anaru
# macOS: installs Anaru.app into /Applications
# Options: --deb (apt), --version <tag>
```

Or grab a bundle manually from the Releases page:
- Linux: `Anaru_<ver>_amd64.deb` / `.rpm` / `.AppImage`
- macOS: `Anaru_<ver>_aarch64.dmg` (or `amd64.dmg`)
- Android: `app-debug.apk` (debug-signed, sideload-installable)

Web/PWA: deploy and open in any browser — installable from the address bar.

## 🚀 Quickstart

```bash
npm install
npm run dict:build   # builds public/dict-data.json from data/raw (see data sources)
npm run dev          # http://localhost:5173
npm test             # unit tests (vitest)
npx playwright test  # E2E: onboarding → import → feed → word → review → stats
npm run build        # production build + PWA service worker
npm run preview      # serve the production build
```

## 📦 Content

### Importing your own files (in-app wizard)

Library → Add series accepts, per episode:

| Input | Requirement |
|---|---|
| Video | one file per episode, `mp4`/`webm` preferred (H.264+AAC for best compatibility); any common container is parsed, but the browser must be able to decode it |
| Japanese subtitles | `srt`/`ass`/`ssa`, UTF-8, required — this is what drives clip cutting, furigana and word taps |
| Translation subtitles | `srt`/`ass`, optional — matched to Japanese cues by start time (±0.05 s) to power the bilingual subtitle mode |

The wizard takes one series name, then one video + subtitle set per episode.
Files are copied into the device's private storage (OPFS); nothing is uploaded.

### Bilingual mode (Japanese + English)

The subtitle mode "Japanese + English" shows the Japanese line with furigana
plus the English translation underneath. It lights up automatically whenever
an episode has a **translation subtitle track**; without one, that mode simply
shows Japanese only. Nothing else needs configuring.

How to provide the English track:

- **In-app wizard** (Library → Add series): the third file picker per episode
  is "English subtitles (optional)". Pick a `.srt`/`.ass` file whose timing
  matches the Japanese one.
- **Content packs**: add a `translation` entry per episode in the manifest
  (or place `e01.en.srt` next to `e01.ja.srt` — the pack builder wires it
  automatically):
  ```json
  { "index": 1, "video": "…", "subtitle": "…", "translation": "…" }
  ```
- Translation cues are matched to Japanese cues by start time (±0.05 s), so
  both files should share the same timeline (WebRip subtitles with WebRip
  video, BDRip with BDRip).

### 📦 Content packs and the default source

The Frieren (葬送のフリーレン) starter pack is served through the
Cloudflare CDN at `https://bb.sonder.eu.org/manifest.json` (Backblaze B2
origin + Bandwidth Alliance — B2 download fees are zero) and auto-imported
after onboarding via `DEFAULT_PACK_URL` in `src/lib/config.ts`. Any
additional packs you host (B2, R2, NAS, any static server with Range + CORS)
can be loaded via Library → Load pack.

1. **Import your own files** (Library → Add series): pick video + Japanese
   subtitle (SRT/ASS) + optional translation subtitle. The app cuts the video
   into short dialogue clips locally. Files stay in your device's private
   storage.
2. **Content packs** (Library → Load pack): host a pack anywhere (NAS, object
   storage, any static server) and paste its `manifest.json` URL. Pack format:

   ```json
   {
     "version": 1,
     "series": [
       {
         "slug": "my-show",
         "title": "My Show",
         "poster": "my-show/poster.jpg",
         "episodes": [
           {
             "index": 1,
             "title": "Episode 1",
             "video": "my-show/e01.mp4",
             "subtitle": "my-show/e01.ja.srt",
             "translation": "my-show/e01.en.srt"
           }
         ]
       }
     ]
   }
   ```

3. **Build a pack from your own files**:

   ```bash
   node tools/pack/build-pack.mjs ./packs/my-show ./out/packs/my-show --base-url https://example.com/packs/my-show
   ```

   Input layout (one folder per series):

   ```
   packs/<series>/e01.mp4        video (mp4/webm; --transcode converts others to h264)
   packs/<series>/e01.ja.srt     Japanese subtitles (required)
   packs/<series>/e01.en.srt     translation (optional)
   packs/<series>/meta.json      optional {"title": "...", "poster": "poster.jpg"}
   ```

   Test locally: `node tools/pack/serve.mjs ./out/my-show 8090` → in the app,
   Library → Load pack → `http://localhost:8090/manifest.json`. The built-in
   server handles Range seeking and CORS, which plain `python -m http.server`
   does not. See `tools/pack/README.md` for hosting notes and size guidance
   (the app streams clips by byte range — whole episodes are never
   downloaded).

Naru (the app we mirror) hosts its own clip library; Anaru's library comes from you — anything you can get video + Japanese subtitles for becomes a feed.
Anything you can get video + Japanese subtitles for becomes a feed.

## App icon

The single source is `site/icon.png` (your design, 1024×1024 preferred).
Regenerate every size (PWA 192/512 + maskable, favicon, Tauri ico/icns/png)
with:

```bash
npm run icons:build
```

## 💾 Data storage

Everything is stored **on your device, locally** — nothing is uploaded:

| What | Where |
|---|---|
| Settings, library, subtitles, saved words, review history | IndexedDB (database `anaru`) |
| Imported video files | OPFS private storage (`anaru-media/`) |
| Cached dictionary + tokenizer | Service worker cache (offline) |

- No account, no sync, no telemetry. Each device keeps its own data.
- **Web/PWA, desktop (Tauri) and mobile (Capacitor) are the same app** — any
  of them works standalone; data just does not roam between devices yet.
- Wipe everything: Settings → Erase all data (clears IndexedDB + media).

## ⚖️ Legal posture

Anaru is an educational tool. It plays **short excerpts** of media you provide
or point it at, annotated with furigana/romaji/translations for language
instruction. This is intended to qualify as fair use / fair dealing
(17 U.S.C. § 107 and comparable provisions): transformative educational
purpose, short length, non-commercial, no market substitution. The App itself
hosts no media. Rights remain with the respective rights-holders; the Terms of
Service include a takedown contact. You are responsible for the media you
import and the packs you distribute.

## 📚 Data sources

- **Dictionary**: [JMdict](https://www.edrdg.org/jmdict/jmdictdb.html)
  (EDICT/JMdict, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)),
  packaged via [jmdict-simplified](https://github.com/scriptin/jmdict-simplified).
  `data/raw/jmdict-eng-common.json` → `node scripts/build-dictionary.mjs` →
  `public/dict-data.json` (22k common entries + JLPT tags).
- **JLPT levels**: [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks)
  CSVs (`data/raw/jlpt-n*.csv`).
- **Tokenization**: [kuromoji](https://github.com/takuyaa/kuromoji.js)
  (Apache-2.0) with the IPA dictionary; browser build is aliased in
  `vite.config.ts` because the Node loader imports `fs`/`path`.
- **SRS**: [ts-fsrs](https://github.com/ts-fsrs/ts-fsrs) (MIT).

## 🌐 Deployment

### Web / PWA

`npm run build` → `dist/`. Serve with any static host (HTTPS required for the
service worker on most platforms).

Deployment constants live in `src/lib/config.ts`: `APP_DOMAIN`,
`CONTACT_EMAIL` (used by the marketing site) and `DEFAULT_PACK_URL` — the
content pack loaded automatically after onboarding (set it to your deployed
pack, e.g. `https://anaru.sonder.eu.org/packs/manifest.json`).

> **Important**: the tokenizer fetches the dictionary from `/dict/*.dat.gz`.
> If your host auto-serves `.gz` files with `Content-Encoding: gzip`
> (many do), the browser will decompress them and the tokenizer will fail.
> Configure your host to serve `/dict/*` as-is (`Accept-Encoding` agnostic,
> no `Content-Encoding` header). `vite preview` and the dev server already do
> this via the `dict-no-encoding` middleware.

Recommended layout: marketing site at the root, app under `/app/`:

```
/site            marketing site (index, /learn/*, privacy, terms)
/dist            app build → deploy to /app/
```

Site build: `node tools/site/build-learn.mjs` (generates `site/learn/*`).
Canonical URLs in the generated pages already point at `anaru.sonder.eu.org`
(edit `tools/site/build-learn.mjs` and re-run `npm run site:build` if the
domain changes).

### Android / iOS (Capacitor)

```bash
npm run build
npx cap sync
npx cap open android   # or: npx cap open ios
```

Requirements: Android Studio (or Xcode). No plugins are needed; the app uses
only web APIs (IndexedDB, OPFS, media elements).

### Desktop (Tauri 2)

```bash
cd src-tauri && cargo build --release   # Linux/macOS/Windows
```

Linux prerequisites (Debian/Ubuntu):

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

The Tauri window embeds the same web app (480×900 default, phone-like).

## 🧪 Testing

- `npm test` — 46 unit tests: kana→romaji, furigana alignment, SRT/ASS
  parsing, clip segmentation, tokenizer, dictionary lookup, FSRS scheduling,
  Dexie persistence, content-pack ingestion.
- `npx playwright test` — E2E (1 retry for first-run slowness): onboarding →
  import wizard (real files) → feed playback → tap word → dictionary sheet →
  save → review → stats, plus pack error handling.
- Offline check (manual): build, `npm run preview`, load the app once, wait
  for the service worker, reload, then cut the network — the shell and the
  dictionary keep working from cache.
- Pack pipeline check: `node tools/pack/build-pack.mjs` + `serve.mjs`, then
  load the manifest URL in the app and watch the feed.

## App Store & Google Play publishing

CI (`push v*` tag) already produces signed artifacts when the repo secrets
below are set; without them it falls back to unsigned/debug builds.

### Google Play

Set these repo secrets, then push a `v*` tag:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | base64 of your release keystore (`keytool -genkeypair -v -keystore anaru-release.jks -alias anaru -keyalg RSA -keysize 2048 -validity 10000`) |
| `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_PASSWORD` | keystore / key passwords |
| `ANDROID_KEY_ALIAS` | key alias |

The release job builds a signed `app-release.aab` (Play Console upload) and
`app-release.apk`. You still need: a Play Console developer account ($25),
store listing assets (screenshots, description, privacy policy URL after the
Vercel deploy), and the app signing key configured in Play Console (upload
key = the keystore above).

### App Store (iOS)

Set these repo secrets:

| Secret | Value |
|---|---|
| `APPLE_CERT_P12` | base64 of your distribution certificate `.p12` |
| `APPLE_CERT_PASSWORD` | p12 password |
| `APPLE_PROVISIONING_PROFILE` | base64 of the App Store provisioning profile (`.mobileprovision`) |
| `APPLE_TEAM_ID` | your Team ID |

The iOS job archives and exports an app-store `.ipa`. You still need: an
Apple Developer account ($99/year), the App Store Connect app record,
privacy policy URL, and screenshots.

### Windows

Bundles are unsigned (SmartScreen may warn). Store publishing is not planned;
distribute the `.msi`/`.exe` from Releases directly.

## 🗂️ Project layout

```
src/            app
  components/   feed player, word sheet, pack modal, import wizard
  lib/          db (IndexedDB+OPFS), nlp (kuromoji/romaji/furigana),
                dict (JMdict lookup), srs (FSRS), subtitles (parse/segment),
                import (episodes/packs)
  pages/        feed, library, review, words, stats, settings, onboarding
site/           marketing site (static HTML/CSS/JS + generated /learn/*), icon.png source
tools/          pack builder + pack server, site word-page generator, icon builder
e2e/            Playwright tests + fixtures
src-tauri/      Tauri 2 desktop shell
android/ ios/   Capacitor platform projects
data/raw/       dictionary sources (JMdict, JLPT CSVs) — not committed
```
