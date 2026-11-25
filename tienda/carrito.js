// Persona 4 · Carrito, checkout y envío del pedido al buzón (hitos "Presente" y "Completa la compra").
// Sin dependencias. El carrito va en una cookie firmada (hk_carrito) para que funcione con varias instancias.
import { createHmac, randomUUID, createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

const BUZON = process.env.BUZON_URL || 'https://hk-buzon-168798369712.europe-southwest1.run.app/api/pedido';
const PRESUPUESTO_AGENTE = 4000;
const SECRETO = process.env.CARRITO_SECRETO
  || createHash('sha256').update('hk-carrito:' + (process.env.CLAVE_EQUIPO || 'picasso')).digest('hex');
const CATEGORIAS_CRUZADA = ['ilumin', 'textil', 'almacen', 'accesori'];

// ---------- Catálogo (tolerante con los nombres de campo que elija el equipo de datos) ----------
let PRODUCTOS = new Map();
const campo = (p, ...ks) => { for (const k of ks) if (p?.[k] !== undefined && p[k] !== null && p[k] !== '') return p[k]; };
export const skuDe = (p) => String(campo(p, 'sku', 'id', 'referencia') ?? '');
export const nombreDe = (p) => String(campo(p, 'nombre', 'name', 'titulo') ?? '');
function numero(v) {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') return numero(campo(v, 'con_iva', 'valor', 'importe', 'amount', 'value'));
  if (typeof v !== 'string') return NaN;
  let t = v.replace(/[^\d.,-]/g, '');
  if (t.includes(',') && t.lastIndexOf(',') > t.lastIndexOf('.')) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/,/g, '');
  return Number(t);
}
export const precioDe = (p) => numero(campo(p, 'precio', 'precio_con_iva', 'precio_iva', 'precio_final', 'pvp', 'price', 'precio_eur'));
const sinTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const categoriaDe = (p) => sinTildes(String(campo(p, 'categoria', 'category', 'familia') ?? ''));

export function cargarCatalogo(txt) {
  let datos = [];
  try { datos = JSON.parse(txt); } catch { datos = []; }
  const lista = Array.isArray(datos) ? datos : (datos.productos || datos.products || datos.items || []);
  PRODUCTOS = new Map();
  for (const p of lista) {
    const sku = skuDe(p);
    if (sku && Number.isFinite(precioDe(p))) PRODUCTOS.set(sku, p);
  }
  return PRODUCTOS.size;
}

// Carga el catálogo publicado por el equipo de datos (mismo fichero que sirve /catalogo.json).
function cargarDesdeFichero() {
  const candidatos = [process.env.CATALOGO_PATH, path.join(DIR, 'catalogo.json'),
    path.join(DIR, 'data', 'catalogo.json'), path.join(DIR, '..', 'data', 'catalogo.json')].filter(Boolean);
  for (const f of candidatos) {
    if (!existsSync(f)) continue;
    const n = cargarCatalogo(readFileSync(f, 'utf8'));
    if (n > 0) { log('INFO', 'carrito: catalogo cargado', { fichero: path.basename(f), productos: n }); return n; }
  }
  log('WARNING', 'carrito: catalogo vacio o sin campos sku/precio reconocibles', {});
  return 0;
}

// ---------- Utilidades ----------
const centimos = (x) => Math.round(Number(x) * 100);
const fmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, useGrouping: 'always' });
export const euros = (x) => fmt.format(Number(x));
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Botón reutilizable para fichas y listados (lo puede usar el front)
export function botonAnadir(sku, esc, texto = 'Añadir al carrito') {
  return `<form method="post" action="/carrito/anadir" class="form-anadir">` +
    `<input type="hidden" name="sku" value="${esc(sku)}">` +
    `<button type="submit" class="boton">${esc(texto)}</button></form>`;
}

// ---------- Cookie firmada del carrito ----------
function firmar(v) { return createHmac('sha256', SECRETO).update(v).digest('base64url').slice(0, 32); }

export function leerCarrito(req) {
  const m = /(?:^|;\s*)hk_carrito=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return {};
  const [v, f] = m[1].split('.');
  if (!v || !f || firmar(v) !== f) return {};
  try {
    const obj = JSON.parse(Buffer.from(v, 'base64url').toString('utf8'));
    const limpio = {};
    for (const [sku, q] of Object.entries(obj)) {
      const n = Math.floor(Number(q));
      if (PRODUCTOS.has(sku) && n >= 1) limpio[sku] = Math.min(n, 99);
    }
    return limpio;
  } catch { return {}; }
}

