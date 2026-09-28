# Rent & Trippin — idea.md

## 1. La idea en diez renglones o menos

- Es una agencia de viajes digital en Venezuela, manejada por mi hermano.
- Vende pasajes aéreos nacionales e internacionales desde Venezuela.
- También vende hoteles, tours y entradas a conciertos.
- Hoy funciona solo por Instagram y WhatsApp, sin ningún sistema.
- Todo es manual: no hay ninguna herramienta de por medio.
- El trabajo diario es cobrar, enviar la información detallada de cada reserva a cada cliente, y darle seguimiento manual a cada una.
- Los clientes son venezolanos que están dentro de Venezuela.
- O son venezolanos de la diáspora que compran para sí mismos o para familiares que viven allá.

## 2. Tres listas

### Lo que dijiste con claridad
- Qué vende: pasajes aéreos (nacionales e internacionales desde Venezuela), hoteles, tours, entradas a conciertos.
- Cómo opera hoy: solo por Instagram y WhatsApp, sin ningún sistema.
- Las tres tareas del día a día: cobrar, enviar la información de cada reserva, y dar seguimiento manual a cada una.
- Quiénes son los clientes: venezolanos dentro de Venezuela, y venezolanos de la diáspora comprando para sí mismos o para familiares en Venezuela.

### Lo que dijiste a medias
- "Cobrar" — no dijiste cómo cobra hoy (efectivo, Zelle, transferencia, tarjeta, cripto, otra).
- "Enviar la información detallada de cada reserva" — no dijiste qué información exactamente ni en qué formato la manda (texto, PDF, imagen, captura).
- "Estar pendiente/dar seguimiento a cada una manualmente" — no dijiste en qué consiste ese seguimiento (confirmar con el proveedor, avisar cambios, recordarle fechas al cliente, algo más).
- "Agencia digital de viajes" — no dijiste si mi hermano trabaja solo o tiene alguien más ayudándolo.

### Lo que nunca mencionaste y hace falta
- Quién le vende a él los pasajes, hoteles, tours y entradas (aerolíneas directo, consolidadoras, mayoristas, otras agencias).
- Cómo cobra y cómo les paga a los proveedores.
- Qué pasa cuando algo sale mal (vuelo cancelado, hotel no confirma, cliente no paga, entrada agotada).
- Cuántas reservas maneja aproximadamente por semana o por mes hoy.
- Si hay más gente, además de él, involucrada en el negocio.

## 3. Seis preguntas

- **¿Quién la usa?** Dijiste que la usa mi hermano (la agencia); no dijiste si el cliente también entraría a la app o solo recibe mensajes.
- **¿Qué problema le quita de encima hoy?** El trabajo manual de cobrar, mandar la información de cada reserva y dar seguimiento a cada cliente uno por uno.
- **¿Cómo resuelve eso hoy, sin la app?** Por Instagram y WhatsApp, a mano, sin ningún sistema.
- **¿Qué tiene que pasar adentro para que valga la pena abrirla otra vez mañana?** No lo dijiste — falta esa información.
- **¿Qué información se guarda y quién más la puede ver?** No lo dijiste — falta esa información.
- **¿Cómo sabría yo, en un mes, que sirvió de algo?** No lo dijiste — falta esa información.

## 4. Las preguntas que me faltan — con respuestas

1. **¿Quién va a usar la app: solo tu hermano, o también los clientes?** Ambos. Mi hermano la usa para llevar control interno de todo, y los clientes tienen su propio login para ver sus reservas. Además quiere agregar un sistema de rewards/puntos para clientes frecuentes.
2. **¿Cómo cobra hoy y en qué moneda?** En efectivo, Zelle y Binance — tanto en dólares como en bolívares.
3. **¿Quién le vende a él los pasajes, hoteles, tours y entradas?** Le compra a todas las opciones: aerolíneas directo, consolidadoras/mayoristas, y otras agencias, dependiendo del caso.
4. **¿En qué consiste exactamente "dar seguimiento" a una reserva?** Confirmar con el proveedor que la reserva quedó bien, avisarle al cliente si algo cambia, y recordarle fechas importantes antes del viaje. Hoy lo hace todo manualmente por WhatsApp.
5. **¿Cuántas reservas maneja aproximadamente por semana o por mes?** Entre 10 y 15 reservas por semana.
6. **¿Trabaja solo o tiene equipo?** Trabaja solo, sin equipo.
7. **¿Qué pasa hoy cuando algo sale mal?** Depende de quién tuvo la culpa — si fue un error suyo o del cliente al dar mal un dato, así se resuelve el reclamo.
8. **¿Qué te haría decir, dentro de un mes, que la app sirvió de algo?** Que se automatizó el trabajo manual que hace hoy.

