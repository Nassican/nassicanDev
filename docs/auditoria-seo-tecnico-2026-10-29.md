# Segunda auditoría técnica de Nassican

Fecha: **29 de octubre de 2026**, America/Bogota. Dominio: **https://www.nassican.com/**. Repositorio inicial: `4c1f0f2`.

Se auditó antes de editar. Los cambios están en el repositorio; **no se desplegaron**, no se cambiaron DNS, preferencias de rastreo, credenciales ni contenido de la base de datos. La producción examinada todavía contiene los problemas corregidos localmente. Un HTTP 200, un sitemap válido o una prueba de disponibilidad no demuestran indexación en Google.

## Estado por área

| Área | Estado | Evidencia y alcance |
| --- | --- | --- |
| SEO on-page | Corregida | Títulos diferenciados de CursoVisor por idioma y H2 de las tarjetas bajo el H1 de `/projects`. Descripciones únicas en las páginas indexables del build. Se respetan las personalizaciones editoriales. |
| Identidad y Schema.org | Corregida y verificada localmente | Un `Person` por documento, siempre `https://www.nassican.com/#person`; `WebSite` usa `/#website`; inicio y perfil referencian a la misma persona. Se corrigió el tipo del asunto de los certificados. |
| Rastreo y redirecciones | Verificada y correcta | Robots público 200, sitemap declarado, recursos de renderizado permitidos. HTTP, dominio sin www y `/es` redirigen. No hubo enlaces internos rotos en el conjunto auditado. |
| Sitemap | Corregida | El archivo de Next pasa de 16 a 14 recursos al excluir exclusivamente las dos versiones del blog vacío. Los 14 destinos locales responden 200 y son canónicos e indexables. |
| Renderizado | Corregida y verificada | Identidad, contenido y enlaces están en el HTML. Se retira el texto de las copias decorativas de la cinta, conservando las etiquetas visibles mediante CSS. |
| Indexabilidad | Corregida localmente; indexación pendiente de verificación externa | Las páginas útiles siguen indexables. Blog vacío: `noindex, follow`, sin bloqueo en robots, hasta publicar el primer artículo. No se accedió a Search Console. |
| Accesibilidad | Corregida en los casos encontrados | Menú móvil con foco dentro, Tab circular, Escape y retorno al botón. Jerarquía del listado corregida. Revisión de imágenes, teclado y dos anchos/temas; no sustituye una auditoría exhaustiva con personas usuarias. |
| Rendimiento | Con problemas pendientes | Lighthouse móvil detecta TBT de 580–700 ms. LCP 1,5 s y CLS 0 en esas mediciones. Falta información de campo para evaluar Core Web Vitals e INP. |
| Rastreadores de IA | Verificada y conservada | Robots permite búsqueda y entrenamiento, como antes. Comparación exacta de la política publicada y la respuesta local con host canónico. No acredita visitas de bots reales ni inclusión en ChatGPT. |
| Validadores de Google e indexación real | Pendiente de verificación externa | No se ejecutaron Rich Results Test, la inspección privada de URLs, informes de acciones manuales ni CrUX/Search Console. |

## Problemas reales y correcciones

### 1. Texto redundante en las tecnologías

En el HTML público de `/` y `/en`, cada tecnología de una categoría aparecía **4 o 6 veces** dentro de `.marquee-track`, sin excluir las copias de la lectura accesible. Por ejemplo, React aparecía 4 veces en Frontend y PostgreSQL 6 veces en Bases de datos.

Ahora el primer conjunto conserva sus nombres como texto normal. Las copias de animación llevan `aria-hidden` y su etiqueta decorativa se pinta con CSS, sin repetir nodos de texto. Se comprueba que las copias tengan el mismo ancho y etiqueta visual, y que el cambio Carrusel/Cuadrícula siga funcionando. La presencia de Git en dos categorías distintas o de una tecnología dentro de una experiencia/proyecto es información contextual útil y se conserva.

### 2. Blog sin artículos anunciado como indexable

`/blog` y `/en/blog` devolvían 200 e `index, follow`, y figuraban en el sitemap, aunque mostraban únicamente el aviso de próximos artículos. No había rutas individuales de artículos publicados que auditar.

Se conservan el diseño, RSS y navegación. Únicamente el archivo vacío recibe `noindex, follow` y sale del descubrimiento. Con el primer artículo publicado, la condición se revierte automáticamente; un `noindex` editorial explícito sigue teniendo prioridad. El sitemap y el mecanismo existente de descubrimiento comparten esta decisión. No se añadió una regla de bloqueo a robots.

