# Guía de SEO y GEO para Nassican: ingeniero de sistemas y AI Engineer

Actualizada: 10 de septiembre de 2026.

**Objetivo:** que Jesús David Benavides Chicaiza, conocido como Nassican, sea identificado por su formación en ingeniería de sistemas y su trabajo en ingeniería de IA; aumentar su visibilidad ante reclutadores, colaboradores y clientes que buscan esas capacidades en español e inglés.

Esta es una guía de trabajo continuo para `https://www.nassican.com`. Complementa la [auditoría técnica](SEO-GEO-HALLAZGOS.md). Los ejemplos de especialidades y textos son propuestas editoriales: deben ajustarse a la experiencia y los proyectos que puedas demostrar. No se han medido volúmenes de búsqueda ni posiciones de tu sitio para las consultas propuestas.

## 1. Qué significa haber aprobado Rich Results

Reportaste que Rich Results Test muestra un resultado correcto. Eso valida aspectos del marcado compatible que la herramienta detectó en la URL examinada. No confirma la indexación de todas tus páginas, la exactitud de tus credenciales, tus posiciones ni que Google vaya a mostrar un resultado enriquecido. Google aclara que un marcado válido no garantiza su aparición. [Fuente: políticas de datos estructurados](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

Hay cuatro resultados diferentes que debemos seguir:

| Resultado | Cómo comprobarlo |
| --- | --- |
| La página funciona y se puede rastrear | Respuesta HTTP, robots y prueba de URL publicada. |
| Google ha indexado la página adecuada | Inspección de URL y canonical elegido en Search Console. |
| La página aparece para búsquedas relevantes | Consultas, impresiones, clics y posición por país/idioma. |
| Un asistente te menciona o cita | Consultas de prueba reproducibles, enlaces citados y visitas referidas. |

Ningún ajuste garantiza aparecer primero para `AI Engineer`. Trata esa consulta amplia como objetivo de largo plazo; empieza por reconocimiento de nombre, ubicación y especialidades demostradas. El éxito profesional incluye recibir contactos adecuados, no únicamente subir una posición.

## 2. Definir una identidad profesional coherente

### Propuesta de posicionamiento

**Ingeniería de sistemas como base profesional; ingeniería de IA aplicada como especialidad; desarrollo Full Stack como capacidad para convertirla en productos.**

Es una recomendación para tu caso: el código actual presenta experiencia de desarrollo web con Next.js, React, TypeScript, NestJS y PostgreSQL. Esa base puede conectar bien con aplicaciones que incorporen IA, pero el uso de herramientas de IA para programar no demuestra por sí solo que hayas construido sistemas de IA.

Tu presentación debe responder rápidamente:

1. Quién eres: Jesús David Benavides Chicaiza / Nassican.
2. Qué formación tienes: ingeniería de sistemas, indicando correctamente su estado.
3. Qué construyes y qué parte haces tú.
4. Dónde trabajas y qué disponibilidad real tienes.
5. Dónde se puede comprobar: proyectos, repositorios, demostraciones y publicaciones.

Usa el nombre completo en perfil y autoría. Puedes usar «Jesús Benavides» en títulos breves y «Nassican» como alias. Mantén una relación clara entre los tres en web, LinkedIn, GitHub y CV.

### Textos propuestos

**Si ya tienes proyectos de IA que sostengan esa especialidad:**

```text
Título de portada ES:
Jesús Benavides | Ingeniero de Sistemas y AI Engineer

Título de portada EN:
Jesús Benavides | AI Engineer & Systems Engineer

Cargo visible ES:
Ingeniero de sistemas enfocado en ingeniería de IA aplicada.

Presentación ES — adaptar a tus proyectos:
Soy Jesús David Benavides Chicaiza, también conocido como Nassican.
Desarrollo aplicaciones con inteligencia artificial y sistemas web.
En mis proyectos explico la arquitectura, las evaluaciones y las
decisiones que permiten llevar una solución desde la idea hasta su uso.

Presentación EN — adaptar a tus proyectos:
I'm Jesús David Benavides Chicaiza, also known as Nassican.
I build AI-powered applications and web systems. My case studies
document architecture, evaluations, and implementation decisions.
```

**Si estás construyendo todavía esa trayectoria**, una presentación más precisa sería «Ingeniero de sistemas y desarrollador Full Stack, enfocado en construir aplicaciones con IA». Después, actualízala cuando los casos publicados justifiquen la especialización.

En inglés, explica tu formación y tus tareas: `Systems Engineer` puede interpretarse de diferentes maneras según el mercado. No cambies el nombre de una titulación por otra distinta para perseguir una palabra clave.

### Punto concreto que corregir en Nassican

Los archivos `apps/web/src/lib/i18n/dictionaries/es.ts` y `en.ts` todavía tienen títulos, `hero.badge`, `hero.description` y textos de «Sobre mí» orientados a Full Stack. `Hero.tsx` usa el nombre del perfil, pero su cargo y presentación visibles provienen del diccionario.

**Cambiar el cargo en admin o el título SEO no actualiza por sí solo esos textos visibles.** Para alinear la portada hay que actualizar ambos diccionarios o implementar su edición desde admin. La guía no aplica ese cambio: primero deben quedar definidos el mensaje y las evidencias que lo sostienen.

## 3. Elegir búsquedas por intención, no por repetición

Trabaja con este mapa inicial. Son hipótesis que debes contrastar con resultados actuales y Search Console, no palabras con demanda o dificultad ya verificadas.

| Prioridad | Consultas de ejemplo | Página que debe responder |
| --- | --- | --- |
| 1 · Identidad | `Jesús David Benavides Chicaiza`, `Nassican`, `Jesús Benavides ingeniero de sistemas` | Portada y perfil profesional. |
| 2 · Identidad + especialidad | `Nassican AI Engineer`, `Jesús Benavides inteligencia artificial` | Portada y página de especialidad. |
| 3 · Profesional + contexto real | `AI Engineer Colombia`, `ingeniero de inteligencia artificial Colombia`, `AI engineer remote Colombia` | Página de especialidad, con ubicación y disponibilidad reales. |
| 4 · Capacidad demostrada | `desarrollador aplicaciones RAG`, `AI engineer TypeScript`, `integración LLM aplicaciones web` | Especialidad y casos que demuestren esas capacidades. |
| 5 · Problema concreto | `cómo evaluar un RAG en español`, `cómo medir el costo de un asistente con IA` | Artículos y experimentos originales. |
| Largo plazo · Consulta amplia | `AI Engineer`, `ingeniero de sistemas` | Depende de la intención que muestran los resultados: una definición, carrera o vacante puede encajar mejor que un portafolio. |

Antes de crear una página para una consulta:

- Mira qué busca resolver el usuario: aprender, contratar, encontrar una persona o buscar empleo.
- Revisa los resultados desde el país e idioma objetivo y anota qué tipos de páginas aparecen.
- Decide qué evidencia propia puedes aportar que ayude a esa persona.
- Asigna una página principal a esa intención; evita varias páginas casi iguales compitiendo entre sí.

No sacrifiques el nombre y la claridad de la portada para repetir `AI Engineer`. Si alguien busca a una persona, debe reconocer de inmediato quién eres y qué has hecho.

## 4. Organizar las páginas del sitio

### Estructura recomendada

| Ruta | Función | Acción |
| --- | --- | --- |
| `/` y `/en` | Identidad, formación, especialidad, mejores evidencias y contacto. | Alinear la presentación actual. |
| `/ai-engineer` y `/en/ai-engineer` | Explicar tu enfoque de IA aplicada, proyectos, proceso y disponibilidad. | Crear desde Páginas cuando exista contenido suficiente. Son rutas propuestas. |
| `/projects` y `/projects/<slug>` | Mostrar trabajo y decisiones de ingeniería. | Priorizar casos terminados y verificables. |
| `/blog` y `/blog/<slug>` | Resolver problemas concretos que has investigado o construido. | Publicar artículos vinculados a tus proyectos. |
| `/certificates` | Complementar la formación y permitir verificar certificados. | Mantener enlaces y fechas vigentes. |

Conserva las rutas existentes que ya reciben enlaces. No necesitas crear una página adicional por cada variante de «ingeniero», «AI», «IA» o cada ciudad.

La página de especialidad debe contener, como mínimo:

- Presentación breve: quién eres y qué tipo de sistemas de IA construyes.
- Problemas que sabes abordar, limitando las afirmaciones a tu experiencia real.
- Enlaces a casos de estudio y demostraciones.
- Explicación de cómo evalúas calidad, costo, latencia y fallos.
- Formación y recorrido relevantes, sin repetir todo el CV.
- Forma de contacto y disponibilidad comprobada para empleo, proyectos o colaboración.

Enlaza la página de especialidad desde portada o navegación; enlaza sus casos y artículos entre sí cuando ayuden a ampliar el tema. Usa textos descriptivos, como «evaluación del asistente documental», en lugar de enlaces ambiguos. [Fuente: guía SEO de Google](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

### Idiomas

En este proyecto, español se publica sin prefijo e inglés bajo `/en`. Al crear una página en admin, la ruta se guarda sin el prefijo de idioma. Completa las dos traducciones antes de publicar.

Cada versión debe ser útil por sí misma, tener su canonical propio y alternativos `hreflang` recíprocos. No hagas que inglés canonice a español. Adapta la redacción al público, manteniendo los mismos hechos y evidencias. [Fuente: versiones localizadas](https://developers.google.com/search/docs/specialty/international/localized-versions).

## 5. Demostrar que eres AI Engineer con proyectos

La principal inversión editorial debe ser documentar trabajo real. Un catálogo de herramientas o certificados, sin ejemplos de aplicación, deja demasiadas preguntas sin responder a quien quiere contratarte.

Tres líneas posibles, a elegir según lo que hayas construido o quieras desarrollar:

| Proyecto propuesto | Qué demostrar | Evidencia que publicar |
| --- | --- | --- |
| Asistente documental con recuperación de fuentes (RAG) | Ingesta, búsqueda, respuesta sustentada, permisos y límites. | Demo, arquitectura, conjunto de preguntas de evaluación, errores y referencias recuperadas. |
| Automatización con herramientas o agentes | Orquestación, controles, manejo de fallos y aprobación humana cuando corresponda. | Flujo real, trazas anonimizadas, pruebas de fallos y resultados frente al proceso anterior. |
| Funcionalidad de IA dentro de una aplicación web | Integración Full Stack, experiencia de usuario, observabilidad y operación. | Repositorio o extractos, despliegue, costo medido, tiempos y decisiones de diseño. |

Estas son propuestas, no una afirmación de que ya tengas esos proyectos ni una obligación de usar RAG o agentes. Elige problemas útiles y una especialidad que puedas mantener.

### Plantilla de caso de estudio

```markdown
# [Proyecto]: [problema que resuelve]

## Resumen
[Qué construí, para quién o para qué escenario y cuál fue mi aporte.]

## Contexto y restricciones
[Usuarios, datos, alcance, presupuesto y límites relevantes.]

## Mi responsabilidad
[Trabajo propio, colaboración y contribuciones de terceros.]

## Arquitectura y decisiones
[Componentes, flujo de datos, alternativas evaluadas y motivos.]

## Evaluación
[Datos de prueba, número de casos, criterios, baseline y procedimiento.]

## Resultados
[Métricas medidas, fecha y condiciones. Enlazar evidencia reproducible.]

## Fallos, limitaciones y mejoras
[Dónde falla y qué queda pendiente.]

## Código, demo y fuentes
[Enlaces accesibles y explicación de lo que no puede publicarse.]
```

Si informas «reduje el costo un 30 %», explica costo de qué, frente a qué versión, en cuántas pruebas y bajo qué condiciones. Separa una prueba local de un resultado de producción. No inventes cifras para completar la plantilla ni publiques datos confidenciales.

Cuando el repositorio sea privado, puedes ofrecer un diagrama, una demo con datos sintéticos y una explicación técnica suficiente para evaluar tu contribución.

## 6. Publicar artículos que apoyen la especialidad

Organiza el blog alrededor de dos o tres temas que puedas sostener con experiencia propia. Para tu base Full Stack, una línea inicial posible es **construcción y evaluación de aplicaciones con IA**.

Ideas de artículos, sujetas a experimentación real:

1. Cómo evalué las respuestas de un asistente documental en español.
2. Qué falló al incorporar un LLM a una aplicación con Next.js.
3. Cómo medí costo por consulta y latencia de una funcionalidad de IA.
4. Cuándo una búsqueda convencional fue suficiente y cuándo necesité RAG.
5. Cómo probé los permisos de acceso a documentos en un asistente.
6. Qué aprendí al comparar dos configuraciones con el mismo conjunto de pruebas.

Para cada artículo:

- Responde una pregunta concreta al inicio.
- Explica el contexto, el método y la evidencia propia.
- Incluye ejemplos, código o tablas cuando realmente aclaren el resultado.
- Atribuye las ideas de terceros y enlaza fuentes originales cerca de las afirmaciones.
- Muestra autor, publicación y fecha de revisión cuando hubo cambios sustanciales.
- Enlaza el proyecto relacionado y ofrece un siguiente paso útil.
- Revisa técnicamente las dos versiones lingüísticas.

No hay un número mágico de palabras ni una frecuencia que garantice posiciones. Como ritmo personal de trabajo, propongo empezar con **un artículo sólido cada dos semanas** y ajustarlo a tu capacidad. La IA puede ayudar a redactar, pero debes verificar código, citas y afirmaciones antes de firmarlas. [Fuente: contenido útil y fiable](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

## 7. Qué mantener para GEO y respuestas de IA

En esta guía, GEO significa facilitar que sistemas de respuesta encuentren, comprendan y puedan citar información fiable sobre ti y tu trabajo.

### Contenido fácil de identificar y citar

- Mantén una biografía visible que relacione nombre, alias, profesión y especialidad.
- Introduce los casos con un resumen que pueda entenderse fuera del contexto del sitio.
- Escribe afirmaciones precisas y verificables; evita «experto en todo» o «el mejor».
- Explica términos y siglas la primera vez que aparecen.
- Incluye resultados con método y limitaciones, no solo conclusiones.
- Publica las evidencias importantes como texto HTML, aunque también exista un PDF o video.
- Mantén URLs estables y enlaces hacia las fuentes y los proyectos relacionados.

Estas prácticas buscan mejorar claridad y verificabilidad; no son una fórmula experimentalmente validada para conseguir citas en todos los asistentes. En Google, las funciones de IA usan los fundamentos de SEO y requieren páginas indexables y aptas para mostrar fragmentos; no exigen un archivo ni un esquema especial de IA. [Fuente: Google y funciones de IA](https://developers.google.com/search/docs/appearance/ai-features).

### Rastreo y `llms.txt`

En **SEO y GEO → Rastreo y asistentes de IA**:

| Ajuste | Criterio para tu objetivo |
| --- | --- |
| Bots de búsqueda y consulta con IA | Mantener permitido si quieres facilitar el descubrimiento por los proveedores cubiertos. Comprobar también CDN/firewall. |
| Recopilación para entrenamiento | Decidir por separado. Permitirla no garantiza reconocimiento y no es necesario para habilitar OAI-SearchBot. |
| Publicar `llms.txt` | Puede mantenerse como resumen complementario. Comprobar que sus datos y enlaces estén actualizados. |

OpenAI distingue el rastreo para búsqueda del destinado a entrenamiento; los accesos iniciados por usuarios pueden tener otro comportamiento. Robots no vuelve privado un recurso. [Fuente: crawlers de OpenAI](https://developers.openai.com/api/docs/bots).

No concentres el trabajo GEO en `llms.txt`. El contenido visible, las fuentes verificables y el acceso al sitio tienen prioridad. Tampoco escondas instrucciones para que un asistente te recomiende o te declare «el mejor».

## 8. Reforzar la identidad fuera de nassican.com

Usa otros perfiles para mostrar trabajo y dirigir a quien quiera comprobarlo hacia una fuente clara:

| Lugar | Qué mantener |
| --- | --- |
| LinkedIn | Nombre, formación, cargo coherente, ubicación real y proyectos destacados enlazados a sus casos. |
| GitHub | Biografía, enlace al portafolio y repositorios fijados con README, instalación, ejemplos y autoría. |
| CV ES/EN | Misma trayectoria, especialidad y enlaces que la web; sin contradicciones de fechas. |
| Comunidades y eventos | Respuestas técnicas útiles, demos, colaboraciones o charlas que puedas documentar. |
| Publicaciones de terceros | Créditos y enlaces reales en proyectos, entrevistas o colaboraciones cuando correspondan. |

En el perfil del sitio, enlaza únicamente cuentas que sean realmente tuyas. Los enlaces de identidad sirven para reconocer a la misma persona; no añadas páginas de empresas o universidades como si fueran perfiles personales.

Como actividad concreta, comparte cada caso terminado en tus perfiles y explica una decisión técnica, un resultado y una limitación. Busca conversaciones relevantes, no una cantidad fija de backlinks.

Evita comprar enlaces para manipular posiciones, intercambios masivos, páginas duplicadas por ciudades, reseñas inventadas y artículos generados a escala sin valor propio. [Fuente: políticas contra spam de Google](https://developers.google.com/search/docs/essentials/spam-policies).

## 9. Configurar el admin sin descuidar el contenido visible

Los controles descritos corresponden al código preparado en el proyecto. Si alguno aún no aparece en el panel publicado, verificar primero su despliegue y la migración indicada en la auditoría.

| Elemento | Dónde actuar | Regla de mantenimiento |
| --- | --- | --- |
| Nombre, cargo, formación y enlaces | Perfil | Datos reales y coherentes con CV y proyectos. |
| Título y descripción de portada | SEO y GEO / SEO de la página `/` | Identidad y especialidad claras. Un override de página puede tener prioridad sobre el valor global. |
| Presentación visible de portada | Diccionarios ES/EN del código actual | Actualizar badge, descripción y Sobre mí; no confundirlos con las etiquetas SEO. |
| Página de especialidad | Contenido → Páginas | Crear una ruta sin prefijo; completar los dos idiomas y enlazarla desde el sitio. |
| SEO por contenido | Blog / Proyectos → idioma → SEO | Título único y descripción fiel; vacío usa el contenido como respaldo. |
| Imagen social | Portada del contenido / imagen global | Imagen representativa que cargue y se vea bien al compartir. |
| Indexación | `noindex` por página/idioma | Desactivado en contenido que quieras posicionar. Usarlo deliberadamente en páginas públicas que no quieras en búsquedas. |
| Redirecciones | SEO → Redirecciones | Revisar antes de cambiar rutas; el módulo actual actúa sobre direcciones que de otro modo darían 404. |

Puedes usar `%s | Jesús Benavides` como plantilla general de títulos; revisa el resultado completo para evitar repetir el nombre. La portada actual usa título absoluto, por lo que debes escribirlo completo.

Escribe descripciones que ayuden a decidir si visitar la página. Los rangos de aproximadamente 50–60 caracteres para títulos y 140–160 para descripciones son orientaciones de edición, no límites ni garantías de Google. No inviertas tiempo en llenar `meta keywords`: Google no utiliza esa etiqueta para posicionamiento. [Fuente: guía SEO de Google](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

## 10. Lista obligatoria antes de publicar o modificar una página

### Contenido y posicionamiento

- [ ] La página tiene un propósito y un público identificables.
- [ ] El título, la introducción y los encabezados describen su contenido.
- [ ] El nombre y la especialidad aparecen naturalmente cuando son relevantes.
- [ ] Cada afirmación de experiencia, resultado o credencial tiene respaldo.
- [ ] Se distingue claramente mi contribución de la de terceros.
- [ ] Las fuentes, código y enlaces funcionan.
- [ ] El contenido importante está en HTML, no únicamente en imágenes o PDF.
- [ ] Español e inglés están completos y revisados.
- [ ] Existe al menos un enlace interno útil que permita descubrir la página.
- [ ] Hay un siguiente paso claro: ver proyecto, leer evaluación o contactar.

### SEO técnico

- [ ] La URL pública responde 200 y muestra el contenido correcto.
- [ ] Canonical apunta a la URL final correspondiente, sin redirecciones evitables.
- [ ] Los alternativos de idioma corresponden a traducciones existentes e indexables.
- [ ] Robots, Googlebot y `X-Robots-Tag` no contienen bloqueos accidentales.
- [ ] La URL aparece en el sitemap cuando corresponde; borradores/noindex no aparecen.
- [ ] `lastmod` y fecha visible reflejan cambios reales, no una actualización cosmética.
- [ ] El título y la descripción resultantes son los esperados después de aplicar overrides.
- [ ] OG/Twitter y sus imágenes cargan correctamente.
- [ ] Los datos estructurados coinciden con el contenido visible.
- [ ] Rich Results se revisa si cambió el marcado; no se añade un tipo ajeno al contenido solo para obtener un resultado especial.
- [ ] Se verifica la vista móvil, navegación, contraste, imágenes y estabilidad del diseño.
- [ ] Al cambiar una URL, la anterior redirige directamente a su equivalente y se actualizan enlaces internos.

No bloquees una URL en robots esperando que Google lea su `noindex`: si no puede rastrearla, puede no ver esa directiva. No uses `noindex` como mecanismo de privacidad. [Fuente: directiva noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

### Rendimiento

Mide LCP, INP y CLS con PageSpeed/CrUX cuando haya suficientes datos reales. Los umbrales de experiencia «buena» son LCP ≤ 2,5 s, INP ≤ 200 ms y CLS ≤ 0,1, evaluados en el percentil 75. Separa móvil de escritorio y distingue datos de campo de pruebas de laboratorio. [Fuente: Web Vitals](https://web.dev/articles/vitals).

Una puntuación de laboratorio alta no prueba por sí sola la experiencia de todos tus visitantes ni garantiza posiciones. Si el HTML pesado o una imagen afecta a la experiencia, corrige el problema medido antes de sumar elementos a la portada.

## 11. Medir SEO y GEO de forma útil

### SEO: panel de seguimiento mensual

En Search Console, empieza con el sitio verificado y su sitemap. Segmenta por página, consulta, país y dispositivo. Para idiomas, usa las rutas ES/EN.

| Grupo | Ejemplos | Qué observar |
| --- | --- | --- |
| Marca | Nassican, nombre completo y variantes. | Si aparece la página adecuada y se reconoce tu identidad. |
| Profesión y especialidad | Ingeniero de sistemas, AI Engineer con nombre o contexto. | Si aumentan las impresiones relevantes de tu perfil/especialidad. |
| Problemas técnicos | Consultas relacionadas con tus artículos y proyectos. | Qué contenido empieza a atraer búsquedas sin mencionar tu nombre. |
| Conversión | Contactos, solicitudes profesionales, descargas de CV. | Si la visibilidad se convierte en oportunidades adecuadas. |

Compara inicialmente ventanas de 28 días, registrando también las fechas de publicación. Con poco tráfico, amplía el periodo. La posición media debe interpretarse dentro de cada consulta y segmento, no como un ranking único del sitio. [Fuente: informe de rendimiento de Search Console](https://support.google.com/webmasters/answer/7576553).

Registrar un clic en contacto o descarga de CV en GA4 requiere instrumentar ese evento: tener el identificador de medición guardado no significa que todos esos objetivos ya estén implementados. No envíes datos personales de formularios a analítica.

### GEO: conjunto pequeño de consultas repetibles

Ejemplos para revisar mensualmente, ajustando las especialidades a tus proyectos:

```text
¿Quién es Jesús David Benavides Chicaiza, conocido como Nassican?
¿En qué trabaja Nassican y qué proyectos de inteligencia artificial tiene?
Busco un AI Engineer en Colombia con proyectos públicos de aplicaciones con IA.
Busco ejemplos de evaluación de asistentes documentales en español.
Who is Jesús Benavides, also known as Nassican?
Find AI engineers in Colombia with public AI application case studies.
```

Prueba consultas de marca y sin marca por separado. Una respuesta correcta cuando incluyes tu nombre no demuestra que te recomienden espontáneamente. No pegues la URL ni entregues tu biografía cuando estés midiendo descubrimiento espontáneo.

Registra cada observación:

| Fecha | Plataforma / modo | Consulta exacta | País / idioma | ¿Menciona? | ¿Cita URL? | URL citada | ¿Datos correctos? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AAAA-MM-DD | Sistema y búsqueda activada/desactivada | Texto completo | Contexto de prueba | Sí/No | Sí/No | Enlace o vacío | Notas |

Usa conversaciones nuevas y conserva las condiciones todo lo posible. Registra variaciones en lugar de seleccionar solo respuestas favorables. No existe una posición GEO única equivalente al ranking clásico.

Puedes calcular **porcentaje de respuestas que mencionan tu marca** y **porcentaje que enlazan tu web** dentro de tu muestra. Son indicadores de ese conjunto de pruebas, no cuota de mercado. Combínalos con referencias recibidas en analítica y calidad de los contactos. Google agrega el tráfico de sus funciones de IA al tipo de búsqueda Web en Search Console; ese informe no equivale a una medición completa de todos los asistentes. [Fuente: medición de funciones de IA](https://developers.google.com/search/docs/appearance/ai-features).

## 12. Rutina permanente y cómo decidir qué mejorar

| Frecuencia / momento | Trabajo | Evidencia de que se hizo |
| --- | --- | --- |
| Cada publicación | Completar la lista anterior, revisar idiomas y enlaces. | URL pública revisada y anotación de publicación. |
| Después de un despliegue | Comprobar portada, una página de cada tipo, robots, sitemap, imágenes y ambos idiomas. | URLs y respuestas correctas; ningún bloqueo accidental. |
| Semanal, 20–30 minutos orientativos | Revisar errores de indexación, enlaces rotos y contactos; elegir una mejora concreta. | Incidencia resuelta o siguiente acción anotada. |
| Cada dos semanas, si hay material | Publicar o mejorar un artículo basado en trabajo real. | Artículo con evidencia y enlaces internos. |
| Mensual | Comparar Search Console, revisar la muestra GEO, biografías y CV. | Registro mensual con cambios, resultados e hipótesis. |
| Trimestral | Revisar arquitectura de contenidos, rendimiento, experiencia demostrada y prioridades. | Plan actualizado; contenido obsoleto corregido o consolidado. |

### Diagnóstico práctico

| Observación | Revisar antes de actuar |
| --- | --- |
| Una página no está indexada | Rastreo, canonical, noindex, errores, contenido y enlaces internos. Evitar solicitar indexación repetidamente sin corregir la causa. |
| Está indexada, pero no tiene impresiones relevantes | Intención, claridad del tema, evidencia aportada y relaciones con otras páginas. |
| Tiene impresiones, pero pocos clics | Consulta concreta, posición, título y descripción. No atribuir todo al título. |
| Recibe visitas, pero nadie contacta | Ajuste al público, calidad de los proyectos, confianza y facilidad de contacto. |
| Te mencionan, pero describen otra especialidad | Coherencia entre portada, perfiles, CV, casos y fuentes externas. |
| Te citan al incluir tu URL, pero no espontáneamente | Distinguir capacidad de leer el sitio de descubrimiento; trabajar contenido y presencia relevante. |

No cambies títulos, rutas y estrategia cada pocos días por una búsqueda aislada. Anota la modificación y deja tiempo suficiente para observarla; el plazo depende del rastreo y del volumen disponible, no de un calendario garantizado.

## 13. Plan inicial de 90 días

Este calendario organiza el trabajo; no promete primeras posiciones en 90 días.

| Periodo | Prioridad | Entregable verificable |
| --- | --- | --- |
| Días 1–7 | Identidad y línea base. Revisar formación, especialidad y disponibilidad; guardar métricas iniciales. | Mensaje profesional ES/EN definido; consultas objetivo y estado inicial registrados. |
| Días 8–21 | Alinear portada, LinkedIn, GitHub y CV. Crear la página de especialidad si está respaldada. | Presentación coherente y enlaces a evidencia; rutas revisadas en Search Console. |
| Días 22–45 | Documentar un proyecto de IA con profundidad. | Un caso de estudio completo, demo o evidencia equivalente y un artículo derivado. |
| Días 46–60 | Ampliar una capacidad distinta o profundizar la evaluación del primer proyecto. | Segundo caso o evaluación sustancial; traducciones revisadas. |
| Días 61–90 | Mejorar según datos y compartir trabajo en espacios relevantes. | Comparación frente a la línea base, revisión GEO y siguiente trimestre priorizado. |

Metas de ejecución sugeridas para ese periodo: una portada coherente, una página de especialidad útil, uno o dos casos de IA sólidos, tres o cuatro artículos propios y un registro mensual de SEO/GEO. Reduce cantidades si comprometen la calidad.

Para consultas concretas, puedes fijar como aspiración entrar en top 10 y luego top 3 **por país, idioma y consulta**, una vez conocida la línea base. No establezcas como indicador único «ser primero para AI Engineer en todo el mundo».

## 14. Las cinco prioridades para Nassican

1. Alinear el contenido visible de la portada con ingeniería de sistemas y tu especialidad real en IA; no limitar el cambio a metadatos.
2. Publicar evidencia de cómo construyes y evalúas sistemas de IA, aprovechando tu base de ingeniería de software.
3. Crear una página clara de especialidad y conectar desde ella proyectos, artículos y contacto.
4. Mantener la misma identidad profesional en web, LinkedIn, GitHub y CV.
5. Medir reconocimiento de marca, búsquedas sin marca y oportunidades profesionales por separado, con una rutina sostenible.

La pregunta de revisión antes de publicar debe ser: **«¿Esta página ayuda a una persona a entender por qué soy adecuado para este trabajo y le permite comprobarlo?»**
