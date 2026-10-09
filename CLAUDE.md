# CLAUDE.md

Guía del repositorio para agentes que trabajen en este proyecto.

## Estructura del repositorio

Es un monorepo de workspaces de npm:

| Workspace | Qué es |
| --- | --- |
| `apps/web` | Sitio público bilingüe → `nassican.com` |
| `apps/admin` | Plataforma de gestión, en español → `app.nassican.com` |
| `packages/shared` | `Locale`, `Localized<T>`, `ContentBlock` y utilidades puras |
| `packages/db` | Esquema Prisma y cliente de base de datos |

**Todos los caminos `src/...` de este documento son relativos a `apps/web/`**,
salvo que se indique otra cosa; el resto del documento describe el sitio
público. Cada aplicación tiene su propio `package.json`, `tsconfig.json` y
alias `@/*`: no hay imports cruzados entre `apps/web` y `apps/admin`, lo
compartido va en `packages/`.

Los comandos se ejecutan desde la raíz del repositorio, no desde `apps/web`.

### `packages/shared`

Dueño de `locales`, `Locale`, `Localized<T>` y del tipo `ContentBlock` con sus
utilidades (`wordCount`, `readingMinutes`, `headingId`, `extractLinks`).
También de lo que las dos aplicaciones tienen que entender igual y ninguna
posee: los nombres de etiqueta de caché, las claves de las secciones de la
portada y la forma del menú (`NavTree`).
`src/lib/i18n/config.ts` y `src/lib/data/content.ts` los reexportan, así que
dentro de `apps/web` se siguen importando desde donde siempre. Al tocar
cualquiera de esos tipos, edítalos en `packages/shared`, no en el reexport.

### `packages/db`

El esquema vive en `packages/db/prisma/schema.prisma`. Dos convenciones lo
recorren entero:

- **Las traducciones son filas.** Cada entidad con texto visible se parte en un
  modelo base y un `*Translation` con clave `(entidadId, locale)`.
- **Los cuerpos siguen siendo `ContentBlock[]`** en columnas `jsonb`. Prisma
  los tipa como `Json` opaco, así que el cliente extendido de
  `packages/db/src/index.ts` es **el único sitio donde se hace el cast** al
  leer, y `prismaJson` de `src/json.ts` el único por donde se escribe. No
  castees JSON en ningún otro archivo.

El enum `Locale` de Postgres y la lista `locales` de `packages/shared` tienen
que moverse juntos; `localeParity` en `src/index.ts` falla al compilar si se
separan.

#### La frontera cliente/servidor no es negociable

`packages/db` empieza con `import "server-only"`. Si un componente de cliente
lo alcanza —aunque sea a través de tres reexportaciones— el build falla y
nombra al culpable. Sin esa guarda el error aparece en el navegador, en tiempo
de ejecución, con el mensaje inútil «PrismaClient is unable to run in this
browser environment», y **el build pasa igualmente**: compilar no demuestra que
la frontera esté bien.

Dos consecuencias prácticas:

- **Un componente de cliente nunca importa de un módulo que consulte la base.**
  Los tipos y las funciones puras que necesite van en un módulo aparte
  (`apps/admin/src/lib/post-draft.ts` frente a `posts.ts`), o en
  `packages/shared`.
- **El barril `apps/web/src/lib/data/index.ts` no reexporta las consultas de
  artículos**, porque tres componentes de cliente importan de él.
  `getPublishedPosts` y `getPost` se importan desde `@/lib/data/posts`.

Al tocar esto, la verificación no es `npm run build` sino comprobar que Prisma
no aparece en los bundles de cliente:

```bash
grep -rl "PrismaClient" apps/web/.next/static apps/admin/.next/static
```

### Latencia: por qué el panel iba lento y qué se hizo

El panel se sentía congelado al navegar. La causa no era el código: era **el
pooler de Neon**. Medido desde Bogotá contra `us-east-1`, con el ida y vuelta
TCP en 75 ms:

| camino | consulta suelta (mediana) |
| --- | --- |
| endpoint agrupado (`-pooler`), protocolo de cable | **560 ms** |
| endpoint directo, protocolo de cable | 86 ms |
| endpoint agrupado, adaptador de Neon | **102 ms** |

Es decir, el pooler cobraba ~460 ms por consulta, y cada página del panel son
entre tres y diez consultas. Eso, y no el render, era el segundo y medio de
espera.

**El endpoint directo no es la respuesta**, aunque sea igual de rápido: en un
despliegue serverless las funciones son efímeras y agotarían el límite de
conexiones de Postgres. Por eso `packages/db/src/index.ts` usa
`@prisma/adapter-neon`, que conserva el endpoint agrupado y evita el peaje. De
paso desaparece el `Error in PostgreSQL connection: Closed` intermitente: ya no
hay un socket TCP de larga vida que se pueda cerrar por debajo.

Las migraciones no pasan por ahí: la CLI lee `url` y `directUrl` del esquema.

**Cuidado al leer estos números.** Están medidos desde Colombia. En Vercel las
funciones corren en la misma región que la base, así que allí la diferencia
será menor — lo que no cambia es que el adaptador es el camino correcto para
serverless, y que las dos mejoras de abajo valen en cualquier sitio.

#### Un viaje de ida y vuelta es el coste de una consulta

A esta distancia da igual lo que pese la consulta: lo que se paga es el viaje.
De ahí dos reglas que ya costaron tiempo por no seguirse:

- **Todo lo que no dependa de nada va en el mismo `Promise.all`.** `getStats`
  hacía tres consultas sueltas después del suyo, y dos de ellas pedían columnas
  (`coverMediaId`) que ya venían en las filas leídas.
- **Sembrar no se comprueba en cada render.** `getConfigDraft` hacía tres
  consultas para confirmar algo que solo es cierto la primera vez. Ahora lee
  primero y siembra únicamente si faltaba algo. Bajó de 1800 ms a 204 ms.

Resultado, con las tres cosas juntas:

| módulo | antes | ahora |
| --- | --- | --- |
| `getStats` | 2031 ms | 430 ms |
| `getConfigDraft` | 1800 ms | 204 ms |
| `listProjects` | 1438 ms | 405 ms |
| `listPages` | 1256 ms | 241 ms |
| `listPosts` | 1114 ms | 229 ms |
| `getProfileDraft` | 1125 ms | 306 ms |

#### Esqueletos: la espera se ve, no se adivina

Sin un `loading.tsx`, Next deja la página anterior en pantalla mientras el
componente de servidor espera a Postgres, y el panel se lee como colgado. Cada
módulo tiene ahora el suyo, construido con las piezas de
`components/Skeleton.tsx`, y `(panel)/loading.tsx` cubre cualquier ruta que no
traiga uno propio.

No hacen nada más rápido: ponen la espera donde van a caer los datos. Por eso
las formas imitan el módulo —fichas donde habrá fichas, filas donde habrá
filas— y por eso el bloque del gráfico de Analítica reserva su altura: sin ella
la página pega un salto cuando llegan los datos.

`(panel)/error.tsx` es la otra mitad. Los fallos que este panel ve de verdad
son transitorios, así que merecen un botón de reintentar —que vuelve a ejecutar
el componente de servidor— y no una traza.

#### Guardar ya no espera al sitio

El aviso al sitio público costaba entre 150 ms y 1,5 s en cada guardado —el
viaje a Vercel, más un arranque en frío si el sitio llevaba rato quieto—, y
nada de eso cambia lo que se guardó. `notifyPublicSite` lo mete en `after()`,
que corre cuando la respuesta ya va de camino.

El aviso de fallo no se pierde, se muda: acaba en `system_events` y lo lista
Sistema. Que es donde debía estar desde el principio — una caché que no se
limpió es un problema del despliegue, no de lo que el operador acababa de
guardar, y meterlo dentro de un mensaje de «guardado» siempre fue el sitio
ligeramente equivocado.

#### Windows: el motor de Prisma se queda bloqueado

`prisma generate` renombra `query_engine-windows.dll.node`, y un servidor de
desarrollo en marcha lo tiene abierto. Detén `npm run dev` y `npm run dev:admin`
antes de migrar o compilar, o verás `EPERM: operation not permitted, rename`.

### La regla de traducción con base de datos

`Localized<T>` hacía que una traducción faltante rompiera el build. Con el
contenido en filas eso deja de ser posible: la comprobación se desplaza al
momento de publicar. Una entidad no pasa a `published` si le falta cualquier
locale. Los diccionarios de interfaz (`src/lib/i18n/dictionaries/`) **no se
migran**: siguen en el código, donde el tipo `Dictionary` sigue rompiendo el
build.

`apps/admin` es de un solo operador y está en español únicamente. La regla
bilingüe cubre lo que leen los visitantes, no el panel — pero lo que el panel
*edita* sí es bilingüe y se valida antes de publicar.

### Autenticación del panel

Better Auth con Google como único proveedor. `src/lib/auth.ts` concentra la
configuración; el acceso está cerrado tres veces y cada cierre funciona sin los
otros dos:

1. Google verifica la identidad.
2. `ADMIN_ALLOWED_EMAILS` rechaza cualquier otra dirección en el hook
   `user.create.before`, antes de que exista fila.
3. `isActive` en la fila se comprueba al crear sesión y en cada petición, así
   que revocar el acceso no depende de Google.

Las rutas protegidas viven en el grupo `src/app/(panel)/`, cuyo layout llama a
`requireUser()` antes de renderizar nada. `/login` queda fuera del grupo. No
hay middleware: la comprobación en el layout es la de verdad, y añadir una
optimista en el proxy solo ahorraría un viaje al servidor.

`requireUser()` relee el usuario en cada petición en vez de fiarse de la sesión,
para que desactivar una cuenta surta efecto de inmediato.

#### El armazón

`components/PanelShell.tsx` dibuja el marco —menú, cabecera, cajón móvil— y es
un componente de **cliente**, porque el menú tiene que saber qué ruta está
abierta. El layout sigue siendo de servidor: llama a `requireUser()` y le pasa
solo los cuatro campos que se muestran, no el usuario entero. `children` llega
ya renderizado en el servidor, así que envolver el layout no arrastra ninguna
página al bundle del navegador.

El menú vive en `lib/navigation.ts` como datos puros, con el icono en forma de
clave y no de componente: así el módulo lo puede importar el servidor y es
`PanelShell` quien mapea la clave al dibujo. `activeHref()` decide qué entrada
se ilumina — coincidencia exacta solo para el dashboard, y por subárbol para el
resto, de modo que el editor de un artículo mantiene «Blogs» encendido. Gana la
coincidencia más larga, que es lo que evita que una ruta anidada active a un
hermano más corto.

El cajón móvil **deriva** su apertura en vez de sincronizarla: guarda en qué
ruta se abrió y está abierto mientras la ruta no cambie. Cerrarlo desde un
efecto que vigila el pathname renderizaría el cajón encima de la página nueva
antes de cerrarlo, y ese es justo el renderizado en cascada del que avisa el
compilador de React. Como efecto secundario gratis, también se cierra con el
botón de atrás, que ningún manejador de clic llega a ver.

#### Modo claro: la escala remapeada, no seiscientas clases

El panel se escribe en una paleta y se lee en dos. Cada superficie, línea y
color de texto de sus veinte componentes es una clase `neutral-N`, y **N se usa
como profundidad, no como oscuridad literal**: 950 es la superficie más honda,
900 las líneas, 500/600 el texto apagado, 100/200 el que de verdad se lee.
Seiscientas apariciones.

Así que el modo claro no son seiscientas ediciones: es la escala redefinida.
Tailwind v4 emite `var(--color-neutral-900)` en lugar del hex, así que sobre­
escribir esas variables bajo `:root:not(.dark)` voltea todas las utilidades de
golpe y ningún componente sabe que existe un segundo tema. Se comprobó en la
hoja generada: `.bg-neutral-950{background-color:var(--color-neutral-950)}`.

**El coste, dicho claro:** en `globals.css`, `bg-neutral-950` significa «la
superficie más honda», que en claro es blanco. Quien lea un componente esperando
un gris oscuro se confundirá un momento, y el comentario de ese archivo es la
disculpa. La alternativa era reescribir cada componente y revisar nueve módulos
a ojo.

**Los pasos están medidos, no elegidos a ojo.** Cada color de texto se contrastó
contra las tres superficies sobre las que puede caer, y los dos que fallaban se
resolvieron buscando el mínimo que pasa:

| | antes | ahora |
| --- | --- | --- |
| `neutral-600` (114 usos, el más tenue) | 4.59 en tarjeta, **4.32 y 3.95 FALLA** | 5.31 · 5.00 · 4.57 |
| `green-400` sobre su fondo teñido | **4.49 FALLA** | 4.73 |

El primero es la lección: un valor que pasa sobre la tarjeta blanca y falla
sobre el fondo de página se ve perfecto en una maqueta y es ilegible en uso.

**El oscuro tenía el mismo problema y no se había medido.** Está arreglado y
medido abajo.

#### El contraste, medido en los dos temas

El modo claro se construyó midiendo cada paso contra sus tres superficies. Hacer
eso dejó a la vista que **nadie había medido los del oscuro**, que llevaban así
desde el primer día:

| | antes | ahora |
| --- | --- | --- |
| `neutral-600` texto (127 usos, el más tenue) | 2.53 página · **2.29 ficha** | 5.01 · 4.54 |
| `neutral-500` texto (102 usos) | 4.18 · **3.78** | 6.28 · 5.69 |
| `neutral-700` borde de botón | 1.91 · **1.73** | 3.35 · 3.03 |

Nada falla cuando esto está mal: no hay error, no hay aviso, y la pantalla
parece deliberada. Lo único que lo encuentra es la aritmética, así que la
aritmética vive en `lib/contrast.test.ts` — lee `globals.css` de verdad y falla
nombrando el ratio que se habría desplegado. Se comprobó que muerde, poniendo el
valor viejo a mano: `#525252 sobre #0a0a0a da 2.53, por debajo de 4.5`.

Cuatro decisiones que el archivo no explica solo:

- **El suelo lo pone la ficha, no la página.** El texto tenue cae sobre `#0a0a0a`
  y sobre `#171717`, y la superficie más clara exige el gris más claro. Medir solo
  contra el fondo de página da un valor que pasa y que en una tarjeta falla — el
  mismo error que ya se cometió una vez en el modo claro.
- **No se empuja más arriba porque el chip `#262626` no lleva texto tenue**: solo
  `text-neutral-100`, 6 de 6 comprobados. Eso era una suposición, así que ahora es
  una prueba — si alguien escribe texto apagado ahí, salta.
- **`neutral-700` hacía dos trabajos y no podía hacer bien los dos.** Era el borde
  de los botones *y* el color de los placeholders, a 1.73. Una variable no puede
  ser a la vez línea tenue y texto legible, así que los siete usos como texto
  —cuatro placeholders, «sin portada», el módulo pendiente del menú y el digest de
  `error.tsx`— se movieron a 600, y el paso se quedó siendo borde. El único que no
  se movió es la flecha `aria-hidden` de SEO, que es decoración.
- **Los botones son de contorno** —borde, sin relleno, etiqueta—, así que el borde
  es lo que dice «esto se pulsa» y no «esto es una frase». Por eso se le pide el
  3:1 de 1.4.11, en los dos temas: en claro estaba a 1.68 y `#b4bac3` pasó a
  `#818891`. **Es el cambio más visible de todo esto**: los botones en claro tienen
  ahora un contorno bastante más marcado.

Los valores están **resueltos, no elegidos**: cada uno es el gris más claro que
pasa su umbral en todas sus superficies, de modo que la escala queda tan discreta
como la regla permite. Los pasos de 400 arriba no se tocaron porque ya pasaban, y
los diez colores de acento se midieron enteros —el peor es `red-400` a 5.63 sobre
su fondo teñido— así que ahí no había nada que arreglar.

Efecto colateral gratis: `hover:border-neutral-600` y `focus:border-neutral-600`
montan las mismas variables. Estaban a 2.29 contra la ficha donde se dibujan, o
sea un anillo de foco que había que buscar.

El contrato del tema vive en `packages/shared/src/theme.ts` —solo la parte pura:
nombre de cookie, duración y el script que corre antes del primer pintado—
porque las dos aplicaciones necesitan exactamente eso y ninguna lo posee. La
mitad que toca el DOM se queda en cada app a propósito: ese paquete no tiene la
librería `dom` porque `packages/db` lo importa y ese código es `server-only`.

Las dos apps **no comparten la cookie**: `nassican.com` y `app.nassican.com` son
orígenes distintos, así que el mismo nombre guarda una elección en cada uno. Es
lo que se quiere — leer a oscuras de noche no dice nada de cómo quieres editar a
mediodía.

Y hay prueba. Mover ese archivo ya lo rompió una vez: un heredoc se comió la
barra de `\s`, el patrón de la cookie compiló como `s*` y no habría encontrado
nunca `; theme=dark`. Nada habría lanzado un error — el panel habría destellado
el tema equivocado en cada carga, para siempre. `theme.test.ts` fija eso.

`app/not-found.tsx` queda **fuera** del grupo `(panel)`, así que un 404 nunca
ejecuta `requireUser()` ni dibuja el árbol de módulos alrededor. Una dirección
equivocada responde igual haya sesión o no, y quien acierte una URL a ciegas no
averigua de qué está hecho el panel.

Better Auth define sus tablas en código, así que actualizarlo puede añadir una
columna sin que nada falle hasta que alguien intenta entrar. **Tras cada
actualización de `better-auth`, ejecuta `npm run check:auth --workspace
@nassican/admin`**, que compara `getAuthTables()` contra los modelos de Prisma.
Así se encontró `account.issuer`, y de la peor manera: por un error en tiempo
de ejecución en el callback de OAuth.

#### El token de Google caduca a los 7 días, y esto se dio por supuesto mal

Este documento afirmaba que el `refreshToken` guardado en `accounts` hacía
innecesaria una service account. **Era falso**, y el coste fue semanas de
Analítica y Search Console vacías sin que nada lo dijera.

Una app OAuth **externa en estado «Testing»** recibe refresh tokens que
**caducan a los 7 días**. La única excepción son los grants cuyos scopes son
exclusivamente de perfil (`openid`, `userinfo.email`, `userinfo.profile`) — y
`analytics.readonly` no lo es.

Lo que lo hizo invisible: **entrar al panel siguió funcionando siempre**, porque
cada login emite un token nuevo. Lo que muere a los 7 días es el uso del token
guardado *en segundo plano*, que es de lo único que viven las dos
sincronizaciones. El panel se veía sano con sus dos integraciones caídas.

La salida no es publicar la app. Publicar exige política de privacidad,
condiciones del servicio y verificación de scopes sensibles — un trámite de días
para una aplicación cuyo único usuario es el dueño de los datos. **El
consentimiento OAuth existe para actuar en nombre de terceros, y aquí no hay
terceros.**

Por eso `lib/google.ts` prefiere una **service account**
(`GOOGLE_SERVICE_ACCOUNT_KEY`) y solo cae al token del operador si no hay clave.
Firma su propia aserción RS256 con `node:crypto`: es una firma, y la regla del
repositorio es no añadir dependencias de runtime sin motivo.

Separar las dos cosas arregla las dos: si las lecturas van por la service
account, el login puede quedarse con los tres scopes de perfil, que **son
justamente los de la excepción** — y entonces su propio token deja de caducar
aunque la app siga sin publicar. Quitar `analytics.readonly` y
`webmasters.readonly` de `socialProviders.google.scope` es el último paso, **y
solo después de confirmar que la service account lee de verdad**: mientras no lo
haga, el token del operador es el único plan B.

El proveedor conserva `accessType: "offline"` y `prompt: "consent"` mientras ese
plan B exista — sin ambos, Google entrega el refresh token solo en el primer
consentimiento y nunca más.

## Regla principal: todo cambio lleva su traducción

**Este sitio es bilingüe (español e inglés). Ningún cambio que introduzca o
modifique texto visible se considera terminado hasta que exista en los dos
idiomas.**

Aplica a:

- Cadenas de interfaz → `src/lib/i18n/dictionaries/es.ts` y `en.ts`.
- Contenido de datos → cualquier campo `Localized<T>` en `src/lib/data/`.
- Metadatos, descripciones y datos estructurados derivados de lo anterior.
- Texto dentro de `alt`, `aria-label`, `title` y `placeholder`.

Cómo cumplirla:

1. `es.ts` es la fuente de verdad del tipo `Dictionary`; `en.ts` se declara como
   ese tipo. Una clave nueva sin traducir **rompe el build**, no llega a
   producción.
2. Los datos usan `Localized<T> = Record<Locale, T>`, así que agregar un
   proyecto, un artículo, un certificado o una entrada de experiencia obliga a
   escribir ambos idiomas.
3. Antes de dar por terminado un cambio: `npm run build`. Si compila, no falta
   ninguna traducción declarada.

Traducir de verdad, no calcar: el inglés debe leerse como escrito en inglés, no
como una traducción literal del español. Los nombres propios (personas,
empresas, productos, tecnologías) no se traducen.

Si no puedes producir una traducción con confianza, dilo explícitamente en la
respuesta en lugar de dejar el texto en un solo idioma.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript.
- Tailwind CSS v4, sin archivo de configuración (`@theme inline` en
  `src/app/globals.css`).
- `react-icons` para iconografía. Sin más dependencias de runtime.
- Sin librería de i18n: el enrutado por idioma es propio (ver abajo).

## Enrutado por idioma

- Las páginas viven bajo `src/app/[locale]/`. No existe `src/app/layout.tsx`:
  el layout raíz es `src/app/[locale]/layout.tsx`.
- El idioma por defecto (`es`) se sirve **sin prefijo**: `/blog`, no `/es/blog`.
  El inglés sí lo lleva: `/en/blog`.
- `src/middleware.ts` hace el puente:
  - `/es/*` → redirección 308 a `/*` (una sola URL indexable por página).
  - `/en/*` → pasa tal cual.
  - `/*` → reescritura interna a `/es/*`, sin cambiar la URL visible.
- Se llama `middleware.ts` y no `proxy.ts` porque Next 16.0.0 no detecta el
  nombre nuevo bajo Turbopack.
- Nunca escribas rutas a mano en los componentes. Usa
  `localePath(locale, "/blog")` de `@/lib/i18n/config`.
