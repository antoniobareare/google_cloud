// Analiza historial-ventas.csv y genera tienda/recomendaciones.json:
// para cada producto, lo que más se compra junto (priorizando las categorías que
// cuentan como venta cruzada: iluminacion, textil, almacenaje, accesorio).
// Trabaja con ids de origen (A-xxxx / B-xxxxx); la tienda los traduce a su sku con `ids_origen`.
// Uso: node scripts/venta_cruzada.mjs
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..', 'tienda');
const DATOS = path.join(RAIZ, 'datos');
const CRUZADA = new Set(['iluminacion', 'textil', 'almacenaje', 'accesorio']);

// ---------- Productos de los proveedores (solo nombre y categoría, para agrupar duplicados)
const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const clave = (nombre) => sinAcentos(nombre.toLowerCase())
  .replace(/\b(\d+|uno|una|dos|tres|cuatro)\s*plazas?\b/g, '').replace(/\s+/g, ' ').trim();

const CAT_A = { 'ALMACENAJE': 'almacenaje', 'TEXTIL HOGAR': 'textil', 'DORMITORIO / CAMAS': 'cama', 'DESCANSO': 'colchon',
  'SOFAS Y SILLONES': 'sofa', 'ILUMINACION': 'iluminacion', 'DESPACHO - SILLAS': 'silla_oficina', 'COMEDOR - MESAS': 'mesa',
  'COMEDOR - SILLAS': 'silla', 'DESPACHO': 'escritorio' };
const CAT_B = { sofa: 'sofa', storage: 'almacenaje', bed: 'cama', dining_chair: 'silla', textile: 'textil', mattress: 'colchon',
  dining_table: 'mesa', office_chair: 'silla_oficina', accessory: 'accesorio', lighting: 'iluminacion', desk: 'escritorio' };

const productos = new Map(); // id_origen -> { nombre, categoria, activo, grupo }
const csvA = new TextDecoder('windows-1252').decode(fs.readFileSync(path.join(DATOS, 'proveedor-a.csv')));
for (const linea of csvA.split(/\r?\n/).slice(1).filter(Boolean)) {
  const [ref, desc, fam, , , , , , estado] = linea.split(';');
  const nombre = desc.trim();
  productos.set(ref, { nombre, categoria: CAT_A[sinAcentos(fam.trim()).toUpperCase()] ?? '?', activo: estado.trim() === 'ACTIVO' });
}
for (const p of JSON.parse(fs.readFileSync(path.join(DATOS, 'proveedor-b.json'), 'utf8')).products) {
  productos.set(p.id, { nombre: p.title, categoria: CAT_B[p.category] ?? '?', activo: p.status === 'active' });
}
// Mismo producto en A y B -> mismo grupo (clave del nombre)
const grupoDe = new Map();
for (const [id, p] of productos) {
  p.grupo = clave(p.nombre);
  if (!grupoDe.has(p.grupo)) grupoDe.set(p.grupo, []);
  grupoDe.get(p.grupo).push(id);
}

// ---------- Historial: cestas por pedido, agrupando duplicados
const cestas = new Map();
const lineas = fs.readFileSync(path.join(DATOS, 'historial-ventas.csv'), 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
for (const l of lineas) {
  const [pedido, , id] = l.split(',');
  const g = productos.get(id)?.grupo ?? id;
  if (!cestas.has(pedido)) cestas.set(pedido, new Set());
  cestas.get(pedido).add(g);
}

const freq = new Map(), pares = new Map();
for (const c of cestas.values()) {
  for (const a of c) {
    freq.set(a, (freq.get(a) ?? 0) + 1);
    for (const b of c) if (a !== b) pares.set(`${a}|${b}`, (pares.get(`${a}|${b}`) ?? 0) + 1);
  }
}

const infoGrupo = (g) => {
  const ids = grupoDe.get(g) ?? [g];
  const p = productos.get(ids[0]);
  return { ids_origen: ids, nombre: p?.nombre ?? g, categoria: p?.categoria ?? '?', activo: ids.some((i) => productos.get(i)?.activo) };
};

// ---------- Recomendaciones: confianza P(b|a); las de venta cruzada primero
const recomendaciones = {};
for (const [a, na] of freq) {
  const ia = infoGrupo(a);
  const candidatos = [...pares].filter(([k]) => k.startsWith(a + '|'))
    .map(([k, n]) => ({ g: k.split('|')[1], n, conf: n / na }))
    .filter((x) => infoGrupo(x.g).activo && x.n >= 2)
    .sort((x, y) => (CRUZADA.has(infoGrupo(y.g).categoria) - CRUZADA.has(infoGrupo(x.g).categoria)) || y.conf - x.conf)
    .slice(0, 4)
    .map((x) => ({ ...infoGrupo(x.g), veces: x.n, confianza: +x.conf.toFixed(2) }));
  if (candidatos.length) for (const id of ia.ids_origen) recomendaciones[id] = candidatos.map(({ ids_origen, nombre, categoria, confianza }) => ({ ids_origen, nombre, categoria, confianza }));
}
fs.writeFileSync(path.join(RAIZ, 'recomendaciones.json'), JSON.stringify(recomendaciones, null, 1));

// ---------- Informe
console.log(`${cestas.size} pedidos · ${freq.size} productos distintos (tras agrupar A/B)\n`);
console.log('Más vendidos:');
for (const [g, n] of [...freq].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  const i = infoGrupo(g); console.log(`  ${String(n).padStart(3)}  ${i.nombre} [${i.categoria}] ${i.activo ? '' : '(DESCATALOGADO)'}`);
}
console.log('\nVenta cruzada por producto principal (top 3, % de pedidos que lo incluyen):');
const principales = [...freq].filter(([g]) => !CRUZADA.has(infoGrupo(g).categoria)).sort((a, b) => b[1] - a[1]).slice(0, 16);
for (const [g, n] of principales) {
  const i = infoGrupo(g);
  const r = (recomendaciones[i.ids_origen[0]] ?? []).filter((x) => CRUZADA.has(x.categoria)).slice(0, 3)
    .map((x) => `${x.nombre} ${Math.round(x.confianza * 100)}%`).join(' · ');
  console.log(`  ${i.nombre} (${n}) → ${r || '—'}`);
}
const tickets = [...cestas.keys()].map((p) => lineas.filter((l) => l.startsWith(p + ','))
  .reduce((s, l) => { const [, , , c, pu] = l.split(','); return s + c * pu; }, 0)).sort((a, b) => a - b);
console.log(`\nTicket medio ${(tickets.reduce((a, b) => a + b, 0) / tickets.length).toFixed(0)} € · mediana ${tickets[tickets.length >> 1].toFixed(0)} € · máx ${tickets.at(-1).toFixed(0)} €`);
console.log(`\nEscrito ${path.relative(process.cwd(), path.join(RAIZ, 'recomendaciones.json'))} (${Object.keys(recomendaciones).length} ids)`);