## 5. Cierre

**Versión original:**
Es una app que le sirve a mi hermano y su agencia de viajes para organizar el cobro, el envío de información y el seguimiento de cada reserva, sin depender solo de Instagram y WhatsApp.

**Versión actualizada** (con login de clientes + base de datos + rewards):
Es una app que le sirve a mi hermano para llevar el control de todas sus reservas, cobros y seguimientos en un solo lugar en vez de a mano por WhatsApp, y les sirve a sus clientes para ver sus propias reservas, recibir avisos de cambios y fechas importantes, y — más adelante — acumular puntos por ser clientes frecuentes.

## 6. Esqueleto MVP vs. Fase 2

### MVP (versión mínima para lanzar)

**Para mi hermano (panel del negocio):**
- Login del negocio (un solo usuario, él).
- Crear una reserva nueva: tipo (pasaje, hotel, tour, entrada), datos del cliente, datos del viaje/servicio, precio, moneda (USD/Bs).
- Registrar el cobro de esa reserva: método (efectivo, Zelle, Binance, tarjeta internacional vía Payoneer) y si está pagado o pendiente.
- Ver lista de todas las reservas activas, con su estado (confirmada, pendiente de confirmar con el proveedor, con problema).
- Marcar una reserva como "confirmada con el proveedor".
- Registrar y ver fechas importantes de cada reserva (para no tener que recordarlas de memoria).
- Historial simple de reservas pasadas por cliente.

**Para el cliente:**
- Login propio (ver solo sus reservas, no las de otros).
- Ver el detalle de cada reserva suya: qué compró, fecha, estado, precio.
- Ver si está pagada o pendiente.
- Subir una foto/captura de su comprobante de pago (Zelle o Binance) al momento de reservar.
- Para pago con tarjeta internacional: al reservar, se le genera un link de pago de Payoneer. Hace clic, paga en la página de Payoneer, y regresa a la app.

**Para mi hermano — verificación de pago:**
- Ver el comprobante subido por el cliente (Zelle/Binance).
- Confirmar el pago manualmente con un clic (pasa de "pendiente" a "pagado"). Esto aplica también al pago con Payoneer, ya que sin cuenta empresarial no hay forma automática de confirmar que el link fue pagado — mi hermano lo verifica en su cuenta de Payoneer y confirma manualmente en la app.

**Notificaciones (lo mínimo indispensable):**
- Aviso al cliente si algo cambia en su reserva.
- Recordatorio antes de una fecha importante del viaje.

*Nota: esto es lo que yo entiendo como mínimo indispensable a partir de lo que has contado hasta ahora — falta validar contigo el detalle de cada pantalla antes de construir nada.*

### Fase 2 (después del lanzamiento)

- Sistema de rewards/puntos para clientes frecuentes.
- Explorar verificación automática de pagos vía la API de Binance (solo aplicaría a pagos hechos en Binance; Zelle no tiene forma de verificarse automáticamente por terceros, así que ahí siempre haría falta la confirmación manual).
- Si el negocio crece, evaluar constituir una LLC en EE.UU. para poder usar Stripe con checkout embebido directamente en la página (en vez de redirigir al cliente a la página de Payoneer). Hoy no se puede porque el checkout embebido de Payoneer (Payoneer Checkout API) requiere cuenta empresarial y aprobación como partner, que no se tiene todavía.
- Historial de reclamos o incidencias (quién tuvo la culpa, cómo se resolvió), en vez de llevarlo solo de memoria.
- Reportes o resumen del negocio (cuánto vendió, cuánto cobró en cada moneda/método).
- Soporte para más de un usuario interno, si en algún momento contrata ayuda.
- Catálogo o vitrina de tours/hoteles/entradas disponibles (hoy todo es a pedido por WhatsApp/Instagram).
- Integración directa con proveedores (aerolíneas, consolidadoras) en vez de cargar todo a mano.
- Chat o mensajería dentro de la app (para no depender de WhatsApp para todo).

## 7. Arquitectura técnica (antes de escribir código)

### 7.1 Qué construir: ¿app web o app nativa?

**Recomendación: una sola app web "responsive"** (se ve y funciona bien en celular y en computadora), que además se pueda "instalar" desde el navegador para que quede como un ícono en la pantalla de inicio del celular (esto se llama PWA — técnicamente sigue siendo una página web, pero se siente como una app).