- `usePathname()` devuelve la ruta **interna** (`/es/blog`) en una carga
  directa y la visible (`/blog`) tras navegación de cliente. Por eso
  `stripLocale()` quita también el prefijo del idioma por defecto. Pásale
  siempre el pathname por ahí antes de usarlo.
- El selector de idioma usa `<a>`, no `<Link>`: ver la sección de tema.

Al agregar una ruta nueva:

1. Créala bajo `src/app/[locale]/`.
2. Exporta `generateStaticParams` devolviendo todos los `locales`.
3. Usa `pageMetadata()` de `@/lib/seo` para canonical + hreflang + OpenGraph.
4. Agrégala a `src/app/sitemap.ts` con `localizedEntries()`.
5. Agrégala a la sección `Páginas` de `src/app/[locale]/llms.txt/route.ts`.
   Si lleva un punto en el nombre (`algo.xml`), añádela también al `matcher` de
   `middleware.ts`: las rutas con punto quedan fuera por defecto y la URL
   española daría 404 mientras la inglesa funciona.
6. Enlázala desde `Navigation.tsx` y/o `Footer.tsx` con `localePath`.

## Contenido

El contenido está a medio migrar a la base de datos.

| Archivo | Qué contiene | Fuente |
| --- | --- | --- |
| `posts/index.ts` | Artículos publicados | **base de datos** |
| `projects/index.ts` | Proyectos y casos de estudio | **base de datos** |
| `profile.ts` | Nombre, correo, ubicación, redes, CVs | **base de datos** |
| `experience.ts` | Historial laboral | **base de datos** |
| `education.ts` | Formación académica | **base de datos** |
| `certificates.ts` | Certificados y cursos | **base de datos** |
| Imágenes | Bytes en `media_blobs`, servidas desde `/media/` | **base de datos** |
| `skills.ts` | Colores, iconos y agrupación de tecnologías | **módulo, a propósito** |
| `content.ts` | Reexporta `ContentBlock` y utilidades de `@nassican/shared` | — |

`skills.ts` se queda en el código y no es un pendiente: son colores, nombres de
icono y agrupación —tokens de presentación, no contenido editable— y los
títulos de grupo salen del diccionario (`t.skills.groups`), no de los datos.
`scripts/import-content.ts` mantiene la tabla `technologies` en sincronía para
que proyectos y experiencia puedan referenciarlas por clave foránea.

Las fechas de experiencia y formación se guardan **como texto**, no como
`Date`: `"2020"`, `"2024-08"` y `"2026-09-25"` son fechas parciales tal como se
escribieron, y esa precisión llega al atributo `datetime` del HTML. Parsearlas
cambiaría el marcado.

`skills.ts` ya **no lo lee la sección de habilidades del sitio**: esa lee las
tablas `technologies` y `skill_groups`, editables desde el módulo Habilidades. El
archivo sigue ahí porque `lib/seo.ts` y `llms.txt` importan de él la lista de
nombres; ver la sección de Habilidades para por qué eso no es una limpieza
trivial.

Las carpetas `projects/<slug>/` con los archivos `es.ts` y `en.ts` **siguen en
el repositorio a propósito**: son la copia de seguridad de la migración y la
fuente que lee `scripts/import-content.ts`. Ya no las lee el sitio. Bórralas
solo cuando la migración esté confirmada en producción.

### Multimedia: las imágenes viven en Postgres

Los bytes se guardan en `media_blobs`, en su propia tabla para que listar la
biblioteca no arrastre binarios. Es una decisión deliberada y con un límite
conocido: **funciona a esta escala —una docena de capturas, unos pocos MB— y
sería la elección equivocada para una galería.** Si algún día el catálogo
crece, se sustituye `readImageByChecksum` por una URL de almacén de objetos y
el resto del código no se entera.

Lo que la hace viable es que **la URL es el checksum de los bytes**:
`/media/<sha256>.webp`. Como esa respuesta no puede cambiar nunca, se sirve con
`max-age=31536000, immutable` y la base se consulta una vez por imagen y por
nodo del CDN, no una vez por visitante. Reemplazar una portada produce otro
checksum, y por tanto otra URL: nunca hay caché rancia que purgar.

Ese camino contiene un punto, así que el matcher del proxy de idiomas ya lo
excluye y `/media/...` nunca se reescribe al segmento `[locale]`.

Toda imagen se convierte a **WebP** al entrar (calidad 82, ancho máximo 1920) y
se le calcula un `blurDataUrl` de 16 px para el placeholder de `next/image`. La
conversión vive en `apps/admin/src/lib/media.ts`; el sitio público solo sirve
bytes y nunca carga `sharp`.

```bash
npm run media:optimise -- --dry   # informa sin escribir
npm run media:optimise            # mueve a la base lo que quede en /public
```

#### El texto alternativo vive en dos sitios, y es a propósito

- **En el bloque**, para una imagen dentro de un cuerpo. Un cuerpo ya es por
  idioma, y la misma foto necesita otra redacción según dónde aparezca, así que
  el `alt` que llega a la página es el del bloque.
- **En `media_translations`**, como valor por defecto de la biblioteca y de las
  portadas, en los dos idiomas.

El editor avisa cuando un bloque de imagen se queda sin `alt`, y la biblioteca
cuenta cuántas imágenes están incompletas. Es accesibilidad, no cosmética.

#### Borrado seguro

`media_usages` responde *esta imagen aparece en 3 artículos*. Se recalcula
entera en cada guardado en vez de mantenerse incrementalmente: la fuente de
verdad es la entidad, y reconstruir sus filas se cura solo.

Pero `describeUsage` lee **dos** fuentes: esa tabla, para las imágenes dentro de
un cuerpo, y las claves foráneas de portada e imagen social directamente. Sin
lo segundo, una imagen importada por script figuraba como «no se usa» aunque
fuese la portada de un proyecto — que es exactamente lo que pasó la primera vez.
Leer las claves foráneas hace que la respuesta sea correcta sin necesitar un
backfill.


Más tarde aparecieron **tres claves foráneas que ninguna de las dos fuentes
miraba**: la imagen de un certificado, el avatar del perfil y la imagen social por
defecto del SEO. Se encontró al enlazar los 37 diplomas: la biblioteca los habría
llamado «sin usar» y dejado borrar. `describeUsage` las lee ahora, y `deleteMedia`
dejó de llevar su propia lista de comprobaciones —esa copia era la que se había
quedado corta— para preguntar a `describeUsage`: una sola respuesta a «¿se usa?»,
la misma que enseña la biblioteca.
`deleteMedia` se niega mientras algo apunte a la imagen, y dice cuántos.

#### La biblioteca a escala: carpetas, páginas y una sola consulta de uso

**El coste estaba en el servidor, no en la cuadrícula.** `listMedia` llamaba a
`describeUsage` una vez por imagen, y cada llamada eran ocho consultas: 40 imágenes
eran unos trescientos viajes y **3,4 s**, creciendo con cada subida. Ahora
`describeUsageMany` responde para todas en **diez consultas fijas** —0,4 s con 40, lo
mismo con 400— y `describeUsage` es esa misma función con un solo id, así que
«¿se usa?» sigue teniendo una única respuesta. Se comprobó comparando las dos
versiones imagen por imagen sobre la base real: **idénticas** en las 40.

**Los metadatos bajan enteros; las miniaturas no.** Unos cientos de bytes por imagen
—mil imágenes pesan menos que un diploma—, así que filtrar, buscar y ordenar ocurre
en el navegador sin volver a preguntar. Lo que no escala son las miniaturas, y
esas van en páginas de 48 y perezosas, con `next/image` redimensionando: una
cuadrícula cuesta lo que hay en pantalla.

**Todo lo que decide qué se ve vive en la dirección** —carpeta, filtro, búsqueda,
orden, vista y página— y se escribe con `window.history.replaceState`, que Next
sincroniza con `useSearchParams`. Con `router.replace` cada tecla de la búsqueda
habría vuelto a leer la biblioteca entera en el servidor. Lo que se filtra es un
enlace; lo que no se reconoce cae al valor por defecto (`media-view.test.ts`).

**Carpetas planas**, aunque el esquema admite anidarlas: a esta escala un nivel
responde «dónde están los diplomas», y un árbol sería otra navegación que aprender.
Subir desde una carpeta —con el botón o **arrastrando** archivos a la página— la
guarda ahí. Borrar una carpeta no borra imágenes: la clave es `SET NULL` y pasan a
«Sin carpeta». Dos carpetas no pueden llamarse igual, sin distinguir mayúsculas.
Organizar no se audita: dice dónde está archivada una imagen, no qué muestra el
sitio, y una tarde ordenando llenaría la bitácora de ediciones.

**Una trampa que apareció al hacerlo:** `storeImage` reconoce una imagen repetida
por su checksum y actualizaba su fila con la carpeta de la subida nueva, `null` si
no traía. Pegar en un artículo un diploma que ya existía lo habría sacado de
«Certificados» en silencio. Ahora una subida sin carpeta deja la imagen donde
estaba; con carpeta, la mueve, porque se hizo desde dentro de ella a propósito.

**Selección múltiple** para mover a una carpeta o mandar a la papelera. La papelera
en lote hace la misma pregunta que el borrado suelto, deja las que están en uso y
**las cuenta en el mensaje**: una acción en lote que se saltara algunas en silencio
parecería haberlas hecho todas. En el detalle, ← y → recorren la selección actual
(no mientras se escribe en un campo) y la carpeta se cambia desde ahí.

### Páginas

En `app.nassican.com/contenido/paginas`. Una sola tabla y dos cosas distintas,
separadas por `kind`:

- **`system`**: una ruta que ya existe en `app/[locale]/`. Solo se editan sus
  metadatos; el contenido está en el código. Se siembran solas al abrir el
  módulo, desde `systemRoutes` en `apps/admin/src/lib/pages.ts` — añadir una
  ruta al sitio significa añadirla ahí y nada más.
- **`custom`**: una página escrita en el panel, con cuerpo de `ContentBlock[]`.

Las personalizadas las sirve **el catch-all `[...notFound]`**, no una ruta
propia: ya hacía falta para los 404, y reutilizarlo hace que «esta ruta es una
página» y «esta ruta no existe» se decidan en el mismo sitio en vez de competir.

Los overrides de SEO se pasan a `pageMetadata({ override })` en lugar de que
`seo.ts` los consulte, para que ese módulo siga siendo puro y síncrono — la
misma razón por la que recibe posts y proyectos como argumentos.

### SEO: metadatos, redirecciones y Search Console

En `app.nassican.com/seo`.

**Metadatos globales.** El diccionario es el respaldo, no la fuente: lo que
escribe el panel gana, y un campo vacío deja lo que ya decía el sitio en vez de
borrar la etiqueta. **El origen no se edita ahí**: una vista previa y producción
comparten estas filas, y un canonical apuntando a producción desde una vista
previa es justo el problema de contenido duplicado contra el que ya protege
`robots.txt`. Se queda en `NEXT_PUBLIC_SITE_URL`.

**Las palabras clave se fueron, y no volverán.** La etiqueta
`<meta name="keywords">` ya no se emite, su campo desapareció del panel —global
y por página— y sus dos columnas se borraron del esquema. Google la ignora
**desde 2009** y Bing la trata como una señal débil de spam; mantener un campo
editable para ella era invitar a alguien a pasar una tarde rellenando algo que
no hace nada.

Quitar solo el campo habría dejado una columna que nadie puede editar — el mismo
señuelo que ya se eliminó en Configuración con `featureFlags`. Por eso se fue
entera.

**Lo que sí se quedó** son las `keywords` de `lib/seo.ts`, que son otra cosa: una
propiedad de schema.org sobre `Article` y `CreativeWork`, que los consumidores de
datos estructurados sí leen. Comparten nombre y no tienen nada que ver.

**Los campos se eligen contra límites, no a ojo.** Google muestra unos 60
caracteres de un título y 155 de una descripción, y corta el resto a media
palabra. El estado anterior salía del diccionario y era competente salvo en un
punto medible: las descripciones iban a 159 y 162 caracteres y se truncaban.

La plantilla era `%s | Jesús David Benavides Chicaiza`: **treinta caracteres de
sufijo gastados antes de que el título de la página dijera nada**. Con
`%s · Nassican` un artículo de cuarenta caracteres cabe entero donde antes se
cortaba. La portada no se ve afectada — usa su título absoluto y conserva el
nombre completo, que es lo que interesa posicionar.

| | antes | ahora |
| --- | --- | --- |
| portada ES | 61 | 52 |
| portada EN | 57 | 48 |
| descripción ES | 159 ✂ | 123 |
| descripción EN | 162 ✂ | 131 |
| `/blog` | 37 | 15 |
| `/projects` | 42 | 20 |

Lo que queda vacío sigue cayendo al diccionario: **un campo en blanco deja lo
que el sitio ya decía en vez de borrarlo**. Esa es la razón de que estos campos
existan — cambiar el mensaje es una edición, no un despliegue— y también la
razón de no rellenarlos con una copia de lo que el diccionario ya dice, que
serían dos fuentes para el mismo texto.

`robots.txt` dejó de ser el archivo de convención `robots.ts` y pasó a ser un
manejador de ruta, porque `MetadataRoute.Robots` no admite líneas arbitrarias y
`robotsExtra` las necesita. La salida se comprobó byte a byte contra la anterior
antes de cambiarla.

#### La verificación de propiedad, y una trampa que costó semanas

`seo_settings.google_site_verification` guarda **el token a secas**, porque Next
construye el elemento a partir del valor. Search Console, en cambio, te muestra
la **etiqueta completa** y te dice que la copies — así que pegarla es lo natural,
y el resultado era un `<meta>` anidado dentro de su propio atributo:

```html
<meta name="google-site-verification"
      content="&lt;meta name=&quot;google-site-verification&quot; …&gt;"/>
```

HTML válido, servido durante semanas, verificación que nunca pasaba, y **nada
podía avisarlo**: el campo estaba rellenado y la etiqueta estaba presente. Se
descubrió mirando el HTML de producción, no el panel.

Por eso `extractVerificationToken()` acepte la etiqueta pegada, el atributo
suelto, la línea del archivo `googleXXXX.html` o el token pelado, y guarda
siempre el token. Ser permisivo aquí no es descuido: es negarse a castigar a
alguien por seguir las instrucciones de la otra pantalla. Lo que sigue pareciendo
HTML sin token extraíble se rechaza al guardar en vez de volver a servir basura.
`seo-draft.test.ts` cubre las cinco formas que de verdad llegan del portapapeles.

**Propiedad de dominio frente a prefijo de URL.** La que funciona es
`sc-domain:nassican.com`, una **propiedad de dominio**: cubre el ápex, `www`,
cualquier subdominio, y http y https, de una vez. Solo se puede verificar por
DNS — y esa es la razón por la que las opciones de archivo HTML, etiqueta meta y
Google Analytics no aparecen para ella: no se ofrecen para propiedades de
dominio.

Añadir `https://www.nassican.com/` como propiedad de prefijo es **redundante**
para medir: ya está cubierto. El archivo `apps/web/public/google1be6c3bc11e05264.html`
está puesto y la etiqueta meta se emite, así que se puede verificar si alguna
integración exige una propiedad de prefijo — pero no hace falta para que el
panel lea Search Console.

**Los otros dos métodos de verificación no pueden funcionar en este sitio**, y
conviene saber por qué antes de perder una tarde con ellos:

- **Google Tag Manager**: no hay contenedor de GTM en la página. Cero
  apariciones de `gtm.js`. El sitio carga GA4 directamente con
  `@next/third-parties`, sin GTM de por medio.
- **Google Analytics**: en el HTML inicial solo hay un
  `<link rel="preload" href="…gtag/js?id=…" as="script">`. La etiqueta
  `<script>` de verdad la inyecta `next/script` tras la hidratación, y el
  verificador de Google **no ejecuta JavaScript**: busca el fragmento en el HTML
  crudo y solo encuentra una pista de precarga.

Esto no afecta a la medición —el script sí se carga en el navegador, y hay datos
reales en GA4—, solo a los verificadores que leen HTML sin ejecutarlo. Si alguna
vez hiciera falta el fragmento en el HTML inicial, habría que renderizarlo en el
layout en lugar de delegarlo a `@next/third-parties`.

#### Un despliegue, varios hostnames, una sola copia indexable

`isIndexableDeployment` mira el entorno, y el entorno no distingue por qué
puerta entró la petición. Vercel da a **cada despliegue** una URL permanente
`*.vercel.app` que no se puede borrar, y todas sirven producción con
`VERCEL_ENV=production`. Se midió: **diez despliegues listos, los tres probados
servían el sitio entero con `Allow: /`**. Tres copias rastreables, y una nueva
con cada `git push`.

Quitar el alias con nombre propio desde Vercel cierra *una* puerta de muchas.
Por eso la comprobación está en el código: `isCanonicalHost()` compara el host
de la petición contra el origen canónico, y `robots.txt` —que ya era un route
handler— sirve `Disallow: /` cuando no coinciden.

**La función falla abierta, y eso es la decisión importante.** Su modo de fallo
no es una página rota: es `Disallow: /` en el sitio real, que ningún monitor
detecta y que tarda semanas en revertirse. Así que todo lo que no pueda
establecer —sin origen configurado, un origen inválido, una petición sin host—
se trata como «este es el host canónico». **Bloquear exige prueba positiva del
host equivocado, nunca la ausencia de prueba del correcto.**

Dos detalles que la prueba fijó: el host se compara en minúsculas y sin los
puertos implícitos `:443` y `:80`, y de una cadena de proxies separada por comas
se juzga el **primer** salto, que es el que pidió el visitante.

La ruta lleva `dynamic = "force-dynamic"` precisamente porque su respuesta
depende del host: cachearla entre hostnames anularía todo lo anterior.

**Cómo se verificó**, y conviene repetirlo con cualquier cambio aquí: el mismo
build, arrancado con el origen de producción horneado, respondiendo a seis
hostnames distintos. `www` en sus tres formas devolvió `Allow: /`; el ápex y dos
URL reales de despliegue devolvieron `Disallow: /`. Y lo que sirve `www` se
comparó contra lo que producción servía en ese momento: **idéntico**.

Un aviso para quien pruebe esto en local: `NEXT_PUBLIC_SITE_URL` se **inlinea en
tiempo de build**. Arrancar con otro valor no cambia nada y hace que todo
parezca bloqueado — el primer intento de esta verificación dio `Disallow: /` en
los seis hosts y el fallo estaba en la prueba, no en el código.

**Redirecciones.** Se resuelven en el catch-all, no en el proxy. El proxy corre
en el edge y no alcanza a Prisma, y consultar una tabla en cada petición para
pagar por la URL vieja ocasional sería el intercambio equivocado. Una
redirección solo importa para un camino que ya no existe, y ese camino acaba en
el catch-all de todos modos. Un destino interno conserva el idioma que el
visitante estaba leyendo; `hits` se cuenta sin bloquear la respuesta.

El panel rechaza una redirección cuyo origen sea una página que existe: nunca se
aplicaría, porque el catch-all solo se alcanza cuando nada más coincidió.

**Search Console.** `syncSearchConsole` trae el rendimiento a
`search_console_daily` y el panel lee de ahí: un tablero que depende de una API
de terceros es un tablero lento y a veces roto. El token sale de
`auth.api.getAccessToken`, que lo refresca solo — por eso el login pide acceso
sin conexión. Google publica con dos o tres días de retraso, así que el rango
termina ahí y no en ayer.

La posición media se pondera por impresiones, que es la única forma en que
promediarla significa algo.

### Analitica: GA4

En `app.nassican.com/analitica`. Mismo patrón que Search Console: se
sincroniza a las tablas `analytics_daily_*` y el panel lee de ahí.

Cinco informes estrechos en un solo `batchRunReports` en vez de uno ancho:
cruzar todas las dimensiones a la vez multiplica las filas sin que nadie
lea nunca la combinación. GA4 admite justo cinco por lote.

**Un `ok` con 0 filas no es una respuesta.** Era indistinguible de una
sincronización correcta sobre un rango vacío, y fue la otra mitad de por qué
esto tardó en verse: las primeras ejecuciones pidieron un rango que terminaba el
día en que se instaló la etiqueta, así que cero era lo correcto y nadie lo supo.
Ahora, cuando la ventana vuelve vacía, `explainEmptyRange` hace **una** consulta
más —solo en ese caso— preguntando desde 2020, y distingue «este rango está
vacío, el primer día con sesiones es el X» de «la propiedad no ha recibido datos
nunca». La nota se guarda en el `sync_run` junto al estado `ok`, igual que la
sincronización parcial de Vercel, porque es lo que hace legible un cero un mes
después.

El idioma de cada ruta se deduce del prefijo, no se le pide a GA4, que no
sabe que nuestro `/en` significa algo. La duración media y la tasa de
interacción se ponderan por sesiones al sumarlas entre días, que es la
única forma en que promediar promedios significa algo.

**El token de Google es compartido.** `apps/admin/src/lib/google.ts` lo
resuelve para los dos módulos. Al pedirlo, `accountId` significa el id de
fila de Better Auth, **no** el `sub` del proveedor — que se llama
`accountId` en la misma tabla. Pasar el segundo produce «Account not
found», un error que no nombra ninguno de los dos ids.

Ni el id de propiedad de GA4 ni la propiedad de Search Console se adivinan,
así que ambos módulos ofrecen un botón que se los pregunta a Google y
muestra los reales.

### Estadísticas: salud del contenido, traducción y enlaces

En `app.nassican.com/estadisticas`. A diferencia de Analítica y SEO, aquí no
hay ninguna API externa: todo sale de la propia base, y el único tráfico hacia
fuera son las peticiones que comprueban los enlaces.

**La cobertura de traducción cuenta entidades, no campos.** Un artículo a
medias en inglés es *una* falta, no cuatro; contar campos produce un porcentaje
que se mueve al añadir columnas al esquema y que nadie sabe interpretar. Cada
hueco lleva su enlace al sitio donde se arregla, porque un porcentaje sobre el
que no se puede actuar es decoración. El umbral de cada tipo es el mismo que
usa su regla de publicación: un artículo necesita título, descripción y cuerpo;
un proyecto solo el `tagline`.

**Los enlaces se guardan por URL, no por sitio donde aparecen.** Lo que está
roto es la dirección, así que comprobarla una vez cubre todas sus apariciones
—tres certificados que apuntan al mismo diploma son una petición, no tres— y
`references` registra dónde se encontró en el último barrido. Las URLs que ya
no aparecen en ningún sitio se borran: la tabla responde «a qué enlaza el
sitio», no «a qué enlazó alguna vez».

