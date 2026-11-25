// Limpia los catálogos de los dos proveedores y genera tienda/catalogo.json (formato de datos/LEEME.md).
// Uso (desde tienda/):  node scripts/limpiar_catalogo.mjs
// Reglas: un producto repetido se vende una vez con el dato MÁS RECIENTE; lo descatalogado no se vende;
// precios con IVA (21 %) y dos decimales; medidas en cm; vocabulario de categoría, color y material del LEEME.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datos = (f) => path.join(DIR, 'datos', f);

// ---------- Vocabulario ----------
const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => sinAcentos(s).toLowerCase().replace(/\s+/g, ' ').trim();

const CATEGORIA_A = {
  'sofas y sillones': 'sofa', 'dormitorio / camas': 'cama', 'descanso': 'colchon', 'textil hogar': 'textil',
  'iluminacion': 'iluminacion', 'almacenaje': 'almacenaje', 'comedor - mesas': 'mesa', 'comedor - sillas': 'silla',
  'despacho': 'escritorio', 'despacho - sillas': 'silla_oficina',
};
const CATEGORIA_B = {
  sofa: 'sofa', bed: 'cama', mattress: 'colchon', textile: 'textil', lighting: 'iluminacion', storage: 'almacenaje',
  dining_table: 'mesa', dining_chair: 'silla', desk: 'escritorio', office_chair: 'silla_oficina', accessory: 'accesorio',
};
const COLOR = {
  blanco: 'blanco', white: 'blanco', negro: 'negro', black: 'negro', gris: 'gris', grey: 'gris', gray: 'gris',
  beige: 'beige', marron: 'marron', brown: 'marron', azul: 'azul', blue: 'azul', verde: 'verde', green: 'verde',
  roble: 'roble', oak: 'roble', nogal: 'nogal', walnut: 'nogal', natural: 'natural',
};
const MATERIAL = {
  tela: 'tela', fabric: 'tela', lino: 'lino', linen: 'lino', piel: 'piel', leather: 'piel', terciopelo: 'terciopelo',
  velvet: 'terciopelo', madera: 'madera', wood: 'madera', metal: 'metal', melamina: 'melamina', melamine: 'melamina',
  espuma: 'espuma', foam: 'espuma', muelles: 'muelles', 'pocket springs': 'muelles', springs: 'muelles',
  algodon: 'algodon', cotton: 'algodon', lana: 'lana', wool: 'lana', malla: 'malla', mesh: 'malla',
  ceramica: 'ceramica', ceramic: 'ceramica',
};
const NUM = { una: 1, uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };
const avisos = [];
const mapa = (tabla, valor, campo, id) => {
  const v = tabla[norm(valor)];
  if (!v) avisos.push(`${id}: ${campo} desconocido "${valor}"`);
  return v ?? null;
};

