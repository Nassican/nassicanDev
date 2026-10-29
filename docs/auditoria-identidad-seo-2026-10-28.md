# Auditoría e implementación de identidad y SEO de Nassican

Fecha: 28 de octubre de 2026. Dominio público auditado: https://www.nassican.com/. Implementación local lista para revisión, sin despliegue, cambios de DNS, credenciales o configuración de producción.

## Cambios implementados

El repositorio confirma un monorepo npm con Next.js 16, React 19, Prisma y PostgreSQL/Neon. La web combina HTML estático con regeneración y rutas de servidor. El español se publica desde `/`, el inglés desde `/en`; `/es` redirige a `/`. Se conservó esta arquitectura.

La identidad utilizada procede del perfil existente: **Jesús David Benavides Chicaiza**, con el título profesional guardado **Ingeniero de Sistemas**, y los perfiles públicos que ya constaban en el contenido: [GitHub](https://github.com/Nassican) y [LinkedIn](https://www.linkedin.com/in/jesusbenavidesmark/). No se añadieron empleadores, títulos académicos, ciudades, clientes, cifras ni redes inventadas.

El inicio explica explícitamente: «Nassican es la marca personal y el portafolio profesional de Jesús David Benavides Chicaiza». Una página estable `/profile` y su traducción `/en/profile` reúnen la trayectoria, formación, tecnologías y proyectos ya publicados, con enlaces a proyectos, contacto, CV y perfiles públicos. Se enlaza desde Sobre mí y el pie de página.

El título del inicio conserva el contenido editorial existente y agrega Nassican. El perfil utiliza el nombre completo y el cargo real. Las descripciones, el texto visible y el grafo de entidades comparten fuentes. No se reemplazó la configuración editorial ni se escribieron ajustes en la base real.

El JSON-LD mantiene una sola entidad `Person`, con `@id` estable `https://www.nassican.com/#person`. `ProfilePage.mainEntity` referencia esa misma persona. Se mantienen `WebSite`, páginas y relaciones con autor/proyectos; no se añadió una `Organization` artificial. Los proyectos con repositorio público válido pueden usar `SoftwareSourceCode`; los demás se describen como `CreativeWork`. No se presentan Docker u otras herramientas como lenguajes de programación.

### Archivos modificados y propósito

Rutas relativas a la raíz. La lista de cobros y documentos está en [cotizaciones-cuotas-cobros.md](cotizaciones-cuotas-cobros.md).

| Archivo                                            | Cambio                                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/identity.ts`                     | Texto de identidad bilingüe, títulos y filtrado de perfiles proporcionados.                                                      |
| `apps/web/src/lib/home-identity.ts`                | Fuente compartida y cacheada para identidad/metadatos del inicio.                                                                |
| `apps/web/src/app/[locale]/page.tsx`               | Consume esa identidad en metadatos, Sobre mí y JSON-LD.                                                                          |
| `apps/web/src/app/[locale]/profile/page.tsx`       | Perfil profesional estable con HTML estático, metadatos propios y entidad `ProfilePage`.                                         |
| `apps/web/src/components/sections/About.tsx`       | Relación explícita marca/persona y enlace descriptivo al perfil.                                                                 |
| `apps/web/src/components/Footer.tsx`               | Enlace permanente al perfil; CV obtenidos de la lista real, sin asumir dos posiciones; nombres accesibles procedentes del texto. |
| `apps/web/src/lib/data/profile.ts`                 | Expone la fecha real de actualización y deduplica lecturas durante la petición.                                                  |
| `apps/web/src/lib/seo.ts`                          | Persona fiel a la fuente, URL de perfil, habilidades reales, tipos de proyecto y relaciones coherentes.                          |
| `apps/web/src/app/[locale]/layout.tsx`             | Pasa habilidades documentadas al grafo; retira el identificador de Twitter no verificado.                                        |
| `apps/web/src/lib/discovery.ts`                    | Incluye el perfil en el descubrimiento y conserva exclusiones editoriales `noindex`.                                             |
| `apps/web/src/app/sitemap.ts`                      | Perfil en el sitemap y fecha real de modificación, sin inventar una fecha de actualización.                                      |
| `apps/admin/src/lib/pages.ts`                      | Reconoce `/profile` en el editor de metadatos existente; no se ejecutó su siembra en la base habitual.                           |
| `apps/web/src/components/sections/Hero.tsx`        | Los nombres accesibles incluyen el texto visible de sus enlaces.                                                                 |
| `apps/web/src/components/sections/Education.tsx`   | El enlace a certificados usa su texto visible como nombre accesible.                                                             |
| `apps/web/src/components/sections/Projects.tsx`    | Igual corrección en el enlace al listado de proyectos.                                                                           |
| `apps/web/src/components/sections/LatestPosts.tsx` | Igual corrección en el enlace al blog.                                                                                           |
| `apps/web/src/components/sections/Contact.tsx`     | Correo, redes y CV conservan sus textos visibles en el nombre accesible.                                                         |
| `apps/web/src/components/ProjectCard.tsx`          | El enlace de caso de estudio incluye el texto visible y el nombre del proyecto.                                                  |
| `apps/web/src/lib/seo.test.ts`                     | Pruebas de identidad, fuentes de habilidades, tipos, imagen, URL del perfil y descubrimiento.                                    |
| `scripts/check-public-identity.cjs`                | Revisión reproducible y de solo lectura de HTML, rutas, metadatos, JSON-LD, robots, teclado y presentación.                      |
| `docs/auditoria-identidad-seo-2026-10-28.md`       | Evidencia, diferencias local/producción y pasos pendientes.                                                                      |

## Problemas encontrados

### En producción antes de modificar el código

- El título del inicio identificaba al desarrollador, pero no contenía Nassican.
- La relación marca/nombre no se explicaba de forma directa en Sobre mí. No existía `/profile`: respondía 404.
- La imagen de `Person` apuntaba al logo de la marca. Ahora solo se incluye un avatar personal apropiado disponible; se omite si la fuente corresponde al logo.
- Había un usuario de Twitter/X fijado en el código sin respaldo en los perfiles proporcionados. Se retiró; se mantienen las Twitter Cards.
- El grafo infería idiomas personales desde los idiomas de la interfaz, residencia desde empleos, tecnologías desde un registro estático y formación completada sin distinguir el estado. Esas inferencias se retiraron o se restringieron a datos documentados.
- Algunos enlaces tenían `aria-label` que sustituían «Ver proyectos», «Contactar» o «Ver caso de estudio» por otros textos. Lighthouse señaló la discrepancia; se corrigió sin cambiar la distribución visual.

### Elementos que ya funcionaban y se conservaron

- HTTP y el dominio sin www redirigen mediante 308 al dominio público HTTPS con www; este sí coincide con la configuración desplegada.
- El inicio entrega nombre, contenido principal, enlaces y JSON-LD en HTML. No dependía de JavaScript para descubrir la identidad básica.
- Ya existían canonical, hreflang, Open Graph, Twitter Cards, favicons, sitemap, robots y una ruta `llms.txt`.
- Los 14 recursos del sitemap público respondieron 200; otras 2 URLs internas detectadas fuera del sitemap también respondieron correctamente. No se encontraron enlaces internos rotos en ese conjunto auditado. Esto no constituye un rastreo ilimitado de toda URL posible ni una comprobación de indexación.
- El canonical del inicio `https://www.nassican.com` y la URL de sitemap `https://www.nassican.com/` son equivalentes. No se reportan como duplicado o fallo.
- No se detectaron `noindex` accidentales o cabeceras de bloqueo en las páginas públicas examinadas. La respuesta 404 de rutas inexistentes se mantuvo.

## Rastreo e IA

No se cambiaron las preferencias existentes. En producción estaban permitidos tanto el grupo de búsqueda de IA como el de entrenamiento, y el nuevo código conserva exactamente sus directivas. Las rutas API permanecen excluidas y no se bloquean CSS/JS.

Según la [documentación oficial de OpenAI](https://developers.openai.com/api/docs/bots), **OAI-SearchBot** se utiliza para búsqueda y **GPTBot** para entrenamiento; sus controles son independientes. **ChatGPT-User** corresponde a accesos iniciados por usuarios y no decide la inclusión en Search. Permitir un rastreador no garantiza que una página se rastree, se indexe, se cite ni aparezca en una respuesta.

La ruta `llms.txt` ya existía. No se creó otro archivo ni una FAQ artificial, y no se presenta ese archivo como requisito de ChatGPT. El perfil entra en el mecanismo de descubrimiento existente.

Los dominios de vista previa y el servidor local conservan su protección de robots. No se modificó la política global para mejorar una puntuación de Lighthouse.

## Pruebas realizadas

### Código y compilación

| Comando                                   | Resultado                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run typecheck`                   | Correcto en los workspaces.                                                                                                     |
| `npm.cmd run lint`                        | Sin errores de código. Se corrigió el único aviso nuevo de parámetro sin uso.                                                   |
| `npm.cmd test`                            | 418 pruebas correctas, de las cuales 10 corresponden al módulo SEO.                                                             |
| `npm.cmd run build`                       | Admin y web compilaron para producción. `/profile` y `/en/profile` se generaron como HTML estático.                             |
| `node scripts/check-public-identity.cjs`  | Correcto sobre la compilación local: 16 recursos del sitemap, incluidos 2 CV; 14 páginas con HTML, metadatos y JSON-LD válidos. |
| `git -c core.safecrlf=false diff --check` | Sin errores de espacios.                                                                                                        |

Para probar el dominio real sin editar `.env`, se pasó `NEXT_PUBLIC_SITE_URL=https://www.nassican.com` únicamente al proceso local de compilación/servidor. El `.env` local conserva su URL de desarrollo. No debe confundirse esa variable local con un problema de la configuración desplegada, que ya devuelve canonical HTTPS con www.

El script desactiva JavaScript **antes** de navegar: comprueba H1 único, nombre exacto, descripciones, canonical, títulos sociales y JSON-LD. Revisa que exista una sola persona y que el perfil la referencie. Comprueba las preferencias de robots mediante una solicitud local con cabecera de host canónico, sin cambiar las preferencias. También prueba un 404 real, un enlace al contacto, navegación inicial con Tab, anchos 1440/390 y temas claro/oscuro. Se revisaron capturas con los colores estabilizados tras las transiciones; no hubo desbordamiento horizontal ni excepciones de página.

### Rendimiento y límites de medición

Se instaló Lighthouse únicamente en TEMP para la auditoría; no se añadieron dependencias al repositorio.

| Medición móvil de laboratorio         | Rendimiento | Accesibilidad | Buenas prácticas | SEO |   LCP | CLS |    TBT |
| ------------------------------------- | ----------: | ------------: | ---------------: | --: | ----: | --: | -----: |
| Inicio público anterior a los cambios |          96 |           100 |              100 | 100 | 1,4 s |   0 | 200 ms |
| Nuevo perfil en localhost             |          90 |           100 |               96 |  69 | 1,2 s |   0 | 420 ms |

El SEO 69 del perfil local incluye el bloqueo **intencional** de `/robots.txt` para un host no canónico. La comprobación HTTP independiente con host canónico sí verifica las directivas permitidas y su igualdad con producción. Un segundo intento con cabecera adicional de Lighthouse mantuvo ese diagnóstico local; no se presenta su puntuación como la del sitio publicado. Buenas prácticas 96 incluye el 404 local de `/_vercel/insights/script.js`, un endpoint del proveedor disponible en el despliegue y ausente en `next start` local; no hubo una excepción de aplicación correspondiente. La segunda medición obtuvo rendimiento 91/TBT 370 ms, ilustrando la variación normal del laboratorio.

No se consultaron Search Console, inspección de URLs, CrUX ni datos de usuarios reales. No se midió INP real ni se afirma que el sitio apruebe Core Web Vitals en campo. Lighthouse tampoco verifica posiciones, menciones en ChatGPT ni el índice de Google. No se consumieron informes ni créditos de Ubersuggest.

La compilación conserva avisos anteriores sobre la convención `middleware` de Next y la antigüedad de `baseline-browser-mapping`; no impiden compilar. No se cambiaron de forma ajena al objetivo.

## Acciones que requieren mi intervención

1. Revisar y autorizar la publicación del código. El dominio público todavía sirve la versión anterior y `/profile` no existirá allí hasta desplegar.
2. Después de publicar, verificar `/profile`, `/en/profile`, robots y el sitemap en el dominio real. Ejecutar Lighthouse en ese despliegue para medir el resultado sin las limitaciones locales.
3. Si tienes acceso de propietario, verificar Search Console, enviar o reenviar `https://www.nassican.com/sitemap.xml` e inspeccionar las URLs importantes. No se enviaron solicitudes a servicios externos en tu nombre.
4. Mantener el enlace canónico al portafolio en tus perfiles públicos y una presentación coherente con el nombre verificado, cuando decidas editar esos perfiles.
5. Las migraciones de cobros ya se aplicaron después de la autorización independiente del propietario; véase el documento de cotizaciones. La publicación del código sigue siendo un paso separado.

## Datos que necesito proporcionar

No faltan datos obligatorios para la identidad implementada: se reutilizó el nombre completo y el contenido profesional existente. Si quieres incluir una foto de la persona en el grafo, hace falta un retrato público apropiado cuando no exista un avatar personal configurado; no se usará el logo como sustituto. No se necesita inventar ni aportar una cuenta de X.

Los datos de identificación y banco para documentos comerciales deben completarse en la pantalla privada de cobros; no se publican en el perfil ni hace falta enviarlos por chat.

## Prioridades pendientes

| Prioridad  | Acción                                                                       | Impacto esperado / esfuerzo                                                                          |
| ---------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1          | Revisar y publicar estos cambios con autorización                            | Hace accesibles las señales de identidad y el perfil; esfuerzo operativo bajo.                       |
| 2          | Validar las nuevas URLs públicas y enviar sitemap en Search Console          | Permite comprobar descubrimiento y detectar errores reales; esfuerzo bajo con acceso de propietario. |
| Completada | Aplicar las dos migraciones comerciales autorizadas                          | Cuotas y cobros persistentes habilitados; respaldo completo y restauración local verificados.        |
| 4          | Repetir medición móvil en producción y revisar datos de campo cuando existan | Prioriza optimizaciones por evidencia, sin sustituir tecnologías que ya funcionan.                   |
| 5          | Mantener casos de estudio y perfiles públicos con datos reales               | Refuerza la coherencia a medida que se publican trabajos verificables; trabajo editorial continuo.   |

## Referencias primarias

- [Google Search Central: guía de SEO](https://developers.google.com/search/docs/fundamentals/seo-starter-guide): contenido accesible, enlaces y metadatos útiles, sin garantías de posición.
- [Google: datos estructurados de ProfilePage](https://developers.google.com/search/docs/appearance/structured-data/profile-page): página de perfil y entidad principal.
- [Schema.org: Person](https://schema.org/Person): propiedades y relaciones de la persona.
- [OpenAI: bots y controles de rastreo](https://developers.openai.com/api/docs/bots): propósitos distintos de búsqueda, entrenamiento y acceso iniciado por el usuario.
- [Chrome: Lighthouse](https://developer.chrome.com/docs/lighthouse/overview): auditoría automatizada de laboratorio y alcance de las comprobaciones.