Hay **tres respuestas, no dos**, y esa es la decisión que sostiene el módulo:

| `ok` | Qué significa |
| --- | --- |
| `true` | respondió correctamente |
| `false` | roto de verdad |
| `null` | contestó rechazando al robot (429, 999) |

LinkedIn devuelve 999 a cualquier cosa que no sea un navegador. Reportarlo como
roto sería un falso positivo, y **un solo falso positivo basta para que nadie
vuelva a mirar el informe**. Por eso `REFUSES_ROBOTS` los aparta a «sin
comprobar», que se muestra en gris y aparte de los rotos, y no entra en el
contador que guarda la instantánea diaria.

Se prueba `HEAD` y se cae a `GET`: GitHub y Platzi responden 403 o 405 a `HEAD`
mientras sirven la página perfectamente, justo las direcciones que más importan
aquí. Las peticiones van en serie a propósito —son una decena, y machacar un
host en paralelo es la forma de acabar con un 429 que no significa nada.

`content_stats_daily` guarda **una fila por día**, reemplazada si ya existe: lo
que interesa es la tendencia, y un día registrado dos veces sería un pico que
nunca ocurrió. Por eso `runContentCheck()` revisa los enlaces *antes* de tomar
la instantánea, que almacena cuántos había rotos.

### Configuración: navegación, secciones y parámetros globales

En `app.nassican.com/configuracion`. Tres cosas que tienen en común una sola
propiedad: cambiarlas antes exigía tocar el código del sitio.

**El menú dejó de estar en el código.** `NavigationItem` guarda cada entrada de
la cabecera y del pie, con sus textos como filas. Las etiquetas salieron de
`dictionaries/es.ts` y `en.ts` —se siembran desde ahí la primera vez que se
abre el módulo, igual que las páginas del sistema—, y a partir de ese momento
**el diccionario deja de ser la fuente del menú**. Sigue siéndolo de todo lo
demás.

Sembrar en la primera visita y no en una migración tiene la misma razón que en
Páginas: el punto de partida vive junto al código que copia, y convertir el
menú en datos no cambia nada el día que ocurre. Solo se siembra un menú
*completamente* ausente, así que uno que alguien vació a propósito se queda
vacío.

Cuatro decisiones que el código no explica solo:

- **Los dos idiomas son obligatorios en cada entrada.** No hay respaldo al
  diccionario: una entrada que existe en español y no en inglés es un hueco por
  el que se cae el visitante, no un detalle que se rellena luego. La regla
  principal de este documento, aplicada al momento de guardar.
- **El botón de contacto es una ubicación (`header_cta`), no una bandera.** Así
  «hay exactamente uno» es una consulta y no una regla que alguien debe
  recordar. Si aparecieran dos, gana el primero.
- **Un enlace de sección guarda la clave desnuda** (`about`), no un href. Que
  se dibuje como `#about` o como `/en/#about` depende de dónde esté ya el
  visitante, y eso se decide al renderizar.
- **Los CV bajaron a la columna de la marca**, junto al nombre y las redes. Son
  descargas con `download` y `hrefLang` propios —algo que el editor de enlaces
  no sabe expresar—, y dejarlos dentro de una columna editable obligaba a que
  «la última columna es especial», que es justo la clase de regla que se rompe
  la primera vez que alguien reordena.

**El orden de las secciones es dato; las secciones no.** Cada una sigue siendo
un componente con sus propias consultas y su propio layout; lo que decide el
panel es dónde va y si aparece. El mapa de `[locale]/page.tsx` es exhaustivo
sobre `HomeSectionKey`, así que añadir una sección al tipo sin añadirla ahí
**no compila**, en vez de renderizar nada. La lista de claves vive en
`packages/shared` porque las dos aplicaciones la necesitan y ninguna la posee.

**La regla que une las dos mitades:** el panel se niega a ocultar una sección a
la que apunta un enlace visible, y nombra los enlaces. Un `#about` hacia una
sección que ya no se dibuja no falla; simplemente no hace nada, que es peor.
Lo reporta en vez de corregirlo solo: cuál de los dos cede es decisión del
operador.

**Los parámetros globales están todos cableados a algo que el sitio hace.**

| Parámetro | Qué decide de verdad |
| --- | --- |
| `defaultTheme` | lo que aplica `themeInitScript` cuando no hay cookie |
| `timezone` | a qué día pertenece la instantánea de Estadísticas |
| `maintenanceMode` | sustituye el sitio entero por un aviso |
| `brandLine` | la línea bajo el nombre en el pie |
| `copyrightName` | el nombre del aviso de copyright |
| `latestPostsCount` | cuántos artículos adelanta la portada |
| `showSectionNavigator` | las flechas flotantes entre secciones |

Se borraron dos columnas que el esquema traía sin usar. `contactEmail`, porque
`profile.email` ya es esa dirección y una segunda columna con lo mismo es una
segunda respuesta esperando a discrepar. `featureFlags`, porque una bolsa JSON
sin tipo invita exactamente a la deriva no documentada que el resto del
repositorio evita: cada ajuste tiene su columna y su forma.

`timezone` corrigió un error real: la instantánea diaria agrupaba por UTC, así
que una revisión hecha por la tarde en Bogotá se archivaba bajo el día
siguiente. Los informes de Google **no** usan esta zona sino la de su propia
propiedad, y eso no se puede cambiar desde aquí.

**El modo mantenimiento vive en el layout, no en el proxy**, porque el proxy
corre en el edge y no alcanza a Prisma. Consecuencia: un layout no puede
devolver un 503, así que lo que mantiene el aviso fuera del índice es
`robots.index`, que se apaga con él. Y al apagarlo, el contenido puede tardar
hasta una hora en volver si falla el aviso de caché — el mismo respaldo de
`CACHE_SECONDS` que protege a todo lo demás.

**`CACHE_SECONDS` pasó de 5 minutos a 1 hora**, y lo decidieron los números de
consumo: 38K escrituras ISR frente a 25K lecturas en treinta días, o sea páginas
regeneradas más veces de las que se servían. Los rastreadores no ejecutan
JavaScript, así que GA4 nunca vio el tráfico que lo causaba, y cada regeneración
es un render completo con sus consultas, facturado como Active CPU. Como el
camino real de un cambio es la invalidación por etiqueta, el respaldo no necesita
ser corto: una hora recorta las regeneraciones doce veces, y veinticuatro apenas
ahorraría más a cambio de un día entero de contenido rancio si un aviso falla. El
`revalidate` de `rss.xml` tiene que ser un literal —Next lee esa configuración
estáticamente y no puede importar la constante— y se mantiene igual a mano.

**Cómo se verificó**, con el método de la migración de proyectos: capturar el
sitio en producción —que todavía servía el menú cableado— y compararlo contra
el build nuevo leyendo de la base. Portada, blog, proyectos y certificados, en
los dos idiomas: **los 50 enlaces de cada página idénticos, en el mismo orden**,
y la única diferencia de texto visible fue la de los CV cambiados de columna.

### Sistema: auditoría, sincronizaciones, despliegues y disponibilidad

En `app.nassican.com/sistema`. Es el único módulo que no habla del contenido
sino del propio funcionamiento, y por eso recoge lo que los demás dejan caer.

**La auditoría registra decisiones, no filas.** Se escribe desde las acciones y
no desde una extensión de Prisma, aunque la extensión saldría gratis: apuntaría
cada fila escrita y nada más — cuatro upserts de un mismo guardado, sin saber
cuál era el hecho, y sin poder nombrar al usuario, porque la capa de base de
datos no tiene sesión. Lo que vale la pena guardar es *publicó*, *borró*,
*guardó*, y eso solo lo sabe la acción.

`logAudit` no lanza nunca. Y lee las cabeceras en su propio `try`: `headers()`
falla fuera de una petición, y perder la IP de quien actuó es infinitamente
menos grave que perder la entrada entera. La diferencia entre un registro con
una columna en blanco y un registro con un agujero justo donde hubo un borrado.

**Las sincronizaciones ya existían**, repartidas: cada módulo escribía su
`sync_run` y solo enseñaba la última. Aquí están todas juntas, que es donde se
ve el patrón — cuál falla siempre, cuál tarda de más.

**Los avisos** son la otra mitad del cambio a `after()`. Cuando el aviso al
sitio público no llega, ya no se cuela dentro de un mensaje de «guardado»:
aterriza en `system_events` y se lista aquí. Es su sitio natural. Una caché que
no se limpió es un problema del despliegue, no de lo que el operador acababa de
guardar.

**La disponibilidad se comprueba cuando se pide**, y sigue siendo la única que
no pasó al planificador: una comprobación diaria reportaría una caída con hasta
24 h de retraso, así que no es monitorización. Una página cuyos datos solo se
mueven al abrirla es mejor decirlo que disimularlo. Se pide `GET` y no `HEAD` a propósito:
lo que importa es que la página se renderice, y con la caché fría se renderiza
bajo demanda — que es justo el caso que vale la pena medir.

#### El planificador: un cron al día, y Wallet fuera a propósito

`apps/admin/vercel.json` dispara `GET /api/cron/daily` a las 06:00 UTC. Hace lo
que antes solo ocurría si alguien abría el módulo: comprobar enlaces, tomar la
instantánea de contenido, sincronizar GA4, Search Console y Vercel, medir el
rendimiento con PageSpeed y vaciar de la papelera lo que lleva más de 30 días.

Medido en producción local: **18 s de reloj** la primera vez, 12 s la segunda.
Los cuatro externos van en paralelo porque son cuatro servicios distintos, así
que los 28,7 s que suman en serie no se pagan.

**Wallet no está aquí.** Se sincroniza a mano, y además es la única que tarda
126 s en su peor caso y la única que ha fallado: meterla con el resto significaba
que un fallo suyo se llevara por delante la instantánea, que es lo único de esta
lista que no se puede recuperar.

**La disponibilidad tampoco**, y eso es un juicio y no un olvido: una
comprobación diaria no es monitorización — reportaría una caída con hasta 24 h de
retraso, y en el plan Hobby no se puede programar nada más frecuente. Se queda
bajo demanda, donde al menos la pantalla dice sin disimulo que el número se mueve
cuando lo pides.

Cuatro cosas que vienen de los límites reales, verificados contra la
documentación y no contra la memoria:

- **`CRON_SECRET`, nunca `requireUser()`.** Esta es la trampa que habría costado
  una tarde: `requireUser()` **redirige** a `/login`, y **los crons no siguen
  redirecciones**. El trabajo se habría quedado con el 3xx, se habría registrado
  como terminado, y no habría hecho nada. Un éxito silencioso es el peor fallo
  posible en algo que nadie mira. Falla cerrado: sin secreto en el entorno, 401.
- **Caben de sobra.** Con fluid compute el máximo en Hobby son **300 s**, no 60.
  Y son **100 crons en todos los planes**: Hobby limita la frecuencia (una vez al
  día, ±59 min), no la cantidad.
- **06:00 UTC = 01:00 en Bogotá**, y por eso esa hora. La instantánea se agrupa
  por `site_settings.timezone`, así que la ventana de ±59 min de Hobby tiene que
  caer entera dentro del mismo día local. A las 00:30 UTC se archivaría bajo el
  día anterior la mitad de las veces.
- **La entrega es best-effort: se pierden *y* se duplican invocaciones.** Lo
  bueno es que todo esto ya era idempotente —cada sincronización hace upsert y la
  instantánea es una fila por día reemplazada—, así que no hubo que cambiar nada.
  Comprobado ejecutando dos veces seguidas: sigue habiendo **una** fila para hoy.

**Dónde difiere del botón de Estadísticas, y por qué.** La acción del panel no
toma la instantánea si la comprobación de enlaces falló, con buen motivo: el
operador ve el error y vuelve a pulsar. Aquí no hay un «vuelve a pulsar» —Vercel
no reintenta un cron fallido—, así que un día omitido es un día perdido para
siempre. Siete de los ocho campos de la instantánea no tienen nada que ver con
los enlaces, y tirar las cifras de contenido y de traducción para evitar un
recuento rancio es el lado equivocado de ese intercambio. **La instantánea se
toma igual.**

**Devuelve 200 aunque un paso falle**, y el cuerpo dice cuál. Cada sincronización
ya escribe su propia fila en `sync_runs`, así que Sistema lista el fallo con su
mensaje de todas formas — ese es el registro que importa. Un 500 aquí solo
pondría el panel de Vercel en rojo por una caída de Google sobre la que este
proyecto no puede hacer nada. Probado con un token roto a propósito: los dos
pasos de Vercel fallaron nombrando el 403, y `link_check` y `snapshot` siguieron
adelante.

**Dónde va `vercel.json`, y cómo se comprueba.** Vercel lo lee desde el **Root
Directory del proyecto**, no desde la raíz del repositorio: en un monorepo con dos
proyectos, uno en la raíz lo ignorarían los dos. El del panel es `apps/admin`, y
la comprobación no es leer la configuración sino preguntárselo al CLI:

```bash
cd apps/admin
npx -y vercel@latest crons ls      # tiene que listar /api/cron/daily
```

Si el archivo estuviera en el sitio equivocado la tabla saldría vacía. Con el
proyecto vinculado responde `0 6 * * *` y el estado del despliegue, y ese estado
es la otra mitad: un cron solo existe **después** de desplegar.

Y el orden importa en un punto que es fácil invertir: **la variable primero, el
despliegue después.** Las variables se inyectan en el despliegue, así que añadir
`CRON_SECRET` luego obliga a volver a desplegar para que la función la vea — y
mientras tanto el cron responde 401 sin explicar por qué.

Para disparar el cron sin esperar a las 06:00, `npx vercel crons run
/api/cron/daily`. Lee las definiciones del proyecto **desplegado**, no del
`vercel.json` local, así que no sirve antes del primer despliegue. El comando
está en beta.

**Por qué el token no ve el panel.** El proyecto del panel es `admin-nassican` y
vive en un **equipo**; el `VERCEL_TOKEN` del entorno está limitado a un solo
proyecto —`nassican-dev`, raíz `apps/web`— y no puede ni listar equipos ni
resolver el usuario. Por eso `syncDeployments` lista el proyecto del panel como
omitido, que es el comportamiento correcto y no un fallo. Si algún día interesa el
historial de despliegues del panel en Sistema, lo que falta es un token con
alcance de equipo y `VERCEL_TEAM_ID` puesto; no hay nada que cambiar en el código.

#### El dashboard vigila al planificador

El cron abrió un agujero el día que se encendió: mientras cada sincronización
solo corría al abrir su módulo, el resultado estaba en pantalla un segundo
después y nada podía pasar desapercibido. Corriendo a las 06:00 sin nadie
delante, el único sitio donde aparece un fallo es Sistema — y a Sistema hay que
ir. Un cron que falla en silencio deja análisis rancios y días sin instantánea
acumulándose, que es exactamente el problema que el planificador vino a resolver.

`lib/sync-health.ts` decide y `lib/dashboard.ts` lee, en el mismo `Promise.all`
que todo lo demás. Hay **tres** señales, y la segunda es la que una versión
ingenua no tiene:

| señal | qué significa |
| --- | --- |
| `failed` | la **última** ejecución de la fuente falló |
| `stale` | no hay ninguna ejecución en 48 h |
| `abandoned` | quedó en `running` y nadie la terminó |

**La ausencia es el modo de fallo que se escapa.** Una sincronización que falla
escribe una fila diciéndolo; un cron que no se disparó no escribe nada. Buscar
solo filas `failed` habría sido ciego justo a lo único que pierde la instantánea
todos los días.

**`abandoned` no lo nombraría nadie más.** Una fila atascada en `running` es una
función que murió a mitad —`maxDuration`, o un cierre— y como no es un fallo,
Sistema la muestra «en curso» para siempre.

**Solo cuenta la última ejecución.** Un fallo de anteayer ya seguido de un éxito
es historia, y reportar historia como problema es cómo un informe deja de leerse
— el mismo motivo por el que Estadísticas mantiene el 999 de LinkedIn fuera del
contador de roto.

Cuatro decisiones más que el código no explica solo:

- **48 h, no 24.** El cron es diario y Hobby lo dispara en cualquier momento de
  la hora, así que entre dos ejecuciones correctas caben 26 h. La entrega es best
  effort y se salta alguna. Avisar de un salto suelto es cómo se aprende a
  ignorar el aviso; 48 h tolera uno y sigue cazando un cron que se paró de verdad.
- **La ventana es una fecha, no un número de filas.** Con `take: 50`, una fuente
  sin correr en una semana se caería de la lista detrás de cincuenta
  sincronizaciones manuales de Wallet y saldría detenida por el motivo
  equivocado.
- **Qué se vigila y qué no está partido en dos listas**, y
  `Exclude<SyncSource, Assigned> extends never` **rompe la compilación** si una
  fuente nueva no se asigna a ninguna. Mismo truco que `localeParity` en
  `packages/db`: olvidarse de decidir si algo se vigila sería un hueco en
  silencio, y los huecos en silencio son lo que este módulo existe para cerrar.
  No se vigilan `wallet` (manual), `uptime` (a demanda) ni `content_stats`, que
  es un valor del enum que nada escribe — la instantánea viaja en la ejecución de
  `link_check`, que es la que la precede.
- **Los avisos van antes que los de contenido.** Cuando una sincronización se
  paró, las cifras de tráfico de más abajo en esa misma página están viejas y no
  hay forma de notarlo mirándolas. Saber que el dato es viejo cambia cómo se lee
  todo lo demás.

El módulo no lleva `server-only` **a propósito**: es puro, y `SyncSource` entra
por `import type`, que se borra al compilar. Es la misma separación que
`post-draft.ts` frente a `posts.ts` — leer vive en `dashboard.ts`, que sí lleva la
guarda, y decidir vive aquí, donde se puede probar sin una petición alrededor.
`sync-health.test.ts` cubre las tres señales, la tolerancia de las 26 h, que un
éxito posterior gane a un fallo anterior, y que las fuentes manuales no se
vigilen.

#### Vercel

`VERCEL_TOKEN`, `VERCEL_PROJECT_WEB` y, si el proyecto vive en un equipo,
`VERCEL_TEAM_ID`. A diferencia de Google, aquí **no** se usa el OAuth del
operador: Vercel no tiene un flujo de consentimiento para esto, así que es un
token personal en el entorno. Como el panel no puede crearlo, sí hace lo
siguiente mejor: el botón «Ver proyectos» pregunta los ids en lugar de mandarte
a buscarlos al panel de Vercel — lo mismo que hacen GA4 y Search Console con
los suyos.

Sin configurar, los dos módulos lo dicen nombrando la variable que falta y **no
registran un `sync_run` fallido**: una integración sin configurar no es una
sincronización que falló.

**Web Analytics de Vercel va junto a GA4, no en su lugar.** Discrepan a
propósito y la discrepancia es el dato: Vercel cuenta sin cookies, así que no
la pierden los bloqueadores —que en una audiencia de desarrolladores distorsionan
bastante a GA4—, mientras que GA4 sabe de sesiones, interacción y procedencia.
La diferencia entre las dos cifras es lo que GA4 no ve.

Se sincroniza a `vercel_analytics_daily` y el panel lee de ahí, como Search
Console y GA4. Una sola tabla con un discriminador `dimension`, porque Vercel
responde a toda agrupación con los mismos dos números — al contrario que GA4,
donde cada informe trae sus propias métricas y necesitaba su propia forma.

Dos cosas que el código no explica solo:

- **Las agrupaciones que no son por día se archivan bajo el último día del
  rango.** No tienen fecha propia: son totales del rango entero. Es lo que hace
  que «rutas más vistas en 28 días» sea un conjunto de filas y no veintiocho.
- **Los visitantes no se suman entre días.** La misma persona el lunes y el
  martes es un visitante, no dos, así que la cifra destacada es el día con más
  y no una suma que sobrecontaría en silencio.

Antes que nada, Web Analytics tiene que estar **activado en el proyecto de
Vercel**: `@vercel/analytics` ya está en el sitio, pero con el interruptor
apagado no se guarda nada y la API responde vacío.

### Copias de seguridad y papelera

Dos módulos en «Administración» que responden a la misma pregunta —cómo no perder
lo que hay— desde lados opuestos: la copia protege de perder la base entera, la
papelera de perder una fila por un clic.

#### La copia: toda la base en un archivo, menos lo que no debe salir

En `app.nassican.com/copias`, solo para propietarios. `GET /api/backup` genera un
`.json.gz` en el momento: **2.324 filas en 64 tablas, 1,27 MB de JSON y 274 KB
comprimido**, en 1,8 s desde Bogotá.

**Las tablas salen del propio esquema** (`Prisma.dmmf`), no de una lista. Un
modelo añadido mañana entra en la siguiente copia sin que nadie se acuerde, y una
copia que se salta en silencio la tabla más nueva se descubre el único día en que
importa. Lo que sí se escribe a mano es lo contrario, en `lib/backup.ts`:

| | qué | por qué |
| --- | --- | --- |
| fuera | `Session` | cada fila es un inicio de sesión vivo; restaurarlas devolvería el acceso a quien lo tuviera |
| fuera | `Verification` | códigos de un solo uso que caducan en minutos |
| fuera | `RestorePoint` | los puntos de restauración; una copia con copias dentro crecería en cada restauración |
| en blanco | tokens y `password` de `Account` | un refresh token es permiso permanente para leer Analytics; la fila se queda para que Google te reconozca al entrar |

**Comprimido por un límite, no por gusto.** Una función de Vercel no puede
responder más de 4,5 MB. Comprime 4,6 veces y no diez porque las imágenes ya son
WebP, así que el techo queda unas dieciséis veces por encima del tamaño actual.

Cada tipo que JSON no sabe llevar tiene una forma fija y reversible
(`packages/db/src/backup-codec.ts`, puro y con prueba): fechas en ISO, `numeric`
como cadena con `toFixed()` —un float es como el dinero gana un céntimo—, `bigint`
como cadena, bytes en base64, y el `NULL` de una columna `jsonb` vuelve como
`Prisma.DbNull`, porque Prisma rechaza un `null` a secas preguntando cuál de los
dos se quiso decir.

**No hay copia automática, y no es un olvido**: el cron no tiene dónde dejarla.
Guardarla en la misma base no protege de nada, y no hay almacén de objetos. Por
eso el dashboard avisa cuando la última descarga tiene **30 días** o no existe:
ese aviso es todo el mecanismo. La fecha sale de la auditoría (`export` sobre
`backup`), porque una descarga es una decisión de alguien.

