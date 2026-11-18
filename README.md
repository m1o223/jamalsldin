# Jamal aldin

Static Arabic RTL design prototype. No backend, authentication, database, or credential collection. Provider logos and other illustrations are inline SVG; the current interface requires no external images, fonts, or runtime network requests.

## Local development

- `npm ci --ignore-scripts`
- `npm start` — http://localhost:4173
- `npm run check`
- `npm test` — Quran navigation/search and daily prayer tracking/navigation checks
- `npm run build` — copies the public interface into `dist/`

On Windows PowerShell with script execution restricted, use `npm.cmd` in place of `npm`.

## Hosting

GitHub source: https://github.com/m1o223/jamalsldin
Production branch: `main`.
Vercel project: `jamal-aldin`, team `m1o223s-projects`.
Stable production domain: https://jamal-aldin.vercel.app
Vercel uses framework Other, repository root, build command `npm run check && npm run build`, output directory `dist`, and the committed lockfile.

Direct routes: `/home`, `/quran`, `/prayer`, `/ai`, `/profile`, `/settings`. Hash routes such as `/#home` also work. The start screen remains at `/`. The account state currently stays guest, including after preview Continue; profile/settings open the existing entry screen until a verified authentication source is integrated.

The build intentionally publishes only `index.html`, `style.css`, `script.js`, `quran.js`, `quran-data.js`, `prayer.js`, and `prayer-data.js`. Earlier unrelated pages, image placeholders, local backups, environment files, caches, and deployment credentials are excluded. No environment variables are required.

The Quran section uses a bundled 114-surah metadata index, local name/number search, and preliminary reader/bookmark/learning views. It contains no verse text or runtime API integration. Data provenance and attribution are in [QURAN_SOURCES.md](QURAN_SOURCES.md).

Prayer tracking stores only the five selected prayer keys under `jamal-aldin:prayers:YYYY-MM-DD` in localStorage, using the device's local calendar date. The page refreshes at local midnight and on returning to the app. This is device-only tracking; it does not imply authentication. Home and prayer pages share the display-only fixture in `prayer-data.js`.

Qibla and contextual AI learning are placeholders. AI learning uses the same `/ai` section with `#ai?topic=wudu` or `#ai?topic=salah` and preserves the prayer page position when returning. No prompt is sent anywhere. Tutorial video buttons remain disabled pending full video review; sources and verification limits are documented in [PRAYER_VIDEO_CANDIDATES.md](PRAYER_VIDEO_CANDIDATES.md).

## Future updates

Keep this repository and its linked Vercel project. Review each requested change, commit and push it to `main`, then verify that Vercel deployed that exact commit successfully to the existing production domain. Do not report a deployment as complete until it is READY and its public HTTPS URL is checked without authentication.