function cookieCarrito(carrito) {
  const v = Buffer.from(JSON.stringify(carrito)).toString('base64url');
  const vacio = Object.keys(carrito).length === 0;
  return `hk_carrito=${vacio ? '' : v + '.' + firmar(v)}; Path=/; Max-Age=${vacio ? 0 : 86400}; Secure; HttpOnly; SameSite=Lax`;
}

function lineasDe(carrito) {
  const lineas = [];
  for (const [sku, q] of Object.entries(carrito)) {
    const p = PRODUCTOS.get(sku);
    if (!p) continue;
    const unit = centimos(precioDe(p)) / 100;
    lineas.push({ sku, name: nombreDe(p), quantity: q, unit_price: unit });
  }
  return lineas;
}
const totalDe = (lineas) => lineas.reduce((s, l) => s + centimos(l.unit_price) * l.quantity, 0) / 100;

// ---------- Pedido v1.0 ----------
export function construirPedido(lineas, cliente) {
  return {
    schema_version: '1.0',
    order_id: randomUUID(),
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    customer: { name: cliente.name.trim(), email: cliente.email.trim(), address: cliente.address.trim() },
    items: lineas.map((l) => ({ sku: l.sku, name: l.name, quantity: l.quantity, unit_price: l.unit_price })),
    currency: 'EUR',
    total: totalDe(lineas),
  };
}

async function enviarAlBuzon(pedido) {
  const clave = process.env.CLAVE_EQUIPO;
  if (!clave) { log('ERROR', 'Falta CLAVE_EQUIPO', {}); return false; }
  for (let intento = 0; intento < 2; intento++) {
    try {
      const r = await fetch(BUZON, {
        method: 'POST',
        headers: { 'x-clave': clave, 'content-type': 'application/json' },
        body: JSON.stringify(pedido),
        signal: AbortSignal.timeout(10000),
      });
      const texto = (await r.text()).slice(0, 300);
      log(r.ok ? 'INFO' : 'WARNING', 'buzon', { order_id: pedido.order_id, status: r.status, respuesta: texto, total: pedido.total, lineas: pedido.items.length });
      if (r.ok) return true;
      if (![429, 502, 503].includes(r.status)) return false;
    } catch (e) {
      log('WARNING', 'buzon sin respuesta', { order_id: pedido.order_id, error: e.name });
    }
    await new Promise((ok) => setTimeout(ok, 800));
  }
  return false;
}

function log(severity, message, extra) {
  console.log(JSON.stringify({ severity, message, ...extra }));
}

// ---------- Vistas ----------
function tablaLineas(lineas, esc, editable) {
  const filas = lineas.map((l) => `<tr>
<td><a href="/producto/${encodeURIComponent(l.sku)}">${esc(l.name)}</a></td>
<td>${editable ? `<form method="post" action="/carrito/actualizar" class="form-cantidad">
<input type="hidden" name="sku" value="${esc(l.sku)}">
<label for="q-${esc(l.sku)}">Cantidad</label>
<input id="q-${esc(l.sku)}" name="cantidad" type="number" min="0" max="99" value="${l.quantity}">
<button type="submit" class="boton-sec">Actualizar</button></form>` : l.quantity}</td>
<td>${euros(l.unit_price)}</td>
<td>${euros(centimos(l.unit_price) * l.quantity / 100)}</td>
${editable ? `<td><form method="post" action="/carrito/eliminar"><input type="hidden" name="sku" value="${esc(l.sku)}"><button type="submit" class="boton-sec">Eliminar</button></form></td>` : ''}
</tr>`).join('\n');
  return `<div class="tabla-scroll"><table class="tabla-carrito">
<thead><tr><th scope="col">Producto</th><th scope="col">Cantidad</th><th scope="col">Precio</th><th scope="col">Subtotal</th>${editable ? '<th scope="col">Quitar</th>' : ''}</tr></thead>
<tbody>${filas}</tbody>
<tfoot><tr><th scope="row" colspan="3">Total (IVA incluido)</th><td colspan="${editable ? 2 : 1}"><strong class="total">${euros(totalDe(lineas))}</strong></td></tr></tfoot>
</table></div>`;
}