#### Restaurar, y la trampa del `search_path`

```bash
RESTORE_DATABASE_URL=postgres://… npm run backup:restore -- copia.json.gz --dry
RESTORE_DATABASE_URL=postgres://… npm run backup:restore -- copia.json.gz
```

Tres negativas que hacen que un destino equivocado falle sin tocar nada:

- **La variable es propia.** Leer `DATABASE_URL` haría de producción el destino por
  defecto de una restauración.
- **Solo escribe en una base vacía.** Nunca mezcla ni sobrescribe.
- **Exige la misma migración que la copia.** Filas escritas para una forma de tabla
  no caben en otra, y descubrirlo en la tabla cuarenta es peor que no empezar.

Va por TCP con un `PrismaClient` corriente y no por el adaptador de Neon, así que
el mismo comando restaura en Neon, en una VPS o en un portátil. Inserta en orden de
claves foráneas (`tableOrder`), dentro de **una** transacción —morir en la tabla
cuarenta deja una base vacía, no una a medias que parece buena—, mueve las
secuencias `autoincrement()` más allá de los ids restaurados y vuelve a contar
tabla por tabla al final.

**Cómo se verificó**, y es el método a repetir: un esquema temporal
`restore_check` en la misma base de Neon, migrado con `prisma migrate deploy` y
`?schema=restore_check`, restaurado, comparado **valor por valor** contra la copia
—64 tablas idénticas, la imagen con sus bytes `RIFF`— y borrado.

Esa prueba encontró la trampa: **el SQL crudo no sigue al `?schema=`.** Prisma lo
aplica calificando sus propias consultas y deja `search_path` en `public`, así que
el `setval` cayó sobre la secuencia de `public` y la restaurada siguió en 1: la
primera auditoría tras restaurar habría chocado con la más vieja. En producción no
hizo daño —la dejó en `max(id) + 1`—, pero es exactamente el tipo de fallo que no
avisa. `schemaOf()` saca el esquema de la URL y `resetSerials` y
`latestMigration` califican con él. La comprobación de migración **también** leía
el `_prisma_migrations` de `public`, y pasó solo porque los dos estaban en la misma.

#### Restaurar desde el panel: reemplazar, no rellenar

El comando restaura en una base vacía. El panel resuelve el otro caso —«déjalo como
estaba el martes»— sobre la base en la que él mismo corre, así que no puede
restaurarlo todo: tiene que elegir. La línea es **lo que hiciste frente a lo que
pasó**, y vive en `packages/db/src/backup.ts`:

| | tablas | por qué |
| --- | --- | --- |
| se reemplazan | contenido, perfil, multimedia, SEO, menú, configuración, juegos, libros | es lo que se escribe a mano |
| se conservan | usuarios, cuentas, sesiones | restaurar una tabla de usuarios vieja es cómo una restauración deja fuera a su propio operador, sin vuelta atrás desde el panel |
| se conservan | auditoría, sincronizaciones, eventos, papelera, puntos | una historia que se rebobina no es historia, y la restauración misma tiene que quedar en ella |
| se conservan | GA4, Search Console, Vercel, Wallet, enlaces, disponibilidad | son espejos de datos ajenos; la próxima sincronización es más nueva que cualquier copia |

**Ninguna tabla puede quedar sin decidir.** `restorePolicyComplete` usa el mismo
truco que `localeParity`: una tabla nueva en ninguna de las dos listas **no
compila**, y el error la nombra —se comprobó quitando `Book`—. Y `backup.test.ts`
fija lo que el tipo no ve: ninguna tabla en las dos listas, y **nada conservado
apunta a algo reemplazado**. Si apuntara, vaciar la tabla reemplazada arrastraría
en cascada filas que se prometió no tocar.

Tres cosas entre un clic y el resultado:

1. **Vista previa antes de nada**, por tabla: cuántas filas hay hoy, cuántas trae la
   copia, **cuántas se pierden y cuántas vuelven**. Los totales solos esconden el
   caso que importa: una copia con tantos juegos como hoy puede igualmente dejar
   fuera el que se compró ayer.
2. **Escribir `RESTAURAR`**, que el servidor vuelve a comprobar.
3. **Un punto de restauración** con el estado actual, tomado antes de escribir y
   restaurable igual. Volver a un punto toma otro, así que deshacer también se
   deshace. Se guardan los cinco últimos, se pueden descargar, y quedan **fuera de
   la copia descargada**: una copia con copias dentro crecería en cada restauración
   y no protegería de nada nuevo.

Solo se restaura desde el panel una copia **de la migración actual**: las filas de
otra forma de tabla no caben. La vista previa lo dice y el reemplazo se niega
igualmente.

Todo ocurre en **una** transacción: se vacían las tablas en orden inverso de claves
y se llenan en orden. Las referencias hacia lo conservado —el autor de un artículo,
quien subió una imagen— se comprueban contra la base tal como está, y se vacían si
ese usuario ya no existe. Al terminar se invalidan todas las etiquetas de colección
del sitio, que cubren también cada lectura por slug.

**Cómo se verificó**, en `restore_check` y nunca sobre producción: restaurada la
copia, se añadió un juego, se borró un libro, se renombró un proyecto y se escribió
una entrada de auditoría. La vista previa dijo «juegos: se pierde 1» y «libros:
vuelve 1»; restaurar dejó las 43 tablas **idénticas fila por fila** a la copia y la
auditoría intacta; volver al punto devolvió el juego, quitó el libro y repuso el
nombre. Contra producción solo se probó lo que no escribe: vista previa, archivo
basura, confirmación incorrecta y acceso sin sesión. **La primera restauración real
desde el panel no se ha hecho todavía**; el punto que toma es la red para ella.

#### La papelera: una copia de la fila, no una columna `deletedAt`

En `app.nassican.com/papelera`. Artículos, proyectos, páginas, imágenes, juegos y
libros van ahí durante **30 días** antes de borrarse; el cron los purga.

**Un `DELETE` sigue siendo un `DELETE`**, y esa es la decisión. Con una columna
`deletedAt` habría que filtrarla en cada consulta de las dos aplicaciones, y la
primera que se olvidara en el sitio público serviría un artículo borrado sin que
nada avisara. Aquí las filas se copian a `trash_items` y se borran **en la misma
transacción**: nada que lea el contenido puede ver lo que está en la papelera,
porque no hay fila.

`takeSnapshot` encuentra lo que se llevaría el borrado **leyendo el esquema**: toda
tabla que cae en cascada, recursivamente. Escribirlas a mano es cómo una tabla
`*Translation` nueva se borraría algún día con su padre y faltaría al restaurar.
Lo que la cascada no puede ver va aparte:

- **`media_usages`**, que nombra su entidad por tipo e id sin clave foránea. Dejarlas
  atrás era un fallo previo a la papelera: `deletePost` y `deleteProject` no las
  borraban —`deletePage` sí—, así que las imágenes de un artículo borrado quedaban
  «en uso» para siempre y la biblioteca se negaba a borrarlas.
- **Las claves `ON DELETE SET NULL` que apuntaban a la fila** —el menú a una página,
  una página hija, el avatar a una imagen—. Borrar las vacía; restaurar las
  **vuelve a apuntar**, solo si siguen vacías. Una página que vuelve está otra vez
  en el menú, no solo en la base.

Restaurar es deshacer, así que **un artículo publicado vuelve publicado** y el sitio
se entera en el acto; el mensaje lo dice.

**Lo que pudo desaparecer mientras esperaba se reporta, no hace fallar.** Una
referencia opcional que ya no existe —la tienda de un juego, la portada— se vacía;
una obligatoria —la etiqueta de un artículo— deja fuera su fila. Las dos cosas se
listan bajo la papelera, aparte del toast, porque el toast se va solo y esas notas
son trabajo pendiente. Lo único que **no** hace es sobrescribir: si otra fila tomó
el slug, la ruta o el checksum de la imagen, no escribe nada y lo nombra.

Fuera de la papelera, a propósito: tecnologías y tiendas (se niegan a borrarse
mientras algo las use, y vacías no hay qué perder), redirecciones y las listas del
perfil (se guardan enteras, y deshacer ahí es volver a escribir), y usuarios.

**Cómo se verificó**: filas desechables contra la base real, creadas y borradas
por el propio script. Un juego cuya tienda se borró mientras esperaba (vuelve con
la tienda vacía y precio `34225.5` intacto), un artículo cuya etiqueta desapareció
y cuyo slug ocupó otro (se niega y no escribe; liberado, vuelve sin la etiqueta),
una página enlazada desde el menú (se reapunta) y una imagen (bytes idénticos).
Una trampa de la prueba, no del código: `jsonb` reordena las claves de un objeto,
así que comparar cuerpos con `JSON.stringify` da distinto aunque sean iguales.

#### Salud del sitio público: dos rutas, porque una cuesta dinero

- **`/api/health`** — el proceso responde. **No toca la base.** Admite `HEAD`.
- **`/api/health/db`** — además llega a Postgres. 503 si no, con el error en los
  registros y no en la respuesta: un mensaje del driver puede nombrar el host.

La separación es una decisión de coste antes que técnica. Un balanceador o un
monitor preguntan cada minuto, y Neon suspende su cómputo tras unos minutos sin
consultas: una sonda que consultara la base cada sesenta segundos lo mantendría
despierto día y noche, pagando horas de cómputo por preguntar si el sitio vive.
La de base es para un monitor lento o para una persona.

Viven en el **sitio público**, `www.nassican.com/api/health` y `/api/health/db`. El
panel tiene su propio `/api/health` y ningún `/db`: preguntar por ella en
`app.nassican.com` da 404, y no porque nada esté caído.

Las dos quedan fuera del proxy de idiomas porque su matcher ya excluye `/api/`.

### Personal: lo que no es el sitio

En `app.nassican.com/personal`, con Movimientos, Presupuesto, Metas y hábitos,
Suscripciones, Juegos, Libros, Aprendizaje y Bitácora debajo. Las cosas que comparten el login con el panel sin tener nada que
ver con la web.

**Es la única sección que se pliega, y la única con página propia.** Las dos
cosas describen la misma diferencia: «Contenido» y «Medición» son *tipos de
trabajo*, no lugares — no hay nada que ver *sobre* ellos, y esconderlos sería
esconder para lo que existe este panel. «Personal» es un conjunto de cosas que
posees, así que «¿cómo voy?» es una pregunta de verdad con una respuesta de
verdad.

Finanzas dejó de ser su propia sección: tenía una sola entrada y pertenecía aquí
desde el principio.

**El plegado vive en estado y no en una cookie ni en `localStorage`.** El armazón
*es* el layout, así que una navegación de cliente nunca lo remonta y la elección
dura toda la sesión; una recarga completa vuelve a abrirlo, que es el valor por
defecto correcto de todas formas. Persistirlo compraría muy poco y costaría o un
destello del estado equivocado antes de hidratar, o una lectura de cookie en cada
petición.

Y se pliega **solo a propósito**: una sección que se abriera sola porque navegaste
dentro desharía una decisión que acabas de tomar. El título y el botón son dos
objetivos separados y no una fila pulsable, porque «ir a Personal» y «esconder
Personal» son intenciones distintas y un solo objetivo convertiría una de las dos
en un accidente.

#### La página central

Nada editable: es donde miras antes de decidir qué módulo abrir. Las dos
primeras cifras cruzan los tres módulos, que es lo que ninguno puede responder
solo — cuántas cosas tienes sin empezar y cuánto costaron.

`activeHref()` tuvo que aprender que una sección puede tener página. Emparejaba
solo contra las entradas, así que `/personal` era la única ruta del panel que no
iluminaba ninguna cabecera. `navigation.test.ts` lo fija, junto con que toda
sección plegable tenga una página a la que ir: plegar un grupo sin destino
escondería sus entradas detrás de un título que no hace nada.

**Lo que tengo y lo que debo van separados**, y el número neto solo detrás. Junto
salía **negativo**, que se lee como «debes» cuando la mitad es dinero en Nequi.
Dos cifras responden dos preguntas; una sola no responde ninguna.

La partición es **por tipo de cuenta, nunca por el signo del saldo**. Una cuenta
de ahorros en descubierto sigue siendo donde guardas dinero, y una tarjeta que
pagaste de más sigue siendo una tarjeta. Ordenar por signo movería una cuenta
entre «tengo» y «debo» según la semana, y una cifra que cambia de categoría sola
es una cifra que nadie puede leer.

**Dos avisos que el total necesita para no mentir.** El primero es el de
`understatesDebt` un nivel más arriba: dos tarjetas sin saldo inicial hacen que
«lo que debo» sea más pequeño que la verdad, y un total que absorbiera eso en
silencio sería el mismo problema con más alcance. El segundo es que **filtrar por
`excludeFromStats` escondía 946.309 pesos de efectivo**: esa bandera significa
«fuera de mis gráficos», y «¿cuánto tengo?» no es un gráfico. Se cuentan, y
cuánto aportan se dice aparte, así que la página no impone ninguna de las dos
lecturas.

**Un fallo de zona horaria, del mismo linaje que el de la instantánea diaria.**
La etiqueta decía «Gastado en septiembre de 2026» el tres de octubre: la consulta
acota el mes en UTC y la etiqueta se formateaba en hora local, y medianoche UTC
del día uno son las siete de la tarde del treinta en Bogotá. Se formatea en UTC
para que el nombre del mes y las filas contadas hablen del mismo mes.

UTC en los dos lados es seguro aquí y no solo consistente: Wallet guarda un
registro sin hora a las 12:00:00Z, así que un desplazamiento de cinco horas no
puede cruzarlo de mes.

Y la categoría `Transfer` se excluye por su id además de por `transfer_id`, que
es lo que ya costó una vez: sin ella, lo más alto del ranking de gasto eran 36
millones que no se gastaron en nada.

### Finanzas: espejo de Wallet, de solo lectura salvo los presupuestos

En `app.nassican.com/finanzas`. Lee las finanzas personales de Wallet
(BudgetBakers) y **nunca escribe en Wallet**, con una excepción decidida por el
operador: los presupuestos, que se editan desde Presupuesto.

#### Por qué un espejo y no llamadas en vivo

La API da **300 peticiones por hora** y admite **dos condiciones de filtro como
máximo**, con un único orden. El módulo existe para cruzar fecha, monto,
categoría y cuenta a la vez: eso no cabe en una petición, así que en vivo habría
que traer páginas y ordenar en memoria en cada carga de pantalla.

Espejado es SQL corriente — el mismo patrón que ya siguen GA4, Search Console y
Vercel aquí. La cifra que lo zanja: **una sincronización completa de 1.346
movimientos cuesta 10 peticiones**, así que la frescura sale casi gratis y el
presupuesto horario no se toca.

#### Solo lectura por construcción, y con prueba

`lib/wallet-client.ts` es la única puerta y abre en un sentido. Tres cosas hacen
que escribir sea imposible, no desaconsejable:

1. `read()` **no tiene parámetro `method`**: `"GET"` está escrito dentro.
2. **No se exporta nada genérico.** La superficie son cuatro lectores tipados;
   quien llama no alcanza el `fetch`, así que no alcanza otro verbo.
3. `import "server-only"`, que además es lo que mantiene el token fuera del
   bundle del navegador — por construcción, no por acordarse.

Y como un comentario que dice «no añadas escrituras» sobrevive hasta la primera
persona con prisa, **hay una prueba que lee el fuente y falla** si esa forma se
rompe: verbos distintos de GET, un `method` tomado de una variable, una
exportación genérica nueva, o `readRecords` perdiendo su parámetro obligatorio.
`npm test` la corre.

#### Cuatro cosas que la documentación no decía

Ninguna salió de leer la referencia; todas salieron de llamar a la API.

- **Hay una ventana de fechas oculta.** Sin pedir rango, `/records` aplica
  **tres meses** por su cuenta y lo confiesa en `appliedRecordDateFilters`. Un
  espejo que confiara en el valor por defecto guardaría un trimestre y lo
  llamaría historial completo. Por eso `readRecords(since, …)` exige la fecha:
  la omisión no se puede cometer.
- **`limit` no es 200 en todos los endpoints.** La referencia dice «max: 200»
  para los listados; `/budgets` responde `400 limit must be at most 20`. Los
  demás sí aceptan 200. Medido endpoint por endpoint después de que una
  sincronización muriera con el número documentado.
- **`createdAt` no siempre viene.** Un registro llegó sin él tras 460 correctos,
  y la columna obligatoria convirtió eso en sincronización fallida. Ahora los
  timestamps son nulables: un espejo no puede exigir un campo que la fuente
  trata como opcional, e inventar una fecha sería peor que admitir que no se
  sabe.
- **El orden por defecto es del más nuevo al más viejo**, que importa para
  paginar correctamente.

#### Decisiones del modelo

- **Dinero en `numeric`, nunca `float`.** La API manda números JSON
  (`-78.4`); guardarlos como dobles es cómo un saldo acaba en `.00000000001`.
- **El signo se conserva**: un gasto es negativo porque así lo manda Wallet. No
  se normaliza a positivo con una columna de signo — la convención de la fuente
  es lo único que un espejo no debe reinterpretar.
- **Sin claves foráneas entre las tablas del espejo.** Son datos de otro: una
  cuenta puede desaparecer de la API con sus movimientos aún presentes, y una
  restricción convertiría eso en una sincronización fallida en lugar de una fila
  con un nombre viejo. Wallet ya denormaliza los nombres en cada movimiento, así
  que el espejo los guarda y el listado se sostiene solo.
- **Borrar es parte de sincronizar**, acotado a la ventana leída: lo que ya no
  está en Wallet se va del espejo, pero una sincronización parcial no puede
  arrasar el histórico anterior.
- **Los filtros viven en la URL.** Una vista filtrada es un enlace que se puede
  guardar y el botón de atrás hace lo que debe. Cualquier cambio salvo la página
  vuelve a la primera: quedarse en la página 7 de un resultado más estrecho
  muestra una tabla vacía y parece roto.
- **Los totales se calculan sobre el conjunto filtrado, no sobre la página
  visible.** Un total que cambia al pasar de página no es un total.
- **De los presupuestos solo se muestra el límite**, que es lo que Wallet
  expone. Lo consumido se calcularía cruzando movimientos y categorías, y una
  cifra propia que discrepe de la que ves en la app es peor que no dar cifra.

#### Presupuestos: la única escritura, también por construcción

El 5 de octubre de 2026 el operador decidió que el panel pueda **editar
presupuestos** en Wallet, y nada más. El token de Wallet **no tiene scopes**: el
mismo que edita un presupuesto podría borrar todos los movimientos. Así que, igual
que la lectura, el límite tiene que estar en la forma del código y no en una
promesa.

`lib/wallet-client.ts` **sigue siendo solo lectura** y su prueba no cambió. La
escritura vive en otro archivo, `lib/wallet-budgets.ts`, y abre a una sola cosa:

1. **Una dirección**, la de `/budgets`, y ninguna función recibe una ruta.
2. **GET, POST y PATCH**, escritos en cada función. **No hay DELETE**: el de Wallet
   es un endpoint genérico para todos los tipos, y cerrar un presupuesto —que
   Wallet conserva con su historial— es la forma reversible de retirarlo.
3. **Nada genérico exportado.** El único `PATCH` es privado y su tipo enumera lo
   que se puede cambiar: nombre, límite desde un mes, categorías, cerrado.
4. **Nunca `resetLimit`**, que reescribiría el límite de los meses pasados.

`wallet-budgets.test.ts` lee el fuente y falla si se rompe cualquiera de las
cuatro. Se comprobó que muerde cambiando `PATCH` por `DELETE` a mano.

#### Las tarjetas de crédito engañan, y el módulo lo dice

Wallet calcula una tarjeta en modo `creditCardManual` como **la suma pelada de
sus movimientos**. Con `initial = 0` —que es como quedan si nadie lo ajusta— el
saldo solo refleja lo registrado desde el primer movimiento: lo que se debía
antes no está en ninguna parte del cálculo, y la cifra parece mucho menor de lo
que es.

Pasó, y costó una pregunta: RappiCard mostraba 583.994,96 debiendo bastante más.
El espejo era fiel —cuadraba al céntimo con Wallet en las seis cuentas, con los
mismos conteos de registros—, así que el desfase estaba en Wallet.

Dos cosas salieron de ahí. Una tarjeta muestra **«debes X»** en lugar de un
negativo mudo, porque un signo menos junto a un saldo de ahorros invita a la
lectura contraria. Y `understatesDebt()` marca la huella exacta del problema —
tarjeta, saldo inicial 0, movimientos > 0 — en vez de dejar que se descubra
comparando con la app del banco. Se arregla ajustando el saldo inicial **en
Wallet**: este módulo no escribe.

El token va en `WALLET_API_TOKEN` (requiere plan Premium) y solo en el entorno
del panel. Se comprobó que su valor no aparece en ninguno de los 47 bundles de
cliente.

### Habilidades: el logo es el dibujo, el color solo tiñe la ficha

En `app.nassican.com/habilidades`. El módulo que CLAUDE.md llevaba meses
prometiendo, y existe por un síntoma concreto: **al pasar el ratón por Vite se
ponía todo amarillo.**

La causa estaba repartida en dos sitios. `SkillIcon` dibujaba cada tecnología con
`react-icons/si`, que es **un solo path**, y la ficha lo teñía con
`--brand-text` sacado del único `hex` de la fila. El logo de Vite es un degradado
cian-a-morado sobre un rayo amarillo: un path y un color no pueden representarlo.

**Devicon**, y no Simple Icons, por una razón medible: 578 tecnologías, **559 con
variante `original` que es el logo real con sus degradados** y 388 con una `plain`
monocolor. Simple Icons da un color de marca por logo — que es exactamente el
problema. El propio manifiesto de devicon dice que Vite es `#ffdd35`.

Resultado en la fila de Vite: el hex de la ficha sigue siendo `#646cff`, y dentro
del logo hay **cinco colores** — `#41d1ff`, `#bd34fe`, `#ffea83`, `#ffdd35`,
`#ffa800`.

**No es una dependencia de runtime.** El panel busca en devicon, el operador ve el
logo real antes de confirmar, y el markup preparado se guarda en
`technologies.icon_svg`. El sitio público inyecta lo que hay en la fila: nunca
pide nada a un tercero para dibujarse, por el mismo motivo por el que las
imágenes viven en Postgres.

