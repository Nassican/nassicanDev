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
| `skills.ts` | Registro de tecnologías y agrupación | módulo *(ya importado)* |
| `profile.ts` | Nombre, correo, ubicación, redes, CVs | módulo |
| `experience.ts` | Historial laboral | módulo |
| `education.ts` | Formación académica | módulo |
| `certificates.ts` | Certificados y cursos | módulo |
| `content.ts` | Reexporta `ContentBlock` y utilidades de `@nassican/shared` | — |

`skills.ts` está en un estado intermedio: sus datos ya viven en las tablas
`technologies` y `skill_groups` —los proyectos referencian tecnologías por
clave foránea—, pero la sección de Habilidades del sitio público sigue leyendo
el módulo. Se cerrará cuando exista su módulo en el panel.

Las carpetas `projects/<slug>/` con los archivos `es.ts` y `en.ts` **siguen en
el repositorio a propósito**: son la copia de seguridad de la migración y la
fuente que lee `scripts/import-content.ts`. Ya no las lee el sitio. Bórralas
solo cuando la migración esté confirmada en producción.

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