**Por qué no una app nativa (la que se descarga de App Store/Play Store):**
- Significa construir y mantener dos aplicaciones separadas (iPhone y Android) — el doble de trabajo y de costo.
- Hay que pasar por la revisión de Apple y Google cada vez que se actualiza algo.
- Ni tú ni tu hermano programan — mientras menos piezas técnicas haya que mantener, mejor.
- Con 10-15 reservas por semana no hace falta esa complejidad todavía; si el negocio crece mucho, ahí se evalúa una app nativa.

Una sola app web cubre las dos necesidades (hermano y clientes) con un solo sistema que mantener.

### 7.2 Qué tecnología usar (stack)

Prioridad: rápido de construir, fácil de mantener sin ser programador experto, y barato.

- **Frontend (lo que se ve):** Next.js — el estándar más usado hoy para este tipo de apps, con muchísima documentación, lo que facilita el mantenimiento futuro (por otro desarrollador o por una IA).
- **Backend + base de datos + login + almacenamiento de fotos:** Supabase — da todo junto y ya armado: base de datos, sistema de login (para el hermano y para los clientes), y almacenamiento para las fotos de comprobantes. Evita construir esas piezas desde cero.
- **Pagos con tarjeta internacional:** Payoneer (link de pago generado por reserva, sin integración embebida — el cliente sale de la app, paga en Payoneer, y regresa).
- **Hosting:** Vercel — se conecta directo con Next.js, gratis para empezar y barato al crecer.

En resumen: **Next.js + Supabase + Vercel + links de pago de Payoneer**. Combinación muy usada, bien documentada, y barata mientras el negocio es pequeño.

### 7.3 Cómo se estructura la base de datos (a alto nivel)

- **Clientes** — nombre, teléfono/correo, y si es cliente o admin (tu hermano).
- **Reservas** — a qué cliente pertenece, tipo (pasaje, hotel, tour, entrada), detalles del viaje/evento, precio, moneda (USD o Bs), estado (pendiente, confirmada con el proveedor, con problema).
- **Pagos** — a qué reserva pertenece, método (efectivo, Zelle, Binance, tarjeta/Payoneer), monto, moneda, comprobante (foto, si aplica) o link de pago (si es Payoneer), y estado (pendiente de revisión / confirmado). Para todos los métodos —incluyendo Payoneer, mientras no haya cuenta empresarial— la confirmación final la hace mi hermano manualmente.
- **Recordatorios/avisos** — a qué reserva pertenece, tipo (cambio o recordatorio de fecha), y si ya se envió.

Conexión: **un cliente tiene varias reservas → cada reserva tiene un pago (con su comprobante o link) → cada reserva puede tener recordatorios asociados.**

### 7.4 Plan de fases de construcción

1. **Base:** crear las cuentas necesarias (Supabase, Vercel, Payoneer) y dejar armadas las tablas de información (clientes, reservas, pagos).
2. **Login:** que el hermano entre como admin, y que cada cliente tenga su propio login.
3. **Panel del hermano:** crear una reserva, verla en una lista, cambiar su estado.
4. **Panel del cliente:** ver sus propias reservas, su estado y su precio.
5. **Cobro y comprobante:** que el cliente pueda pagar (efectivo/Zelle/Binance con foto de comprobante, o tarjeta con link de Payoneer) y que el hermano confirme el pago con un clic.
6. **Avisos:** notificar al cliente si algo cambia, y recordarle fechas importantes antes del viaje.
7. **Prueba real:** usarlo con reservas de verdad durante unas semanas y ajustar lo que no funcione bien.

Cada paso depende del anterior — no se puede mostrar reservas sin login, ni cobrar sin tener reservas creadas. Fase 2 (rewards, reportes, verificación automática con Binance, Stripe si se constituye una LLC, etc.) se aborda después de que este MVP esté probado y funcionando.

## 8. Estilo visual

**Referencias:**
- `DESIGN.md` (en esta misma carpeta) — extraído del repo público [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md), sección Apple. Análisis técnico del lenguaje visual del sitio de Apple (colores, tipografía, espaciados, componentes). Se usa como guía de principios, no como plantilla a copiar literalmente.
- `assets/Rent_a_trippin-01.png` — logo oficial de la marca. [Confirmado]

### Identidad de marca (Rent & Trippin)