#### Dos fallos que solo aparecen al inyectar varios logos juntos

**El primero rompe los colores en silencio.** Devicon numera sus degradados `a`,
`b`, `c` **en todos los archivos**, así que el `url(#a)` de Vite y el de Node son
el mismo nombre. Con los dos en la misma página —que es la definición de la
sección de habilidades— el segundo icono se pinta con el degradado del primero.
Vite sale verde. Nada falla, nada avisa, y se lee como «los colores están mal» y
no como una colisión de ids. Medido sobre los doce logos del proyecto:
**4 colisiones de 10 ids**. `namespaceSvgIds` les pone la clave de la tecnología
delante; después, 0.

**El segundo lo introduje yo y lo encontró la báscula.** Inyectar el markup una
vez por ficha dejó la portada en **53,7 % de SVG inline**: 371 KB, de los cuales
275 KB eran los mismos logos repetidos, porque el carrusel duplica su lista para
hacer el bucle. El icono de Docker aparecía **diez veces**. Un sprite define cada
uno una vez y las fichas lo referencian con `<use>`:

| | antes | después |
| --- | --- | --- |
| portada | 691.753 B | **453.665 B** |
| ids duplicados | 35 | **0** |
| símbolos / referencias | — | 23 / 116 |

Diez copias de un icono también significaban diez elementos con `id="docker-a"`,
que es HTML inválido y funcionaba solo porque `url(#docker-a)` resuelve contra la
primera coincidencia del documento y las diez eran idénticas.

El sprite se oculta con `width:0` y no con `display:none`, que en algunos
navegadores impide que los degradados referenciados resuelvan.

#### Lo que hace que el color no se pierda

`BrandIcon` fija `color: initial` cuando tiene logo propio. Sin eso heredaría el
`--brand-text` de la ficha y volveríamos al punto de partida — la ficha sigue
tiñendo su fondo, su borde y su resplandor, y el glifo ya no.

Con la variante `plain` pasa lo contrario y también a propósito: es una forma sola
que **sí** debe teñirse, y para eso está el hex.

#### Monocromo: dos modos que quieren lo contrario de la misma propiedad

`color` no basta, y el caso que lo demuestra es Express: **su marca es un path sin
atributo `fill`**, y el valor por defecto de `fill` en SVG es **negro**. Sobre un
fondo oscuro no es que desentone — no se ve. El hex de marca tampoco lo salva,
porque el color de marca *es* negro.

Y hay un segundo motivo, menos dramático: veintitrés logos con sus propias
paletas son veintitrés paletas discutiendo con la del sitio.

Así que `IconMode` tiene dos valores y **cada uno necesita lo contrario del otro**
en `BrandIcon`:

| modo | `color` del icono | por qué |
| --- | --- | --- |
| `color` | `initial`, no hereda | si hereda, el tinte de la ficha lo aplana — el fallo de Vite |
| `mono` | hereda `currentColor` | si no hereda, cae al negro por defecto — el fallo de Express |

Eso es exactamente por qué el modo es un campo y no una convención: una sola
regla no puede servir a los dos.

`monochromeSvg()` quita degradados, filtros, atributos de color y las
declaraciones `fill`/`stroke` escritas como estilo, y pone `fill="currentColor"`
en la raíz. **`fill="none"` sobrevive a propósito**: eso es forma y no color — es
como un logo conserva sus huecos, y repintarlo los rellenaría.

Se aplica **al construir el sprite**, no al guardar. El original preparado se
queda en la fila, así que cambiar de modo es una columna y nunca otra descarga, y
volver atrás no pierde nada.

#### Añadir tecnologías, que es lo que faltaba

La primera versión solo editaba lo que la migración de contenido había sembrado,
lo que la convertía en un selector de color y no en un módulo: lo que de verdad
se le pide es poner una tecnología nueva en el sitio sin desplegar.

Eliminar **se niega mientras algo la referencie**, y dice cuántos. Misma regla que
`deleteMedia` y por el mismo motivo: el stack de un proyecto es una clave
foránea, así que borrar la fila de debajo fallaría en la base o vaciaría una
ficha en silencio. El botón se deshabilita además con el conteo en el `title`,
pero la comprobación que cuenta es la de la acción.

#### Dónde quedó la migración de `skills.ts`

Las tablas `technologies` y `skill_groups` ya tenían los datos desde la migración
de contenido: 25 tecnologías, 4 grupos con sus etiquetas en los dos idiomas, sus
posiciones y sus miembros ordenados. Lo único que faltaba era poder editarlo. Los
títulos de grupo salen ahora de las filas y el diccionario pasó a ser el respaldo
— el mismo movimiento que hizo Configuración con el menú.

**`skills.ts` todavía no se puede borrar**, y conviene saber por qué para no
intentarlo otra vez: lo importan `lib/seo.ts` y `llms.txt/route.ts` para la lista
de nombres de tecnología. Borrarlo exige pasarles esos nombres como argumento, y
`seo.ts` tiene que seguir siendo **puro y síncrono** — la misma razón por la que
recibe los artículos y los proyectos en vez de consultarlos. Es un cambio
deliberado, no una limpieza de cola. La sección de habilidades del sitio ya no lo
lee.

### Juegos: la biblioteca se escribe a mano, y es lo correcto

En `app.nassican.com/juegos`. Sección «Personal» del menú, aparte de Finanzas.

**No se deriva del espejo de Wallet, y esa decisión se tomó dos veces.** La
primera propuesta fue derivarla: las notas de los 89 movimientos de la categoría
*Software, apps, games* nombran casi todos los juegos, con precio y fecha, desde
abril de 2020. Era tentador y estaba mal. **Una biblioteca no es un registro de
pagos:** un juego regalado o de los que Epic da gratis no tiene movimiento
ninguno, así que «juegos que no he abierto» —la única cifra de este módulo que
puede cambiar una decisión— habría salido mal desde la primera fila.

Tampoco hay API que lo automatice: no hay clave de Steam, y ni Ubisoft Connect ni
GOG publican una API de biblioteca. Así que a mano no es una concesión, es lo
único que existe.

**Dos veces una agrupación ingenua dio una respuesta segura y falsa** sobre esos
movimientos, y conviene que quede escrito porque es el argumento del diseño:

1. Mirando 18 filas, la categoría parecía ser suscripciones. Son juegos: solo 5
   de 89 son recurrentes de verdad.
2. El detector marcó `assassin's` como recurrente — 11 meses, 230.473 en total— y
   se interpretó como un diferido a 11 cuotas. Son **once juegos distintos de la
   saga comprados en seis años**. Solo 5 de los 89 dicen «diferido».

Cuatro decisiones que el esquema no explica solo:

- **`platform` es el lanzador, no la tienda.** Una clave comprada en Eneba se
  juega en Ubisoft Connect, y lo que quieres saber después es dónde hacer clic.
- **Vacío no es cero**, ni en precio ni en horas. Cero horas es un juego que
  abriste y cerraste; cero pesos diría que fue gratis. `null` dice «no lo sé», y
  las dos cifras del módulo dependen de que esa diferencia exista.
- **Las fechas se guardan como texto parcial** —`2024`, `2024-08`,
  `2024-08-13`— por lo mismo que las de experiencia y formación: recuerdas haber
  comprado algo en 2022 sin recordar el día, y un parser inventaría el 1 de enero.
- **El coste por hora solo promedia los juegos que tienen las dos cifras.**
  Dividir el gasto total entre las horas totales cobraría a los juegos que sí
  jugaste los que nunca pusiste precio, y el número se movería cada vez que una
  fila queda a medias. Comprobado: con un juego de 34.225 a 42,5 h y otro de
  60.000 sin abrir, da 805,29 y no 2.216.

**El estado se cambia desde la lista**, no desde el formulario: es el campo que
más se mueve y abrir un editor para tocar un `select` son tres clics para una
decisión.

**Un fallo que encontró su propia prueba, y vale por el módulo entero.**
`parseNumber` usaba `Number()` directo, y aquí **el punto agrupa miles**: `34.225`
se leía como treinta y cuatro. Un juego de 34.225 pesos se habría guardado como
34, en silencio, y en la dirección que hace parecer barato el montón de sin
abrir. Lo peor: el módulo *imprime* los precios en formato es-CO, así que copiar
una cifra de la pantalla al campo era la forma más probable de provocarlo. La
lógica estaba además duplicada en `games.ts`, o sea que el fallo existía en dos
sitios y se podía arreglar en uno solo; ahora hay una sola función y una prueba
que comprueba que validar y guardar leen el número igual.

#### La tienda no es el lanzador, y hacen falta las dos

«Lo compré en Steam pero es de Ubisoft y se abre en Ubisoft Connect» no es un
caso raro: **son 9 de los 96 juegos**. Un solo campo obligaba a mentir en todos
ellos, y la pregunta que se hace después —«¿dónde hago clic para jugarlo?»— tiene
una sola respuesta correcta.

- **`platform`** es dónde se ejecuta: el lanzador que abres.
- **`store`** es dónde se compró, y es opcional porque a veces ya no se recuerda.

La ficha solo menciona la tienda cuando difiere del lanzador, que es el único
caso en que decirlo aporta algo.

#### Las tiendas son filas; los lanzadores, no

Y la diferencia no es arbitraria. **Un lanzador es un conjunto cerrado que no te
inventas** —Steam, Ubisoft Connect, GOG Galaxy, Epic— y añadir uno es un acto raro
y deliberado, así que vive bien en un enum. **Una tienda es lo contrario**: Eneba,
Humble, Fanatical, Instant Gaming y la siguiente reventa de claves que aparezca.
Obligar a desplegar para registrar una compra en una tienda nueva es la clase de
fricción que termina con el campo vacío, y un campo vacío es un campo muerto.

Borrar una tienda **no borra sus juegos**: la clave foránea es `SetNull`, así que
conservan su lanzador y pierden solo la respuesta a «de dónde salió», que ya era
opcional. Negarse en cambio significaría que una tienda que cerró no se puede
ordenar nunca.

**La migración se escribió a mano porque la generada perdía datos.** `prisma
migrate diff` proponía `DROP COLUMN "store"` antes de que existiera dónde copiar
las 88 asignaciones. El orden es el asunto entero: crear la tabla, sembrarla desde
el enum que está a punto de irse, rellenar, y solo entonces borrar la columna.
Comprobado contando antes y después: 88 y 88.

Dos filtros en la lista y no uno, por la misma razón que hay dos campos: «lo
compré en Steam» y «se abre en Ubisoft» son preguntas distintas y nueve de estos
juegos las responden distinto.

#### «Lo quiero»: un deseo no es dinero gastado

`wishlist` existe en las dos bibliotecas, y el compilador señaló al añadirlo algo
que no estaba pensado: **el precio de un deseo es lo que esperas pagar, no lo que
pagaste**. Dejarlo entrar en «gasto total» o en «sin abrir» reportaría dinero que
sigue en el banco — la única forma en que esas cifras podrían mentir sin parecer
mal. Queda fuera de las dos.

Lo encontró `Record<GameStatus, number>` al dejar de compilar, que es el mismo
truco de exhaustividad que usan `localeParity` y el mapa de secciones de la
portada.

#### La lista curada, fusionada con la siembra

```bash
npm run games:list -- --dry   # informa sin escribir
npm run games:list            # escribe
```

Dos registros de los mismos seis años con granularidades distintas. La siembra
desde Wallet partió cada pack en sus juegos —diecisiete títulos de Valve, tres de
Outlast— pero adivinó el lanzador a partir del comercio y le salió `other` casi
siempre. La lista curada sabe la **tienda** de cada compra y no parte los packs.

**El mapeo está escrito a mano, no emparejado por parecido.** «Assassins Creed
Origins» y «Assassin's Creed Origins - Standard Edition» son la misma compra;
«Half-Life 2» y «Half-Life 2: Episode One» no lo son. Un emparejamiento difuso
acertaría casi siempre, y estos datos ya habían producido dos respuestas seguras
y falsas. Lo explícito se revisa; lo listo no.

Resultado: 56 compras cubriendo 88 de 96 filas, 85 corregidas, 3 creadas (las de
este mes, posteriores a la última sincronización), **0 sin mapear**, y 8 filas que
la lista no menciona y que se dejan intactas.

El precio de un pack **no se reparte entre sus miembros**: queda en la nota. Es la
misma regla de la primera siembra y por el mismo motivo — 13.131 entre diecisiete
juegos son 772 que nadie midió.

Un fallo que cazó el `--dry`: la creación no comprobaba lo ya existente, así que
una segunda pasada habría duplicado esos tres títulos. Es exactamente para lo que
estos scripts imprimen antes de actuar.

#### La siembra desde Wallet, una sola vez

```bash
npm run games:import -- --dry   # informa sin escribir
npm run games:import            # escribe
```

La biblioteca es independiente de Wallet, pero seis años de notas de compra ya
nombraban casi todos los títulos y teclear cien a mano era trabajo para nada. El
script corre **una vez**, escribe filas normales de `games`, y después es
irrelevante: nada vuelve a leer Wallet. Es idempotente por título, así que una
segunda pasada importa 0.

Resultado: **93 juegos desde abril de 2020**, 38 líneas descartadas, y 869.194
pesos en cosas sin abrir que no estaban contados en ningún sitio.

Tres decisiones que el script explica con su salida:

- **Un cargo con varios títulos no lleva precio**, y el total va a la nota. Hubo
  15 cargos así, uno de ellos con **diecisiete** juegos de Valve por 13.131:
  repartirlos a 772 cada uno inventaría una precisión que nadie tiene, y el
  contrato del módulo es que un precio vacío significa «no sé». Una cifra real o
  ninguna.
- **Todo entra como «sin empezar»**, que es mentira y hay que decirlo: nada aquí
  sabe qué se jugó. Es el punto de partida que se corrige desde la lista, donde
  el estado es un select por fila.
- **La lista de descarte se imprime entera, una línea por línea.** Esta categoría
  guarda también las suscripciones —Claude, Netflix, Google One, Duolingo,
  Hostinger— y dos agrupaciones ingenuas ya habían dado respuestas seguras y
  falsas sobre estas filas. Nada se adivina en silencio: el `--dry` las enseña y
  el operador las revisa.

Un fallo que el `--dry` cazó antes de escribir: la lista de descarte solo miraba
la nota, así que el cargo de Hostinger —anotado «Diferido a 1 mes» y nada más—
iba a entrar como un juego llamado *Diferido a 1 mes*. Ahora se comprueba también
la contraparte, y una línea que solo dice que el cobro fue diferido se descarta
por sí sola.

### RSS: el feed que no existía

`/rss.xml` y `/en/rss.xml`, generados desde las mismas consultas que alimentan el
sitemap. Es lo más barato de toda la lista de pendientes y lo que más
desproporcionadamente rinde: un blog sin feed es invisible para los lectores y los
agregadores, que en una audiencia técnica son casi todo el tráfico que no viene de
una búsqueda.

**RSS 2.0 y no Atom**, que es el más viejo y más feo de los dos y el que cualquier
lector maneja sin pensar. Ahí no está la decisión interesante.

Tres que sí lo son:

- **El `guid` es el slug, no la URL.** Un lector apoya en él su lista de «esto ya
  lo vi», así que tiene que sobrevivir al día en que una ruta cambie. Con la URL,
  renombrar un artículo lo reenviaría a todo el mundo como si fuera nuevo.
- **Un despliegue de vista previa y el modo mantenimiento devuelven un canal
  vacío, no un 404.** Un lector que recibe un 404 puede darse de baja; uno que
  recibe un canal sin entradas simplemente no encuentra nada nuevo, que es la
  verdad en los dos casos.
- **`atom:link rel="self"`** apunta al propio feed, que es como un lector se
  entera de que la dirección se movió.

**Y una trampa que este documento ya describía desde el otro lado.** `/rss.xml`
daba **404** mientras `/en/rss.xml` funcionaba, porque el matcher del proxy excluye
las rutas con punto —así es como `/media/<sha256>.webp` nunca se reescribe al
segmento `[locale]`— y por tanto `/rss.xml` nunca llegaba a `/es/rss.xml`. Se
arregla como ya se había arreglado `/llms.txt`: listándolo explícitamente para
volver a entrar en la reescritura. **Cualquier ruta nueva con un punto en el
nombre tiene este fallo**, y solo en la URL española, que es la que menos se
prueba.

### El índice de contenidos, y el fallo que destapó

`headingId` lleva desde siempre poniendo un `id` a cada encabezado de `Prose` —el
comentario de esa función incluso decía «para anclas y el índice»— y nada lo
enlazaba. El trabajo estaba hecho; faltaba la lista.

**Pero `headingId` solo no basta, y el índice es justo lo que lo enseña.** Dos
encabezados llamados «Resultado» pliegan los dos a `resultado`, el navegador salta
al primero, y la segunda entrada de la lista apunta en silencio a la sección
equivocada. Se lee como un ancla rota, no como una colisión.

Por eso el sufijo lo pone `tableOfContents()`, y **`Prose` renderiza desde esa
misma función** en lugar de llamar a `headingId` por bloque. Si no, la lista y el
documento discreparían sobre cómo se llama el segundo «Resultado», que es peor que
el fallo que se estaba arreglando. Los dos recorren solo los bloques `heading` y
en el mismo orden, así que no se pueden desalinear.

Se oculta con menos de dos entradas: uno no es un índice, es la primera línea del
artículo repetida. Y es servidor y `<a>` pelados — un resaltado que sigue al lector
es bonito y también es un componente de cliente en cada página de artículo, y esto
se gana su sitio sin uno.

### Libros: la misma idea con otros sustantivos

En `app.nassican.com/libros`, junto a Juegos en la sección «Personal».

Misma forma que Juegos hasta en el orden de los campos, a propósito: dos
bibliotecas que se comportan distinto sin motivo son dos cosas que recordar. Lo
que cambia es lo que un libro de verdad tiene — autor, páginas, formato — y nada
se dobla para que las dos tablas se parezcan.

**Dos tablas y no un `LibraryItem` con un `kind`.** Un modelo compartido habrían
sido cuatro columnas nulables y un discriminador haciendo de dos tablas honestas.
Lo que sí comparten es **leer sus campos**, que vive en `draft-fields.ts` — y esa
extracción tiene una razón concreta: la primera versión de `parseNumber` se
desplegó con un fallo que existía en dos sitios y se podía arreglar en uno solo.

Cuatro decisiones propias de los libros:

- **`format` es cómo se lee** (físico, ebook, audiolibro), no dónde se compró. Lo
  segundo no se necesita saber otra vez; lo primero cambia qué significan las
  páginas.
- **Un libro terminado cuenta su longitud entera**, leída o no. Nadie actualiza
  `pagesRead` en la última página, así que fiarse de ese campo descontaría todos
  los libros que alguien ha acabado en su vida. Para lo que no está terminado,
  cuenta lo registrado.
- **El porcentaje solo se muestra mientras significa algo.** Un libro terminado
  es el 100 % por definición y decirlo es ruido.
- **Leer más páginas de las que tiene se reporta con las dos cifras.** Casi
  siempre es el total escrito en la casilla equivocada, y recortarlo en silencio
  esconde justo eso. El promedio de longitud solo cuenta los terminados que
  tienen páginas, por lo mismo que el coste por hora de los juegos solo cuenta
  los que tienen las dos cifras.

#### El ISBN completa lo vacío, nunca lo escrito

«Completar» busca el ISBN y rellena título, autor y páginas **solo en los campos
vacíos**. El título del catálogo para una edición española suele ser el inglés, o
trae un subtítulo que nadie dice en voz alta; sustituir algo que el operador eligió
es lo único que un autocompletado no puede hacer nunca. `fillFromFacts` es puro y
la prueba lo fija.

**Solo Open Library, y Google Books se quitó a propósito.** Estuvo de respaldo y
sin clave respondió 429 a todas las peticiones: la cuota anónima es compartida por
todo el que llama sin clave, y está gastada. Con clave era otro proyecto de Cloud y
otra factura que vigilar, para un respaldo que en la práctica bebe de los mismos
catálogos: cuando Open Library no conocía una edición, Google tampoco. Una fuente
que responde vale más que dos donde la segunda solo añade una forma de fallar.
«No está en el catálogo» y «el catálogo falló» son respuestas distintas, y el
mensaje las separa: una significa escribirlo a mano, la otra reintentar luego.

**Se guarda como ISBN-13 y el dígito de control se comprueba.** Un ISBN-10 y su
ISBN-13 son la misma edición, y dos grafías harían de un libro dos. Un ISBN mal
tecleado sigue teniendo trece dígitos, y buscarlo rellenaría el formulario con el
libro de otro. El prefijo «ISBN-13:» se quita entero: si no, su «13» se leería
como los dos primeros dígitos.

El borrador se construía desde la fila **en dos sitios** —el botón de editar y la
base de «sin guardar»—, así que añadir `isbn` en uno solo habría dejado el marcador
encendido en todo formulario abierto. Ahora los dos usan `toDraft`.

### Suscripciones: a mano, y por meses pagados

En `app.nassican.com/suscripciones`, en «Personal».

**No se deriva de Wallet, por decisión del operador y con los números detrás.**
Agrupar los cargos repetidos del espejo dio Netflix y Tigo junto a D1 y Mercado
Libre, partió Tigo en dos nombres, y no encontró ni Claude ni Google One —que se
cobran en dólares, al año o desde otra cuenta—. Es la tercera vez que una
agrupación ingenua de esos movimientos daría una respuesta segura y falsa.

**Un pago es un mes, no un día.** `subscription_payments` tiene clave
`(suscripción, periodo)` con `periodo = "2026-09"`: «¿pagué septiembre?» es la
pregunta, y un cobro del 31 de agosto por septiembre tiene que responderla. El
día, si se sabe, va en `paidAt`. La cuadrícula del año marca cada mes como
pagado, esperado y ya pasado (ámbar, con «?»), próximo, o nada esperado. Los
esperados salen del ciclo contado desde la próxima renovación, y nunca antes del
inicio: un plan empezado en junio no debe marzo. El ámbar **pregunta, no acusa**:
un mes pagado y no marcado se ve igual que uno sin pagar.

Tres decisiones que el código no explica solo:

- **«Pagado» mueve la renovación solo si el pago era para ella.** Marca el mes de
  la renovación y la adelanta un ciclo; marcar un mes viejo en la cuadrícula no
  empuja la próxima fecha al futuro por accidente.
