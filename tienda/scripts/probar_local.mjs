// Prueba local de la tienda antes de desplegar.
// Arranca server.js en un puerto libre, comprueba lo que miran los hitos que podemos ver desde fuera
// y mide la latencia del servidor en la portada.
// Uso (desde tienda/):  node scripts/probar_local.mjs      → código de salida 0 si todo va bien
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
let fallos = 0;
const ok = (cond, texto) => { console.log(`${cond ? '✔' : '✘'} ${texto}`); if (!cond) fallos++; };

const srv = spawn(process.execPath, ['server.js'], { cwd: DIR, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
let salidaError = '';
srv.stderr.on('data', (d) => { salidaError += d; });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('El servidor no arrancó en 5 s:\n' + salidaError)), 5000);
  srv.stdout.on('data', (d) => { if (String(d).includes('escuchando')) { clearTimeout(t); res(); } });
  srv.on('exit', (c) => rej(new Error(`El servidor terminó (código ${c}):\n${salidaError}`)));
});

try {
  // --- Portada: cabeceras, cookie y calidad web básica ---
  const r = await fetch(BASE + '/');
  const html = await r.text();
  const h = r.headers;
  ok(r.status === 200, `Portada responde 200 (${r.status})`);
  const hsts = /max-age=(\d+)/.exec(h.get('strict-transport-security') || '');
  ok(hsts && Number(hsts[1]) >= 31536000, 'HSTS con max-age de 1 año o más');
  ok(h.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');
  const csp = h.get('content-security-policy') || '';
  ok(/default-src [^;]*'self'/.test(csp) && /script-src 'self'(;|$)/.test(csp), 'CSP con default-src y script-src restringidos');
  ok(!/unsafe-inline|unsafe-eval|\*/.test(csp), 'CSP sin unsafe-inline, unsafe-eval ni comodines');
  const cookie = h.get('set-cookie') || '';
  ok(/hk_sesion=[^;]+/.test(cookie) && /;\s*Secure/i.test(cookie) && /;\s*HttpOnly/i.test(cookie) && /SameSite=(Lax|Strict)/i.test(cookie),
    'Cookie hk_sesion con valor, Secure, HttpOnly y SameSite');
  ok(!h.get('x-powered-by') && !h.get('server'), 'No anuncia framework ni servidor');
  ok(/<html lang="es"/.test(html), 'Idioma declarado');
  ok((/<title>([^<]*)<\/title>/.exec(html)?.[1] || '').length >= 20, 'Título de 20 caracteres o más');
  ok((/<meta name="description" content="([^"]*)"/.exec(html)?.[1] || '').length >= 20, 'Meta descripción de 20 caracteres o más');
  ok(/<meta name="viewport"/.test(html), 'Etiqueta viewport');
  ok((html.match(/<h1[\s>]/g) || []).length === 1, 'Un único h1');
  ok(!/<img(?![^>]*\balt=)[^>]*>/i.test(html), 'Todas las imágenes con alt');
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html) && !/\sstyle="/i.test(html), 'Sin scripts ni estilos en línea (no rompen la CSP ni dan errores de consola)');

  // --- Compresión ---
  const br = await fetch(BASE + '/', { headers: { 'accept-encoding': 'br' } });
  ok(br.headers.get('content-encoding') === 'br' || html.length <= 512, 'Portada comprimida con brotli si el cliente lo admite');

  // --- No filtra nada ---
  for (const ruta of ['/.env', '/server.js', '/package.json', '/.git/config', '/.gcloudignore', '/datos/proveedor-a.csv', '/../server.js', '/no-existe']) {
    const x = await fetch(BASE + ruta);
    const t = await x.text();
    ok(x.status === 404 && !/server\.js|node:internal|\s at /.test(t), `${ruta} → 404 sin trazas`);
  }

  // --- Catálogo y asistente ---
  const cat = await fetch(BASE + '/catalogo.json');
  let catOk = false; try { JSON.parse(await cat.text()); catOk = true; } catch {}
  ok(cat.status === 200 && catOk, '/catalogo.json responde JSON válido');
  const a = await fetch(BASE + '/api/asistente', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pregunta: '¿Cuánto cuesta el envío?' }) });
  const aj = await a.json().catch(() => ({}));
  ok(a.status === 200 && typeof aj.respuesta === 'string' && aj.respuesta.length < 1500, 'Asistente responde 200 con {respuesta}');
  const mal = await fetch(BASE + '/api/asistente', { method: 'POST', body: 'esto no es json' });
  ok(mal.status === 200, 'Asistente aguanta un cuerpo que no es JSON');

  // --- Latencia del servidor en la portada (200 peticiones seguidas, conexión reutilizada) ---
  const agente = new http.Agent({ keepAlive: true, maxSockets: 1 });
  const una = () => new Promise((res, rej) => {
    const t0 = process.hrtime.bigint();
    http.get(BASE + '/', { agent: agente, headers: { 'accept-encoding': 'gzip' } }, (resp) => {
      resp.resume(); resp.on('end', () => res(Number(process.hrtime.bigint() - t0) / 1e6));
    }).on('error', rej);
  });
  for (let i = 0; i < 20; i++) await una(); // calentar
  const tiempos = [];
  for (let i = 0; i < 200; i++) tiempos.push(await una());
  tiempos.sort((x, y) => x - y);
  const med = tiempos[100], p95 = tiempos[190];
  console.log(`  Latencia del servidor en la portada: mediana ${med.toFixed(2)} ms · p95 ${p95.toFixed(2)} ms`);
  ok(med < 5 && p95 < 20, 'Portada servida en menos de 5 ms (mediana) y 20 ms (p95)');
  agente.destroy();
} finally {
  srv.kill();
}

console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
