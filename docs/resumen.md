# Casa Devoteam · resumen del proyecto (picasso-team)

Tienda online de muebles en **Cloud Run** que vende el catálogo limpio de dos proveedores, se puede comprar como
invitado con pago simulado, envía cada pedido al buzón del reto y tiene un asistente con Gemini. Un agente de IA
entra, navega como una persona y compra.

**Resultado del agente: 390 / 470** · Completa la compra 170/170 · La web se entiende 70/70 ·
**Ranking de gasto 150/150 (puesto 1)** · Venta cruzada 0/80 (pendiente de entender, ver al final).

---

## 1. Arquitectura en una imagen

```
Navegador / agente IA                 Cloud Run (europe-southwest1, público, --allow-unauthenticated)
        │  HTTPS                      ┌───────────────────────────────────────────────────────────────┐
        └────────────────────────────►│ server.js  (Node 22, sin framework, node:http)                │
                                      │  ├─ cabeceras de seguridad + cookie hk_sesion en TODA respuesta│
                                      │  ├─ portada y fichas: HTML PRECALCULADO al arrancar            │
                                      │  │     (escaparate.js + conjuntos.js + ventacruzada.js)        │
                                      │  │     comprimido en gzip y brotli → cada visita copia bytes   │
                                      │  ├─ /catalogo.json  (catalogo.json, formato del LEEME)         │
                                      │  ├─ /carrito, /checkout  → carrito.js (cookie firmada)         │──► Buzón del reto
                                      │  │                                    POST pedido v1.0          │    (x-clave)
                                      │  └─ /api/asistente → asistente.js ─────────────────────────────│──► Gemini Flash-Lite
                                      └───────────────────────────────────────────────────────────────┘    (Vertex AI)
Datos de entrada (no se despliegan): tienda/datos/  ─►  scripts/limpiar_catalogo.mjs  ─►  catalogo.json
                                                        scripts/venta_cruzada.mjs     ─►  recomendaciones.json
```

Un solo servicio, sin base de datos y sin estado en el servidor: el carrito viaja en una cookie firmada, así que
da igual cuántas instancias levante Cloud Run (clave para Black Friday).

## 2. Qué hace cada fichero

| Fichero | Qué hace |
|---|---|
| `tienda/server.js` | Servidor HTTP. Cabeceras de seguridad, cookie `hk_sesion`, páginas precalculadas y comprimidas, rutas, 404/500 sin trazas, keep-alive largo para Cloud Run |
| `tienda/escaparate.js` | Portada (texto de envío/montaje gratis, índice de categorías, conjuntos, catálogo por categorías) y fichas de producto (precio, medidas, color, material, condiciones, venta cruzada, conjunto) |
| `tienda/carrito.js` | Carrito en cookie firmada con HMAC (`hk_carrito`), añadir uno o varios productos, actualizar, eliminar, checkout como invitado (nombre, email, dirección), construcción del pedido v1.0 y envío al buzón con reintentos **antes** de enseñar la confirmación |
| `tienda/conjuntos.js` | 5 conjuntos por estancia (salón, salón de piel, dormitorio, despacho, comedor) con total y un botón que añade todo de una vez |
| `tienda/ventacruzada.js` | "Lo que otros clientes se llevaron con esto" en ficha y carrito + aviso "te faltan X € para envío/montaje gratis" |
| `tienda/asistente.js` | `POST /api/asistente`. Gemini Flash-Lite con el catálogo y las condiciones en el prompt, reglas anti-inyección, recorte a <1.500 caracteres y ≤4 precios, caché y reintento |
| `tienda/catalogo.json` | Catálogo limpio publicado (53 productos), exactamente el formato del LEEME |
| `tienda/catalogo_detalle.json` | Igual + fondo y alto, solo para la web y el asistente |
| `tienda/recomendaciones.json` | Qué se compra junto, por id de proveedor (sale del historial) |
| `tienda/scripts/limpiar_catalogo.mjs` | Genera los dos catálogos desde los ficheros de los proveedores |
| `scripts/venta_cruzada.mjs` | Analiza `historial-ventas.csv` y genera `recomendaciones.json` |
| `tienda/scripts/desplegar.sh` | Despliegue oficial: exige estar en `main`, pasa la prueba local y despliega |
| `tienda/scripts/probar_local.mjs`, `medir_portada.sh`, `probar_asistente.mjs` | Pruebas antes de desplegar (fugas, latencia, asistente) |
| `scripts/comprobar.mjs` | Comprueba casi todos los hitos contra cualquier URL antes de gastar un intento |