- **Un mes marcado a posteriori no inventa fecha.** Se guarda con el precio de
  lista y `paidAt` vacío; el monto real y el día se rellenan después, y lo
  pagado del año suma lo cobrado de verdad, no el precio de lista.
- **Avanzar un mes respeta la precisión y ajusta el día** que el mes no tiene: el
  31 de enero más un mes es el 28 o 29 de febrero, que es lo que hace la tarjeta.
  Una renovación escrita como mes se juzga por mes: vence «este mes», no «hace un
  día» desde un 1 inventado.

**El ciclo es un número de meses, no un enum**, así que un plan semestral es un
valor y no una migración.

**Los dólares se convierten con la TRM oficial** (`lib/trm.ts`, datos abiertos de
la Superintendencia Financiera: sin clave, con caché de 12 h en el propio
`fetch`). Si no hay tasa para todas las monedas —euros, o la API caída— **no hay
total en pesos**: cada moneda por separado. Una suma parcial con la etiqueta de
total es la cifra que este módulo no puede mostrar.

El dashboard avisa de lo vencido sin marcar y de lo que se renueva en 7 días, y
borrar una suscripción la lleva a la papelera **con sus pagos**.

### Bitácora: la semana que pasó, y lo que escribiste de ella

En `app.nassican.com/bitacora`, en «Personal». La semana vive en la URL
(`?semana=2026-09-28`), así que una semana pasada es un enlace y «atrás» funciona.

**La mitad automática no se guarda: se lee.** Sale de la auditoría al dibujar la
página. Guardar un resumen junto a su fuente sería una segunda respuesta
esperando a discrepar de la primera. `describeAudit` convierte cada fila en una
frase, y los **cambios de estado son las frases que importan**: «Editaste el
juego» no dice nada, «Terminaste Geometry Dash» es para lo que existe la
biblioteca. Las repeticiones del mismo día se pliegan («×30»), y se dejan fuera
las sesiones y las propias notas de la bitácora.

Algunas filas viejas de auditoría guardaban solo el estado y no el título —el
`setStatus` de Juegos registraba `{status}`—, así que el nombre se busca por id
para esas, en una sola consulta por tipo.

**Las semanas son locales.** Una edición a las nueve de la noche del domingo en
Bogotá son las dos del lunes en UTC, y agrupar por UTC la archivaba en la semana
siguiente: el mismo error que ya cometió la instantánea diaria. `zonedMidnight`
calcula el instante de la medianoche local con el desplazamiento de la propia
zona, y la prueba lo fija también para una con horario de verano.

**Escribir una nota no se audita**: la bitácora acabaría describiéndose a sí misma
con «añadiste una nota». Moverla a la papelera sí, como todo borrado. Una nota
exige un día completo —pertenece a una semana, y «2026-10» no dice a cuál—; la
hora es opcional, y las notas sin hora encabezan su día. Las notas se ven en
blanco y lo automático en gris: son dos clases de verdad, el registro y tu
versión de él.

**Tres pesos, a propósito.** Tus notas son lo más visible, porque son lo único
escrito por ti. Lo que cambió algo —terminaste, publicaste, pagaste, añadiste
algo en Personal— va después, con su icono, y se resume arriba en cuentas («2
libros empezados · 2 pagos»). Las ediciones de rutina van en gris y se pliegan
pasadas tres por día: una semana real tuvo 170 de estas y 18 de las otras, y con
el mismo peso las 18 se perdían entre las 170.

**Una afirmación necesita evidencia.** Marcar un juego como terminado escribe la
misma fila de auditoría al terminarlo que al poner al día una biblioteca vieja, y
la primera semana real contó «25 juegos terminados» de una tarde de lo segundo:
24 sin fecha de fin y uno de 2025. Así que «Terminaste» solo se dice —y solo
cuenta— cuando la fecha de fin del juego o libro cae a una semana de la marca, o
en el mismo mes si solo se sabe el mes. Si no, «Marcaste como terminado», en
rutina. Igual con los pagos: «Pagaste» solo para el botón «Pagado» (que registra
`now: true`) o para un mes actual o posterior; marcar mayo en octubre es
«Registraste el pago», y seis meses marcados de una sentada no son seis pagos de
esta semana.

**No es la auditoría.** Se arma con ella, pero pliega repeticiones, deja fuera lo
rutinario y sus notas se editan; el registro completo, con quién y desde dónde,
sigue en Sistema, y la propia página lo dice con un enlace a `/sistema#auditoria`.

**La revisión semanal guiada.** El resumen libre pasó a tres preguntas —qué salió
bien, qué cambiarías, tres prioridades para la semana siguiente— más notas libres.
Se apoya en el metaanálisis de Harkin (2016): vigilar el progreso ayuda a cumplir
metas, y más **cuando se registra por escrito**.

- **Las prioridades se guardan en la semana para la que son**, no en la que se
  escribieron: la revisión de la semana 40 escribe las de la 41, y es en la 41
  donde se marcan como cumplidas. Ver si el plan aguantó es la mitad de una
  revisión que mejora el siguiente plan.
- **Tres como mucho.** Una lista de prioridades que crece es una lista sin
  ninguna. Se emparejan por id, así que editar una conserva su marca.
- **Una prioridad se vuelve pendiente con un clic**, planificada para el lunes de
  su semana: la revisión dice qué importa y Pendientes le da un día.
- **Lo que hay que decidir está a la vista** mientras se revisa: la bandeja sin
  fecha y lo atrasado, con enlace.
- **El dashboard la recuerda solo de lunes a miércoles.** Una revisión mira atrás
  para planificar adelante, y el jueves la semana que planificaría ya va por la
  mitad. Recordarla un sábado solo enseña a ignorar recordatorios.

`writeReview` vive en `lib/journal.ts` y no en la acción para poder probarse
contra la base sin una petición alrededor: respuestas y prioridades van en una
sola transacción, para que nunca quede una revisión guardada sin el plan al que
llevó.

### Pendientes: apuntar rápido, planificar con un día

En `app.nassican.com/pendientes`, junto al Dashboard. El módulo existe por un
hallazgo concreto: Masicampo y Baumeister (2011) mostraron que una tarea sin
terminar sigue interfiriendo con lo siguiente que haces, y que lo que la calla
**no es terminarla sino planificar cuándo**. De ahí la regla del módulo: un
pendiente sale de la bandeja **solo con un día**. «2026-10» no es un plan.

**Capturar cuesta dos segundos o no ocurre.** Desde cualquier pantalla, la paleta
con `+` delante apunta en lugar de buscar: «+ pagar la luz mañana» crea el
pendiente ya planificado. El «hoy»/«mañana» del final se lee **en el servidor**,
contra la zona configurada, porque el día del navegador puede no ser el de
Bogotá. La paleta se queda abierta tras apuntar: capturar viene en ráfagas.

**Descartar es un cierre, no un fracaso.** Decidir no hacer algo lo saca de la
cabeza igual que hacerlo, así que tiene su botón al lado de los de planificar.

Los grupos son de calendario y no de «próximos 7 días»: «esta semana» acaba el
domingo, y un domingo no ofrece «próximo lunes» porque ya es «mañana». Planificar
es un toque —Hoy, Mañana, Próximo lunes— y «Otro día» abre el calendario. El
dashboard avisa de lo atrasado y de lo que es para hoy.

En la bitácora, **solo completar destaca**. Apuntar, planificar y descartar son
cómo se mantiene la lista, y una semana de ellos a peso completo enterraría lo
hecho.

### Metas y hábitos: con plan, con señal, y con la cifra real

En `app.nassican.com/metas`, en «Personal». Dos piezas, cada una sobre su propia
evidencia.

**Una meta exige su plan «si… entonces…».** Es el único campo obligatorio además
del título, partido en sus dos mitades. Los metaanálisis de *implementation
intentions* (Gollwitzer y Sheeran, 2006: d = 0,65 en 94 pruebas; Sheeran, Listrom y
Gollwitzer, 2024: 642 pruebas) encontraron el efecto mayor justo en ese formato
condicional. Una meta sin plan es un deseo, y el formulario no guarda deseos.

El progreso se lleva **a mano** (+ y −, nunca bajo cero) o **se cuenta solo** desde
filas que otros módulos ya tienen: libros y juegos terminados, artículos
publicados, pendientes completados. Contado al leer y nunca guardado, para que «4
de 12 libros» no pueda discrepar de Libros. Los terminados se cuentan **por su fecha
de fin, a su propia precisión**: un libro terminado «2026» cuenta para una meta que
empieza en marzo de 2026, porque nada dice que fuera antes. Sin fecha de fin no
cuenta — la misma evidencia que pide la bitácora antes de decir «terminaste».

**Un hábito exige su señal** (`cue`: «después de almorzar») y los días en que toca.
Dos números que una app de hábitos suele falsear siguen el estudio de Lally (2010):

- **La racha perdona un día perdido.** Solo se corta con dos días debidos seguidos
  sin marcar, porque saltarse uno no afectó a la formación del hábito. Una racha
  que se reinicia por un fallo suelto castiga justo el desliz que no hace daño, y
  es como las rachas hacen abandonar. Si el último día debido quedó sin marcar, lo
  dice: «hoy la salvas». Hoy sin marcar no es un fallo: el día sigue en curso.
- **El progreso se mide contra 66 días**, la media hasta la automaticidad, con su
  rango real (18 a 254) dicho al lado, y no contra los 21 del mito.

Los últimos siete días se pueden marcar a posteriori: un día recordado tarde
también cuenta. Archivar un hábito deja de pedirlo y conserva su historia;
borrarlo lo lleva a la papelera con todos sus días.

`streak()` tenía un fallo que encontró su prueba: el aviso de riesgo se apagaba al
final del bucle, porque los dos fallos donde **empezó** la racha se leían como si la
amenazaran. Ahora el riesgo existe solo mientras queda racha que salvar.

### Lista de deseos: lo que quieres tener, y lo apartado para cada cosa

En `app.nassican.com/metas/deseos`, como **pestaña de Metas** y no como entrada
propia del menú: es la misma pregunta —hacia qué voy— con otro sustantivo.
`GoalsTabs` enlaza las dos mitades; son dos rutas, así que cada una tiene su
dirección y su esqueleto, y `activeHref()` mantiene «Metas y hábitos» encendido
por subárbol sin tocar nada. La paleta sí la nombra («Lista de deseos»), porque
el menú no lo hace.

**Su propia tabla, no una `Goal`.** Una meta es una conducta y el formulario se
niega a guardarla sin su plan «si… entonces…»; una laptop no tiene plan que
escribir, tiene un precio al que llegar. Meterla en `goals` habría obligado a
aflojar la única regla de ese módulo.

**Lo ahorrado no se guarda: se suma.** `wish_savings` tiene una fila por cada vez
que se aparta algo, con su día y su nota, y «cuánto llevo» es la suma. Retirar es
una fila **negativa** —se escribe con un − delante— y no una edición: una cifra
corregida a mano borra lo que pasó, y el historial es lo que explica el total. No
se puede retirar más de lo que hay.

Apartar es **un campo en la propia tarjeta**: un ahorro que cuesta abrir un editor
es un ahorro que no se anota, y entonces la barra miente. La fecha y la nota
aparecen al desplegar la tarjeta.

Cuatro decisiones que el código no explica solo:

- **No toca Wallet ni lee de él.** Lo ahorrado es lo que el operador dice haber
  apartado, y la página lo dice con esas palabras. Deducirlo del saldo de una
  cuenta sería la cuarta agrupación ingeniosa sobre esos movimientos, y el panel
  solo escribe presupuestos en Wallet.
- **«Falta» se suma deseo por deseo**, no como coste menos ahorro: lo que sobra
  en uno no paga otro hasta que se mueve. Para eso está «Pasar lo ahorrado a…»,
  que escribe una retirada en un lado y un ingreso en el otro, en una
  transacción y nombrándose mutuamente. Solo entre deseos de la misma moneda.
- **Descartar no borra el ahorro.** Un deseo descartado con dinero apartado lo
  dice en ámbar —«ahorrados sin destino»— y ofrece moverlo. Volver a «lo quiero»
  borra la fecha y el precio de compra: algo que se quiere otra vez no se compró.
- **«Para cuándo» da una cifra mensual**, no un aviso: lo que falta entre los
  meses que quedan, nunca menos de uno. Una fecha `2026-12` llega hasta el 31,
  y solo «se pasó» cuando el mes termina — la regla del calendario editorial.

**Las monedas no se mezclan sin tasa.** Cada deseo ahorra en su moneda, fija en
cuanto tiene un ahorro anotado. Los totales van en pesos con la TRM de
Suscripciones; sin tasa para todas, cada moneda por separado.

**«Comprado» pregunta cuándo y por cuánto** en la misma tarjeta, y la fecha viaja
en la fila de auditoría. La bitácora dice «Compraste…» —y lo cuenta como «deseo
cumplido»— solo si esa fecha cae a una semana de la marca; si no, «Marcaste como
comprado (2025)», en rutina. Apartar aparece como «Apartaste $ 200.000 para…»,
sin peso de hito. A la papelera va con sus ahorros y vuelve entero.

**El mismo choque de clases que `w-full`, ahora con colores.** `small` trae su
borde y su texto grises; añadirle `border-green-800 text-green-300` deja las dos
clases en la lista y **gana la gris**. El botón «Comprado» salió gris en la
primera captura. Aquí `smallShape` es la forma sin color y cada variante
—neutra, verde, roja— es su propia clase. El patrón viejo sigue en otros módulos
(«Lograda» en Metas): no asumas que esos botones se ven como dice su clase.

**Cómo se verificó.** Contra la base real con filas desechables: la suma con una
retirada, el total por moneda, mover entre deseos (y negarse entre monedas),
comprar y volver atrás, y la papelera ida y vuelta con sus cuatro ahorros. En
Chrome, a 1440 y 390 px y en los dos temas, y **pulsando los botones de verdad**:
apartar, intentar retirar de más y comprar.

### «Hoy»: el día en la cabecera del dashboard

`lib/today.ts` y `components/TodayPanel.tsx`. El resto del dashboard mira atrás
—tráfico, sincronizaciones, salud del contenido—; esto mira adelante, y **solo
hasta hoy**: pendientes de hoy y atrasados, hábitos que tocan, prioridades de la
semana, renovaciones de los próximos 3 días, metas que vencen en una semana, la
revisión semanal si falta y lo destacado de ayer. Lo que está más lejos vive en su
módulo: traerlo aquí convertiría un vistazo en una lista.

**Todo se marca ahí mismo** —un pendiente, un hábito, una prioridad—, porque abrir
tres módulos para marcar tres casillas es como las casillas se quedan sin marcar.

Al llegar «Hoy», los avisos de pendientes, renovaciones y revisión **salieron de la
lista del dashboard**, que ahora se titula «El sitio y el sistema». La misma cosa
dos veces en una página es ruido, y la lista volvió a hablar solo de lo que es suyo.

«Ayer» sale de `readActivity`, extraída de la bitácora para que las dos lean la
auditoría igual: los mismos nombres resueltos y la misma evidencia pedida a cada
«terminaste».

### Calendario editorial: ideas con fecha, y lo que sale cuándo

En `app.nassican.com/contenido/calendario`. Existe por un dato: **cero artículos
publicados**. Una idea sin fecha sigue rondando sin avanzar —el mismo hallazgo que
sostiene Pendientes—, así que aquí cada idea pide una fecha objetivo, aunque sea
solo un mes.

**Ideas en su propia tabla, no artículos con un estado «idea».** Una idea no tiene
slug, ni cuerpo, ni traducciones; un `post` que pudiera carecer de los tres haría
que cada consulta sobre artículos preguntara si es uno de verdad. Al pulsar
**«Escribir»**, la idea se convierte en un borrador real de Blogs —con su título
en español y un slug legible desde el principio, con sufijo si choca— y apunta a
él. Desde ese momento **manda el artículo**: su estado y su fecha, nunca la etapa
de la idea. Escribir dos veces la misma idea no crea dos borradores.

Un tablero y un mes, que leen las mismas piezas: una idea para el 15 es una
tarjeta en «Ideas» y un punto en el 15 a la vez, nunca dos listas que mantener al
día. Columnas: Ideas, Investigando, Escribiendo, Programado y Publicado. Los
artículos empezados directamente en Blogs también entran: el calendario trata de
lo que sale, no de dónde se empezó. **Publicado con fecha futura es programado**,
diga lo que diga el estado, y se juzga con el reloj del servidor.

**La precisión de la fecha manda también aquí.** Un objetivo «2026-11» es un plan
de verdad: se ve en noviembre, en una franja aparte, y no clavado al día 1, que
haría parecer que vence un día que nadie eligió. Por la misma razón, solo es
«atrasado» cuando el mes termina. «Hoy» avisa de lo editorial que se pasó de
fecha; la primera versión llamaba atrasado a «2026-10» el 5 de octubre, y la
prueba lo cazó.

El ritmo —cuántos artículos salieron en los últimos 30 días— va arriba, en ámbar
cuando es cero.

### Enfoque: bloques con pausa fija y una línea de dónde lo dejaste

En `app.nassican.com/enfoque`, junto a Pendientes. Dos hallazgos lo sostienen, y
ninguno promete más trabajo:

- **Leroy (2009), residuo de atención.** La atención se queda en la tarea
  interrumpida, y lo que la suelta es un plan para retomarla. Por eso cerrar un
  bloque pide **«dónde lo dejas»**, y empezar otro sobre lo mismo —el mismo
  pendiente, o el mismo nombre escrito con otros acentos— lo enseña antes de
  arrancar. Esa nota es el módulo; el temporizador es lo de menos.
- **Biwer y colaboradores, pausas fijas.** Mejor ánimo y el mismo trabajo en menos
  tiempo que con pausas a voluntad. No más trabajo, así que el módulo no lo dice.
  Dos formatos, 25/5 y 50/10.

**El reloj vive en la base, no en el navegador.** Un bloque en marcha es una fila
con `ended_at` vacío, y todo lo demás es aritmética sobre `started_at`: una
recarga, otra pestaña o el teléfono ven el mismo reloj. Uno a la vez —dos relojes
contarían los mismos minutos dos veces—, y la comprobación comparte transacción
con el alta para que dos pestañas no ganen las dos.

**Un bloque nunca cierra después de su final previsto.** Uno olvidado a la hora del
almuerzo es un bloque de 25 minutos, no de tres horas, y «horas de foco» contaría
el almuerzo. Por lo mismo, la pausa corre desde el final del bloque: escribir la
nota dos minutos tarde deja tres de descanso, y volver una hora después no deja
ninguno — ya se tomó. Un bloque cortado antes de tiempo no gana pausa.

**El reloj te sigue.** `FocusChip` lo pone en la cabecera de todas las pantallas y
en el título de la pestaña, que es lo que se ve desde otra. Pregunta al servidor
**una vez**, al cargar el panel —el armazón no se remonta al navegar—, y después
escucha lo que anuncia el módulo (`announceFocus`). Al terminar el bloque o la
pausa, el navegador avisa si se le dio permiso desde el propio módulo; sin
permiso, el título basta. El segundo que avanza es un `useSyncExternalStore` con
0 en el servidor, así que el HTML no lleva una hora que no casaría al hidratar.

**No se audita.** Los bloques llegan a la bitácora desde su propia tabla —una línea
por bloque, con la nota— y las horas de la semana van arriba, junto a lo
destacado. Auditarlos los pondría dos veces, la misma razón por la que las notas
de la bitácora no se auditan. «Hoy» enseña los minutos del día y lleva al módulo.

Marcar «el pendiente quedó hecho» al cerrar usa el mismo cierre y la misma
auditoría que Pendientes, así que la bitácora dice «Completaste…» desde donde se
marque. Borrar un pendiente no borra sus bloques: la clave es `SET NULL` y el
nombre se copió al empezar, para que la historia se siga leyendo.

Fuera de la papelera, como las listas del perfil: un bloque es un registro de
minutos, se borra con confirmación y no hay nada que restaurar que valga más que
volver a medirlo.

**Cómo se verificó**, contra la base real y con filas desechables: un segundo
bloque se niega, uno cerrado tres horas tarde cuenta 25 minutos, la nota vuelve
por pendiente y por nombre, la bitácora y «Hoy» lo suman, y borrar el pendiente
conserva el bloque. **No se ha probado en un navegador**: el aviso del sistema y
el título de la pestaña están verificados en el código, no en pantalla.

### Rendimiento: PageSpeed Insights en el planificador

En `app.nassican.com/rendimiento`, en «Medición». Cada noche el cron mide cinco
cosas con Lighthouse —móvil en la portada, `/projects`, `/blog` y
`/certificates`, y escritorio en la portada como referencia— y las guarda en
`pagespeed_runs`, una fila por página, estrategia y día local. «Medir ahora» hace
lo mismo al momento.

**Sin clave, PageSpeed responde 429**, como Google Books: la cuota anónima es de
todos los que llaman sin credenciales y estaba gastada el día en que se escribió
esto. Pero la API no necesita permisos sobre ningún dato, solo saber a qué
proyecto cobrar la cuota, así que **cualquier token del proyecto sirve**: la
service account con el scope `openid`, el más pequeño que existe, o el del login
del operador, que ya lo tiene. `PAGESPEED_API_KEY` gana si está puesta.

**Falta un paso que no se puede hacer desde el código:** activar «PageSpeed
Insights API» en el proyecto de Google Cloud de la service account. Es gratis y no
pide facturación. Mientras no esté, la sincronización falla con ese mensaje
exacto —se comprobó contra Google: «has not been used in project … or it is
disabled»— y el dashboard lo enseña como sincronización detenida, que es lo que
es. `explainError` traduce los dos fallos conocidos a una instrucción.

**Solo avisa de una caída de 10 puntos o de bajar de 50.** Lighthouse varía unos
puntos entre una carga y otra sin que nada cambie —la máquina que Google prestó
ese minuto—, y avisar de cada oscilación es como un aviso aprende a ser ignorado.
Las bandas son las de Lighthouse (90 y 50) y los umbrales de LCP, TBT y CLS los
que publica Google; los colores siempre van con su palabra al lado.

Es una fuente más de `sync-health`: entra en `SCHEDULED`, así que si el cron deja
de medir, el dashboard lo dice. Restaurar una copia no la toca: es un espejo de
una medición ajena, como GA4.

### Edición rápida en las listas