function ventaCruzada(carrito, total, esc) {
  const restante = PRESUPUESTO_AGENTE - total;
  const candidatos = [...PRODUCTOS.values()]
    .filter((p) => !carrito[skuDe(p)])
    .filter((p) => CATEGORIAS_CRUZADA.some((c) => categoriaDe(p).toLowerCase().includes(c)))
    .filter((p) => precioDe(p) <= restante)
    .sort((a, b) => precioDe(b) - precioDe(a));
  // Una de cada categoría (la de mayor precio que cabe), hasta 4
  const elegidos = [];
  for (const c of CATEGORIAS_CRUZADA) {
    const p = candidatos.find((x) => categoriaDe(x).toLowerCase().includes(c));
    if (p) elegidos.push(p);
  }
  if (!elegidos.length) return '';
  return `<section class="cruzada" aria-labelledby="completa">
<h2 id="completa">Completa tu compra</h2>
<p>Quienes compran esto suelen completar su espacio con iluminación, textiles y almacenaje a juego. Añádelos ahora y llegarán en el mismo envío.</p>
<ul class="lista-cruzada">
${elegidos.map((p) => `<li><a href="/producto/${encodeURIComponent(skuDe(p))}">${esc(nombreDe(p))}</a> <strong>${euros(precioDe(p))}</strong> <span class="iva">IVA incluido</span>
${botonAnadir(skuDe(p), esc)}</li>`).join('\n')}
</ul></section>`;
}

// extra(skus, total): venta cruzada opcional desde server.js (historial de ventas); si no llega, usa la de aquí
function vistaCarrito(carrito, esc, aviso, extra) {
  const lineas = lineasDe(carrito);
  if (!lineas.length) {
    return `${aviso ? `<p class="aviso" role="status">${esc(aviso)}</p>` : ''}
<p>Tu carrito está vacío.</p><p><a class="boton" href="/">Ver productos</a></p>`;
  }
  const total = totalDe(lineas);
  const finalizar = `<form method="get" action="/checkout"><button type="submit" class="boton boton-principal">Finalizar compra</button></form>`;
  return `${aviso ? `<p class="aviso" role="status">${esc(aviso)}</p>` : ''}
${finalizar}
${tablaLineas(lineas, esc, true)}
${finalizar}
${extra ? extra(Object.keys(carrito), total) : ventaCruzada(carrito, total, esc)}
<p><a href="/">Seguir comprando</a></p>`;
}

function vistaCheckout(lineas, esc, datos = {}, errores = {}) {
  const err = (k) => (errores[k] ? `<p class="error" id="err-${k}">${esc(errores[k])}</p>` : '');
  const campoForm = (id, etiqueta, tipo, auto) => `<label for="${id}">${etiqueta}</label>
<input id="${id}" name="${id}" type="${tipo}" autocomplete="${auto}" required value="${esc(datos[id] || '')}"${errores[id] ? ` aria-describedby="err-${id}" aria-invalid="true"` : ''}>
${err(id)}`;
  return `${errores.general ? `<p class="error" role="alert">${esc(errores.general)}</p>` : ''}
<h2>Resumen del pedido</h2>
${tablaLineas(lineas, esc, false)}
<form method="post" action="/checkout" class="form-checkout">
<h2>Datos de envío</h2>
${campoForm('name', 'Nombre y apellidos', 'text', 'name')}
${campoForm('email', 'Email', 'email', 'email')}
${campoForm('address', 'Dirección de envío', 'text', 'street-address')}
<p>Pago simulado: no se piden datos de tarjeta ni bancarios.</p>
<button type="submit" class="boton boton-principal">Pagar ${euros(totalDe(lineas))} (pago simulado)</button>
</form>
<p><a href="/carrito">Volver al carrito</a></p>`;
}

function vistaConfirmado(pedido, esc) {
  return `<p class="ok" role="status"><strong>Compra realizada.</strong> Gracias, ${esc(pedido.customer.name)}.</p>
<p>Número de pedido: <strong>${esc(pedido.order_id)}</strong></p>
${tablaLineas(pedido.items, esc, false)}
<p>Lo enviaremos a: ${esc(pedido.customer.address)}</p>
<p><a class="boton" href="/">Volver a la tienda</a></p>`;
}