Para ello, el constructor de metadatos de servidor ahora respeta también una restricción de indexabilidad de la propia página. Blog y certificados usan ese constructor, que aplica los ajustes editoriales, mantenimiento y despliegue; antes usaban directamente el constructor puro y podían sustituir las restricciones heredadas del layout.

### 3. Jerarquía de proyectos

El listado tenía `H1 → H3`, sin un H2 intermedio. La tarjeta acepta el nivel de encabezado: H2 en `/projects` y `/en/projects`, H3 dentro de las secciones que ya tienen H2. El tamaño y el diseño no cambian.

### 4. Título de CursoVisor idéntico entre idiomas

Ambas versiones usaban `CursoVisor · Nassican`. Ahora el valor predeterminado identifica el caso de estudio en español o inglés. Se mantienen los títulos SEO editoriales existentes, incluido el de Strategix. Las variantes lingüísticas conservan canonical propio y hreflang; no se consideran URLs duplicadas que deban eliminarse.

### 5. Asunto de los certificados en JSON-LD

Los 37 certificados por idioma usaban `about: "categoría"`. El vocabulario oficial de Schema.org espera una entidad `Thing` para `about`. Ahora se emite `about: { "@type": "Thing", "name": "categoría" }`, usando exactamente la categoría publicada. No se alteran títulos, fechas, proveedores o enlaces de credenciales.

La validación local examina sintaxis JSON, tipos, propiedades, dominios de las propiedades, referencias absolutas y uso de entidades en rangos que las requieren. Las URLs de `BreadcrumbList.item` son referencias válidas y no se confunden con categorías en texto libre. Esta comprobación no equivale a una certificación externa de elegibilidad para resultados enriquecidos.

### 6. Menú móvil sin manejo de foco ni Escape

Reproducción en producción a 390 px: abrir con Enter dejaba `aria-expanded=true` y el foco fuera del diálogo; pulsar Escape mantenía el menú abierto. Se añadió manejo de foco, recorrido circular con Tab/Mayús+Tab, cierre con Escape y restauración del foco. Pasar a escritorio también cierra el menú y restituye el desplazamiento. Se conserva el panel y su aspecto.

## Rutas y decisiones

Todas las rutas HTML de esta tabla responden **200**, tienen **un H1**, descripción, canonical absoluto, Open Graph, Twitter Card y contenido principal en el HTML auditado. El canonical corresponde a `https://www.nassican.com` más la ruta. La evidencia adjunta conserva los valores de cada metadato y H1, no solo esta clasificación.

| Ruta | Título SEO final | Decisión |
| --- | --- | --- |
| `/` | Nassican \| Jesús David Benavides · Desarrollador web full stack | Indexable |
| `/en` | Nassican \| Jesús David Benavides · Full stack web developer | Indexable |
| `/profile` | Nassican \| Jesús David Benavides Chicaiza · Ingeniero de Sistemas | Indexable |
| `/en/profile` | Nassican \| Jesús David Benavides Chicaiza · Systems Engineer | Indexable |
| `/projects` | Proyectos · Nassican | Indexable |
| `/en/projects` | Projects · Nassican | Indexable |
| `/projects/strategix` | Strategix: gestión estratégica con SEMAT Essence · Nassican | Indexable |
| `/en/projects/strategix` | Strategix: SEMAT Essence strategic planning · Nassican | Indexable |
| `/projects/cursovisor` | CursoVisor · Caso de estudio · Nassican | Indexable |
| `/en/projects/cursovisor` | CursoVisor · Case study · Nassican | Indexable |
| `/certificates` | Certificados y cursos · Nassican | Indexable |
| `/en/certificates` | Certificates and courses · Nassican | Indexable |
| `/blog` | Blog · Nassican | Noindex mientras esté vacío; accesible y follow |
| `/en/blog` | Blog · Nassican | Noindex mientras esté vacío; accesible y follow |

Los dos CV del sitemap son PDF, responden 200 con `application/pdf` y sin cabecera `X-Robots-Tag` tanto en producción como en el build; no se exige un H1 HTML a un PDF. `/contact` responde 404: el contacto real es `/#contact` y `/en#contact`, enlazado desde el sitio. No se creó una página duplicada de contacto. La URL de prueba inexistente también devuelve un 404 real.

Se revisaron las plantillas individuales de artículos y sus pruebas de JSON-LD. Como no hay artículos publicados, no se presenta una navegación a un artículo real como comprobación ejecutada. Al publicar el primero, se debe inspeccionar su URL real, obtenida del sitemap.

## Identidad y rastreadores