En Juegos, Libros, Suscripciones y Aprendizaje. Un botón «Edición rápida»
convierte cada fila en campos —precio, horas, páginas, fechas, progreso—; Tab pasa
de uno a otro y cada campo **se guarda al salir de él, solo si cambió**. Rellenar
66 juegos con el formulario llevó 102 minutos de abrir y cerrar.

`QuickField` se monta con `key={valor}`: cuando el servidor contesta con la fila
nueva, el campo arranca de ella en vez de sincronizarse en un efecto. Un fallo deja
lo escrito en el campo y dice por qué, para no perder el número mientras se
arregla.

Cada módulo tiene **una** acción con la lista cerrada de campos que acepta y cómo
se lee cada uno (`parseQuick`). Son los mismos lectores que los formularios
—`34.225` sigue siendo treinta y cuatro mil—, así que un valor escrito en la fila
y en el editor no pueden guardarse distinto. Vacío sigue siendo «no lo sé», salvo
el precio de una suscripción, que sin él no sirve para ningún total.

**«¿Lo terminaste hoy?»** Marcar algo como terminado sin fecha de fin pregunta en
la propia fila: «Sí, hoy», «Otro día…» o «No lo sé». La bitácora solo dice
«Terminaste» cuando la fecha lo respalda, y este es el momento en que la fecha se
sabe. No se estampa sola: poner al día una biblioteca vieja es la otra razón para
marcar algo terminado. «Hoy» lo resuelve el servidor en la zona configurada.

### Aprendizaje: la tercera biblioteca, y la que llega al sitio

En `app.nassican.com/aprendizaje`, en «Personal». La misma forma que Juegos y
Libros —estados, «lo quiero», lo pagado y sin abrir—, con lo que un curso tiene:
plataforma, progreso, duración y horas dedicadas, fecha objetivo. Una fecha
objetivo `2026-11` solo es «atrasada» cuando noviembre termina, como en el
calendario editorial. Terminar un curso lo pone al 100 %: nadie escribe 100 el día
que aprueba.

**Un curso terminado pasa a Certificados desde su fila**, y de ahí al sitio. El
formulario pide lo que el certificado necesita **en los dos idiomas** —la regla
principal de este documento, aplicada al publicar—: el título en español sale del
curso, el inglés no se adivina nunca. Una categoría que ya usan los certificados
rellena las dos lenguas de una vez, para que los filtros de `/certificates` no
crezcan con un casi-duplicado. Se invalida la etiqueta `certificates` del sitio y
el curso queda enlazado (`certificate_id`, único): publicar dos veces se niega. El
diploma se sube después desde Perfil.

### Trabajos: proyectos en curso con empresas

En `app.nassican.com/trabajos`, junto a Pendientes. Sustituye a «Oportunidades»,
que se quitó el mismo día en que se hizo: un embudo de contactos con próximos
pasos no servía sin poder automatizarlo, y lo que de verdad se quería seguir era
el trabajo **ya acordado**. Se llama «Trabajos» y no «Proyectos» para no chocar con
Contenido → Proyectos, que son los del portafolio.

**Tres estados y ninguno más**: no iniciado, en marcha, finalizado. La página se
abre por lo que se mueve, así que «en marcha» va primero y los finalizados se
pliegan al final.

**La bitácora de avances es el módulo.** Cada avance es un día, un texto y, si se
quiere, sus horas; la ficha suma las horas y dice cuándo fue el último. Anotar el
primer avance de un trabajo sin iniciar lo pone **en marcha** y fija el inicio:
trabajo que se anota es trabajo que empezó. Pasar a «en marcha» desde la lista
también fija el inicio si faltaba, porque ese día se sabe. Finalizar **no** estampa
la fecha: pregunta «¿Lo terminaste hoy?», como Juegos y Libros, porque poner al
día un trabajo viejo es la otra razón para marcarlo.

**El único aviso es el silencio**: en marcha y sin avances hace más de 7 días
(`QUIET_DAYS`). Un trabajo que nadie toca suele estar esperando a alguien, y ese
alguien a menudo es uno. «Hoy» lista los que están en marcha con los días desde su
último avance, y en rojo los que pasaron su fecha de entrega.

En la bitácora, empezar y terminar destacan; cada avance aparece como «Avanzaste
en…», plegado por día como cualquier repetición y sin el peso de un hito. A la
papelera va con sus avances y vuelve entero — comprobado.

**Un fallo que solo se ve mirando, y que estuvo en tres módulos.** La primera
versión se entregó sin abrirla en un navegador y salió rota: el desplegable de
estado ocupaba la fila entera, el título quedaba aplastado a cero y la empresa y
las fechas caían palabra por palabra. La causa: el estilo base de los campos
(`field`) lleva `w-full`, y se le añadía `w-auto` o `w-24` creyendo que lo
sobrescribía. Las dos clases quedan en la lista y **en la hoja generada gana
`w-full`** — el orden lo decide Tailwind, no el orden en que se escriben. Typecheck,
lint, pruebas y build pasaban.

Estaba igual en Aprendizaje y en Multimedia. En los tres hay ahora un `fieldBase`
sin ancho y `field` es `w-full` más eso: un campo estrecho parte de `fieldBase`.
**No añadas una clase de ancho a `field`.** `min-w-*`, `max-w-*` y `flex-1` sí
funcionan sobre él, porque no compiten con `width`.

Se verificó con capturas reales —Chrome del sistema dirigido con `puppeteer-core`
instalado fuera del repositorio, con una sesión de prueba y datos desechables—, a
1440 px y a 390 px. Es el método a repetir con cualquier pantalla nueva: **una
interfaz no está comprobada hasta que alguien la ha visto.**

### Presupuesto: los presupuestos de Wallet, editados aquí

En `app.nassican.com/presupuesto`, junto a Movimientos. **Es la única parte del
panel que escribe en Wallet**, por decisión del operador (5 de octubre de 2026):
el resto sigue siendo un espejo de solo lectura. Ver «Presupuestos: la única
escritura» en la sección de Finanzas para cómo se garantiza.

**Los presupuestos son los de Wallet, no una copia.** La primera versión guardaba
sus propios límites en una tabla del panel; se quitó al poder escribir, porque dos
juegos de límites son dos respuestas esperando a discrepar, y el de Wallet es el
que el operador ve en el teléfono. La página los lee **en vivo** —una petición—
con el gasto que **Wallet mismo** calculó para el periodo, así que las cifras son
las de la app. Si Wallet no responde, cae al espejo y calcula el gasto desde los
movimientos sincronizados, y lo dice.

**Lo que el panel añade es el ritmo.** El 70 % gastado el día 12 de un mes de 30 es
ir treinta puntos por delante, y a ese paso el presupuesto cierra por encima. Cada
barra marca el día del periodo, y la proyección solo avisa desde el día 5: con dos
días, una cena proyecta un mes que no va a pasar. El dashboard avisa desde el
espejo, sin llamar a Wallet cada vez que se abre.

Se puede crear un presupuesto mensual, cambiar su límite, su nombre y sus
categorías, y cerrarlo o reabrirlo. Dos decisiones:

- **Cambiar el límite vale desde este mes.** Wallet no deja editar el límite base;
  ofrece `resetLimit`, que reescribe también el de **todos los meses pasados**, o
  un cambio que rige desde un periodo en adelante. Se usa el segundo, y el pasado
  queda como fue. Un cambio que el operador hubiera programado para un mes futuro
  se sustituye: eso es lo que significa «desde ahora».
- **Cerrar, no borrar.** Borrar en Wallet es un único endpoint genérico para todos
  los tipos —registros y cuentas incluidos—, y cerrar conserva el presupuesto con
  su historial y se puede deshacer desde aquí.

Debajo, el gasto del mes en grupos que ningún presupuesto cubre, de mayor a menor
y con «Crear presupuesto» que rellena el grupo, y las renovaciones que faltan.
Cada escritura se audita, y el espejo se actualiza con lo que Wallet respondió.

**Cómo se verificó.** Leyendo: los siete presupuestos y su gasto, idénticos a los
de Wallet uno por uno. Escribiendo: **una sola escritura que no cambia nada** —
renombrar «Vivienda» a «Vivienda»— para probar token, formato y respuesta sin
tocar los datos del operador. Crear, cambiar límites y cerrar no se han probado
contra Wallet: se dejaron para que el operador los haga desde la interfaz, porque
un presupuesto de prueba no se podría borrar desde el panel.

### Usuarios: sesiones, roles y revocación

En `app.nassican.com/usuarios`. Muestra los tres cerrojos de la sección de
autenticación desde el otro lado: quién está en la lista de permitidos, quién
tiene fila, y desde qué navegadores está dentro ahora mismo.

**Las reglas que impiden quedarse fuera son el módulo.** Todo lo demás es una
lista. Viven en `user-draft.ts` como funciones puras, así que las comprueba la
interfaz —deshabilitando la opción y explicando por qué en el `title`— y las
vuelve a comprobar la acción, que es la única comprobación que cuenta:

- No puedes quitarte a ti mismo el rol de propietario.
- No puedes desactivar tu propia cuenta.
- No se puede tocar al último propietario activo, sea quien sea.

Existen porque romperlas cierra la única puerta y **no hay segundo canal para
deshacerlo**: no hay recuperación de contraseña ni soporte, solo editar la base
a mano. La acción vuelve a leer el estado en vez de fiarse de lo que mandó el
navegador, porque las reglas hablan del mundo y la página pudo llevar una hora
abierta.

**La comprobación de rol se repite en cada acción**, no una vez en la página.
Una acción de servidor es un endpoint público; un rol que solo decide si se
dibuja un botón no protege nada.

**Revocar el acceso hace dos cosas.** La bandera `isActive` corta los inicios
futuros —y ya bastaría, porque `requireUser()` la relee en cada petición—, pero
además se borran las sesiones abiertas. Sin eso la lista de sesiones mentiría
sobre quién está dentro.

Cerrar tu propia sesión está permitido a propósito: es como se echa de un
navegador que ya no tienes delante. El panel marca cuál es antes, para que no
sea un accidente.

**Un estado que no se ve en ninguna otra parte:** una fila puede decir «activo»
y su dirección haber salido de `ADMIN_ALLOWED_EMAILS`. Las dos cosas son
ciertas y la persona no entra. El módulo lo señala en vez de dejar que se
descubra en la pantalla de acceso.

Invitar a alguien **no es un botón**: la lista es una variable de entorno, así
que añadir a una persona es un despliegue. El módulo la enseña para que al
menos sea visible qué dice.

`describeUserAgent` es deliberadamente superficial —sirve para distinguir el
portátil del móvil, no para construir una base de datos de dispositivos— y lo
que no reconoce lo muestra en crudo, que es más honesto que «Desconocido». Ojo
al orden de las comprobaciones: el user agent de un iPhone dice «like Mac OS X»
y el de Android dice «Linux», así que lo específico va antes que lo general o
todos los móviles se reportan como escritorio. Pasó.

#### Paginación

`components/Pager.tsx`. Las listas llegan acotadas del servidor —las últimas N
ejecuciones, las últimas N entradas—, así que paginar es cortar, no volver a
pedir: a esta distancia de la base, ir a por la página dos costaría un viaje
para enseñar filas que ya estaban aquí.

La página se recorta al renderizar y no en un efecto. Cuando la lista encoge
por debajo —terminó una sincronización, se borró una fila— un efecto
renderizaría la página vacía una vez antes de corregirse.

En Sincronizaciones el error comparte fila con el resto en vez de añadir una
segunda línea, truncado y con el texto completo en el `title`. Son mensajes
largos, y uno envuelto hacía ilegible el resto de la tabla a cambio de un texto
que nadie lee entero de un vistazo.

### Las piezas que atraviesan el panel

Cosas que no son de ningún módulo y están en todos. Las cuatro primeras se construyeron
juntas porque las cuatro responden a lo mismo: el panel lo usa una sola persona,
muchas veces, y lo que se paga en una sesión larga no son los milisegundos sino
los clics y el trabajo perdido.

**Buscar y filtrar: el filtro es la URL.** `lib/list-filters.ts` es puro y lo
comparten Blogs, Proyectos y Páginas; `components/ListFilters.tsx` lo escribe en
los parámetros de la dirección, no en estado de React. Así un filtro se marca
como favorito, el botón de atrás hace lo que se espera, y el servidor ya sabe
qué enseñar sin un render intermedio con la lista entera.

Tres decisiones que el código no explica solo:

- **`fold()` quita los acentos**, así que «paginas» encuentra «Páginas» y
  «espana» encuentra «España». No es una concesión: en un teclado se escribe sin
  acentos y buscar es escribir rápido, no escribir bien.
- **Las filas sin fecha suben, no bajan.** La lista ordena por fecha
  descendente, y un borrador recién creado todavía no tiene `publishedAt`. Al
  final de la lista es donde no se vuelve a ver, que es justo lo contrario de lo
  que hace falta.
- **El filtro dice cuántas filas escondió.** Una lista que oculta en silencio es
  una lista que te hace creer que perdiste algo.

**⌘K: los módulos son locales, el contenido se pide.** `components/CommandPalette.tsx`
saca los módulos de los mismos datos de `lib/navigation.ts` que dibuja el menú
—así un módulo nuevo aparece aquí el día que aparece allí, sin una segunda lista
que mantener— y no cuesta ningún viaje, que es lo que hace que ⌘K sea instantáneo
para aquello en lo que más se usa. El contenido llega de una acción de servidor
la **primera** vez que se abre la paleta y se queda el resto de la pestaña. No hay
búsqueda contra la base por cada tecla: a la latencia de esta base eso sería un
teclado que se arrastra.

Antes bajaba con cada render del armazón, y conviene contar bien lo que costaba
porque es fácil equivocarse en los dos sentidos. Medido suelto, `listCommands()`
son **217 ms** con seis filas de contenido en toda la base —tres `findMany`, dos
de ellos arrastrando una relación, o sea cinco viajes; el coste nunca fueron las
filas— pero medido **de punta a punta no cambiaba nada**: corría en el mismo
`Promise.all` que `requireUser()` y en paralelo con las consultas de la propia
página, así que estaba escondido detrás de ellas. Las medianas por página antes y
después son las mismas dentro del ruido.

Se dejó perezoso de todas formas, y por razones que no son la latencia de hoy:
quita cinco viajes a la base por cada vista de página, saca de la carga útil de
*todas* las páginas el título de todos los borradores, y es lo único que escala —
el coste del layout crece con el contenido mientras el de la página no, así que
algún día sí sería el camino crítico. La lección a no repetir: **medir una función
suelta dice lo que cuesta, no lo que tarda la página.**

Mientras el contenido viene, la paleta dice «Buscando en el contenido…» en vez de
«nada coincide», que sería una mentira que se corrige sola un instante después.

Lo que empieza por lo que escribiste gana a lo que lo lleva por el medio. Y el
índice seleccionado se recorta **al renderizar**, no en un efecto: cuando la
lista se encoge bajo el cursor, un efecto dibujaría el hueco vacío una vez antes
de corregirse.

#### Nada de `backdrop-filter` en una capa a pantalla completa

Esto es lo que de verdad hacía que escribir en la paleta se arrastrara, y no la
base de datos.

`backdrop-blur-sm` convierte su elemento en una *raíz de fondo*: el navegador
tiene que capturar todo lo pintado por debajo, aplicarle un desenfoque gaussiano
a esa captura y recomponer — a lo ancho de toda la ventana, en **cada fotograma
en que algo por encima cambie**, que en la paleta es cada tecla. Con GPU es un
shader y casi no se nota. Con la aceleración por hardware apagada es una
convolución en CPU sobre varios millones de píxeles, y entonces sí se nota.

Había dos, las dos fuera:

- **La paleta**, por lo anterior. Ahora es un negro translúcido plano, que
  compone gratis y dice lo mismo.
- **El velo del cajón móvil**, por una razón más puntiaguda: ese **se anima** con
  `transition-opacity`, así que el desenfoque se recalculaba en cada fotograma de
  la transición — en el único dispositivo donde eso importa.

De paso se fueron dos cosas del mismo saco: `shadow-2xl` pasó a `shadow-lg` (un
radio de 50 px rasterizado en CPU no es gratis) y las filas perdieron su
`transition-colors`, que hacía que el resaltado fuera por detrás de la flecha al
navegar con el teclado.

Y una micro-optimización que además deja el código más limpio: plegar una
etiqueta con `fold()` asigna tres cadenas, así que se pliega **una vez por lista**
y no una vez por etiqueta por tecla. Lo que corre al teclear solo compara.

**Cambios sin guardar.** `lib/use-unsaved.ts`. `isDirty` compara como JSON
canónico y no por referencia, porque los editores reconstruyen su borrador en
cada tecla: por referencia un formulario recién abierto saldría sucio, y un
aviso que siempre está encendido es un aviso que se aprende a ignorar. Ordenar
las claves hace además que una clave ausente y un `undefined` explícito sean el
mismo borrador — que es exactamente la diferencia de `ordered?: boolean` que
`normaliseBody` ya tuvo que resolver.

La base de comparación la mueve el guardado y **solo si la acción confirmó que
salió bien**: lo que se envió pasa a ser lo guardado, no lo que haya en pantalla
cuando vuelve el viaje, así que lo que escribiste mientras guardaba sigue
marcado como pendiente. En Perfil hay cuatro bases, una por sección, porque cada
sección se guarda sola.

Lo que **no** cubre, y conviene saberlo: solo `beforeunload`, o sea cerrar la
pestaña, recargar y escribir otra dirección. El App Router no ofrece forma
documentada de interceptar una navegación de cliente, así que pulsar «Blogs» con
cambios sin guardar los pierde igual. Prometer lo contrario en un comentario
sería peor que no tenerlo.

**El teléfono: reglas globales, no 158 ediciones.** El final de
`app/globals.css` tiene un bloque `@media (pointer: coarse)` **fuera de toda
`@layer`**. Eso es lo que lo hace funcionar: Tailwind v4 mete sus utilidades en una
capa de cascada, y una regla sin capa gana a cualquier regla con capa, sea cual
sea su especificidad. Así pisa `text-sm` y `p-1.5` sin `!important` y sin tocar
componentes. Se comprobó en la hoja generada que la regla no quedó dentro de
ninguna capa.

- **Campos a 16 px.** Safari de iOS amplía la página al enfocar un campo de menos
  de 16 px y no vuelve. Los 158 campos del panel eran de 14 px.
- **Botones de solo icono a 40 × 40 px.** El selector es
  `[aria-label]:has(> svg:only-child)`: un control con etiqueta accesible y un
  único icono es exactamente un botón de solo icono. Algunos medían 20 px y
  estaban junto a «mover a la papelera».

Es `pointer: coarse` y no un ancho de pantalla porque el problema es el dedo, no
el tamaño: un iPad es ancho y tampoco tiene cursor.

Tres piezas más del mismo trabajo:

- **La paleta tiene botón.** «Buscar» en la cabecera llama a
  `openCommandPalette()`, que dispara el mismo `toggle` que ⌘K. Antes, en un
  teléfono la paleta no existía.
- **El calendario en táctil se toca, no se abre por código.** El `<input
  type="date">` invisible cubre el botón del calendario. Con ratón deja pasar el
  clic y el botón lo abre con `showPicker()`; al tacto recibe el toque él mismo,
  porque Safari de iOS no garantiza abrir un selector que considera oculto. En la
  bitácora además estaba **dentro** de un botón, que es HTML inválido.
- **Movimientos es una lista en el teléfono.** La tabla mide 42 rem y en móvil
  enseñaba un tercio de cada fila. Debajo de `sm` las mismas filas, en el mismo
  orden, con un selector para ordenar porque ya no hay cabecera.

**La barra de desplazamiento** también vive en `globals.css`: fina, sin flechas y
con los grises del tema (`neutral-700` en reposo, `neutral-600` al pasar). La
trampa está en el orden de precedencia: Chrome **ignora todos los
`::-webkit-scrollbar`** en cuanto un elemento tiene `scrollbar-width` o
`scrollbar-color`, y solo los primeros pueden quitar las flechas. Por eso las
propiedades estándar van dentro de `@supports not selector(::-webkit-scrollbar)`,
que hoy significa solo Firefox.

**No se ha probado en un teléfono real.** Todo esto está verificado en el código y
en el HTML y CSS generados. El calendario en iPhone, sobre todo, falta comprobarlo.

**Fechas: escribir o elegir.** `components/DateField.tsx` en Juegos, Libros,
Suscripciones, Bitácora y Perfil. **El texto se queda** porque estas fechas son
parciales a propósito —«2022» es una respuesta real a «¿cuándo lo compraste?», y
un calendario solo sabe decir días—, así que el calendario del navegador es una
forma de escribirlo, abierto desde un botón con `showPicker()`, sin librería. Se
abre en el mes o el año ya escrito, no en hoy.

La hora es la misma idea un paso más allá: escondida hasta que se pide, solo
ofrecida junto a un día completo, y guardada como `"2024-08-13T21:30"`.
`joinDateTime` es el único sitio de la regla: escribir «2024-08» encima de un día
con hora **suelta la hora** en vez de guardar una hora contra un mes. En Perfil no
hay hora, porque esas fechas llegan al atributo `datetime` del sitio público.

`isPartialDate` ahora comprueba que los dígitos sean un día de verdad
—«2024-02-30» son ocho dígitos y ningún día— y `formatPartialDate` las lee en las
listas como se dicen («13 ago 2024, 21:30»), construido a mano y no con `Date`,
que inventaría el día que falta y luego lo movería de medianoche por la zona.

**Toasts: el aviso ya no empuja la página.** `components/Toast.tsx`. El banner
anterior se insertaba sobre el formulario, así que cada guardado bajaba todo una
línea y luego la subía — en un editor eso significa que el campo que estabas
mirando se mueve mientras lo miras.

**El éxito se va solo; el fallo no.** Un «guardado» dice algo que ya esperabas y
en lo que no hace falta volver a pensar. Un fallo dice lo contrario de lo que
esperabas, nombra qué hacer, y es el único mensaje que vale releer: quitarlo con
un temporizador es cómo se pierde.

El temporizador depende de `result` y de nada más. Con `onDismiss` entre las
dependencias se reiniciaba en cada tecla —es un cierre nuevo en cada render— y
«Guardado» no se iba nunca mientras siguieras escribiendo. Un `ref` mantiene la
llamada al día sin ser dependencia.

