# Planeación del panel

Lo que falta en `app.nassican.com`, en el orden en que conviene hacerlo. Cada
punto dice por qué existe, qué se hace y cómo se sabe que quedó bien. Lo ya
construido está documentado en `CLAUDE.md`; esto es solo lo pendiente.

Revisado el 4 de octubre de 2026. Los hallazgos de móvil salen de revisar el
código, no de un teléfono: el panel **nunca se ha probado en uno**, y esa es la
razón de que el punto 1 vaya primero.

---

## 0. Antes que nada: subir lo que ya está hecho

**Por qué.** Las sesiones de copias, papelera, restauración, ISBN, pegar
imágenes, salud del sitio, suscripciones, bitácora y fechas con calendario no
están en git. Unos treinta archivos sin commit. Las migraciones **sí** están
aplicadas en la base de producción —son aditivas, así que lo desplegado sigue
funcionando—, pero cuanto más tiempo pase, más difícil es revisar el cambio y
más fácil perderlo.

**Qué.** Commits por tema, no uno gigante:

1. Copias de seguridad, restauración desde el panel y puntos de restauración.
2. Papelera.
3. ISBN, pegar imágenes en el editor y `/api/health` del sitio.
4. Suscripciones, bitácora y el selector de fechas.
5. Listas en bloque y nombres de día adaptables.

**Cómo se verifica.** `npm run build` en limpio (con `dev:admin` detenido, por el
`EPERM` de Prisma), despliegue, y abrir `www.nassican.com/api/health/db`.

---

## 1. Vista móvil — prioridad alta

### 1.1 El iPhone hace zoom en cada campo

**Por qué.** Safari en iOS amplía la página al enfocar cualquier campo con letra
menor de 16 px, y no la devuelve. Los 158 campos del panel usan `text-sm` (14 px),
definidos en **18 copias** de la misma constante `field`. Escribir una nota en la
bitácora desde el teléfono hoy es pelear con el zoom.

**Qué.** Una sola constante compartida en `lib/ui.ts` con `text-base sm:text-sm`,
y las 18 copias importándola. Arregla el zoom y quita la duplicación de paso.

**Cómo se verifica.** Ninguna aparición de `const field =` fuera de `lib/ui.ts`;
en un iPhone, tocar un campo no amplía la página.

### 1.2 La paleta ⌘K no existe en el teléfono

**Por qué.** Solo se abre con el teclado. En móvil es, además, la forma más rápida
de moverse: el menú lateral obliga a abrir el cajón y desplazarse.

**Qué.** Un botón de lupa en la cabecera que abre la paleta, visible en todos los
tamaños, con «Ctrl K» como pista en escritorio.

### 1.3 Botones demasiado pequeños para un dedo

**Por qué.** Diez botones solo-icono (editar, papelera, quitar hora…) miden entre
20 y 26 px. Lo recomendado son 44 px, y por debajo de eso se falla el toque y se
pulsa el de al lado — que a veces es «mover a la papelera».

**Qué.** Área táctil de 40–44 px en pantallas táctiles con la variante
`pointer-coarse:` de Tailwind v4, sin cambiar cómo se ven en escritorio.

### 1.4 Explicaciones escondidas en `title`

**Por qué.** Hay 24 `title` con información, y en un móvil no hay ratón que los
muestre. Los que importan están en **Usuarios**: por qué no puedes desactivar una
cuenta o quitarte el rol de propietario se explica solo ahí. En el teléfono el
control simplemente no responde y no hay forma de saber por qué. (Los botones
«Guardar» de Juegos, Libros y Suscripciones no tienen el problema: sus razones
también salen en una lista visible.)

**Qué.** Las razones de Usuarios como texto visible junto al control; el resto
de `title`, revisados uno por uno.

### 1.5 Acciones que dependen del cursor

**Por qué.** Los botones de las notas de la bitácora se ven al 60 % hasta pasar el
ratón. En táctil no hay «pasar el ratón».

**Qué.** Opacidad completa con `pointer-coarse:`.

### 1.6 Filas con demasiados controles

**Por qué.** Una suscripción tiene «Pagado», «Meses», selector de estado, editar y
borrar en la misma fila; un juego, selector de estado y dos iconos. En 375 px
eso se parte en tres líneas desordenadas.

**Qué.** En móvil, la acción principal visible («Pagado», el estado) y el resto
detrás de un menú «⋯».

### 1.7 Tablas anchas

**Por qué.** Las cinco tablas tienen scroll horizontal, así que no se rompen.
Pero Movimientos mide 42 rem: en el teléfono se ve un tercio de cada fila.

**Qué.** Movimientos como tarjetas por debajo de `sm`; las de Analítica, SEO y
Estadísticas pueden quedarse con scroll.

