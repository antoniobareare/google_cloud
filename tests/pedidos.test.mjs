import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';

test('la tienda muestra el catálogo y confirma solo pedidos aceptados por el buzón', async (t) => {
  const directorio = await mkdtemp(join(tmpdir(), 'tienda-pedidos-'));
  t.after(() => rm(directorio, { force: true, recursive: true }));
  for (const recurso of ['package.json', 'server.js', 'pedidos.js', 'vistas.js', 'public']) {
    await cp(new URL(`../tienda/${recurso}`, import.meta.url), join(directorio, recurso), { recursive: true });
  }
  const productos = [
    { sku: 'lampara', nombre: 'Lámpara de pie', categoria: 'iluminacion', precio: 14.95, ancho_cm: 40 },
    { sku: 'textil', nombre: 'Manta beige', categoria: 'textil', precio: 2.03 },
  ];
  await writeFile(join(directorio, 'catalogo.json'), JSON.stringify({ productos }));

  const peticiones = [];
  let estadoBuzon = 200;
  const buzon = createServer(async (req, res) => {
    const partes = [];
    for await (const parte of req) partes.push(parte);
    peticiones.push({ url: req.url, clave: req.headers['x-clave'], pedido: JSON.parse(Buffer.concat(partes)) });
    res.writeHead(estadoBuzon, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: estadoBuzon === 200 }));
  });
  buzon.listen(0, '127.0.0.1');
  await once(buzon, 'listening');
  t.after(() => buzon.close());

  const tienda = spawn(process.execPath, ['server.js'], {
    cwd: directorio,
    env: { ...process.env, PORT: '0', CLAVE_EQUIPO: 'clave-local', BUZON_PEDIDOS_URL: `http://127.0.0.1:${buzon.address().port}/api/pedido` },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  t.after(async () => {
    if (tienda.exitCode !== null) return;
    tienda.kill();
    await once(tienda, 'exit');
  });
  const salida = createInterface({ input: tienda.stdout });
  const [inicio] = await once(salida, 'line', { signal: AbortSignal.timeout(5000) });
  const puerto = /escuchando en (\d+)/.exec(inicio)[1];
  const base = `http://127.0.0.1:${puerto}`;

  const portada = await fetch(base);
  assert.equal(portada.status, 200);
  assert.match(portada.headers.get('set-cookie'), /^hk_sesion=.+; Secure; HttpOnly; SameSite=Lax$/);
  assert.match(await portada.text(), /href="\/producto\/lampara"/);
  assert.deepEqual(await (await fetch(`${base}/catalogo.json`)).json(), { productos });
  assert.match(await (await fetch(`${base}/producto/lampara`)).text(), /Añadir al carrito/);
  assert.match(await (await fetch(`${base}/carrito`)).text(), /Pagar \(simulado\)/);

  const order_id = randomUUID();
  const customer = { name: 'Cliente de prueba', email: 'tienda@example.com', address: 'Calle de prueba, Madrid' };
  const items = [{ sku: 'lampara', quantity: 2, unit_price: 0 }, { sku: 'textil', quantity: 1 }];
  const pagar = (datos) => fetch(`${base}/api/pedidos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(datos),
  });

  const invalido = await pagar({ order_id, customer, items: [null] });
  assert.equal(invalido.status, 400);
  assert.equal(peticiones.length, 0);

  const valido = await pagar({ order_id, customer, items, total: 0 });
  assert.equal(valido.status, 201);
  assert.deepEqual(await valido.json(), { order_id });
  assert.equal(peticiones.length, 1);
  const { clave, url, pedido } = peticiones[0];
  assert.equal(clave, 'clave-local');
  assert.equal(url, '/api/pedido');
  assert.equal(pedido.schema_version, '1.0');
  assert.equal(pedido.order_id, order_id);
  assert.match(pedido.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.deepEqual(pedido.customer, customer);
  assert.equal(pedido.currency, 'EUR');
  assert.deepEqual(pedido.items, [
    { sku: 'lampara', name: 'Lámpara de pie', quantity: 2, unit_price: 14.95 },
    { sku: 'textil', name: 'Manta beige', quantity: 1, unit_price: 2.03 },
  ]);
  assert.equal(pedido.total, 31.93);

  estadoBuzon = 422;
  const rechazado = await pagar({ order_id: randomUUID(), customer, items });
  assert.equal(rechazado.status, 502);
  assert.deepEqual(await rechazado.json(), { error: 'El buzón no confirmó el pedido. Vuelve a intentar el pago.' });
});
