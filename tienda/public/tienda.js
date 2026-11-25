const CLAVE_CARRITO = 'casa-devoteam-carrito';
const CLAVE_PEDIDO = 'casa-devoteam-pedido';
const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

function leerCarrito() {
  try {
    const items = JSON.parse(localStorage.getItem(CLAVE_CARRITO));
    return Array.isArray(items) ? items.filter((item) =>
      typeof item?.sku === 'string' && Number.isSafeInteger(item.quantity) && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

function guardarCarrito(items) {
  localStorage.setItem(CLAVE_CARRITO, JSON.stringify(items));
  sessionStorage.removeItem(CLAVE_PEDIDO);
}

const buscador = document.querySelector('#buscar-productos');
const categoria = document.querySelector('#categoria-productos');
if (buscador && categoria) {
  const normalizar = (texto) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const tarjetas = [...document.querySelectorAll('.tarjeta[data-categoria]')];
  const filtrar = () => {
    const palabras = normalizar(buscador.value.trim()).split(/\s+/);
    for (const tarjeta of tarjetas) {
      const texto = normalizar(tarjeta.textContent);
      tarjeta.hidden = (categoria.value !== '' && tarjeta.dataset.categoria !== categoria.value) ||
        !palabras.every((palabra) => texto.includes(palabra));
    }
    document.querySelector('#sin-resultados').hidden = tarjetas.some((tarjeta) => !tarjeta.hidden);
  };
  buscador.addEventListener('input', filtrar);
  categoria.addEventListener('change', filtrar);
}

const agregar = document.querySelector('[data-agregar]');
agregar?.addEventListener('click', () => {
  const items = leerCarrito();
  const sku = agregar.dataset.agregar;
  const linea = items.find((item) => item.sku === sku);
  if (linea) linea.quantity += 1;
  else items.push({ sku, quantity: 1 });
  guardarCarrito(items);
  document.querySelector('#estado-producto').textContent = 'Añadido al carrito.';
});

async function mostrarCarrito(formulario) {
  const estado = document.querySelector('#estado-carrito');
  let items = leerCarrito();
  if (!items.length) {
    estado.textContent = 'Tu carrito está vacío.';
    return;
  }

  const respuestaCatalogo = await fetch('/catalogo.json');
  if (!respuestaCatalogo.ok) throw new Error('Catálogo no disponible');
  const { productos } = await respuestaCatalogo.json();
  const catalogo = new Map(productos.map((producto) => [producto.sku, producto]));
  const lista = document.querySelector('#lineas-carrito');
  const comprar = document.querySelector('#comprar');
  const total = document.querySelector('#total-carrito');

  const actualizarTotal = () => {
    const centimos = items.reduce((suma, item) => suma + Math.round(catalogo.get(item.sku).precio * 100) * item.quantity, 0);
    total.textContent = euros.format(centimos / 100);
  };

  const disponibles = items.filter((item) => catalogo.has(item.sku));
  if (disponibles.length !== items.length) {
    estado.textContent = 'Hemos retirado los productos que ya no están disponibles.';
    items = disponibles;
    guardarCarrito(items);
  } else {
    estado.textContent = '';
  }

  const actualizarVista = () => {
    comprar.hidden = items.length === 0;
    if (items.length === 0) estado.textContent = 'Tu carrito está vacío.';
    actualizarTotal();
  };

  for (const item of items) {
    const producto = catalogo.get(item.sku);
    const linea = document.createElement('li');
    const enlace = document.createElement('a');
    enlace.href = '/producto/' + encodeURIComponent(item.sku);
    enlace.textContent = producto.nombre;

    const etiqueta = document.createElement('label');
    etiqueta.textContent = 'Cantidad ';
    const cantidad = document.createElement('input');
    cantidad.type = 'number';
    cantidad.min = '1';
    cantidad.step = '1';
    cantidad.value = String(item.quantity);
    cantidad.setAttribute('aria-label', 'Cantidad de ' + producto.nombre);
    cantidad.addEventListener('change', () => {
      const nuevoValor = cantidad.valueAsNumber;
      if (!Number.isSafeInteger(nuevoValor) || nuevoValor < 1) {
        cantidad.value = String(item.quantity);
        return;
      }
      item.quantity = nuevoValor;
      guardarCarrito(items);
      actualizarTotal();
    });
    etiqueta.append(cantidad);

    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.textContent = 'Quitar';
    quitar.setAttribute('aria-label', 'Quitar ' + producto.nombre);
    quitar.addEventListener('click', () => {
      items = items.filter((otro) => otro !== item);
      guardarCarrito(items);
      linea.remove();
      actualizarVista();
    });

    linea.append(enlace, etiqueta, quitar);
    lista.append(linea);
  }
  actualizarVista();

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const campos = [...lista.querySelectorAll('button, input'), ...formulario.elements];
    const aviso = document.querySelector('#estado-pago');
    const customer = Object.fromEntries(new FormData(formulario));
    const order_id = sessionStorage.getItem(CLAVE_PEDIDO) || crypto.randomUUID();
    sessionStorage.setItem(CLAVE_PEDIDO, order_id);
    campos.forEach((campo) => { campo.disabled = true; });
    aviso.textContent = 'Confirmando el pedido…';

    try {
      const respuesta = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customer, items, order_id }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error || 'No pudimos confirmar el pedido.');

      guardarCarrito([]);
      comprar.hidden = true;
      lista.replaceChildren();
      formulario.reset();
      estado.textContent = '';
      document.querySelector('#numero-pedido').textContent = resultado.order_id;
      document.querySelector('#pedido-confirmado').hidden = false;
    } catch (error) {
      aviso.textContent = error instanceof TypeError ? 'No pudimos conectar. Vuelve a intentar el pago.' : error.message;
    } finally {
      campos.forEach((campo) => { campo.disabled = false; });
    }
  });
}

const formulario = document.querySelector('#pago');
if (formulario) {
  mostrarCarrito(formulario).catch(() => {
    document.querySelector('#estado-carrito').textContent = 'No se pudo cargar el carrito. Recarga para intentarlo de nuevo.';
  });
}
