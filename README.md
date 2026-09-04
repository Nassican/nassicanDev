<p align="center">
  <img src="apps/web/public/brand/LogoNassican.png" alt="Logo de Nassican" width="180" />
</p>

# Nassican

Monorepo de [nassican.com](https://nassican.com). Contiene dos aplicaciones:

| Workspace | Dominio | Qué es |
| --- | --- | --- |
| `apps/web` | `nassican.com` | Sitio público: portafolio bilingüe de Jesús David Benavides Chicaiza |
| `apps/admin` | `app.nassican.com` | Plataforma de gestión del sitio |
| `packages/shared` | — | Tipos y utilidades comunes: `Locale`, `Localized<T>`, `ContentBlock` |
| `packages/db` | — | Esquema Prisma y cliente de base de datos (Postgres en Neon) |

## Sitio público (`apps/web`)

Portafolio bilingüe construido con Next.js. Presenta el perfil profesional, experiencia, formación, habilidades, certificados, proyectos y artículos en español e inglés.

## Características

- Rutas localizadas: español sin prefijo (`/`) e inglés bajo `/en`.
- Tema claro y oscuro persistido mediante cookies.
- Proyectos con páginas de detalle y casos de estudio tipados.
- Blog modular preparado para contenido bilingüe.
- Certificados con búsqueda y filtros.
- CV descargable en español e inglés.
- SEO con canonical, `hreflang`, Open Graph, JSON-LD, sitemap y robots.
- Archivos `llms.txt` localizados.
- Diseño responsive y accesible.
- Build reproducible sin descargar fuentes externas.

## Tecnologías

- Next.js 16 con App Router
- React 19
- TypeScript
- Tailwind CSS 4
- React Icons
- ESLint 9

El proyecto no utiliza una librería de internacionalización ni un CMS. Las rutas localizadas y el contenido se gestionan con módulos TypeScript propios.

## Requisitos

- Node.js 20 o superior
- npm

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La versión inglesa está disponible en [http://localhost:3000/en](http://localhost:3000/en).

## Comandos

Todos se ejecutan desde la raíz del repositorio:

```bash
npm run dev          # sitio público en :3000
npm run dev:admin    # plataforma de gestión en :3001
npm run build        # compila todos los workspaces
npm run build:web    # compila solo el sitio público
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run db:generate  # regenera el cliente de Prisma
npm run db:migrate   # crea y aplica una migración
npm run db:studio    # Prisma Studio
```

## Estructura

```text
.
├── apps/
│   ├── web/                     # sitio público (nassican.com)
│   │   ├── public/              # recursos estáticos, capturas y CV
│   │   └── src/
│   │       ├── app/
│   │       │   ├── [locale]/    # páginas, layout y rutas localizadas
│   │       │   ├── globals.css  # estilos globales y tema
│   │       │   ├── manifest.ts
│   │       │   ├── robots.ts
│   │       │   └── sitemap.ts
│   │       ├── components/
│   │       │   ├── sections/    # secciones de la página principal
│   │       │   └── ui/          # componentes reutilizables
│   │       ├── lib/
│   │       │   ├── data/        # contenido tipado del portafolio
│   │       │   ├── i18n/        # configuración y diccionarios es/en
│   │       │   ├── seo.ts
│   │       │   └── theme.ts
│   │       └── middleware.ts    # redirección y reescritura de idiomas
│   └── admin/                   # plataforma de gestión (app.nassican.com)
│       └── src/app/             # panel en español, sin segmento [locale]
└── packages/
    ├── shared/                  # Locale, Localized<T>, ContentBlock
    └── db/
        ├── prisma/schema.prisma # modelo de datos
        └── src/                 # cliente Prisma y acceso tipado al jsonb
```

El alias `@/*` está definido por aplicación: dentro de `apps/web` resuelve a
`apps/web/src/*`. Los caminos citados en este documento son relativos a la
aplicación correspondiente.

## Gestión de contenido

El contenido editable vive en `src/lib/data/`. Los datos alimentan las páginas, el sitemap, los datos estructurados y `llms.txt` desde una única fuente.

- `profile.ts`: perfil, redes sociales y CV.
- `skills.ts`: tecnologías y categorías.
- `experience.ts`: experiencia profesional.
- `education.ts`: formación académica.
- `certificates.ts`: cursos y certificados.
- `projects/`: proyectos y casos de estudio.
- `posts/`: artículos del blog.

Cada cambio de contenido visible debe implementarse tanto en español como en inglés. Los tipos `Localized<T>` y los diccionarios ayudan a detectar traducciones faltantes durante la compilación.

### Agregar un proyecto

1. Crea una carpeta en `src/lib/data/projects/<slug>/`.
2. Añade `index.ts`, `es.ts` y `en.ts`, tomando un proyecto existente como referencia.
3. Registra el proyecto en `src/lib/data/projects/index.ts`.
4. Guarda su imagen en `public/projects/`.
5. Usa `comingSoon: true` mientras el caso de estudio no esté terminado.

### Publicar un artículo

1. Copia `src/lib/data/posts/_example/` y renombra la carpeta con el slug.
2. Completa y traduce `es.ts` y `en.ts`.
3. Registra el artículo en `src/lib/data/posts/index.ts`.
4. Elimina `draft: true` cuando esté listo para publicarse.

## Variables de entorno

Ninguna es obligatoria: sin ellas el sitio compila y funciona, solo sin
analítica. Cada workspace trae su `.env.example`.

| Variable | Workspace | Para qué |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `apps/web` | Base de las URLs absolutas; por defecto `https://nassican.com` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `apps/web` | Etiqueta GA4 del flujo de datos web (`G-…`) |
| `DATABASE_URL` · `DIRECT_DATABASE_URL` | `packages/db` | Conexión agrupada y directa de Neon |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | `apps/admin` | Login con Google y acceso a sus APIs |
| `ADMIN_ALLOWED_EMAILS` | `apps/admin` | Única cuenta con acceso al panel |
| `GA4_PROPERTY_ID` | `apps/admin` | Propiedad que consulta la Data API (numérico) |

El identificador de medición y el de propiedad son distintos y no
intercambiables: el primero es donde el sitio **envía**, el segundo es de donde
el panel **lee**.

`NEXT_PUBLIC_GA_MEASUREMENT_ID` debe definirse solo en el entorno de
producción de Vercel. La analítica además no se emite fuera de un build de
producción, para que las sesiones de desarrollo no acaben en la misma
propiedad que alimenta el panel.

## Despliegue

Cada aplicación se despliega como un proyecto independiente de Vercel sobre
este mismo repositorio, distinguidos por su *Root Directory*:

| Proyecto de Vercel | Root Directory | Dominio |
| --- | --- | --- |
| Sitio público | `apps/web` | `nassican.com` |
| Plataforma de gestión | `apps/admin` | `app.nassican.com` |

Antes de publicar cambios se recomienda ejecutar `npm run lint` y `npm run build`.
