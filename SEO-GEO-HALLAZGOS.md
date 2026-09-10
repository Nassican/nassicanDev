# Auditoría SEO y GEO de nassican.com

Fecha: 10 de septiembre de 2026. Alcance: web pública bilingüe, configuración en admin y código compartido. Documento de trabajo: se actualiza con los cambios y su validación.

Seguimiento: el propietario reporta una validación correcta en Rich Results Test. No se dispone aquí del informe ni de la URL exacta probada; esto no modifica por sí solo el estado de los pasos de despliegue e indexación pendientes. La estrategia editorial y de mantenimiento para su objetivo profesional está en [GUIA-SEO-GEO-PERSONAL.md](GUIA-SEO-GEO-PERSONAL.md).

Hallazgo de posicionamiento adicional: la portada visible sigue usando `hero.badge`, `hero.description` y textos de «Sobre mí» orientados a Full Stack, definidos en los diccionarios ES/EN. Cambiar Perfil o los metadatos de admin no actualiza todos esos textos. Alinear ese mensaje con ingeniería de sistemas e IA aplicada requiere edición del código o hacer esos campos configurables, además de evidencia profesional que respalde la especialidad.

## Hallazgos y cambios implementados

| Prioridad | Hallazgo | Estado |
| --- | --- | --- |
| Alta | Producción sirve HTML en www, pero canonical, OG y sitemap apuntan al apex, que redirige. | Corregido en código: se normaliza a `https://www.nassican.com`, incluso si la variable existente conserva el apex. Otros orígenes de preview se respetan. |
| Alta | Sitemap sin páginas personalizadas, sin exclusión de `noindex` y con `lastmod` igual a la fecha de ejecución. | Catálogo común de páginas indexables; incluye personalizadas, filtra por idioma y emite fechas reales de artículos/proyectos/páginas. Se omite `lastmod` de portadas/listados/PDF cuando no existe una fecha fiable. |
| Alta | Imagen social global guardada en admin pero ignorada; artículos sin portada en metadatos. | OG y Twitter usan portada → imagen global → tarjeta generada. La tarjeta pasa a `/social-image` y `/en/social-image`, fuera de la convención de archivos que tenía prioridad sobre la configuración. URLs externas de imágenes ya no se concatenan incorrectamente al dominio. |
| Alta | SEO de portada sin conectar con Páginas; campos SEO de artículos/proyectos en DB sin editor ni consumo público. | Resolver central en `apps/web/src/lib/page-metadata.ts`; portada conectada. Editores de blog/proyecto con título, descripción y `noindex` por idioma. |
| Alta | Metadatos de Googlebot permiten indexar incluso en mantenimiento; protección de previews limitada a robots.txt. | Robots y Googlebot coherentes; metadatos y cabecera HTTP `X-Robots-Tag` en rutas localizadas de previews/desarrollo. Sitemap vacío en previews/mantenimiento. |
| Alta | JSON-LD serializado sin escapar `<`, susceptible a cerrar el script desde contenido editorial. | Serializador común en todas las páginas que emiten JSON-LD, con prueba de cierre de script. |
| Media | Bots específicos no heredan `Disallow: /api/`; permisos de búsqueda IA y entrenamiento fijos en código. | Todos los grupos permitidos incluyen la exclusión. Controles separados en admin y validación para impedir grupos duplicados que anulen la decisión. Bing/Applebot usan el grupo general. |
| Media | `llms.txt` omite páginas personalizadas y usa descripción fija; no respeta `noindex`. | Usa el catálogo del sitemap, perfil y descripción editable; elimina artículos/proyectos noindex por idioma y agrega páginas personalizadas. Se desactiva con 404 al apagarlo, en preview, mantenimiento o si la portada del idioma es noindex. |
| Media | `llms.txt` permite una copia CDN de 24 horas independiente de los cambios del panel. | Cabeceras de revalidación sin ese TTL; las consultas mantienen la invalidación por etiquetas existente. El archivo lleva `X-Robots-Tag: noindex` para no competir con la web. |
| Media | Person declara empleos anteriores como actuales; cargo fijo en vez del perfil editable. | `worksFor` filtra experiencias terminadas; cargo y descripción usan perfil/SEO editable. La lista de proyectos de la portada coincide con los destacados y su visibilidad. |
| Media | Artículos sin firma visible ni imagen en BlogPosting. | Firma enlazada al perfil, portada visible y portada en datos estructurados. Se conserva la autoría del propietario del portafolio. |
| Media | GA4 de admin no alimenta la etiqueta de la web. | Identificador de admin con prioridad sobre la variable de entorno; envío limitado a producción. Validación de formato al guardar. |
| Baja | El editor promete que menos de 160 caracteres siempre se muestra completo. | Texto corregido: longitud orientativa, con posibilidad de recorte o reescritura. |
| Baja | Plantilla de título sin `%s` puede eliminar la identidad de cada página. | Validación de servidor al guardar. |

