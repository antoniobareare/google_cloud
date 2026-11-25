// Conjuntos completos por estancia: lo que el historial de ventas dice que se compra junto,
// con el total visible y un botón que lo añade todo al carrito de una vez.
// Objetivo: menos pasos para el cliente (y el agente), más venta cruzada y más ticket.
//
// Uso en server.js:
//   import { crearConjuntos } from './conjuntos.js';
//   const cj = crearConjuntos(catalogo.productos);
//   cj.bloqueInicio()      -> HTML con todos los conjuntos (portada o /conjuntos)
//   cj.bloqueFicha(sku)    -> HTML "este producto forma parte del conjunto X" (ficha)
//   cj.lista               -> [{ id, nombre, lineas: [{ producto, cantidad }], total }]
// El botón hace POST /carrito/anadir con `sku` y `cantidad` REPETIDOS (uno por línea):
// el carrito debe aceptar varios sku en el mismo envío (contrato con checkout).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euros = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' }).format(n);

// Cada línea: ids de origen equivalentes (A y B del mismo producto) y cantidad.
// Si un producto no está en el catálogo (descatalogado o sin stock), la línea se omite.
const DEFINICION = [
  {
    id: 'hogar-completo', nombre: 'Hogar completo: salón de piel y dormitorio',
    texto: 'La opción más completa: salón de piel con sillón y todos sus complementos, más dormitorio de 150 con colchón premium y ropa de cama. Envío y montaje a domicilio gratis.',
    lineas: [[['A-6902', 'B-93141'], 1], [['A-1893'], 1], [['B-13338'], 1], [['A-4533'], 1], [['B-21741', 'A-5053'], 1], [['A-9000'], 1],
      [['B-36878'], 1], [['B-98516'], 1], [['A-5051'], 1], [['A-3115'], 1], [['B-39342'], 1], [['B-22857'], 1],
      [['B-23736'], 2], [['B-30739', 'A-5441'], 2], [['B-40144'], 1], [['A-9295'], 1]],
  },
  {
    id: 'salon-comedor-premium', nombre: 'Salón-comedor premium',
    texto: 'Sofá de piel, dos sillones, mesa extensible con sillas, aparador, estantería, iluminación y textil: el salón-comedor entero listo para estrenar, con envío y montaje gratis.',
    lineas: [[['A-6902', 'B-93141'], 1], [['A-1893'], 2], [['B-20825'], 1], [['B-28073'], 1], [['A-3551'], 1], [['B-40144'], 1],
      [['B-13338'], 1], [['A-9295'], 1], [['A-4533'], 1], [['B-21741', 'A-5053'], 1], [['A-9000'], 1]],
  },
  {
    id: 'salon', nombre: 'Salón completo',
    texto: 'Sofá de tres plazas con todo lo que nuestros clientes suelen añadir: luz de lectura, alfombra, cojines y manta.',
    lineas: [[['B-65337', 'A-1116'], 1], [['B-13338'], 1], [['A-4533'], 1], [['B-21741', 'A-5053'], 1], [['A-9000'], 1]],
  },
  {
    id: 'salon-piel', nombre: 'Salón de piel con sillón',
    texto: 'Sofá de piel de tres plazas, sillón a juego y los complementos más vendidos con él.',
    lineas: [[['A-6902', 'B-93141'], 1], [['A-1893'], 1], [['B-13338'], 1], [['A-4533'], 1], [['B-21741', 'A-5053'], 1], [['A-9000'], 1]],
  },
  {
    id: 'dormitorio', nombre: 'Dormitorio completo 150',
    texto: 'Cama de 150, colchón de muelles ensacados y toda la ropa de cama, con mesillas y lámparas a ambos lados.',
    lineas: [[['B-36878'], 1], [['B-98516'], 1], [['A-5051'], 1], [['A-3115'], 1], [['B-39342'], 1], [['B-22857'], 1],
      [['B-23736'], 2], [['B-30739', 'A-5441'], 2]],
  },
  {
    id: 'despacho', nombre: 'Despacho en casa',
    texto: 'Escritorio elevable eléctrico con silla ergonómica y los accesorios que más se compran juntos.',
    lineas: [[['A-2229', 'B-94536'], 1], [['B-65328'], 1], [['B-85581'], 1], [['B-67452'], 1], [['B-50794'], 1],
      [['B-70916'], 1], [['A-4350'], 1]],
  },
  {
    id: 'comedor', nombre: 'Comedor para seis',
    texto: 'Mesa redonda de nogal, seis sillas a juego, aparador, lámpara de techo y alfombra.',
    lineas: [[['A-2964', 'B-52063'], 1], [['B-90466', 'A-9750'], 1], [['A-3551'], 1], [['A-9295'], 1], [['A-4533'], 1]],
  },
];

