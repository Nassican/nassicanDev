# Portafolio Moderno - Jesús David Benavides Chicaiza

## Stack Tecnológico

- **Next.js Latest Version** (App Router) - Framework React con SSR/SSG
- **TypeScript** - Type safety y mejor DX
- **Tailwind CSS** - Styling rápido y moderno
- **React Hook Form + Zod** - Formulario de contacto validado
- **Resend/Nodemailer** - API para envío de emails
- **Lucide React** - Iconos minimalistas

## Estructura del Proyecto

```
nassican/
├── app/
│   ├── layout.tsx          # Layout principal
│   ├── page.tsx            # Homepage con todas las secciones
│   ├── api/
│   │   └── contact/
│   │       └── route.ts    # API endpoint para formulario
│   └── globals.css         # Estilos globales
├── components/
│   ├── sections/
│   │   ├── Hero.tsx        # Sección inicial con nombre
│   │   ├── About.tsx       # 2 párrafos: Frontend + Backend
│   │   ├── Skills.tsx      # Tecnologías (editable fácilmente)
│   │   ├── Experience.tsx  # Timeline educación/experiencia
│   │   ├── Projects.tsx    # Showcase de proyectos (enfoque principal)
│   │   └── Contact.tsx     # Formulario + enlaces + CV download
│   ├── ui/
│   │   ├── Button.tsx      # Componente reutilizable
│   │   ├── Card.tsx        # Para proyectos y experiencia
│   │   └── SectionTitle.tsx
│   └── Navigation.tsx      # Navbar sticky
├── lib/
│   └── data.ts            # Datos editables (proyectos, skills, etc)
├── public/
│   ├── cv.pdf             # CV para descargar (placeholder)
│   └── projects/          # Imágenes de proyectos
└── package.json
```

## Diseño Monocromático

### Paleta de Colores

- **Background**: Blanco puro (#FFFFFF) y Negro (#000000)
- **Grises**: #F5F5F5, #E5E5E5, #A3A3A3, #525252, #171717
- **Acentos sutiles**: Sombras y bordes para profundidad
- **Hover states**: Inversión blanco/negro para interactividad

### Principios de Diseño

- Tipografía limpia y moderna (Inter o Geist)
- Espaciado generoso y respiración visual
- Animaciones sutiles pero presentes
- Grid y layouts asimétricos para modernidad
- Alto contraste para legibilidad

## Secciones Principales

### 1. Hero Section

- Nombre completo grande y bold
- Título: "Estudiante de Ingeniería de Sistemas"
- Subtítulo breve
- CTA: Ver Proyectos / Contactar
- Animación de entrada suave

### 2. About

- **Párrafo 1**: Enfoque en Frontend (React, Next.js, UX/UI, performance)
- **Párrafo 2**: Enfoque en Backend (APIs, bases de datos, arquitectura)
- Layout en dos columnas o cards

### 3. Skills

- Categorías: Frontend, Backend, Tools, Databases
- Diseño en grid con iconos/nombres
- Fácilmente editable desde `lib/data.ts`
- Hover effects minimalistas

### 4. Experience/Timeline

- Timeline vertical con diseño moderno
- Educación (Ingeniería de Sistemas)
- Experiencia relevante (si aplica)
- Estructura editable desde data.ts

### 5. Projects (Sección Principal)

- Grid de cards con imágenes
- Cada proyecto muestra:
  - Imagen/screenshot
  - Título y descripción breve
  - Stack tecnológico (tags)
  - Enlaces: Demo en vivo + GitHub
  - Categoría: Frontend/Backend/Fullstack
- Filtros opcionales por categoría
- Hover effect con overlay
- Modal o página expandida (escalable)

### 6. Contact

- Formulario simple:
  - Nombre
  - Email
  - Mensaje
  - Botón de envío
- Validación con Zod
- Email de contacto: contacto@nassican.com
- Links a redes sociales (GitHub, LinkedIn, etc)
- Botón para descargar CV (PDF)
- Estados: Loading, Success, Error

## Características de Escalabilidad

### Preparado para Crecer

- **Data-driven**: Todos los proyectos/skills en `lib/data.ts` (fácil migrar a CMS)
- **Componentes reutilizables**: Diseño modular
- **API Routes**: Listo para agregar más endpoints
- **TypeScript**: Type safety para refactoring seguro
- **Tailwind**: Sistema de diseño consistente
- **SEO**: Metadata configurada, OG images
- **Performance**: Image optimization, lazy loading

### Futuras Mejoras Posibles

- Agregar blog con MDX
- Conectar a CMS (Sanity, Contentful)
- Sistema de analytics
- Internacionalización (i18n)
- Dark mode toggle
- Más animaciones interactivas

## Deployment

- Configuración optimizada para **Vercel**
- Variables de entorno para email API
- Automático con git push
- Custom domain ready

## Archivos Clave a Editar

Para actualizar contenido fácilmente:

- `lib/data.ts` - Proyectos, skills, experiencia, info personal
- `public/cv.pdf` - Tu CV real
- `public/projects/` - Screenshots de proyectos
