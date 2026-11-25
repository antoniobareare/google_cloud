const BUZON_OFICIAL = 'https://hk-buzon-168798369712.europe-southwest1.run.app/api/pedido';
const LIMITE_BYTES = 64 * 1024;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ErrorPedido extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

export function prepararPedido(datos, productos) {
  if (typeof datos?.order_id !== 'string' || !UUID_V4.test(datos.order_id)) {
    throw new ErrorPedido(400, 'Vuelve al carrito para iniciar el pago.');
  }

  const cliente = Object.fromEntries(['name', 'email', 'address'].map((campo) => {
    const valor = datos.customer?.[campo];
    return [campo, typeof valor === 'string' ? valor.trim() : ''];
  }));
  if (!cliente.name || cliente.name.length > 120 || !cliente.address || cliente.address.length > 300 ||
      cliente.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)) {
    throw new ErrorPedido(400, 'Revisa el nombre, el correo y la dirección de entrega.');
  }

  if (!Array.isArray(datos.items) || datos.items.length < 1 || datos.items.length > 200) {
    throw new ErrorPedido(400, 'El carrito debe tener entre 1 y 200 productos distintos.');
  }

  let totalCentimos = 0;
  const vistos = new Set();
  const items = datos.items.map((linea) => {
    const { sku, quantity } = linea ?? {};
    const producto = productos.get(sku);
    if (!producto || vistos.has(sku)) {
      throw new ErrorPedido(400, 'Revisa el carrito. Algún producto no está disponible o aparece repetido.');
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new ErrorPedido(400, 'Cada producto debe tener una cantidad entera mayor que cero.');
    }

    const precioCentimos = Math.round(producto.precio * 100);
    totalCentimos += precioCentimos * quantity;
    if (!Number.isSafeInteger(totalCentimos)) {
      throw new ErrorPedido(400, 'La cantidad supera el máximo permitido.');
    }
    vistos.add(sku);
    return { sku, name: producto.nombre, quantity, unit_price: precioCentimos / 100 };
  });

  return {
    schema_version: '1.0',
    order_id: datos.order_id.toLowerCase(),
    created_at: new Date().toISOString(),
    customer: cliente,
    items,
    currency: 'EUR',
    total: totalCentimos / 100,
  };
}

export async function enviarPedido(pedido) {
  const clave = process.env.CLAVE_EQUIPO;
  if (!clave) throw new ErrorPedido(503, 'El pago todavía no está disponible.');

  const body = JSON.stringify(pedido);
  if (Buffer.byteLength(body) > LIMITE_BYTES) {
    throw new ErrorPedido(413, 'El pedido es demasiado grande. Reduce el número de productos.');
  }

  try {
    const respuesta = await fetch(process.env.BUZON_PEDIDOS_URL || BUZON_OFICIAL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-clave': clave },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (respuesta.status === 200 && (await respuesta.json())?.ok === true) return;

    await respuesta.body?.cancel().catch(() => {});
    console.warn(JSON.stringify({ evento: 'buzon_pedido_rechazado', estado: respuesta.status, pedido: pedido.order_id }));
  } catch {
    console.warn(JSON.stringify({ evento: 'buzon_pedido_sin_respuesta', pedido: pedido.order_id }));
  }
  throw new ErrorPedido(502, 'El buzón no confirmó el pedido. Vuelve a intentar el pago.');
}