// ---------- Utilidades ----------
const IVA = 1.21;
// El proveedor calcula el precio sin IVA dividiendo un PVP redondo entre 1,21 y redondeando al céntimo
// (p. ej. 429,00 → 354,55). Al volver a multiplicar sale 429,0055 → 429,01. Si queda a ≤1 céntimo de un euro
// exacto, se usa el euro exacto (el PVP original).
const conIva = (euros, incluido) => {
  const x = incluido ? euros : euros * IVA;
  const entero = Math.round(x);
  return !incluido && Math.abs(x - entero) <= 0.0105 ? entero : Math.round(x * 100) / 100;
};
const redondeaCm = (x) => Math.round(x * 10) / 10;
const aCm = (valor, unidad) => redondeaCm(valor * ({ mm: 0.1, cm: 1, m: 100 }[unidad] ?? NaN));
// "SOFÁ AARHUS 3 PLAZAS" → "Sofá Aarhus 3 Plazas"; "Sillón Viena 1 PLAZA" → "Sillón Viena 1 Plaza"
const MENORES = new Set(['de', 'del', 'con', 'para', 'el', 'la', 'los', 'las', 'y', 'en', 'a', 'cm']);
function nombreBonito(s) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  const todoMayus = t === t.toUpperCase();
  return t.split(' ').map((w, i) => {
    if (/^\d+X\d+$/i.test(w)) return w.toLowerCase();                    // 150X190 → 150x190
    if (!todoMayus) return /^PLAZAS?$/.test(w) ? w.toLowerCase() : w;    // "Sillón Viena 1 PLAZA"; respeta "LED"
    const m = w.toLowerCase();
    if (i > 0 && MENORES.has(m)) return m;
    return m.charAt(0).toUpperCase() + m.slice(1);
  }).join(' ');
}
// Plazas: "3 plazas", "tres plazas", "1 plaza", "Sofá de dos plazas" (a veces solo en la descripción)
function plazasDe(...textos) {
  for (const t of textos) {
    const m = /\b(\d+|una|uno|un|dos|tres|cuatro|cinco|seis)\s+plazas?\b/.exec(norm(t));
    if (m) return /^\d+$/.test(m[1]) ? Number(m[1]) : NUM[m[1]];
  }
  return null;
}
// Medidas en texto: "160 x 200 x 95 cm", "1,50 x 0,60 x 2,00 m", "160x230x1 cm"
function medidasDeTexto(t) {
  const m = /(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/i.exec(String(t ?? ''));
  if (!m) return null;
  const n = (x) => Number(x.replace(',', '.'));
  const u = m[4].toLowerCase();
  return { ancho: aCm(n(m[1]), u), fondo: aCm(n(m[2]), u), alto: aCm(n(m[3]), u) };
}
// Clave para detectar el mismo producto en los dos proveedores (sin acentos, sin "N plazas", sin mayúsculas)
const clave = (nombre) => norm(nombre)
  .replace(/\b(\d+|una|uno|un|dos|tres|cuatro|cinco|seis)\s+plazas?\b/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- Proveedor A (CSV con ';', codificación latin1, precios "1.049,00") ----------
const filasA = readFileSync(datos('proveedor-a.csv'), 'latin1').split(/\r?\n/).filter((l) => l.trim());
const cabA = filasA.shift().split(';').map((c) => c.trim());
const productosA = filasA.map((linea) => {
  const c = Object.fromEntries(linea.split(';').map((v, i) => [cabA[i], v.trim()]));
  const [d, m, y] = c.F_ACT.split('/');
  const precio = Number(c.PVP.replace(/\./g, '').replace(',', '.'));
  const med = medidasDeTexto(c.MEDIDAS);
  if (!med) avisos.push(`${c.REF}: medidas ilegibles "${c.MEDIDAS}"`);
  return {
    id: c.REF, fuente: 'A', fecha: new Date(`${y}-${m}-${d}T00:00:00Z`),
    nombre: nombreBonito(c.DESCRIPCION),
    categoria: mapa(CATEGORIA_A, c.FAMILIA, 'categoría', c.REF),
    precio: conIva(precio, c.IVA_INCL.toUpperCase() === 'S'),
    plazas: plazasDe(c.DESCRIPCION),
    medidas: med,
    color: mapa(COLOR, c.COLOR, 'color', c.REF),
    material: mapa(MATERIAL, c.ACABADO, 'material', c.REF),
    activo: norm(c.ESTADO) === 'activo',
  };
});

// ---------- Proveedor B (JSON, céntimos, inglés, mm/cm, datos que solo están en la descripción) ----------
const productosB = JSON.parse(readFileSync(datos('proveedor-b.json'), 'utf8')).products.map((p) => {
  let med = null;
  if (p.dimensions && p.dimensions.w != null) med = { ancho: aCm(p.dimensions.w, p.dimensions.unit), fondo: aCm(p.dimensions.d, p.dimensions.unit), alto: aCm(p.dimensions.h, p.dimensions.unit) };
  else med = medidasDeTexto(p.description);
  if (!med) avisos.push(`${p.id}: sin medidas`);
  return {
    id: p.id, fuente: 'B', fecha: new Date(p.updated_at),
    nombre: nombreBonito(p.title),
    categoria: mapa(CATEGORIA_B, p.category, 'categoría', p.id),
    precio: conIva(p.price_cents / 100, p.tax_included === true),
    plazas: plazasDe(p.title, p.description),
    medidas: med,
    color: mapa(COLOR, p.color, 'color', p.id),
    material: mapa(MATERIAL, p.material, 'material', p.id),
    activo: norm(p.status) === 'active',
  };
});

// ---------- Unir: mismo producto → el más reciente manda; descatalogado (según el dato más reciente) fuera ----------
const grupos = new Map();
for (const p of [...productosA, ...productosB]) {
  const k = clave(p.nombre);
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(p);
}
const productos = [];
const informe = { duplicados: [], descatalogados: [] };
for (const lista of grupos.values()) {
  lista.sort((x, y) => y.fecha - x.fecha);
  const r = lista[0];
  const ids = lista.map((p) => p.id);
  if (lista.length > 1) informe.duplicados.push(`${ids.join(' + ')} → ${r.id} (${r.fecha.toISOString().slice(0, 10)}) "${r.nombre}" ${r.precio} €`);
  if (!r.activo) { informe.descatalogados.push(`${ids.join(' + ')} "${r.nombre}"`); continue; }
  // Campos que falten en el más reciente se completan con los de los demás (plazas que solo dice un proveedor)
  const primero = (campo) => lista.map((p) => p[campo]).find((v) => v != null) ?? null;
  const esAsiento = r.categoria === 'sofa';
  productos.push({
    sku: slug(r.nombre),
    ids_origen: ids,
    nombre: r.nombre,
    categoria: r.categoria,
    precio: r.precio,
    plazas: esAsiento ? (r.plazas ?? primero('plazas')) : null,
    ancho_cm: (r.medidas ?? primero('medidas'))?.ancho ?? null,
    color: r.color ?? primero('color'),
    material: r.material ?? primero('material'),
    // Solo para la web y el asistente (no forman parte del formato del LEEME): se publican aparte
    _fondo_cm: (r.medidas ?? primero('medidas'))?.fondo ?? null,
    _alto_cm: (r.medidas ?? primero('medidas'))?.alto ?? null,
  });
}
const orden = ['sofa', 'cama', 'colchon', 'mesa', 'silla', 'escritorio', 'silla_oficina', 'almacenaje', 'iluminacion', 'textil', 'accesorio'];
productos.sort((x, y) => orden.indexOf(x.categoria) - orden.indexOf(y.categoria) || x.precio - y.precio);

// SKU únicos
const vistos = new Set();
for (const p of productos) { let s = p.sku, i = 2; while (vistos.has(s)) s = `${p.sku}-${i++}`; p.sku = s; vistos.add(s); }

// catalogo.json: exactamente el formato del LEEME. catalogo_detalle.json: con fondo y alto, para la web y el asistente.
const publico = productos.map(({ _fondo_cm, _alto_cm, ...p }) => p);
writeFileSync(path.join(DIR, 'catalogo.json'), JSON.stringify({ productos: publico }, null, 2) + '\n');
writeFileSync(path.join(DIR, 'catalogo_detalle.json'), JSON.stringify({ productos: productos.map(({ _fondo_cm, _alto_cm, ...p }) => ({ ...p, fondo_cm: _fondo_cm, alto_cm: _alto_cm })) }, null, 2) + '\n');

console.log(`Proveedor A: ${productosA.length} · Proveedor B: ${productosB.length} · Publicados: ${productos.length}`);
console.log(`\nDuplicados (${informe.duplicados.length}):\n  ` + informe.duplicados.join('\n  '));
console.log(`\nDescatalogados (${informe.descatalogados.length}):\n  ` + informe.descatalogados.join('\n  '));
console.log(avisos.length ? `\nAVISOS (${avisos.length}):\n  ` + avisos.join('\n  ') : '\nSin avisos de vocabulario ni medidas');
const sinCampo = publico.filter((p) => !p.categoria || !p.color || !p.material || p.ancho_cm == null || (p.categoria === 'sofa' && p.plazas == null));
if (sinCampo.length) console.log('\nCon campos vacíos:\n  ' + sinCampo.map((p) => `${p.ids_origen.join('+')} ${p.nombre}`).join('\n  '));