export function crearConjuntos(productos = [], definicion = DEFINICION) {
  const skuDeOrigen = new Map();
  for (const p of productos) for (const id of p.ids_origen ?? []) skuDeOrigen.set(id, p);

  const lista = definicion.map((c) => {
    const lineas = c.lineas
      .map(([ids, cantidad]) => ({ producto: ids.map((id) => skuDeOrigen.get(id)).find(Boolean), cantidad }))
      .filter((l) => l.producto);
    // total al céntimo, en enteros
    const total = lineas.reduce((s, l) => s + Math.round(l.producto.precio * 100) * l.cantidad, 0) / 100;
    return { ...c, lineas, total };
  }).filter((c) => c.lineas.length >= 3);

  // Botón que añade todas las líneas al carrito del navegador (public/tienda.js, data-conjunto="sku:cantidad,...")
  const formulario = (c) => `<button type="button" data-conjunto="${esc(c.lineas.map((l) => `${l.producto.sku}:${l.cantidad}`).join(','))}" data-nombre="conjunto ${esc(c.nombre)}">Añadir el conjunto ${esc(c.nombre)} al carrito (${euros(c.total)})</button>`;

  const tarjeta = (c) => `<article class="cj" id="conjunto-${esc(c.id)}">
  <h2>${esc(c.nombre)} · ${euros(c.total)}</h2>
  <p>${esc(c.texto)}${c.total >= 1500 ? ' <strong>Incluye envío y montaje gratis.</strong>' : c.total >= 500 ? ' <strong>Envío gratis.</strong>' : ''}</p>
  <ul class="cj-lineas">
${c.lineas.map((l) => `    <li>${l.cantidad > 1 ? `${l.cantidad} × ` : ''}<a href="/producto/${encodeURIComponent(l.producto.sku)}">${esc(l.producto.nombre)}</a> <span>${euros(l.producto.precio)}</span></li>`).join('\n')}
  </ul>
  ${formulario(c)}
</article>`;

  return {
    lista,
    bloqueInicio: () => lista.length
      ? `<section class="cj-bloque" aria-label="Conjuntos completos"><h2 class="cj-titulo">Conjuntos completos: amuebla una estancia en un clic</h2>${lista.map(tarjeta).join('')}</section>`
      : '',
    bloqueFicha: (sku) => {
      // Hasta 2 conjuntos con este producto: el más completo y el más ajustado
      const con = lista.filter((x) => x.lineas.some((l) => String(l.producto.sku) === String(sku))).sort((a, b) => b.total - a.total);
      const elegidos = con.length > 1 ? [con[0], con[con.length - 1]] : con;
      return elegidos.length ? `<section class="cj-bloque" aria-label="Conjunto recomendado"><h2>Llévate la estancia completa</h2>
<p>Si tu presupuesto lo permite, te recomendamos el conjunto completo: todo combina, y con envío y montaje a domicilio gratis.</p>${elegidos.map(tarjeta).join('')}</section>` : '';
    },
  };
}
