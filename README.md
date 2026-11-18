# Jamal aldin

Static Arabic RTL design prototype. No backend, authentication, database, or credential collection. Provider logos and other illustrations are inline SVG; the current interface requires no external images, fonts, or runtime network requests.

## Local development

- `npm ci --ignore-scripts`
- `npm start` — http://localhost:4173
- `npm run check`
- `npm run build` — copies the public interface into `dist/`

On Windows PowerShell with script execution restricted, use `npm.cmd` in place of `npm`.

## Hosting

GitHub source: https://github.com/m1o223/jamalsldin
Production branch: `main`.
Vercel uses framework Other, repository root, build command `npm run check && npm run build`, output directory `dist`, and the committed lockfile.

Direct routes: `/home`, `/quran`, `/prayer`, `/profile`, `/settings`. Hash routes such as `/#home` also work. The start screen remains at `/`.

The build intentionally publishes only `index.html`, `style.css`, and `script.js`. Earlier unrelated pages, image placeholders, local backups, environment files, caches, and deployment credentials are excluded. No environment variables are required.

## Future updates

Keep this repository and its linked Vercel project. Review each requested change, commit and push it to `main`, then verify that Vercel deployed that exact commit successfully to the existing production domain. Do not report a deployment as complete until it is READY and its public HTTPS URL is checked without authentication.