## 3. Recorrido de una compra (lo que hace el agente)

1. `GET /` → portada precalculada. Recibe `hk_sesion` (Secure, HttpOnly, SameSite=Lax).
2. Elige un conjunto o una ficha `GET /producto/<sku>`.
3. `POST /carrito/anadir` con `sku` y `cantidad` (uno o varios pares) → 303 a `/carrito` con un aviso
   ("Has añadido el conjunto completo (8 productos)"). El carrito va en la cookie `hk_carrito`, firmada para que
   nadie la manipule; los precios siempre se recalculan desde el catálogo del servidor.
4. `/carrito` → tabla con cantidades, total, "Finalizar compra" arriba y abajo, sugerencias y aviso de umbrales.
5. `/checkout` → 3 campos con etiqueta (nombre, email, dirección) y botón "Pagar X € (pago simulado)". Sin tarjeta.
6. `POST /checkout` → valida, construye el pedido v1.0 (UUID v4, fecha ISO con zona, total sumado en céntimos),
   lo envía al buzón (2 intentos si responde 429/502/503) y **solo entonces** muestra "Pedido confirmado" y vacía el carrito.

Todo son formularios HTML normales: funciona sin JavaScript, sin ventanas emergentes y sin registro.

## 4. Cómo cubrimos cada hito

| Hito | Cómo | Dónde |
|---|---|---|
| Estamos online | Cloud Run público en `europe-southwest1` | `desplegar.sh` |
| Presente | Pedido v1.0 al buzón en cada compra, total en céntimos enteros | `carrito.js` |
| Tiempo de respuesta | HTML precalculado y comprimido al arrancar, `--min-instances 1`, `--cpu-boost`, keep-alive 620 s | `server.js`, `desplegar.sh` |
| Black Friday | Sin estado, sin limitador de peticiones, concurrencia 250, hasta 5 instancias; cada visita solo copia bytes | `server.js`, `desplegar.sh` |
| Cabeceras de seguridad | HSTS 2 años, `nosniff`, CSP `default-src 'self'; script-src 'self'` sin `unsafe-inline` (no hay JS inline) | `server.js` |
| No filtra nada | Solo se sirven rutas conocidas (lista blanca); 404/500 genéricos; sin `X-Powered-By`; `datos/` y scripts fuera del despliegue | `server.js`, `.gcloudignore` |
| Sesión en cookie segura | `hk_sesion` en la primera respuesta, Secure + HttpOnly + SameSite=Lax | `server.js` |
| Catálogo limpio | Duplicados A/B unidos por nombre normalizado y gana el más reciente; descatalogados fuera; IVA; mm/m → cm; inglés → vocabulario; plazas desde la descripción | `limpiar_catalogo.mjs` |
| Asistente e inyección | Flash-Lite (rápido y barato), catálogo y condiciones en el prompt, la pregunta va entre comillas como dato, filtro si filtra instrucciones | `asistente.js` |
| Calidad web | `lang`, title y description ≥20, viewport, un solo `h1`, labels en todos los campos, sin inline (cero errores de consola con la CSP), sin desbordamiento a 375 px | `server.js`, `escaparate.js`, `estilos.css` |
| Completa la compra / La web se entiende | Invitado, 3 campos, sin JS, sin pop-ups, categorías enlazadas, botón de pagar claro | `carrito.js`, `escaparate.js` |
| Ranking de gasto | Conjuntos completos con total visible y botón único; avisos de envío/montaje gratis (umbrales reales 500 € y 1.500 €) | `conjuntos.js`, `ventacruzada.js` |
| Venta cruzada | Sugerencias del historial: iluminación, textil, almacenaje y accesorios que se compran con cada producto | `ventacruzada.js`, `recomendaciones.json` |

