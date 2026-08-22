# Anaru 📺 — Learn Japanese by watching anime

Free, offline, no-account Japanese learning app that turns anime scenes into
bite-sized lessons. Cross-platform: Web/PWA, Android, iOS, Windows, macOS, Linux.

- Vertical feed of short anime clips with subtitles
- Furigana on every kanji
- Five subtitle modes: romaji → Japanese+romaji → Japanese → Japanese+English → video only
- Tap any word → dictionary lookup → save it
- FSRS spaced-repetition review deck with the source scene on each card
- Series library with spoiler protection (hide shows you haven't watched)
- Listening cards, stats, streaks, daily goals
- Content packs: load remote libraries from any URL, or import your own files

## ⬇️ Download & install

Prebuilt bundles are published to GitHub Releases on every `v*` tag
(Linux .deb/.rpm/.AppImage, macOS .dmg, Windows .msi/.exe, Android APK).
One-line install:

```bash
curl -fsSL https://raw.githubusercontent.com/Mirakelor/Anaru/main/install.sh | bash
# Linux: installs the AppImage to ~/.local/bin/anaru + start-menu shortcut
# macOS: installs Anaru.app into /Applications
# Options: --deb (apt), --version <tag>
```

Or grab a bundle manually from the Releases page:
- Linux: `Anaru_<ver>_amd64.deb` / `.rpm` / `.AppImage`
- macOS: `Anaru_<ver>_aarch64.dmg` (or `amd64.dmg`)
- Windows: `Anaru_<ver>_x64-setup.exe` / `.msi`
- Android: `app-debug.apk` (sideload-installable)

Web/PWA: open the site in any browser and install it from the address bar.

## 🚀 Getting started

After first launch you are offered a starter pack — an anime library that
loads directly into your feed, no setup needed. Everything happens on your
device; no account required.

### Adding your own content (in-app wizard)

Library → Add series accepts, per episode:

| Input | Requirement |
|---|---|
| Video | one file per episode, `mp4`/`webm` preferred (H.264+AAC for best compatibility); any common container is parsed, but the browser must be able to decode it |
| Japanese subtitles | `srt`/`ass`/`ssa`, UTF-8, required — this is what drives clip cutting, furigana and word taps |
| Translation subtitles | `srt`/`ass`, optional — matched to Japanese cues by start time (±0.05 s) to power the bilingual subtitle mode |

The wizard takes one series name, then one video + subtitle set per episode.
Files are copied into the device's private storage; nothing is uploaded.

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

### Content packs

A pack is a folder of episodes plus a `manifest.json` describing them, hosted
on any static server. Load one in the app via Library → Load pack.

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

Build a pack from your own files:

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

Your content source is anything you can get video + Japanese subtitles for.

## 💾 Privacy & data

Everything is stored **on your device, locally** — nothing is uploaded:

| What | Where |
|---|---|
| Settings, library, subtitles, saved words, review history | IndexedDB (database `anaru`) |
| Imported video files | OPFS private storage (`anaru-media/`) |
| Cached dictionary + tokenizer | Service worker cache (offline) |

- No account, no sync, no telemetry. Each device keeps its own data.
- **Web/PWA, desktop and mobile are the same app** — any of them works
  standalone; data just does not roam between devices yet.
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

## 🔧 Development

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build for the web (/app/ base, Vercel layout)
npm run build:app    # production build for desktop/mobile (relative asset paths)
npm test             # unit tests
npx playwright test  # E2E: onboarding → import → feed → word → review → stats
```

Desktop (Tauri 2): `cd src-tauri && npx tauri build` (Linux prerequisites:
`libwebkit2gtk-4.1-dev`, `librsvg2-dev`, `libayatana-appindicator3-dev`, …).
Mobile (Capacitor): `npx cap sync android|ios` then build with Android
Studio / Xcode.

Web deployment: serve the marketing site at the root and the app build under
`/app/` (`node tools/deploy/build-vercel.mjs` produces exactly this layout).
Deployment constants live in `src/lib/config.ts` — `APP_DOMAIN`,
`CONTACT_EMAIL`, and `DEFAULT_PACK_URL` (the pack auto-imported after
onboarding).

> **Note for hosts of `/app/`**: the tokenizer fetches its dictionary from
> `/dict/*.dat.gz`. If your host auto-serves `.gz` files with
> `Content-Encoding: gzip`, the browser decompresses them and the tokenizer
> fails. Serve `/dict/*` as-is (`vite preview` and the dev server already do
> via the `dict-no-encoding` middleware).

## 📚 Data sources

- **Dictionary**: [JMdict](https://www.edrdg.org/jmdict/jmdictdb.html)
  (EDICT/JMdict, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)),
  packaged via [jmdict-simplified](https://github.com/scriptin/jmdict-simplified)
  (~22k common entries + JLPT tags).
- **JLPT levels**: [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks)
  CSVs (`data/raw/jlpt-n*.csv`).
- **Tokenization**: [kuromoji](https://github.com/takuyaa/kuromoji.js)
  (Apache-2.0) with the IPA dictionary.
- **SRS**: [ts-fsrs](https://github.com/ts-fsrs/ts-fsrs) (MIT).

## 📱 Store publishing

Pushing a `v*` tag builds signed store artifacts automatically when the repo
secrets are set, otherwise it falls back to debug builds.

- **Google Play**: secrets `ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`
  → signed `app-release.aab` + `app-release.apk`.
- **App Store**: secrets `APPLE_CERT_P12`, `APPLE_CERT_PASSWORD`,
  `APPLE_PROVISIONING_PROFILE`, `APPLE_TEAM_ID` → app-store `.ipa`.
- **Windows**: bundles are unsigned (SmartScreen may warn); distributed from
  Releases, not the Store.

You still need the store accounts (Play Console $25 one-time, Apple Developer
$99/year), store listings and screenshots.

## 🗂️ Project layout

```
src/            app
  components/   feed player, word sheet, pack modal, import wizard
  lib/          db (IndexedDB+OPFS), nlp (kuromoji/romaji/furigana),
                dict (JMdict lookup), srs (FSRS), subtitles (parse/segment),
                import (episodes/packs)
  pages/        feed, library, review, words, stats, settings, onboarding
site/           marketing site (static HTML/CSS/JS + generated /learn/*)
tools/          pack builder + pack server, site generator, deploy script
e2e/            Playwright tests + fixtures
src-tauri/      Tauri 2 desktop shell
android/ ios/   Capacitor platform projects
data/raw/       dictionary sources (JMdict, JLPT CSVs) — not committed
```