## Criterio GEO

Se priorizan contenido visible, autoría verificable, rastreo y consistencia entre HTML y datos estructurados. `llms.txt` es un complemento experimental, no una garantía de citas ni posicionamiento. Google no exige archivos o esquemas especiales para sus funciones de IA: [documentación oficial](https://developers.google.com/search/docs/appearance/ai-features).

Las fechas del sitemap deben reflejar modificaciones reales: [Google: construir un sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). La prioridad del sitemap no controla qué URL posiciona mejor.

La herencia de metadatos y la prioridad de los archivos de imágenes se revisan con [Next.js: generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata).

El escape de JSON-LD sigue [Next.js: JSON-LD](https://nextjs.org/docs/app/guides/json-ld). La separación de grupos de robots sigue [Google: especificación de robots.txt](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec).

Los permisos de búsqueda y entrenamiento son distintos: [OpenAI: crawlers](https://developers.openai.com/api/docs/bots) y [Anthropic: crawlers](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler). Robots expresa preferencias, no es control de acceso; algunas consultas iniciadas por usuarios pueden no aplicar sus reglas.

## Evidencia de producción

Consulta HTTP pública realizada el 10/09/2026 alrededor de las 21:22 UTC, sin autenticación ni cambios remotos:

- `https://nassican.com/`: **307** hacia `https://www.nassican.com/`.
- `https://www.nassican.com/`: **200**, servido por Vercel, `X-Matched-Path: /es`.
- Canonical del HTML: `https://nassican.com`; `og:url` usa el mismo origen incorrecto.
- `og:image`: `https://nassican.com/es/opengraph-image?...`, con origen que redirige y prefijo interno `/es`.
- Robots declara `Sitemap: https://nassican.com/sitemap.xml`; los bots específicos solo tenían `Allow: /`.
- Sitemap contiene `<loc>https://nassican.com/</loc>` y un `lastmod` de portada `2026-09-10T20:31:28.960Z`, consistente con el uso de `new Date()` al generar.
- HTML de portada descargado: aproximadamente **520 kB sin comprimir**. Es una observación del documento; no se midieron transferencia comprimida, LCP, INP ni CLS, por lo que no se atribuye una puntuación de rendimiento.
- La herramienta web inicialmente no pudo abrir el dominio; una consulta HTTP posterior sí lo consiguió. No hubo evidencia de indisponibilidad del sitio.

## Dónde configurar

| Panel | Configuración |
| --- | --- |
| SEO y GEO → Metadatos globales | Títulos/descripciones por idioma, plantilla, imagen social, verificación de Google e identificadores de medición. |
| SEO y GEO → Rastreo y asistentes de IA | Permitir bots de búsqueda/consulta, permitir recopilación/entrenamiento y publicar `llms.txt`. Guardado con el botón de Metadatos globales. |
| Contenido → Blogs / Proyectos → idioma → SEO | Título SEO y descripción opcionales, exclusión `noindex`; la portada se usa al compartir. |
| Contenido → Páginas | SEO de rutas del sistema (incluida portada) y páginas personalizadas. Solo páginas publicadas afectan al sitio. |
| Perfil | Nombre, cargo, ubicación, enlaces y experiencia que alimentan la identidad pública. |

Los tres controles nuevos conservan el comportamiento anterior por defecto: activados. Se preparó una migración aditiva, sin eliminación de datos, en `packages/db/prisma/migrations/20260910220000_seo_geo_controls/migration.sql`.

## Pendientes de publicación y verificación operativa

1. **Aplicar la migración antes de desplegar cualquiera de las aplicaciones.** Los nuevos campos son necesarios para sus consultas. No se ha ejecutado DDL contra la base conectada. En el entorno elegido, desde `packages/db`, ejecutar `npx prisma migrate deploy` tras revisar el destino y las migraciones pendientes.
2. Regenerar Prisma y ejecutar `npm run build` completo cuando el motor de Windows no esté bloqueado por el servidor de desarrollo. La compilación de código aislada sí se validó; no equivale a prerenderizar con la base migrada.
3. Después del despliegue, probar guardado/recarga de los controles en admin y HTML público: imágenes, `noindex`, hreflang, robots, sitemap y ambos `llms.txt`. Verificar el endpoint de invalidación desde Sistema.
4. Configurar en Vercel una redirección permanente 301/308 del apex a www si el dominio se mantendrá así. Actualmente devuelve 307; este ajuste de hosting no se modifica desde el repositorio.
5. Usar `NEXT_PUBLIC_SITE_URL=https://www.nassican.com` y el destino final en `PUBLIC_SITE_URL` de admin. El normalizador corrige el apex para SEO, pero la invalidación HTTP necesita que admin apunte directamente al host final.
6. En Search Console, enviar el sitemap final e inspeccionar una URL de cada tipo y cada idioma. No se han consultado datos privados de impresiones, posiciones, cobertura ni conversiones, ni se promete mejora de posiciones.
7. Validar páginas publicadas con Rich Results Test y medir PageSpeed/CrUX en móvil. Investigar el tamaño de HTML y repetición del grafo Person si las mediciones muestran impacto.

## Hallazgos que requieren trabajo adicional

- **Mantenimiento:** la interfaz actual responde con HTML de aviso; sería preferible responder 503 con `Retry-After` durante interrupciones temporales. Se corrigió la contradicción de robots, pero implementar la respuesta de mantenimiento en infraestructura requiere definir duración y comportamiento operativo.
- **Contenido GEO:** priorizar casos de estudio completos (problema, responsabilidades, decisiones, resultados medibles y enlaces comprobables), artículos con referencias y fechas de revisión reales, y una presentación clara de servicios/especialidades en ambos idiomas. No se inventaron clientes, resultados, credenciales ni preguntas frecuentes.
- **Páginas pendientes de caso de estudio:** los proyectos `comingSoon` siguen disponibles. El nuevo `noindex` permite excluirlos mientras se completa el contenido; no se cambió masivamente la política editorial.
- **Fechas editoriales:** el esquema llama a `updatedAt` «última edición con peso editorial», pero Prisma lo actualiza en cada escritura. Ahora no se inventan fechas en listados; todavía conviene separar fecha de revisión editorial de cambios administrativos si estos son frecuentes.
- **Campos heredados:** `canonicalUrl` de artículos e imágenes OG específicas por traducción existen en Prisma pero continúan sin editor. Se usa canonical propio y portada/imagen global; exponer canonical externo exige definir el caso de sindicación y su validación.
- **Identidad y autoría:** el sitio sigue siendo un portafolio de un solo autor, con algunos alias/redes y textos del diseño fijos. Un blog multiusuario necesitará autores públicos distintos de las cuentas de acceso del admin.
- **Previews:** las páginas tienen noindex y el sitemap está vacío. La protección adicional de despliegues y recursos estáticos/PDF depende del hosting; revisar Deployment Protection en Vercel.
- **Bots:** revisar periódicamente nombres y finalidad de los agentes; algunos proveedores agrupan varios usos. Cambiar robots no revoca contenido ya recopilado.
- **Cambios de slug:** revisar redirecciones de artículos/proyectos antes de renombrarlos; no se configuraron redirecciones de contenido real durante esta auditoría.

## Validación

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 17 pruebas aprobadas: 5 existentes y 12 regresiones SEO/GEO. |
| `npm run lint` | Aprobado en web y admin. Advertencia existente sobre antigüedad de baseline-browser-mapping. |
| `npm run typecheck` | Aprobado en los cuatro workspaces. |
| `prisma validate` desde packages/db | Esquema válido. |
| Next build `--experimental-build-mode compile` | Web y admin compilan; se validaron las rutas generadas. |
| Prisma en bundles de cliente | Sin coincidencias de `PrismaClient` en `.next/static` de las dos aplicaciones. |
| `npm run db:generate` / `npm run build` completo | Bloqueado por EPERM al reemplazar `query_engine-windows.dll.node`; se identificó un servidor admin activo y no se interrumpió. |
| Guardado real y prerender con nueva migración | Pendiente; no se modificó la base conectada ni se desplegó. |

Las pruebas cubren normalización de origen, imágenes locales/externas, overrides, noindex/Googlebot, idiomas ausentes o excluidos, fechas de descubrimiento, serialización segura, empleadores actuales y permisos independientes de bots. No sustituyen la inspección de indexación ni la medición de citas en buscadores con IA.
