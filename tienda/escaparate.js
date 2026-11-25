// Escaparate: portada (conjuntos + catálogo por categorías) y fichas de producto.
// Todo se genera UNA vez al arrancar (server.js lo precalcula y comprime): cero coste por visita.
// Si el front monta otras vistas (p. ej. rama miguel), se sustituye este módulo sin tocar el carrito.
import { botonAnadir, euros } from './carrito.js';

const NOMBRES = {
  sofa: 'Sofás y sillones', cama: 'Camas', colchon: 'Colchones', mesa: 'Mesas de comedor', silla: 'Sillas de comedor',
  escritorio: 'Escritorios', silla_oficina: 'Sillas de oficina', almacenaje: 'Almacenaje', iluminacion: 'Iluminación',
  textil: 'Textil', accesorio: 'Accesorios',
};
const ORDEN = Object.keys(NOMBRES);
export const nombreCategoria = (c) => NOMBRES[c] ?? c;
export const rutaProducto = (sku) => `/producto/${encodeURIComponent(sku)}`;

export function crearEscaparate({ productos, detalle = [], esc, conjuntos, ventaCruzada }) {
  const det = new Map(detalle.map((d) => [d.sku, d]));
  const categorias = [...new Set(productos.map((p) => p.categoria))]
    .sort((a, b) => (ORDEN.indexOf(a) + 1 || 99) - (ORDEN.indexOf(b) + 1 || 99));

  const atributos = (p) => {
    const d = { ...p, ...det.get(p.sku) };
    const medidas = [d.ancho_cm, d.fondo_cm, d.alto_cm].every(Number.isFinite)
      ? `${d.ancho_cm} × ${d.fondo_cm} × ${d.alto_cm} cm (ancho × fondo × alto)`
      : Number.isFinite(d.ancho_cm) ? `${d.ancho_cm} cm de ancho` : null;
    return [
      d.plazas ? ['Plazas', d.plazas] : null,
      medidas ? ['Medidas', medidas] : null,
      d.color ? ['Color', d.color] : null,
      d.material ? ['Material', d.material] : null,
    ].filter(Boolean);
  };

  const tarjeta = (p) => `<li class="tarjeta">
  <h3><a href="${rutaProducto(p.sku)}">${esc(p.nombre)}</a></h3>
  <p class="precio">${euros(p.precio)} <span class="iva">IVA incluido</span></p>
  <p class="meta">${atributos(p).map(([, v]) => esc(v)).join(' · ')}</p>
  ${botonAnadir(p.sku, esc, `Añadir ${p.nombre} al carrito`)}
</li>`;

  const indice = `<nav class="indice" aria-label="Categorías">${categorias
    .map((c) => `<a href="#cat-${esc(c)}">${esc(nombreCategoria(c))}</a>`).join(' ')}</nav>`;

  const portada = `<p class="intro">Muebles, colchones, iluminación y textil con <strong>envío gratis desde 500 €</strong> y
<strong>montaje gratis desde 1.500 €</strong>. Compra como invitado, sin registro. Pago simulado.</p>
${indice}
${conjuntos?.bloqueInicio() ?? ''}
${categorias.map((c) => `<section class="categoria" id="cat-${esc(c)}" aria-labelledby="h-${esc(c)}">
<h2 id="h-${esc(c)}">${esc(nombreCategoria(c))}</h2>
<ul class="rejilla">${productos.filter((p) => p.categoria === c).map(tarjeta).join('')}</ul>
</section>`).join('\n')}`;

  const ficha = (p) => `<p class="precio grande">${euros(p.precio)} <span class="iva">IVA incluido</span></p>
<dl class="atributos">
  <dt>Categoría</dt><dd><a href="/#cat-${esc(p.categoria)}">${esc(nombreCategoria(p.categoria))}</a></dd>
${atributos(p).map(([k, v]) => `  <dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('\n')}
</dl>
${botonAnadir(p.sku, esc, 'Añadir al carrito')}
<p class="condiciones">Envío en 3 a 5 días laborables en la península · 30 días para devolverlo · 3 años de garantía${p.categoria === 'colchon' ? ' (10 en colchones) y 100 noches de prueba' : ''}.</p>
${ventaCruzada?.bloqueFicha(p.sku) ?? ''}
${conjuntos?.bloqueFicha(p.sku) ?? ''}
<p><a href="/">Seguir comprando</a> · <a href="/carrito">Ver carrito</a></p>`;

  return { portada, ficha, categorias };
}