- **Color principal (morado de marca) [Confirmado]:** `#482583` — extraído directamente de los píxeles del logo (color sólido, un solo tono, sin degradado).
  - Variante para hover/foco (+12% más claro): `#5D3F91`
  - Variante para estado activo/presionado (-15% más oscuro): `#3D1F6F`
  - Variante clara para fondos o superficies suaves (+30% más claro): `#7E66A8`
  - Contraste del morado base contra blanco: 11.24:1 — de sobra para texto y botones (el mínimo recomendado para texto normal es 4.5:1).
- **Ícono de marca:** un avión estilizado dentro de un círculo — se puede reutilizar como favicon, loader/spinner de carga, o marca de agua discreta.
- **Personalidad tipográfica del logo:** letras muy gruesas (bold/extrabold), formas redondeadas y geométricas, sin serifas — transmite algo amigable y sólido a la vez, distinto a la delgadez elegante de Apple.

### Cómo combinamos Apple + la identidad de Rent & Trippin

De Apple tomamos la **disciplina** (espacio, jerarquía, quietud); de Rent & Trippin tomamos la **personalidad** (el morado, la forma bold/redondeada). No se pelean: Apple aporta el silencio de fondo para que el morado y las fotos de viaje sean lo único que llame la atención.

- **La foto es la protagonista, no la interfaz.** Fotografía grande y de calidad de destinos, hoteles, tours y conciertos, a página completa — igual que Apple con sus productos.
- **Un solo color de acento: el morado `#482583`.** Todo botón, link o elemento interactivo usa este morado (y sus variantes de hover/activo) — ningún segundo color compite por atención, igual que el azul único de Apple.
- **Mucho espacio en blanco, cada sección respira.** Secciones grandes con aire arriba y abajo; se puede alternar fondo blanco/claro y fondo oscuro (casi negro) entre secciones, como hace Apple, usando el morado como acento sobre ambos.
- **Títulos bold y redondeados, no delgados.** A diferencia de Apple (que usa pesos finos/medios), los títulos de Rent & Trippin deben verse gruesos y redondeados, en línea con el logo. Tipografía sugerida: **Poppins** o **Fredoka** (ambas gratuitas, en Google Fonts) en su peso ExtraBold/Bold para títulos — se ven modernas, amigables y redondeadas, cercanas al espíritu del logo.
- **Texto de cuerpo limpio y legible, estilo Apple.** Para párrafos y texto pequeño sí seguimos el criterio de Apple: tipografía más neutra y cómoda de leer. Sugerido: **Inter** (gratuita, Google Fonts) en peso regular — deja que los títulos bold sean los que tengan personalidad, y el cuerpo de texto no compita con ellos.
- **Casi cero decoración.** Sin sombras decorativas, sin bordes por todos lados, sin degradados de fondo — la única sombra suave, si se usa, va debajo de las fotos (destinos/hoteles), nunca en botones ni tarjetas.
- **Botones tipo "pill" (bien redondeados) en morado** para las acciones principales (reservar, pagar, confirmar) — combina el grammar de botón de Apple con el color propio de la marca.
- **Transiciones suaves, nunca bruscas.** Cambios de sección con fundidos suaves, botones que responden con un leve "encogimiento" al presionarlos — el movimiento es para que la app se sienta pulida, no para llamar la atención sobre sí mismo.

### Cómo se traduce a las pantallas de viajes

- Una sección grande por tipo de servicio (vuelos, hoteles, tours, entradas), con foto grande del destino/evento, titular bold en morado o negro, y un botón "pill" morado ("Reservar", "Ver disponibilidad").
- El ícono del avión del logo puede usarse como elemento decorativo sutil en pantallas de carga o confirmación de reserva (por ejemplo, una animación suave del avión "volando" mientras se procesa un pago).
- Selección de fecha/ciudad/tipo de habitación o entrada con tarjetas redondeadas seleccionables, usando el morado para marcar la opción elegida (equivalente al `configurator-option-chip-selected` de Apple, pero en morado en vez de azul).
- El flujo de pago (efectivo/Zelle/Binance con comprobante, o tarjeta vía Payoneer) debe sentirse igual de simple y confiable que un "Buy" de Apple — pocos pasos, botón morado claro al final.

### Decisiones confirmadas
- **Tipografía de títulos [Confirmado]:** no existe la fuente original del logo. Se usa Poppins o Fredoka (Google Fonts, gratuitas) como ya se había definido.
- **Fotografía [Confirmado]:** el negocio no tiene banco de fotos propias. Por ahora se usan fotos de bancos de imágenes de stock libres de derechos (ej. Unsplash, Pexels) para destinos, hoteles, tours y conciertos. Se pueden reemplazar por fotos propias más adelante si el negocio las genera.
