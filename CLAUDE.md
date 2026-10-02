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

`skills.ts` está en un estado intermedio: sus datos ya viven en las tablas
`technologies` y `skill_groups` —los proyectos referencian tecnologías por
clave foránea—, pero la sección de Habilidades del sitio público sigue leyendo
el módulo. Se cerrará cuando exista su módulo en el panel.

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

`deleteMedia` se niega mientras algo apunte a la imagen, y dice cuántos.

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
hasta cinco minutos en volver si falla el aviso de caché — el mismo respaldo de
`CACHE_SECONDS` que protege a todo lo demás.

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

**La disponibilidad se comprueba cuando se pide.** El panel no tiene
planificador, y una página de monitorización cuyos datos solo se mueven al
abrirla es mejor decirlo que disimularlo. Se pide `GET` y no `HEAD` a propósito:
lo que importa es que la página se renderice, y con la caché fría se renderiza
bajo demanda — que es justo el caso que vale la pena medir.

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

### Finanzas: espejo de solo lectura de Wallet

En `app.nassican.com/finanzas`. Lee las finanzas personales de Wallet
(BudgetBakers) y **nunca escribe en Wallet**.

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

Cuatro cosas que no son de ningún módulo y están en todos. Se construyeron
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

**⌘K: una lista, dos orígenes.** `components/CommandPalette.tsx` saca los
módulos de los mismos datos de `lib/navigation.ts` que dibuja el menú —así un
módulo nuevo aparece aquí el día que aparece allí, sin una segunda lista que
mantener— y el contenido se resuelve **una vez** en el servidor al renderizar el
armazón (`lib/commands.ts`). No hay búsqueda contra la base por cada tecla: a la
latencia de esta base eso sería un teclado que se arrastra.

Lo que empieza por lo que escribiste gana a lo que lo lleva por el medio. Y el
índice seleccionado se recorta **al renderizar**, no en un efecto: cuando la
lista se encoge bajo el cursor, un efecto dibujaría el hueco vacío una vez antes
de corregirse.

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
npm run profile:import -- --dry
npm run profile:import
```

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
npm test             # runner de Node: packages/shared, apps/web/src/lib,
                     # apps/admin/src/lib. Sin dependencias nuevas.
npm run db:generate  # regenera el cliente de Prisma
npm run db:migrate   # crea y aplica una migración
npm run db:studio    # Prisma Studio
```

Tras editar `schema.prisma` hay que ejecutar `npm run db:generate` antes de que
los tipos nuevos existan.

`npm run build` es la verificación mínima antes de dar por terminado cualquier
cambio.
