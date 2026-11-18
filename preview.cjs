// Local static preview only. No application API, persistence, or external calls.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = new Set(['index.html', 'style.css', 'script.js', 'quran-data.js', 'quran.js', 'mark.svg']);
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml'};
http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!files.has(file)) {res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(__dirname, file), (error, content) => {
    if (error) {res.writeHead(500);res.end('Preview file unavailable');return;}
    res.writeHead(200, {'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : content);
  });
}).listen(4173, process.env.PREVIEW_HOST || '127.0.0.1', () => console.log(`Jamal aldin preview: http://${process.env.PREVIEW_HOST || 'localhost'}:4173`));