Y no hay portal, aunque lo parezca necesario: `fixed` se mide contra el
antepasado *transformado* más cercano, y de `<main>` hacia abajo no hay ninguno.
El cajón móvil sí se anima con un `transform`, pero es hermano del contenido, no
su padre.

#### La vista previa se acuña al pulsar, no al renderizar

El token de vista previa dura cinco minutos a propósito: abre un documento sin
publicar a quien lo tenga. Pero eso significa que **no se puede acuñar cuando se
renderiza la página del editor**, que fue como se hizo primero: una sesión de
edición dura más de cinco minutos, así que el botón estaba muerto antes de que
nadie lo pulsara, y muerto de una forma que nadie iba a relacionar con cuánto
llevaba escribiendo.

Así que el botón apunta a `/api/preview` del propio panel, con una dirección que
no caduca, y el token se acuña en el clic. Ese salto va detrás de la sesión del
panel, que es también lo que evita que sea una máquina abierta de tokens.

`previewKinds` vive en `packages/shared/src/preview.ts` como lista, y el tipo
sale de ella. La lista estaba escrita a mano en los dos lados de la frontera, y
una copia a mano es una copia que algún día le falta un elemento.

#### Al depurar: el HTML de desarrollo no sirve para auditar secretos

Buscando el token en el HTML del editor aparecía la cookie de sesión completa,
junto a las cabeceras de la petición y rutas absolutas de `.next/dev/`. Es la
instrumentación de desarrollo de Next, que serializa la promesa de `headers()`
con su pila para el panel de errores. En el build de producción: cero cookies,
cero cabeceras, cero rutas de disco.

Misma lección que la del origen horneado en `robots.txt`: **lo que se audita es
el build, no el servidor de desarrollo.** Un falso positivo aquí cuesta una
tarde buscando una fuga que no existe.

### Perfil y credenciales

En `app.nassican.com/perfil`: datos personales, redes, CVs, experiencia,
formación y certificados. Cada sección se guarda entera —las listas son cortas
y curadas a mano, así que reemplazar el conjunto es más simple de razonar que
un protocolo por fila— e invalida su propia etiqueta de caché.

Migración inicial:

```bash
npm run games:import -- --dry   # siembra Juegos desde las notas de Wallet
npm run profile:import -- --dry
npm run profile:import
```

**Certificados de Platzi.** `npm run certificates:platzi -- <carpeta> [--dry]` lee la
exportación paginada de «Mis cursos» (`data.courses[]`). La fecha y el diploma salen
de ahí; los títulos no del todo. El español es el de Platzi, limpio de lo que habla
del catálogo y no del curso (años de versión, «Gratis», dobles espacios). El inglés
y la categoría están **escritos a mano en el script**, una línea por curso, porque
una traducción que el build no comprueba es una que alguien tuvo que escribir, y
ese archivo es donde se revisa. Un curso que falte en el catálogo hace fallar el
script en vez de entrar sin inglés.

Idempotente por **número de curso**, leído del enlace del diploma: un certificado ya
en el perfil es el mismo curso diga lo que diga su slug, y conserva su título y
categoría. Solo se le corrige la etiqueta de fecha al año oficial de aprobación —
así salieron dos que decían 2024 y eran de 2023. Primera ejecución: 34 nuevos, 3 ya
estaban; la segunda, 0.

**Los diplomas.** `npm run certificates:diplomas -- <carpeta> [--dry] [--force]`
descarga la `diploma_image` de cada certificado y la guarda con `storeImage`, el
mismo camino que una subida del panel: WebP, placeholder borroso y checksum como
URL, en una carpeta «Certificados» de Multimedia. 37 diplomas pasaron de 3,4 MB a
1,1 MB (−68 %), unos 30 KB cada uno. La CDN de Platzi responde 403 sin un user
agent de navegador.

**El texto alternativo dice lo que la imagen muestra**, leído de un diploma real:
Platzi certificando al operador, por su nombre completo, por aprobar el curso, en
la fecha impresa. La fecha es la de aprobación **en Bogotá**, que es la que
imprime el diploma: la exportación la guarda en UTC, y una aprobación por la noche
es el día siguiente allí. El inglés dice que el diploma está en español, porque lo
está.

**Guardar Certificados solo escribe lo que cambió.** La lista se manda entera y
antes se escribía entera: 111 escrituras para 37 diplomas. Una transacción por
lotes no lo arregló —el adaptador de Neon sigue mandando cada sentencia en su
propio viaje: 9,4 s medidos desde Bogotá—; leer lo guardado una vez y comparar sí:
una lista sin cambios es una lectura (0,3 s) y editar un título, una escritura.

**El diploma se sube, se cambia y se quita desde la ficha**, en Perfil →
Certificados, con el mismo `CoverPicker` de las portadas, y su texto alternativo
se edita al lado en los dos idiomas. Ese texto vive en `media_translations`, no
en el certificado —es el mismo que enseña Multimedia—, así que editarlo en un
sitio lo cambia en el otro.

Tres reglas:

- **Sin texto alternativo en los dos idiomas no se guarda.** Una imagen nueva
  llega con uno sugerido (`suggestDiplomaAlt`) en vez de vacío: es un borrador
  que conviene corregir, no una casilla en blanco que bloquea sin explicar.
- **Una imagen soltada va a la papelera, no se queda huérfana.** Reemplazar,
  quitar o borrar el certificado devuelve en `released` lo que dejó de estar
  enlazado; la acción pregunta a `describeUsage` y solo la manda a la papelera
  si nada más la usa. Treinta días para arrepentirse, y la biblioteca no acumula
  diplomas que nadie recuerda haber subido.
- **El cambio de imagen solo se escribe si cambió**, igual que el resto de la
  lista: `fileMediaId` entra en la comparación, y el texto alternativo se escribe
  solo cuando difiere del guardado.

Una subida desde la ficha cae en la raíz de Multimedia, no en la carpeta
«Certificados» del script: moverla es un clic allí y no justificaba otro
parámetro en la ruta de subida.

**La lista son filas, y se abre una a la vez.** Treinta y siete formularios
apilados obligaban a bajar por treinta y seis para corregir uno. Cada fila dice lo
justo para encontrarlo —miniatura, título, proveedor, año, categoría y qué le
falta— y se despliega en su sitio. Buscar (sin acentos, con `fold()`), el filtro
«Incompletos» y las páginas de doce **solo deciden qué se ve**: la sección sigue
guardando la lista entera, ocultas incluidas.

**Guardar devuelve la lista con sus ids.** Antes un certificado nuevo se quedaba en
pantalla sin id tras guardar, y el siguiente guardado lo borraba y lo volvía a
crear —sin pérdida, pero con otro id—. La acción devuelve lo guardado y el editor
lo adopta, salvo que se haya escrito algo mientras guardaba: eso se queda en
pantalla y sigue marcado como pendiente. Experiencia y Formación tienen el mismo
patrón y **no** se tocaron: allí borrar y recrear tampoco pierde nada.

### El script de importación

```bash
npm run content:import -- --dry   # informa sin escribir
npm run content:import            # escribe
```

Es idempotente: cada escritura es un upsert por la clave que identifica la cosa
(la clave de registro de una tecnología, el slug de un proyecto), así que
ejecutarlo dos veces no cambia nada. Eso es lo que permite verificarlo:
ejecutar, comparar el sitio renderizado contra una instantánea previa,
corregir, volver a ejecutar.

**Cómo se verificó la migración de proyectos**, que es el método a repetir con
el resto: capturar el HTML de las páginas afectadas antes del cambio, migrar,
y comparar el texto visible y los enlaces —no el HTML crudo, que cambia en cada
build por los hashes de los chunks. Las 11 páginas resultaron idénticas salvo
el `lastModified` del sitemap, que es `new Date()` por diseño.

Consecuencia de la migración: **`apps/web` necesita `DATABASE_URL`**, también
en tiempo de build. `generateStaticParams` consulta la base para saber qué
artículos prerenderizar, así que sin base no hay build.

### Cuerpo de artículos y casos de estudio

No se **guarda** Markdown ni MDX: el cuerpo es un arreglo de `ContentBlock`
(`paragraph`, `heading`, `list`, `code`, `quote`, `image`) que renderiza
`src/components/Prose.tsx`. Es a propósito — un bloque mal formado o una
traducción faltante falla en `tsc` en lugar de renderizarse mal en producción.
Si algún día se migra a MDX, el cambio debería quedar contenido en `Prose`.

#### Markdown es un teclado, no un formato

`BlockEditor` ofrece dos vistas del mismo cuerpo, y el interruptor está en el
componente compartido, así que lo tienen blogs, proyectos y páginas a la vez.
Lo que **no** cambia es dónde acaba el texto: sigue siendo `ContentBlock[]` en
todo momento, incluido mientras el textarea está abierto. Escribir parsea
directo a bloques, de modo que las dos vistas no pueden discrepar y guardar en
«la vista equivocada» no existe como forma de perder trabajo. El sitio público
no se entera: no hay parser de Markdown en el bundle de nadie.

La conversión **no es simétrica**, y esa es la parte que hay que entender:

    normaliseBody(b) -> markdown -> bloques   devuelve normaliseBody(b) exacto
    markdown -> bloques                       conserva solo lo que cabe

Un bloque guarda texto plano sin marcas en línea, así que `**negrita**`, los
enlaces `[texto](url)`, las tablas y las listas anidadas no tienen dónde ir. No
se tiran en silencio **ni se guardan como asteriscos literales**: el parser
quita la sintaxis, conserva las palabras, y **reporta cada línea que tuvo que
simplificar** mientras se escribe. La decisión se queda con quien redacta.

Las imágenes son el caso interesante. Un bloque necesita `mediaId`, y ninguna
URL escrita a mano lo puede aportar, así que el parser solo reconstruye las que
ya estaban en el cuerpo —guarda un índice al abrir la vista— y una escrita a
mano se reporta en vez de inventarse. Subirla desde el botón sí funciona en las
dos vistas.

`normaliseBody()` existe por un descubrimiento real: en la base conviven
`ordered: false` y la ausencia de `ordered`, porque el tipo dice
`ordered?: boolean` y tanto el script de importación como el editor estaban en
su derecho. Se dibujan igual y Markdown no sabe deletrear la diferencia, así
que la ida y vuelta tiene que elegir una. Elige la ausencia, y esa función lo
deja escrito en vez de que aparezca como un diff sorpresa en una fila.

**Esto tiene prueba, y es la primera del repositorio.** `npm test` — el runner
de Node, sin dependencias nuevas. Cubre la ida y vuelta, cada tipo de bloque
por separado, la convergencia de las dos formas de lista, y que todo lo que no
cabe se reporte. Se comprobó además contra **los cuerpos reales de la base**,
que es donde apareció lo de `ordered`: un ejemplo inventado nunca lo habría
enseñado.

#### Pegar una captura

Ctrl+V con una imagen en el portapapeles, en cualquier bloque o en el texto
Markdown, la sube y la convierte igual que el botón: entra justo después del
bloque, o donde esté el cursor.

**Solo si el portapapeles no trae texto.** Word y Excel ponen una imagen de la
selección junto a su texto, y lo que se quería era el texto: pegar una tabla de una
hoja de cálculo y recibir un PNG de ella sería la sorpresa. Una herramienta de
capturas o «Copiar imagen» del navegador no dejan texto plano.

**La inserción lee el cuerpo de después de subir, no el de antes.** La subida tarda
uno o dos segundos, y pegar y seguir escribiendo es justo para lo que sirve.
Insertar sobre el `blocks` capturado al empezar —que es lo que hacía el botón desde
siempre— habría tirado lo escrito mientras subía. Un `ref` guarda el último cuerpo
confirmado y la inserción parte de ahí.

### Artículos: se escriben en el panel, no en el repositorio

Ya no hay carpetas por artículo. Se crean y publican desde
`app.nassican.com/contenido/blogs`, y `apps/web/src/lib/data/posts/index.ts`
solo contiene las consultas. El tipo `Post` no cambió, y por eso `PostCard`,
`Prose` y los ayudantes de SEO siguieron intactos: lo que cambió es de dónde
salen los datos, no su forma.

**Publicar exige los dos idiomas.** Un locale cuenta como escrito cuando tiene
título, descripción y al menos un bloque; `publishPost` rechaza la publicación
enumerando los que faltan. Es la regla principal de este documento trasladada
del compilador al momento en que importa.

#### Vista previa: la del sitio, no una imitación

El botón de los tres editores abre el documento en nassican.com **renderizado
por el renderizador del sitio**. Rehacer la página del artículo dentro del panel
habría sido más rápido y habría empezado a mentir la primera vez que cambiara
`Prose`, la tipografía o el tema — y una vista previa que se desvía de
producción es peor que no tenerla, porque se confía en ella.

Así que la capa de datos aprende una sola pregunta —`isPreview()`— y todo lo de
abajo es la página real.

**El enlace lleva una firma, no el secreto.** Una vista previa es una navegación
del navegador: lo que lleve acaba en el historial, en cabeceras `Referer` y en
registros. `REVALIDATE_SECRET` viaja en una cabecera `Authorization` y debe
quedarse ahí; meterlo en una URL sería repartir permiso permanente de invalidar
caché a cualquier cosa que registre la petición. El secreto **firma** y no
viaja: lo que viaja es `{kind, id, expiresAt}` más su HMAC, inútil para otro
documento e inútil del todo a los cinco minutos.

`verifyPreviewToken` **falla cerrado** — lo contrario de `isCanonicalHost`,
porque los costes son opuestos: allí lo malo es desindexar el sitio real, aquí
es servir borradores a quien pregunte.

El token lleva el **id**, no la ruta: un slug cambia mientras se edita, y un
enlace que da 404 tras renombrar es un enlace en el que no se vuelve a confiar.
La ruta lo resuelve al abrir.

**La vista previa salta la caché, y esa es la mitad importante.**
`unstable_cache` devolvería la versión anterior a la edición, que es justo la
pregunta que se abrió la vista previa para responder.

**Muestra lo guardado, no lo que se está escribiendo.** Lee la fila, así que una
edición sin guardar no está. Lo dice el `title` del botón en lugar de dejar que
se descubra preguntándose por qué no aparece el cambio.

Cómo se verificó, con un borrador real: sin token el artículo da **404** y no
aparece en el índice; un token inventado da **401**; uno caducado da **401 con
su motivo**; el firmado redirige, pone la cookie y renderiza el borrador con su
aviso; salir devuelve el 404; y `?back=https://evil.com` se ignora — la salida
solo acepta rutas, porque una redirección abierta es una herramienta de phishing.

#### Cómo llega un cambio al sitio público

Las dos aplicaciones son despliegues distintos, así que `revalidateTag` en el
panel no alcanza a la caché del sitio. La cadena es:

1. Las lecturas de `apps/web` se etiquetan con `cacheTags` de
   `@nassican/shared` (`posts`, `post:<slug>`).
2. Al publicar, el panel llama a `POST /api/revalidate` del sitio con esas
   etiquetas, autenticado con `REVALIDATE_SECRET`, que **ambos lados deben
   compartir**.
3. El sitio ejecuta `revalidateTag(tag, { expire: 0 })` y las páginas se
   regeneran en la siguiente petición.

Entre publicaciones las páginas siguen siendo estáticas. Un artículo publicado
después del último build no tiene entrada en `generateStaticParams` y se
renderiza bajo demanda, que es lo que da `dynamicParams` por defecto.

**Desplegar no refresca el contenido por sí solo.** `unstable_cache` guarda sus
entradas en `.next/cache`, que sobrevive a un rebuild —y que Vercel restaura
entre despliegues—, así que un build nuevo puede seguir sirviendo lo que había.
Se comprobó: con `.next` intacto el sitio mostraba el nombre viejo de un
proyecto que ya estaba renombrado en la base; borrando `.next` lo recogía.

La consecuencia práctica: **el camino por el que un cambio llega al sitio es la
invalidación de etiquetas, no el despliegue.** Si el panel avisa de que no pudo
contactar con el sitio, el contenido puede quedarse atrás indefinidamente. Al
depurar «¿por qué no se ve mi cambio?», empieza por ahí y no por el build.

Si la llamada de revalidación falla, la publicación **no se revierte**: el
contenido ya está guardado, y una caché que tarda es mejor que un botón que
parece haber fallado. El fallo se registra en `system_events` y aparece en
Sistema, porque desde que el aviso corre en `after()` la acción ya ha
respondido cuando se sabe el resultado.

### Proyectos: se gestionan en el panel

En `app.nassican.com/contenido/proyectos`. La regla de publicación es más
laxa que la de los artículos porque siempre lo fue: **solo la descripción de
una línea es obligatoria en cada idioma**. Un proyecto se lista con
`comingSoon` mientras su caso de estudio no exista, y la ficha lo dice
explícitamente en lugar de mostrar relleno. Sigue vigente: **no inventes el
contenido de un caso de estudio.**

El stack dejó de ser un arreglo de cadenas comparadas contra `skills.ts` y pasó
a ser clave foránea contra `technologies`. El editor ofrece las tecnologías
registradas; una que no exista se descarta al guardar y el panel lo dice, en
vez de almacenarla en silencio y romper el icono.

### La estructura antigua, para referencia

Misma estructura que el blog, una carpeta por proyecto:

```
src/lib/data/projects/
  index.ts            registro: una línea de import y una entrada por proyecto
  types.ts            ProjectItem, ProjectMeta, ProjectTranslation
  <slug>/
    index.ts          metadatos: slug, title, year, date, stack, demo, repo, image
    es.ts             tagline, resumen, rol, highlights y caso de estudio
    en.ts             lo mismo en inglés
```

Los nombres de `stack` deben existir como claves en `skills.ts` para que
resuelva el icono. `image` va bajo `/public`.

De `ProjectTranslation` solo `tagline` es obligatorio. Un proyecto puede
listarse con `comingSoon: true` mientras su caso de estudio no exista: la
página de detalle lo dice explícitamente en lugar de mostrar texto de relleno.
**No inventes el contenido de un caso de estudio**; si no tienes la información
real del proyecto, déjalo en `comingSoon`.


**Los desplegables del sitio son propios.** Un `<select>` nativo se puede estilizar
cerrado y no abierto: la lista la dibuja el sistema operativo —un menú blanco de
Windows sobre una página casi negra, en otra tipografía—. `components/ui/Select.tsx`
dibuja la suya con las superficies del sitio y conserva lo que el nativo daba
gratis, que es lo fácil de perder: el patrón *listbox* de ARIA (flechas,
Inicio/Fin, Enter y Espacio, Escape de vuelta al botón, una letra para saltar) y
`aria-activedescendant`, para que el lector de pantalla anuncie la opción bajo el
cursor. En `/certificates` cada diploma se amplía en un `<dialog>` modal nativo:
foco atrapado y Escape sin librería. Las imágenes van `unoptimized`: ya son WebP a
su tamaño final bajo una URL inmutable, y reoptimizarlas gastaría cuota de Vercel
para nada.
## Tema claro / oscuro

- **Por defecto oscuro.** Sin preferencia guardada, el sitio se ve en oscuro; no
  se sigue la preferencia del sistema. Ese valor lo decide ahora
  `site_settings.default_theme`, así que `themeInitScript` es una función que
  lo recibe y `DEFAULT_THEME` pasó a ser el respaldo — lo que usan el cliente
  antes de hidratar y el `catch` del script.
- La preferencia se guarda en la **cookie** `theme` (`dark` | `light`), no en
  `localStorage`. La cookie está disponible en cada carga de documento, que es
  lo que hace falta para aplicar el tema antes del primer pintado.
- `src/lib/theme.ts` concentra el contrato: cookie, evento de sincronización
  entre los dos `ThemeToggle` (navbar y drawer), y `themeInitScript`, el script
  en línea que corre en `<head>` antes de pintar. Ese script es autónomo a
  propósito: se ejecuta mucho antes que cualquier bundle.
- La clase `dark` en `<html>` es la fuente de verdad en runtime. `ThemeToggle`
  la lee con `useSyncExternalStore`, no con `useState` + `useEffect`.

**Por qué el selector de idioma recarga la página:** cambiar de idioma cambia el
parámetro `[locale]` del layout raíz, React remonta `<html>` y descarta la clase
`dark` que puso el script. El tema se reiniciaba en cada cambio de idioma. Una
carga completa de documento vuelve a ejecutar el script y lo aplica antes de
pintar. No cambies ese `<a>` por `<Link>`.

## SEO

`src/lib/seo.ts` centraliza metadatos y datos estructurados. Reglas:

- Las entidades `Person` y `WebSite` se emiten una sola vez desde el layout y
  tienen `@id` estable e independiente del idioma. El resto de páginas las
  referencian con `{ "@id": ... }` en vez de repetir el bloque.
- Toda página necesita canonical + `alternates.languages` + `x-default`. Eso lo
  resuelve `alternatesFor()` / `pageMetadata()`.
- El sitemap emite una entrada por página **por idioma**, cada una con el mapa
  de alternativas.
- `llms.txt` existe en ambos idiomas (`/llms.txt` y `/en/llms.txt`) y se genera
  desde los mismos datos.

## Convenciones de código

- Componentes de servidor por defecto. `"use client"` solo cuando hace falta
  estado o APIs del navegador.
- Los componentes reciben `locale` y/o `t` (el diccionario) por props. No hay
  contexto global de idioma.
- Comentarios en inglés, en el código; explican **por qué**, no qué hace la
  línea. Comenta solo lo que no se deduce leyendo el código.
- Sin `any`. Sin dependencias nuevas salvo que se justifique explícitamente.

## Comandos

Desde la raíz del repositorio:

```bash
npm run dev          # sitio público en :3000
npm run dev:admin    # plataforma de gestión en :3001
npm run build        # build de producción de todos los workspaces
npm run lint         # ESLint en las dos aplicaciones
npm run typecheck    # tsc --noEmit en todos los workspaces
npm test             # runner de Node: packages/shared, packages/db/src,
                     # apps/web/src/lib, apps/admin/src/lib. Sin dependencias nuevas.
npm run db:generate  # regenera el cliente de Prisma
npm run db:migrate   # crea y aplica una migración
npm run db:studio    # Prisma Studio
npm run backup:restore -- copia.json.gz --dry   # ver «Copias de seguridad»
```

Tras editar `schema.prisma` hay que ejecutar `npm run db:generate` antes de que
los tipos nuevos existan.

`npm run build` es la verificación mínima antes de dar por terminado cualquier
cambio.