La persona sigue siendo **Jesús David Benavides Chicaiza**, la marca personal **Nassican** y el sitio **https://www.nassican.com/**. No se creó una organización artificial. Los únicos `Person.sameAs` son los perfiles ya proporcionados y visibles: GitHub Nassican y LinkedIn jesusbenavidesmark. No se añadieron cuentas ni se asumió acceso a ellas.

El nombre completo, la explicación de la marca y enlaces a proyectos/perfil están en el HTML inicial. `Person`, `WebSite` y las páginas mantienen identificadores estables; los proyectos y artículos referencian al mismo autor. Las imágenes informativas examinadas tienen alt y dimensiones explícitas o una caja con proporción reservada; las portadas de proyecto usan la optimización existente de Next/Image. No se detectó un defecto que justificase sustituir ese sistema.

Las cinco imágenes sociales únicas se descargaron y respondieron 200: la imagen editorial WebP de 1080 × 1080, dos portadas WebP de proyectos y los dos generadores sociales PNG de 1200 × 630. Sus dimensiones y tamaños reales están en la evidencia; no se infirieron a partir de los atributos HTML.

En producción:

- `http://www.nassican.com/` → 308 → HTTPS con www.
- `http://nassican.com/` → 308 → HTTPS sin www → 308 → HTTPS con www.
- `https://nassican.com/` → 308 → HTTPS con www.
- `/es/projects` → 308 → `/projects`.
- `robots.txt` devuelve 200 y declara `https://www.nassican.com/sitemap.xml`; solo excluye `/api/` en los grupos permitidos, sin bloquear CSS/JS de Next.

