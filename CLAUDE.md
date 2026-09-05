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

Better Auth define sus tablas en código, así que actualizarlo puede añadir una
columna sin que nada falle hasta que alguien intenta entrar. **Tras cada
actualización de `better-auth`, ejecuta `npm run check:auth --workspace
@nassican/admin`**, que compara `getAuthTables()` contra los modelos de Prisma.
Así se encontró `account.issuer`, y de la peor manera: por un error en tiempo
de ejecución en el callback de OAuth.

El login pide además permisos de solo lectura sobre Analytics y Search Console:
el `refreshToken` que Google devuelve queda en `accounts` y es lo que hace
innecesaria una service account. Por eso el proveedor lleva `accessType:
"offline"` y `prompt: "consent"` — sin ambos, Google entrega el refresh token
solo en el primer consentimiento y nunca más.

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

`robots.txt` dejó de ser el archivo de convención `robots.ts` y pasó a ser un
manejador de ruta, porque `MetadataRoute.Robots` no admite líneas arbitrarias y
`robotsExtra` las necesita. La salida se comprobó byte a byte contra la anterior
antes de cambiarla.

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

No se usa Markdown ni MDX: el cuerpo es un arreglo de `ContentBlock`
(`paragraph`, `heading`, `list`, `code`, `quote`) que renderiza
`src/components/Prose.tsx`. Es a propósito — un bloque mal formado o una
traducción faltante falla en `tsc` en lugar de renderizarse mal en producción.
Si algún día se migra a MDX, el cambio debería quedar contenido en `Prose`.

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

Si la llamada de revalidación falla, el panel lo dice pero **no revierte la
publicación**: el contenido ya está guardado, y una caché que tarda es mejor
que un botón que parece haber fallado.

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
  se sigue la preferencia del sistema.
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
npm run db:generate  # regenera el cliente de Prisma
npm run db:migrate   # crea y aplica una migración
npm run db:studio    # Prisma Studio
```

Tras editar `schema.prisma` hay que ejecutar `npm run db:generate` antes de que
los tipos nuevos existan.

`npm run build` es la verificación mínima antes de dar por terminado cualquier
cambio.
