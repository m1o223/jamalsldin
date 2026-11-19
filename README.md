# Jamal aldin

Static Arabic RTL design prototype. No backend, authentication, server database, or credential collection. Provider logos and other illustrations are inline SVG; the current interface requires no external images, fonts, or runtime network requests.

## Local development

- `npm ci --ignore-scripts`
- `npm start` — http://localhost:4173
- `npm run check`
- `npm test` — Quran, prayer and local chat/voice/navigation checks
- `npm run build` — copies the public interface into `dist/`

On Windows PowerShell with script execution restricted, use `npm.cmd` in place of `npm`.

## Hosting

GitHub source: https://github.com/m1o223/jamalsldin
Production branch: `main`.
Vercel project: `jamal-aldin`, team `m1o223s-projects`.
Stable production domain: https://jamal-aldin.vercel.app
Vercel uses framework Other, repository root, build command `npm run check && npm run build`, output directory `dist`, and the committed lockfile.

Direct routes: `/home`, `/quran`, `/prayer`, `/ai`, `/profile`, `/settings`. Hash routes such as `/#home` also work. The start screen remains at `/`. The account state currently stays guest, including after preview Continue. Settings are available to guests; the account/profile route opens the existing entry screen until verified authentication is integrated.

The build intentionally publishes only `index.html`, `style.css`, `script.js`, `quran.js`, `quran-data.js`, `prayer.js`, `prayer-data.js`, `chat-core.js`, `chat.js`, `preferences.js`, `settings.js`, and `settings.css`. Earlier unrelated pages, image placeholders, local backups, environment files, caches, and deployment credentials are excluded. No environment variables are required.

The Quran section uses a bundled 114-surah metadata index, local name/number search, and preliminary reader/bookmark/learning views. It contains no verse text or runtime API integration. Data provenance and attribution are in [QURAN_SOURCES.md](QURAN_SOURCES.md).

Prayer tracking stores only the five selected prayer keys under `jamal-aldin:prayers:YYYY-MM-DD` in localStorage, using the device's local calendar date. The page refreshes at local midnight and on returning to the app. This is device-only tracking; it does not imply authentication. Home and prayer pages share the display-only fixture in `prayer-data.js`.

Qibla remains a placeholder. Contextual learning uses the same Jamal chat section with `#ai?topic=wudu` or `#ai?topic=salah`, prefills a draft without sending it, and preserves the prayer page position when returning. No prompt is sent anywhere. Tutorial video buttons remain disabled pending full video review; sources and verification limits are documented in [PRAYER_VIDEO_CANDIDATES.md](PRAYER_VIDEO_CANDIDATES.md).

## Local Jamal chat

The chat hides the bottom navigation and returns to its in-app origin. It has no AI provider, generated replies, backend, uploads or transcription. Its status explicitly says AI is not connected. Text/attachment/audio messages are retained on this browser/device in IndexedDB (`jamal-local-chat`, stores `threads` and `meta`), including Blob objects. New chats preserve previous messages. Unsent drafts stay in memory, not on a server. If browser storage fails, a visible notice explains the session-only fallback. Browser/site-data clearing removes saved conversations; no account sync is present.

Files are previewed locally (up to five attachments, 20 MiB per selected file, 30 MiB combined). Voice capture starts only from an explicit mic-button gesture, chooses a supported MediaRecorder MIME type, stops all tracks after Stop/Cancel/navigation/page hiding, and guards against a late permission result. Recording is capped at five minutes, then requires preview and explicit Send. Object URLs are revoked when previews/messages are rebuilt. CSP permits only same-origin and local Blob image/media sources, with all network connections still disabled.

The composer uses a contained grid, safe-area padding and VisualViewport resize/scroll events to follow the visible mobile viewport. Automated tests cover the viewport update logic and mocked recording lifecycles. No browser or Safari device is connected in this environment, so actual iPhone keyboard, microphone permission/playback and visual layout still need device review. API references: [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static), [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB).

The white composer starts as a 60px capsule. Focusing its RTL, 16px textarea expands it to about 120px before typing; the fixed control row stays below the text. An invisible, same-font measure tracks wrapping without resetting the animated textarea height. Drafts retain the expanded state after blur; empty unfocused fields collapse, while focused sends remain expanded. Growth is capped for the visible viewport and then scrolls internally. The 220ms shape transition is disabled with reduced motion. Safari and installed iPhone home-screen mode still require physical-device review.

## Future updates

Settings store validated preferences under `jamal-aldin:preferences:v1`. Theme (light/dark/device) and UI font size apply across the site; verse size is an independent pixel-based variable and is previewed without introducing verse text. Arabic is the only enabled language. The prayer-time format applies to both fixture cards, while city/country/method remain preferences and never imply calculated times. Method labels reference https://aladhan.com/calculation-methods ; no API is called. Notification preferences do not schedule or request notifications. Location, accounts, payment/Premium, reciters and playback remain unavailable, with explicit statuses. Legacy contact/privacy/about files belong to an unrelated earlier project and are not published or linked as Jamal aldin documents.

When chat saving is disabled, no new thread/active-thread metadata is written. Messages added to an existing saved thread while disabled remain session-only and are filtered from later persistent snapshots, even after saving is reenabled. A thread created while disabled stays temporary for its session; begin a new conversation to save after reenabling. Existing saved history remains readable and untouched. Confirmed history clearing flushes this session's writes, clears only the chat IndexedDB stores, and drops in-memory chat/draft/Blob URL references. Preference reset removes only the preference key; it preserves prayer tracking, chat history and unrelated browser data. Both actions require confirmation. Storage failures are reported without claiming deletion or persistence succeeded.

Keep this repository and its linked Vercel project. Review each requested change, commit and push it to `main`, then verify that Vercel deployed that exact commit successfully to the existing production domain. Do not report a deployment as complete until it is READY and its public HTTPS URL is checked without authentication.