La [documentación oficial de OpenAI](https://developers.openai.com/api/docs/bots) distingue **OAI-SearchBot** (búsqueda) y **GPTBot** (contenido que puede usarse para entrenamiento). **ChatGPT-User** atiende acciones de usuarios y no es el control de inclusión en Search. Actualmente ambos grupos están permitidos. No se cambió esta preferencia: bloquear GPTBot y permitir búsqueda sería una decisión independiente del propietario.

Las solicitudes públicas con esas dos etiquetas de user-agent devolvieron 200 y el nombre en HTML. Esto comprueba esa respuesta HTTP, **no** la accesibilidad desde las IP reales de OpenAI ni el cumplimiento de visitas futuras. Permitir rastreo no garantiza indexación, menciones o citas. La ruta `llms.txt` ya existía; no se añadió otra ni se presenta como requisito.

## Rendimiento y enlaces externos

Mediciones **de laboratorio de la versión pública anterior a estas correcciones**, ejecutadas con Lighthouse 13.6.0 y Chrome local. Las puntuaciones se expresan sobre 100.

| Medición | Rendimiento | Accesibilidad | Buenas prácticas | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Móvil, primera | 82 | 100 | 100 | 100 | 1,5 s | 0 | 700 ms |
| Móvil, repetición | 85 | 100 | 100 | 100 | 1,5 s | 0 | 580 ms |
| Escritorio | 100 | 100 | 100 | 100 | 0,5 s | 0 | 60 ms |

La primera captura atribuye tareas de 406 ms y 162 ms a `googletagmanager.com`, además de tareas de la aplicación. Es evidencia para investigar el costo de JavaScript/analítica, no para desactivar mediciones sin evaluar el efecto. No se cambiaron dependencias o analítica para perseguir una puntuación. La variación entre corridas impide prometer una ganancia por los cambios locales.

No se obtuvo INP real ni datos CrUX/usuarios. TBT no es INP. No se puede declarar aprobado o fallido Core Web Vitals de campo a partir de estas pruebas.

Se comprobaron **43 destinos externos** por HEAD: 4 respondieron 200, 38 de Platzi devolvieron 403 y LinkedIn devolvió 405. Estas respuestas restringen la verificación automática; no prueban que los enlaces estén rotos ni justifican retirar credenciales. Se dejan para revisión manual normal, sin intentar entrar a cuentas.

## Archivos modificados

| Archivo | Motivo |
| --- | --- |
| `apps/web/src/components/sections/SkillsBoard.tsx` | Copias de animación decorativas sin texto redundante. |
| `apps/web/src/components/ProjectCard.tsx` | Nivel semántico de encabezado según contexto. |
| `apps/web/src/app/[locale]/projects/page.tsx` | Solicitar H2 para el listado. |
| `apps/web/src/app/[locale]/projects/[slug]/page.tsx` | Título predeterminado del caso de estudio por idioma. |
| `apps/web/src/app/[locale]/blog/page.tsx` | Indexabilidad condicional y constructor de metadatos compartido. |
| `apps/web/src/app/[locale]/certificates/page.tsx` | Aplicar las mismas restricciones/defaults de metadatos que el resto de rutas. |
| `apps/web/src/lib/page-metadata.ts` | Conservar la restricción `indexable: false` de cada página. |
| `apps/web/src/lib/discovery.ts` | Excluir el archivo vacío y recuperarlo con la primera publicación. |
| `apps/web/src/lib/seo.ts` | Asunto de certificado como entidad Schema.org. |
| `apps/web/src/components/Navigation.tsx` | Corregir interacción de teclado del diálogo móvil. |
| `apps/web/src/lib/seo.test.ts` | Regresiones de descubrimiento y asuntos de certificados. |
| `scripts/audit-public-seo.cjs` | Inventario HTTP/HTML, metadatos, enlaces y evidencia sin escrituras en BD. |
| `scripts/check-public-seo.cjs` | Validación semántica y pruebas reales de navegador. |
| `scripts/check-public-identity.cjs` | Esperar HTML listo, evitando depender de que finalice la analítica externa. |
| Este informe y su JSON de evidencia | Resultados, límites y acciones posteriores. |

## Comprobaciones y comandos

Se usan `npm.cmd` y PowerShell en Windows. El dominio canónico se pasó **solo al proceso** de build/servidor mediante `NEXT_PUBLIC_SITE_URL=https://www.nassican.com`; no se editaron `.env`.

| Comando o comprobación | Resultado |
| --- | --- |
| `npm.cmd run lint` | Correcto; permanece el aviso previo de antigüedad de `baseline-browser-mapping`. |
| `npm.cmd run typecheck` | Correcto en los cuatro workspaces. |
| `npm.cmd test` | 422 pruebas correctas: 80 compartidas/BD, 12 SEO y 330 del panel. |
| `npm.cmd run build` | Build completo de producción correcto. |
| `npm.cmd run build:web` | Build web final correcto después de las correcciones adicionales. |
| `node scripts/audit-public-seo.cjs` | Inventario de la versión pública, metadatos/JSON-LD y enlaces internos. |
| `SEO_AUDIT_ORIGIN=http://localhost:3207 node scripts/audit-public-seo.cjs` | Inventario equivalente del build final; en PowerShell se asignó la variable con `$env:`. |
| `node scripts/check-public-seo.cjs` | Correcto: vocabulario, entidades, sitemap, metadatos y 32 variantes de navegador (8 rutas × 2 anchos × 2 temas), incluido teclado del menú móvil. |
| `node scripts/check-public-identity.cjs` | Comprobación con JavaScript desactivado antes de navegar y revisión de identidad. |
| Lighthouse móvil dos veces y escritorio | Resultados de laboratorio indicados arriba; informes originales guardados en TEMP. |
| GET/HEAD públicos y vocabulario oficial Schema.org con `fetch` | Evidencia HTTP y validación sin autenticación. |
| `git diff --check` | Sin errores de espacios. |

Los scripts de navegador usan `puppeteer-core` y Lighthouse ya disponibles en TEMP; no se añadieron dependencias al proyecto. Las primeras ejecuciones de la nueva comprobación detectaron problemas de su propio arnés: equivalencia de origen con/sin `/`, selector singular, respuestas de caché 304 y esperas de red de terceros. Se corrigieron esas comprobaciones; no se cambiaron canonicals correctos ni la política de producción para satisfacerlas.

El build conserva el aviso previo sobre la convención `middleware`. En el servidor local, `/_vercel/insights/script.js` puede responder 404 porque ese endpoint lo sirve Vercel en el despliegue: se registra como limitación local, no como fallo de aplicación ni como error observado en producción. Cualquier error inesperado de recursos o excepción de página hace fallar la prueba.

Los inventarios, HTML, capturas e informes Lighthouse se guardaron en `%TEMP%\nassican-seo-second-audit`. El [JSON de evidencia](auditoria-seo-tecnico-2026-10-29.evidencia.json) resume las comprobaciones públicas y locales sin credenciales. La política local de robots sigue bloqueando hosts no canónicos; una solicitud con host canónico permitió compararla exactamente con producción. No apareció `PrismaClient` en los bundles públicos del navegador.

## Qué hacer en Google Search Console

Estas acciones corresponden al propietario, **después de publicar los cambios cuando lo autorices**. No se accedió a Search Console ni se solicitó indexación en tu nombre.

1. Abre la propiedad de dominio `nassican.com` o la propiedad de prefijo `https://www.nassican.com/`. En **Inspección de URLs**, inspecciona `https://www.nassican.com/` y `/en`. Revisa el estado del índice, último rastreo, disponibilidad para Google y canonical elegida por Google frente a la declarada. Usa **Probar URL publicada** para comprobar el acceso actual y revisar HTML/renderizado; esa prueba no certifica indexación. Solicita indexación si la página actualizada lo necesita.
2. Repite la inspección con estas URLs canónicas completas:
   - `https://www.nassican.com/profile`
   - `https://www.nassican.com/en/profile`
   - `https://www.nassican.com/projects`
   - `https://www.nassican.com/en/projects`
   - `https://www.nassican.com/projects/strategix`
   - `https://www.nassican.com/en/projects/strategix`
   - `https://www.nassican.com/projects/cursovisor`
   - `https://www.nassican.com/en/projects/cursovisor`
   - `https://www.nassican.com/certificates`
   - `https://www.nassican.com/en/certificates`
3. En **Sitemaps**, comprueba/envía `https://www.nassican.com/sitemap.xml`. Revisa resultado de lectura y fecha; tras este despliegue el archivo servido debe tener 14 recursos con el contenido actual. El total descubierto por Google puede actualizarse más tarde y no equivale al total indexado.
4. En **Indexación de páginas**, revisa ejemplos concretos de errores 5xx, 404 inesperados, bloqueos, canonical distinta, “Descubierta: actualmente sin indexar” y “Rastreada: actualmente sin indexar”. Las URLs `/es/...` con redirección y el blog vacío excluido por `noindex` son resultados intencionales. No solicites indexación de esas variantes ni de rutas privadas.
5. En **Ajustes → Estadísticas de rastreo**, revisa disponibilidad del host/robots, respuestas del servidor y tendencias. En **Seguridad y acciones manuales**, verifica si existe una incidencia; solo si la hay, aplica su corrección y solicitud de revisión correspondiente. Usa “Validar corrección” en los informes que lo ofrezcan después de resolver una incidencia real.
6. Al publicar el primer artículo, toma **su URL real** del sitemap e inspecciónala, junto con su traducción publicada y `/blog`/`/en/blog`. Comprueba título, canonical, contenido, fecha y JSON-LD; solicita indexación si procede. Actualmente no hay una URL individual publicada que recomendar como existente.
7. Consulta el informe de **Core Web Vitals** y los validadores externos de datos estructurados después del despliegue. Si no hay suficientes datos de campo, no lo interpretes como aprobado. Para los CV, inspecciona sus dos URLs del sitemap si su aparición en Google forma parte del objetivo.

La [documentación de inspección de URLs](https://support.google.com/webmasters/answer/9012289?hl=es) diferencia la información del índice de la prueba en directo. Las [estadísticas de rastreo](https://support.google.com/webmasters/answer/9679690?hl=es) ayudan a comprobar el acceso del robot, que no puede inferirse solo desde este entorno.

## Pendientes ordenados por impacto y esfuerzo

| Orden | Acción | Impacto esperado | Esfuerzo |
| --- | --- | --- | --- |
| 1 | Revisar y autorizar el despliegue de estas correcciones; verificar después las mismas rutas públicas | Alto: activa las correcciones fuera del repositorio | Bajo |
| 2 | Inspeccionar canonicals y reenviar/comprobar sitemap en Search Console | Alto para detectar problemas reales de descubrimiento/indexación | Bajo, con acceso de propietario |
| 3 | Investigar TBT móvil, separando hidratación, tareas largas propias y analítica | Medio; debe medirse con varias corridas y datos de campo | Medio |
| 4 | Publicar el primer artículo original cuando esté listo | Habilita un blog con contenido real, sin relleno SEO | Editorial, variable |
| 5 | Confirmar manualmente LinkedIn y los destinos de Platzi protegidos | Higiene de referencias y credenciales | Bajo a medio |
| 6 | Ejecutar validadores externos y revisar Core Web Vitals tras publicar | Confirma lo que depende de Google y usuarios reales | Bajo; disponibilidad de datos variable |

## Referencias primarias

- [Google: construir y enviar un sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- [Google: noindex y acceso del rastreador](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
- [Google: ProfilePage](https://developers.google.com/search/docs/appearance/structured-data/profile-page).
- [Schema.org: Person](https://schema.org/Person), [about](https://schema.org/about) y [vocabulario usado para validar](https://schema.org/version/latest/schemaorg-current-https.jsonld).
- [OpenAI: rastreadores](https://developers.openai.com/api/docs/bots).
