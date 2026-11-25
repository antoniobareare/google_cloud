// Tienda del hackathon: servidor Node sin framework.
// Todo lo que se sirve está en memoria (rápido para "Tiempo de respuesta" y "Black Friday").
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants as zlibConst } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enviarPedido, ErrorPedido, prepararPedido } from './pedidos.js';
import { carrito, esc, ficha, portada, rutaProducto } from './vistas.js';
import { responder, calentar } from './asistente.js';
import { crearVentaCruzada } from './ventacruzada.js';
import { crearConjuntos } from './conjuntos.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);

// ---------- Cabeceras de seguridad (en TODAS las respuestas) ----------
const SEGURIDAD = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

// ---------- Datos ----------
const leer = (f, def = '') => (existsSync(path.join(DIR, f)) ? readFileSync(path.join(DIR, f), 'utf8') : def);
const catalogo = JSON.parse(leer('catalogo.json', '{"productos":[]}'));
const listaCatalogo = Array.isArray(catalogo) ? catalogo : catalogo?.productos;
if (!Array.isArray(listaCatalogo)) throw new Error('catalogo.json debe contener una lista de productos.');
const productos = listaCatalogo.filter((producto) =>
  typeof producto?.sku === 'string' && producto.sku.trim() &&
  typeof producto.nombre === 'string' && producto.nombre.trim() &&
  Number.isFinite(producto.precio) && producto.precio >= 0 &&
  Number.isSafeInteger(Math.round(producto.precio * 100)));
const PRODUCTOS = new Map(productos.map((producto) => [producto.sku, producto]));

// ---------- Venta cruzada (hito del agente: algo de iluminación, textil, almacenaje o accesorios) ----------
const VENTA_CRUZADA = crearVentaCruzada(productos);
const CONJUNTOS = crearConjuntos(productos);
// En el carrito (página igual para todos): complementos baratos que encajan con casi cualquier compra
const COMPLEMENTOS = ['lampara-de-pie-arco', 'pack-4-cojines-decorativos', 'manta-para-sofa', 'alfombra-de-salon-160x230']
  .map((sku) => PRODUCTOS.get(sku)).filter(Boolean);
// Ofertas = ventajas reales de las condiciones de venta (los precios NO cambian: deben coincidir con el catálogo)
const BANNER_OFERTAS = `<p class="oferta" role="note"><strong>Ofertas de la semana:</strong> envío gratis en pedidos desde 500 € y montaje a domicilio gratis desde 1.500 €. Amuebla la estancia completa con nuestros conjuntos y ahórrate el envío y el montaje.</p>`;
// "Mejora tu elección": las 2 versiones superiores de la misma categoría
const mejoras = (p) => productos.filter((o) => o.categoria === p.categoria && o.precio > p.precio)
  .sort((a, b) => a.precio - b.precio).slice(0, 2);
