# Project instructions

- Work in the existing Jamal aldin project and preserve its agreed visual design and frontend-only scope.
- Source repository: https://github.com/m1o223/jamalsldin
- Production branch: main.
- Vercel project: jamal-aldin (prj_jYbccItqbOL0tblEfyfTnBvtms8G).
- Vercel team: m1o223s-projects (team_mfOHRYQ4bak6cVLBzf5HPtcJ).
- Stable production domain: jamal-aldin-m1o223s-projects.vercel.app.
- The connected MCP token may not see this project; the user authorized the Vercel CLI account for the explicit team above. Use that CLI fallback with the same IDs rather than creating a duplicate project.
- Keep JSON and source files UTF-8 without BOM: Vercel's strict package parser rejects a BOM even when npm locally accepts it.
- Reuse the linked Vercel project for every future update; do not create a new repository or project.
- For authorized changes: implement, run appropriate checks, build, commit, push to main, and verify the matching Vercel deployment is READY and publicly accessible at the same production domain.
- Never commit credentials, .env secrets, node_modules, caches, local backups, or .vercel authentication files.
- Public build output is dist/. All current illustrations/logos are inline SVG. No backend or environment secrets are needed.