### 1.8 El calendario en iOS

**Por qué.** `DateField` abre el calendario nativo con `showPicker()` sobre un
campo de 1 px. Funciona en Chrome; en Safari de iOS **no está comprobado**.

**Qué.** Probarlo. Si falla, en móvil el botón muestra un `<input type="date">`
visible en lugar del oculto.

### 1.9 La bitácora en el teléfono

**Por qué.** En móvil el formulario de nota y el resumen quedan **antes** que los
días: hay que desplazarse una pantalla entera para ver la semana.

**Qué.** En móvil, el formulario plegado tras un botón «Escribir una nota», y el
resumen al final.

### Cómo verificar todo el punto 1

El repositorio no tiene pruebas de interfaz: todo lo visual se ha comprobado
leyendo HTML. Dos caminos:

- **Manual**, con el modo dispositivo de las DevTools a 375, 768 y 1280 px, más
  una pasada en un iPhone real para 1.1 y 1.8, que el emulador no reproduce.
- **Playwright** como dependencia de desarrollo, con un `npm run screens` que
  saque capturas de cada módulo a los tres anchos. Es una dependencia nueva y la
  regla del repositorio pide justificarla: la justificación es que hoy ningún
  cambio visual tiene red, y el móvil es donde más se nota.

---

## 2. Instalable en el teléfono — prioridad media

**Por qué.** Para usar Bitácora, Suscripciones o Juegos desde el móvil, abrir el
navegador y escribir la dirección es la fricción que hace que no se use.

**Qué.** `app/manifest.ts` con nombre, colores e iconos de 192 y 512 px, y
`themeColor` en el layout. **Sin service worker ni modo offline**: los datos son
en vivo y una caché offline mostraría cifras viejas como si fueran actuales.

**Cómo se verifica.** «Añadir a pantalla de inicio» abre el panel a pantalla
completa, con su icono.

---

## 3. Avisos que llegan sin abrir el panel — prioridad media

**Por qué.** Una renovación que vence, un cron que falló o una copia de seguridad
con un mes de antigüedad solo se ven **si abres el dashboard**. El planificador
corre a las 06:00 sin nadie delante, y sus avisos esperan a que alguien los mire.

**Qué.** Un correo diario desde el cron, **solo cuando hay algo que decir**: un
correo cada día que no dice nada es un correo que se aprende a ignorar.

**Decisión pendiente.** El proveedor de correo. Resend tiene capa gratuita y se
puede llamar con `fetch` sin SDK, así que no añadiría dependencia.

---

## 4. Productividad en lo que ya existe — prioridad media

- **Edición en línea en Juegos y Libros.** Precio, horas y estado en la propia
  fila, con Tab para pasar a la siguiente. Rellenar 66 juegos llevó 102 minutos.
- **«¿Terminado hoy?»** Al marcar un juego o libro como terminado desde la lista,
  ofrecer en el aviso un botón que ponga la fecha de fin de hoy. Así la bitácora
  lo cuenta como terminado, sin estampar la fecha a ciegas en una puesta al día
  de la biblioteca.
- **Recordatorio del resumen semanal.** Un aviso en el dashboard el lunes si la
  semana anterior no tiene resumen.

---

## 5. Deuda técnica — prioridad baja

- **Scopes de Google.** `CLAUDE.md` deja pendiente quitar `analytics.readonly` y
  `webmasters.readonly` del login una vez confirmado que la service account lee.
  Confirmarlo y cerrarlo, o seguirá caducando el token cada 7 días.
- **Copia automática fuera de Neon.** Hoy depende de que alguien la descargue. Con
  una VPS o un almacén de objetos, el cron podría dejarla allí.
- **Advertencia del build.** Cada build avisa del `export *` sobre el cliente
  CommonJS de Prisma en `packages/db/src/index.ts`. No rompe nada, pero tapa
  avisos nuevos entre el ruido.

---

## 6. El sitio público

- **Cero artículos publicados.** El RSS, el índice de contenidos y la vista previa
  esperan contenido. Para el SEO, un artículo vale más que cualquier mejora
  técnica de esta lista.
- **Medición móvil del sitio.** Una pasada de Lighthouse en móvil para tener una
  cifra de partida antes de tocar nada.

---

## Orden sugerido

| fase | qué | por qué en ese orden |
| --- | --- | --- |
| 1 | 0 · 1.1 · 1.2 · 1.3 · 2 | subir lo hecho, y lo que más estorba en el teléfono con lo que menos cuesta |
| 2 | 1.4 – 1.9 · 4 | el resto del móvil, verificado a tres anchos, y los ahorros de tiempo |
| 3 | 3 · 5 · 6 | lo que necesita una decisión tuya o depende del hosting |