const bloqueMejoras = (p) => {
  const lista = mejoras(p);
  return lista.length ? `
  <section class="vc" aria-label="Mejora tu elección">
    <h2>Mejora tu elección</h2>
    <p>Más calidad y más años de uso. Con pedidos desde 1.500 € el montaje a domicilio es gratis.</p>
    <ul class="vc-lista">${lista.map((o) => `<li class="vc-item">
      <a href="/producto/${encodeURIComponent(o.sku)}">${esc(o.nombre)}</a>
      <span class="vc-precio">${o.precio.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
      <button type="button" data-agregar="${esc(o.sku)}" data-nombre="${esc(o.nombre)}">Añadir ${esc(o.nombre)} al carrito</button>
    </li>`).join('')}</ul>
  </section>` : '';
};
const BLOQUE_COMPLEMENTOS = COMPLEMENTOS.length ? `
  <section class="vc" aria-label="Completa tu casa">
    <h2>Antes de pagar: completa tu casa</h2>
    <p id="aviso-oferta" class="oferta" role="status">Envío gratis desde 500 € y montaje a domicilio gratis desde 1.500 €.</p>
    <p>Los clientes que compran muebles suelen añadir iluminación y textil.</p>
    <ul class="vc-lista">${COMPLEMENTOS.map((p) => `<li class="vc-item">
      <a href="/producto/${encodeURIComponent(p.sku)}">${esc(p.nombre)}</a>
      <span class="vc-precio">${p.precio.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
      <button type="button" data-agregar="${esc(p.sku)}" data-nombre="${esc(p.nombre)}">Añadir ${esc(p.nombre)} al carrito</button>
    </li>`).join('')}</ul>
    <p id="estado-producto" role="status"></p>
  </section>` : '';

function pagina({ titulo, descripcion, h1, cuerpo }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/estilos.css">
<script src="/tienda.js" defer></script>
</head>
<body>
<header class="cab">
  <a class="logo" href="/">Casa Devoteam</a>
  <nav aria-label="Principal"><a href="/">Inicio</a> <a href="/carrito">Carrito</a></nav>
</header>
<main>
<h1>${esc(h1)}</h1>
${cuerpo}
</main>
<footer class="pie"><p>Envíos a la península y Baleares · Pago simulado · Compra como invitado</p></footer>
</body>
</html>`;
}

// Respuesta precalculada al arrancar (sin compresión, gzip y brotli): cada petición solo copia bytes.
// IMPORTANTE para el hito "Tiempo de respuesta": la portada NUNCA debe calcularse en cada visita
// (nada de llamar a Gemini, leer ficheros ni recorrer el catálogo por petición).
function preparar(cuerpo, tipo) {
  const raw = Buffer.from(cuerpo);
  return {
    raw,
    gz: gzipSync(raw, { level: 9 }),
    br: brotliCompressSync(raw, { params: { [zlibConst.BROTLI_PARAM_QUALITY]: 11 } }),
    tipo,
  };
}

const ESTATICOS = {
  '/': preparar(
    pagina({
      titulo: 'Casa Devoteam · Muebles y decoración online',
      descripcion: 'Tienda online de muebles, iluminación, textil y decoración. Compra como invitado y recibe tu pedido en casa.',
      h1: 'Muebles y decoración para tu casa',
      cuerpo: BANNER_OFERTAS + CONJUNTOS.bloqueInicio() + portada(productos),
    }),
    'text/html; charset=utf-8'
  ),
  '/carrito': preparar(pagina({
    titulo: 'Tu carrito de compra · Casa Devoteam',
    descripcion: 'Revisa tus muebles y completa tu pedido como invitado en Casa Devoteam.',
    h1: 'Tu carrito de compra',
    cuerpo: carrito + BLOQUE_COMPLEMENTOS,
  }), 'text/html; charset=utf-8'),
  '/catalogo.json': preparar(JSON.stringify({ productos }), 'application/json; charset=utf-8'),
  '/estilos.css': preparar(leer('public/estilos.css'), 'text/css; charset=utf-8'),
  '/tienda.js': preparar(leer('public/tienda.js'), 'text/javascript; charset=utf-8'),
  '/favicon.svg': preparar(leer('public/favicon.svg'), 'image/svg+xml'),
  '/favicon.ico': preparar(leer('public/favicon.svg'), 'image/svg+xml'),
  '/robots.txt': preparar('User-agent: *\nAllow: /\n', 'text/plain; charset=utf-8'),
};

const FICHAS = new Map(productos.map((producto) => [rutaProducto(producto.sku), preparar(pagina({
  titulo: `${producto.nombre} · Casa Devoteam`,
  descripcion: `Consulta el precio y las características de ${producto.nombre} en Casa Devoteam.`,
  h1: producto.nombre,
  cuerpo: ficha(producto) + BANNER_OFERTAS + bloqueMejoras(producto) + CONJUNTOS.bloqueFicha(producto.sku) + VENTA_CRUZADA.bloqueFicha(producto.sku),
}), 'text/html; charset=utf-8')]));

const PAGINA_404 = preparar(
  pagina({ titulo: 'Página no encontrada · Casa Devoteam', descripcion: 'La página que buscas no existe en Casa Devoteam.', h1: 'Página no encontrada', cuerpo: '<p><a href="/">Volver a la tienda</a></p>' }),
  'text/html; charset=utf-8'
);
const PAGINA_500 = preparar(
  pagina({ titulo: 'Error · Casa Devoteam', descripcion: 'Ha ocurrido un error inesperado en Casa Devoteam.', h1: 'Algo ha fallado', cuerpo: '<p>Inténtalo de nuevo. <a href="/">Volver a la tienda</a></p>' }),
  'text/html; charset=utf-8'
);

// ---------- Envío ----------
function enviar(req, res, estado, r, extra = {}) {
  const cab = { ...SEGURIDAD, 'content-type': r.tipo, 'cache-control': 'no-store', ...extra };
  // Cookie de sesión: la primera vez que se visita cualquier página
  if (!/(?:^|;\s*)hk_sesion=/.test(req.headers.cookie || '')) {
    cab['set-cookie'] = `hk_sesion=${randomBytes(16).toString('hex')}; Path=/; Max-Age=86400; Secure; HttpOnly; SameSite=Lax`;
  }
  let cuerpo = r.raw;
  if (r.raw.length > 512 && (r.br || r.gz)) {
    const ae = req.headers['accept-encoding'] || '';
    cab['vary'] = 'Accept-Encoding';
    if (r.br && /\bbr\b/.test(ae)) { cuerpo = r.br; cab['content-encoding'] = 'br'; }
    else if (r.gz && /\bgzip\b/.test(ae)) { cuerpo = r.gz; cab['content-encoding'] = 'gzip'; }
  }
  cab['content-length'] = cuerpo.length;
  res.writeHead(estado, cab);
  res.end(req.method === 'HEAD' ? undefined : cuerpo);
}

function json(req, res, estado, obj) {
  enviar(req, res, estado, { raw: Buffer.from(JSON.stringify(obj)), gz: null, br: null, tipo: 'application/json; charset=utf-8' });
}

function leerCuerpo(req, max = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const trozos = [];
    req.on('data', (trozo) => {
      if (bytes > max) return;
      bytes += trozo.length;
      if (bytes > max) {
        trozos.length = 0;
        reject(new ErrorPedido(413, 'La petición supera el tamaño permitido.'));
      } else {
        trozos.push(trozo);
      }
    });
    req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
    req.on('error', reject);
  });
}

async function tramitarPedido(req, res) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    return json(req, res, 415, { error: 'El pedido debe estar en formato JSON.' });
  }

  try {
    const datos = JSON.parse(await leerCuerpo(req));
    const pedido = prepararPedido(datos, PRODUCTOS);
    await enviarPedido(pedido);
    // Aprender del agente: qué compra y cuánto gasta (sin datos personales)
    console.log(JSON.stringify({ severity: 'INFO', message: 'pedido enviado', total: pedido.total,
      lineas: pedido.items.map((i) => `${i.quantity}x ${i.sku} ${i.unit_price}`) }));
    return json(req, res, 201, { order_id: pedido.order_id });
  } catch (error) {
    if (error instanceof SyntaxError) return json(req, res, 400, { error: 'El JSON del pedido no es válido.' });
    if (error instanceof ErrorPedido) return json(req, res, error.estado, { error: error.message });
    throw error;
  }
}

// ---------- Rutas ----------
async function manejar(req, res) {
  const url = new URL(req.url, 'http://x');
  const ruta = url.pathname;

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (Object.hasOwn(ESTATICOS, ruta)) {
      const extra = ruta === '/estilos.css' || ruta === '/tienda.js' || ruta.startsWith('/favicon.')
        ? { 'cache-control': 'public, max-age=300' } : {};
      return enviar(req, res, 200, ESTATICOS[ruta], extra);
    }
    const producto = FICHAS.get(ruta);
    if (producto) return enviar(req, res, 200, producto);
  }

  if (req.method === 'POST' && ruta === '/api/pedidos') return tramitarPedido(req, res);

  if (req.method === 'POST' && ruta === '/api/asistente') {
    let pregunta = '';
    try { pregunta = String(JSON.parse(await leerCuerpo(req)).pregunta || ''); } catch { /* cuerpo no válido */ }
    return json(req, res, 200, { respuesta: await responder(pregunta) });
  }

  return enviar(req, res, 404, PAGINA_404);
}

const servidor = http.createServer((req, res) => {
  manejar(req, res).catch(() => {
    // Nunca enseñamos trazas ni rutas internas
    if (!res.headersSent) enviar(req, res, 500, PAGINA_500);
    else res.destroy();
  });
});
// Cloud Run reutiliza conexiones hacia el contenedor hasta 600 s. Si Node las cerrara antes,
// alguna petición caería en una conexión recién cerrada y daría un 502 esporádico (malo para p95 y Black Friday).
servidor.keepAliveTimeout = 620_000;
servidor.headersTimeout = 630_000;
servidor.listen(PORT, () => {
  console.log(JSON.stringify({ severity: 'INFO', message: `Tienda escuchando en ${servidor.address().port}` }));
  if (!process.env.SIN_CALENTAR) calentar();
});
