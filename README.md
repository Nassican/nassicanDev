<p align="center">
  <img src="public/brand/LogoNassican.png" alt="Logo de Nassican" width="180" />
</p>

# Nassican - Portafolio personal

Portafolio bilingüe de Jesús David Benavides Chicaiza, construido con Next.js. Presenta su perfil profesional, experiencia, formación, habilidades, certificados, proyectos y artículos en español e inglés.

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

```bash
npm run dev       # servidor de desarrollo
npm run lint      # análisis estático con ESLint
npm run build     # compilación optimizada de producción
npm run start     # ejecuta la compilación de producción
```

## Estructura

```text
src/
├── app/
│   ├── [locale]/        # páginas, layout y rutas localizadas
│   ├── globals.css      # estilos globales y tema
│   ├── manifest.ts
│   ├── robots.ts
│   └── sitemap.ts
├── components/
│   ├── sections/        # secciones de la página principal
│   └── ui/              # componentes reutilizables
├── lib/
│   ├── data/            # contenido tipado del portafolio
│   ├── i18n/            # configuración y diccionarios es/en
│   ├── seo.ts
│   └── theme.ts
└── middleware.ts        # redirección y reescritura de idiomas
```

Los recursos estáticos, capturas de proyectos y CV se encuentran en `public/`.

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

La aplicación funciona sin variables obligatorias. Para generar URLs absolutas de otro dominio puede definirse:

```env
NEXT_PUBLIC_SITE_URL=https://nassican.com
```

Si no se establece, se utiliza `https://nassican.com`.

## Despliegue

El proyecto puede desplegarse en Vercel o en cualquier plataforma compatible con Next.js:

```bash
npm run build
npm run start
```

Antes de publicar cambios se recomienda ejecutar `npm run lint` y `npm run build`.
