const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const categorias = {
  sofa: 'Sofás y sillones', cama: 'Camas', colchon: 'Colchones', mesa: 'Mesas',
  silla: 'Sillas', escritorio: 'Escritorios', silla_oficina: 'Sillas de oficina',
  almacenaje: 'Almacenaje', iluminacion: 'Iluminación', textil: 'Textil', accesorio: 'Accesorios',
};

export function rutaProducto(sku) {
  return `/producto/${encodeURIComponent(sku)}`;
}

export function atributos(producto) {
  return [
    producto.plazas && `${producto.plazas} ${producto.plazas === 1 ? 'plaza' : 'plazas'}`,
    producto.ancho_cm && `${producto.ancho_cm} cm de ancho`,
    producto.color,
    producto.material,
  ].filter(Boolean).join(' · ');
}

export function portada(productos) {
  if (!productos.length) return '<p>Estamos preparando el catálogo. Vuelve en unos minutos.</p>';

  const opciones = [...new Set(productos.map((producto) => producto.categoria))].map((categoria) =>
    `<option value="${esc(categoria)}">${esc(categorias[categoria] || categoria)}</option>`);
  const tarjetas = productos.map((producto) => `
    <article class="tarjeta" data-categoria="${esc(producto.categoria)}">
      <h2><a href="${esc(rutaProducto(producto.sku))}">${esc(producto.nombre)}</a></h2>
      <p>${esc(categorias[producto.categoria] || producto.categoria)}</p>
      <p>${esc(atributos(producto))}</p>
      <p class="precio">${euros.format(producto.precio)}</p>
    </article>`);
  return `
    <div class="filtros">
      <label>Buscar productos <input id="buscar-productos" type="search"></label>
      <label>Categoría <select id="categoria-productos"><option value="">Todas</option>${opciones.join('')}</select></label>
    </div>
    <p id="sin-resultados" role="status" hidden>No hay productos que coincidan.</p>
    <div class="rejilla">${tarjetas.join('')}</div>`;
}

export function ficha(producto) {
  return `
    <p><a href="/">Ver todo el catálogo</a></p>
    <p>${esc(categorias[producto.categoria] || producto.categoria)}</p>
    <p>${esc(atributos(producto))}</p>
    <p class="precio">${euros.format(producto.precio)}</p>
    <button type="button" data-agregar="${esc(producto.sku)}">Añadir al carrito</button>
    <p id="estado-producto" role="status"></p>
    <p><a href="/carrito">Ir al carrito</a></p>`;
}

export const carrito = `
  <p id="estado-carrito" role="status">Cargando carrito…</p>
  <ul id="lineas-carrito" class="lineas-carrito"></ul>
  <section id="comprar" hidden>
    <p class="precio">Total de productos <strong id="total-carrito"></strong></p>
    <h2>Datos de entrega</h2>
    <form id="pago" class="campos">
      <label for="nombre">Nombre completo</label>
      <input id="nombre" name="name" autocomplete="name" maxlength="120" required>
      <label for="correo">Correo electrónico</label>
      <input id="correo" name="email" type="email" autocomplete="email" maxlength="254" required>
      <label for="direccion">Dirección de entrega</label>
      <textarea id="direccion" name="address" autocomplete="street-address" maxlength="300" required></textarea>
      <button type="submit">Pagar (simulado)</button>
    </form>
    <p id="estado-pago" role="status"></p>
  </section>
  <section id="pedido-confirmado" hidden>
    <h2>Pedido confirmado</h2>
    <p>Tu número de pedido es <strong id="numero-pedido"></strong>.</p>
  </section>
  <p><a href="/">Volver al catálogo</a></p>`;
