// Venta cruzada: "lo que otros clientes compraron con esto" + avisos de umbral (envío y montaje gratis).
// Sale de historial-ventas.csv (scripts/venta_cruzada.mjs -> recomendaciones.json, por id de origen)
// y se traduce a los sku del catálogo limpio con `ids_origen`. Precios SIEMPRE del catálogo.
//
// Uso en server.js:
//   import { crearVentaCruzada } from './ventacruzada.js';
//   const vc = crearVentaCruzada(catalogo.productos);
//   vc.bloqueFicha(sku)             -> HTML para la ficha de producto
//   vc.bloqueCarrito(skus, total)   -> HTML para el carrito (sugerencias + aviso de umbrales)
// Los botones hacen POST /carrito/anadir con `sku` y `cantidad` (contrato con el carrito).
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RUTA_RECS = path.join(DIR, 'recomendaciones.json');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euros = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' }).format(n);

// Umbrales reales de condiciones-de-venta.md
const ENVIO_GRATIS = 500;
const MONTAJE_GRATIS = 1500;

export function crearVentaCruzada(productos = [], recsPorOrigen = existsSync(RUTA_RECS) ? JSON.parse(readFileSync(RUTA_RECS, 'utf8')) : {}) {
  const porSku = new Map(productos.map((p) => [String(p.sku), p]));
  const skuDeOrigen = new Map();
  for (const p of productos) for (const id of p.ids_origen ?? []) skuDeOrigen.set(id, String(p.sku));

  // sku -> [sku recomendados] (ya traducidos, solo lo que se vende)
  const recs = new Map();
  for (const p of productos) {
    const lista = (p.ids_origen ?? []).flatMap((id) => recsPorOrigen[id] ?? []);
    const skus = [];
    for (const r of lista) {
      const s = r.ids_origen.map((id) => skuDeOrigen.get(id)).find(Boolean);
      if (s && s !== String(p.sku) && !skus.includes(s)) skus.push(s);
    }
    if (skus.length) recs.set(String(p.sku), skus);
  }

  // Sugerencias para un conjunto de skus: por número de apariciones, sin repetir lo que ya hay
  function sugerencias(skus, max = 4) {
    const ya = new Set(skus.map(String));
    const puntos = new Map();
    for (const s of ya) (recs.get(s) ?? []).forEach((r, i) => {
      if (!ya.has(r)) puntos.set(r, (puntos.get(r) ?? 0) + (4 - Math.min(i, 3)));
    });
    return [...puntos].sort((a, b) => b[1] - a[1]).slice(0, max).map(([s]) => porSku.get(s)).filter(Boolean);
  }

  const tarjeta = (p) => `<li class="vc-item">
  <a href="/producto/${encodeURIComponent(p.sku)}">${esc(p.nombre)}</a>
  <span class="vc-precio">${euros(p.precio)}</span>
  <form action="/carrito/anadir" method="post">
    <input type="hidden" name="sku" value="${esc(p.sku)}">
    <input type="hidden" name="cantidad" value="1">
    <button type="submit">Añadir ${esc(p.nombre)} al carrito</button>
  </form>
</li>`;

  const bloque = (titulo, lista) => lista.length
    ? `<section class="vc" aria-label="${esc(titulo)}"><h2>${esc(titulo)}</h2><ul class="vc-lista">${lista.map(tarjeta).join('')}</ul></section>`
    : '';

  function avisoUmbrales(total) {
    if (total <= 0) return '';
    const msgs = [];
    if (total < ENVIO_GRATIS) msgs.push(`Te faltan <strong>${euros(ENVIO_GRATIS - total)}</strong> para el <strong>envío gratis</strong> (desde ${euros(ENVIO_GRATIS)}; si no, 49 €).`);
    else msgs.push('Tu pedido tiene <strong>envío gratis</strong>.');
    if (total < MONTAJE_GRATIS) msgs.push(`Te faltan <strong>${euros(MONTAJE_GRATIS - total)}</strong> para el <strong>montaje a domicilio gratis</strong> (desde ${euros(MONTAJE_GRATIS)}; si no, 39 €).`);
    else msgs.push('Tu pedido incluye <strong>montaje a domicilio gratis</strong>.');
    return `<p class="vc-aviso">${msgs.join(' ')}</p>`;
  }

  return {
    sugerencias,
    avisoUmbrales,
    bloqueFicha: (sku) => bloque('Completa tu compra: lo que otros clientes se llevaron con este producto', sugerencias([sku])),
    bloqueCarrito: (skus, total = 0) => avisoUmbrales(total) + bloque('Clientes con un carrito como el tuyo también compraron', sugerencias(skus)),
  };
}
