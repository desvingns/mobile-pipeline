# Third-party assets in this folder

| Path | Source | Licence |
|---|---|---|
| `fonts/unbounded-*.woff2` | @fontsource-variable/unbounded (Unbounded Project Authors) | SIL OFL 1.1 — `fonts/LICENSE-unbounded.txt` |
| `fonts/golos-text-*.woff2` | @fontsource-variable/golos-text (Golos Text Project Authors) | SIL OFL 1.1 — `fonts/LICENSE-golos-text.txt` |
| `fonts/jetbrains-mono-*.woff2` | @fontsource-variable/jetbrains-mono (JetBrains) | SIL OFL 1.1 — `fonts/LICENSE-jetbrains-mono.txt` |
| `vendor/gsap/*.min.js` | gsap 3.14.2 (GreenSock / Webflow) | GSAP Standard "no charge" licence — https://gsap.com/standard-license |
| `sfx/*.wav` | HyperFrames media-use bundled library, originally Pixabay | Pixabay Content License — https://pixabay.com/service/license-summary/ (no attribution required) |
| `music/bed.wav` | Generated for this project with Google Lyria RealTime (or `scripts/synth-music.cjs`) | Project-owned generation; see `music/bed.json` for the source |
| `voice/*.wav` | Generated with Microsoft Edge neural TTS (edge-tts, ru-RU-SvetlanaNeural) | Synthetic narration generated for this project |

All files are copied by `node scripts/vendor-assets.cjs` (fonts, GSAP, SFX); voice and music by the
audio scripts. Nothing is fetched at render time.