## 5. Decisiones técnicas (y por qué)

- **Node sin framework.** Cero dependencias en el servidor salvo el SDK de Gemini: arranque rápido, nada que
  anuncie versión, control total de cabeceras.
- **Todo precalculado al arrancar.** El catálogo cambia solo al desplegar, así que portada y fichas se generan una
  vez y se comprimen en brotli/gzip. Mediana medida desde fuera ≈ 80 ms.
- **Carrito en cookie firmada (HMAC), sin base de datos.** Escala con cualquier número de instancias y no cuesta
  nada. Los precios nunca salen de la cookie: se recalculan con el catálogo.
- **Formularios HTML en vez de JavaScript.** El agente "ve" la página como una persona: botones reales, sin estados
  ocultos. Además la CSP estricta no rompe nada.
- **Flash-Lite para el asistente.** La nota se multiplica por la latencia (×1 si ≤3 s) y el saldo es de 5 $. El
  catálogo completo (53 productos) cabe en el prompt: no hace falta RAG.
- **Redondeo del IVA.** El proveedor calculó el neto dividiendo un PVP redondo entre 1,21. Si al multiplicar queda a
  ≤1 céntimo de un euro exacto, se usa el euro exacto (429,0055 → 429,00). Lo confirma el historial de ventas.
- **Venta cruzada con datos, no a ojo.** 320 pedidos del historial → qué se compra junto, agrupando duplicados A/B.
- **Despliegue solo desde `main`** con prueba local obligatoria (`desplegar.sh`), ramas por persona y PR.

## 6. Cómo hemos usado la IA

- Claude Code y Antigravity para escribir el código, revisar ramas, integrar el trabajo de varias personas y
  auditar el catálogo de forma independiente (recalcularlo desde cero y compararlo con el publicado).
- Scripts generados con IA para comprobar los hitos antes de gastar intentos (`comprobar.mjs`, `probar_local.mjs`).
- Gemini Flash-Lite en producción como asistente de la tienda.
- Análisis del historial de ventas para decidir conjuntos y venta cruzada.

## 7. Preguntas probables del mentor

- **¿Por qué no hay base de datos?** No hace falta: catálogo estático y carrito en cookie firmada. Menos coste, menos fallos.
- **¿Cómo evitáis que alguien cambie el precio?** La cookie solo guarda sku y cantidad, está firmada con HMAC y los precios salen del catálogo del servidor.
- **¿Cómo sabéis que el pedido es válido?** Total sumado en céntimos enteros, UUID v4, fecha ISO con zona; probado contra un buzón falso que aplica las reglas del enunciado.
- **¿Cómo resiste el asistente la inyección?** Reglas de seguridad en la instrucción de sistema, la pregunta va delimitada como dato, temperatura baja y filtro de salida.
- **¿Dónde está la clave del buzón?** En una variable de entorno de Cloud Run, nunca en el repositorio.
- **¿Qué pasa con 200 visitantes a la vez?** Cada visita solo copia bytes de memoria; sin estado, Cloud Run escala.

## 8. Qué haríamos con más tiempo

- **Venta cruzada 0/80:** revisar el "Detalle" de la prueba en el portal. Hipótesis: el agente solo compró lo que
  necesitaba (o lo que añadió de esas categorías contaba como necesario). Idea: sugerir complementos de categorías
  distintas a las de su necesidad y destacarlos en el carrito justo antes de pagar.
- Clave del buzón en **Secret Manager** (`--set-secrets`) en vez de variable de entorno.
- Buscador en la portada (la rama `miguel` tiene uno en JavaScript) e imágenes de producto.
- Pruebas automáticas en CI en cada PR (las de `probar_local.mjs` y `comprobar.mjs`).

## 9. Avisos para el equipo

- `desplegar.sh` usa `--set-env-vars`, que **reemplaza todas las variables** del servicio: si `CLAVE_EQUIPO` no va en
  esa misma línea (o como secreto), un redespliegue la borra y los pedidos dejan de llegar al buzón.
- Lo desplegado debe salir de `main`. Si infra despliega cambios locales, hay que subirlos a `main` para que el
  repositorio que entregamos sea lo que funciona.