// ---------- Rutas ----------
// ctx = { enviar, pagina, esc, leerCuerpo, html } (vienen de server.js)
export async function manejarCompra(req, res, ruta, ctx) {
  const { esc } = ctx;
  const html = (estado, titulo, descripcion, h1, cuerpo, cookies) =>
    ctx.enviar(req, res, estado, ctx.html(ctx.pagina({ titulo, descripcion, h1, cuerpo })),
      cookies ? { 'set-cookie': cookies } : {});
  const redirigir = (dest, carrito) => {
    const cab = { 'set-cookie': cookieCarrito(carrito), location: dest };
    return ctx.enviar(req, res, 303, ctx.html(''), cab);
  };
  const form = async () => new URLSearchParams(await ctx.leerCuerpo(req, 16 * 1024));

  if (req.method === 'POST' && ruta === '/carrito/anadir') {
    // Admite uno o varios productos en el mismo envío (sku y cantidad repetidos, por pares):
    // lo usan los botones de "Añadir el conjunto completo" (conjuntos.js).
    const f = await form();
    const skus = f.getAll('sku');
    const cantidades = f.getAll('cantidad');
    const carrito = leerCarrito(req);
    const anadidos = [];
    skus.slice(0, 30).forEach((sku, i) => {
      if (!PRODUCTOS.has(sku)) return;
      const q = Math.max(1, Math.min(99, Math.floor(Number(cantidades[i] || 1)) || 1));
      carrito[sku] = Math.min(99, (carrito[sku] || 0) + q);
      anadidos.push(sku);
    });
    if (!anadidos.length) return redirigir('/carrito?aviso=noexiste', carrito);
    if (anadidos.length > 1) return redirigir('/carrito?aviso=conjunto&n=' + anadidos.length, carrito);
    return redirigir('/carrito?aviso=anadido&sku=' + encodeURIComponent(anadidos[0]), carrito);
  }
  if (req.method === 'POST' && (ruta === '/carrito/actualizar' || ruta === '/carrito/eliminar')) {
    const f = await form();
    const sku = f.get('sku') || '';
    const carrito = leerCarrito(req);
    const q = ruta === '/carrito/eliminar' ? 0 : Math.floor(Number(f.get('cantidad')));
    if (q >= 1) carrito[sku] = Math.min(99, q); else delete carrito[sku];
    return redirigir('/carrito', carrito);
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && ruta === '/carrito') {
    const u = new URL(req.url, 'http://x');
    const p = PRODUCTOS.get(u.searchParams.get('sku') || '');
    const n = Math.floor(Number(u.searchParams.get('n')));
    const aviso = u.searchParams.get('aviso') === 'anadido' && p ? `Has añadido «${nombreDe(p)}» al carrito.`
      : u.searchParams.get('aviso') === 'conjunto' && n > 1 ? `Has añadido el conjunto completo (${n} productos) al carrito.`
      : u.searchParams.get('aviso') === 'noexiste' ? 'Ese producto no está disponible.' : '';
    return html(200, 'Tu carrito · Casa Devoteam', 'Revisa los productos de tu carrito y finaliza la compra como invitado.',
      'Tu carrito', vistaCarrito(leerCarrito(req), esc, aviso, ctx.extraCarrito));
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && ruta === '/checkout') {
    const lineas = lineasDe(leerCarrito(req));
    if (!lineas.length) return redirigir('/carrito', {});
    return html(200, 'Finalizar compra · Casa Devoteam', 'Introduce tus datos de envío y confirma el pedido. Pago simulado, sin tarjeta.',
      'Finalizar compra', vistaCheckout(lineas, esc));
  }
  if (req.method === 'POST' && ruta === '/checkout') {
    const carrito = leerCarrito(req);
    const lineas = lineasDe(carrito);
    if (!lineas.length) return redirigir('/carrito', {});
    const f = await form();
    const datos = { name: (f.get('name') || '').trim(), email: (f.get('email') || '').trim(), address: (f.get('address') || '').trim() };
    const errores = {};
    if (!datos.name) errores.name = 'Escribe tu nombre y apellidos.';
    if (!EMAIL_RE.test(datos.email)) errores.email = 'Escribe un email válido, por ejemplo nombre@ejemplo.com.';
    if (!datos.address) errores.address = 'Escribe la dirección de envío.';
    const titulo = 'Finalizar compra · Casa Devoteam';
    const desc = 'Introduce tus datos de envío y confirma el pedido. Pago simulado, sin tarjeta.';
    if (Object.keys(errores).length) return html(200, titulo, desc, 'Finalizar compra', vistaCheckout(lineas, esc, datos, errores));
    const pedido = construirPedido(lineas, datos);
    const ok = await enviarAlBuzon(pedido); // SIEMPRE antes de enseñar la confirmación
    if (!ok) {
      return html(200, titulo, desc, 'Finalizar compra',
        vistaCheckout(lineas, esc, datos, { general: 'No hemos podido registrar el pedido. Pulsa «Pagar» otra vez.' }));
    }
    return html(200, 'Pedido confirmado · Casa Devoteam', 'Tu compra se ha realizado correctamente. Resumen de tu pedido.',
      'Pedido confirmado', vistaConfirmado(pedido, esc), cookieCarrito({}));
  }
  return false; // no es una ruta de compra
}

cargarDesdeFichero();
