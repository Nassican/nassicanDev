# Planeación del panel

Lo que falta en `app.nassican.com`, en el orden en que conviene hacerlo. Cada
punto dice por qué existe, qué se hace y cómo se sabe que quedó bien. Lo ya
construido está documentado en `CLAUDE.md`; esto es solo lo pendiente y lo
decidido.

Revisado el 4 de octubre de 2026.

---

## Decidido: lo que no se va a hacer

- **Sin app propia para el teléfono.** El panel se instala con el acceso directo
  normal del navegador («Añadir a pantalla de inicio»). Ni manifiesto, ni service
  worker, ni modo offline.
- **Sin correos.** Los avisos siguen viviendo en el dashboard. Nada sale del panel
  por email.

---

## 0. Subir lo que ya está hecho

**Por qué.** Varias sesiones de trabajo siguen sin commit: copias, papelera,
restauración, ISBN, pegar imágenes, salud del sitio, suscripciones, bitácora,
fechas con calendario, listas en bloque y la vista móvil. Las migraciones **sí**
están aplicadas en producción —son aditivas—, pero cuanto más tiempo pase, más
difícil es revisar el cambio.

**Qué.** Commits por tema, no uno gigante:

1. Copias de seguridad, restauración desde el panel y puntos de restauración.
2. Papelera.
3. ISBN (solo Open Library), pegar imágenes y `/api/health` del sitio.
4. Suscripciones, bitácora y el selector de fechas.
5. Listas en bloque, nombres de día adaptables y vista móvil.

**Cómo se verifica.** `npm run build` en limpio, con `dev:admin` detenido (por el
`EPERM` de Prisma). Después, desplegar y abrir `www.nassican.com/api/health/db`.

---

## 1. Vista móvil

### Hecho

| | qué se hizo |
| --- | --- |
| Zoom de iOS al tocar un campo | una regla en `globals.css` pone los campos a 16 px en pantallas táctiles; cubre los 158 a la vez |
| ⌘K sin teclado | botón «Buscar» con lupa en la cabecera, en todos los tamaños |
| Botones demasiado pequeños | los botones de solo icono tienen al menos 40 × 40 px de área táctil, también con una sola regla |
| Explicaciones solo en `title` (Usuarios) | por qué un rol o un acceso no se puede cambiar, ahora como texto visible |
| Acciones que solo aparecían con el ratón | las de las notas de la bitácora, visibles siempre al tacto |
| Movimientos, 42 rem de ancho | lista legible en el teléfono, con selector para ordenar; la tabla sigue en pantallas medianas y grandes |
| Calendario en iOS | al tacto, el selector nativo recibe el toque directamente en lugar de abrirse por código |
| Bitácora en el teléfono | el formulario y el resumen, plegados tras un botón; la semana se ve sin desplazarse |
| Suscripciones | precio y renovación sin ancho fijo, buscador a todo el ancho |

### Pendiente

- **Probarlo en un teléfono de verdad**, sobre todo el calendario en iPhone. Todo
  lo anterior está comprobado leyendo el código y el HTML generado, no tocando una
  pantalla.
- **Filas con muchos controles en Juegos.** Selector de estado más dos iconos;
  con los botones a 40 px, en 375 px puede partirse en dos líneas. Si se ve mal,
  meter editar y borrar detrás de un menú «⋯».
- **El estilo de los campos está copiado en 18 archivos.** La regla global tapa el
  síntoma en el teléfono; unificarlo en `lib/ui.ts` es la limpieza de fondo.

---

## 2. Módulos propuestos para la productividad

Elegidos contra la evidencia, no contra la moda. Cada uno se apoya en un
hallazgo con estudios detrás y en algo que el panel ya tiene.

### 2.1 Metas con planes «si… entonces…» y hábitos — hecho

Construido en `/metas`. Ver `CLAUDE.md`.

**La evidencia.** Escribir el plan como «si pasa X, entonces hago Y» —una
*implementation intention*— tiene un efecto medio a grande sobre conseguir la
meta: d = 0,65 en el metaanálisis de 2006 (94 pruebas), confirmado en 2024 con
642 pruebas. El efecto es mayor con el formato condicional y cuando el plan se
repasa.

En hábitos, el estudio de Lally (2010) encontró **66 días de media** hasta que un
hábito se vuelve automático, con un rango de 18 a 254. Y **saltarse un día no
afectó** a la formación del hábito.

**El módulo.**
- Cada meta lleva su plan «si… entonces…» como campo obligatorio.
- Los hábitos se marcan día a día. La racha **tolera un día perdido**, porque
  castigar el fallo suelto contradice el estudio y es justo lo que hace abandonar.
- La expectativa que muestra son 66 días, no los 21 del mito.

### 2.2 Bandeja de entrada y planificar el «cuándo» — hecho

Construido como **Pendientes** (`/pendientes`, captura con «+» desde la paleta). Ver `CLAUDE.md`.

**La evidencia.** Las tareas sin terminar siguen ocupando la cabeza y empeoran el
rendimiento en lo siguiente (efecto Zeigarnik). Pero Masicampo y Baumeister (2011)
mostraron que **no hace falta terminarlas**: basta un plan concreto —cuándo, dónde,
cómo— para que dejen de interferir.

**El módulo.**
- Capturar en dos segundos desde la paleta ⌘K («+ pendiente»), sin abrir un
  formulario.
- Para salir de la bandeja, cada pendiente pide **un día y, si quieres, una hora**,
  con el calendario que ya existe.
- La revisión semanal de la bitácora enseña lo que sigue sin planificar.

### 2.3 Bloques de enfoque con nota de retorno — hecho

En `/enfoque`, con el reloj en la cabecera de todas las pantallas. Ver `CLAUDE.md`.

**La evidencia.**
- **Saltar entre tareas cuesta.** Leroy (2009) encontró que la atención se queda
  en la tarea interrumpida —el «residuo de atención»—, y que el rendimiento en la
  siguiente cae, sobre todo cuando la anterior quedó a medias y con prisa.
- **Las pausas programadas ayudan, sin hacer magia.** Con pausas fijas al estilo
  Pomodoro, Biwer y colaboradores midieron mejor ánimo y la misma cantidad de
  trabajo en menos tiempo que con pausas a voluntad. No hubo más esfuerzo ni más
  tareas terminadas.

**El módulo.**
- Un temporizador de bloques: 25/5 o 50/10, a elegir.
- Al cortar un bloque, una línea de **«dónde lo dejé»**: un plan para retomar, que
  es lo que reduce el residuo.
- Cada bloque cae en la bitácora, y de ahí sale «horas de foco esta semana».

### 2.4 Revisión semanal guiada (mejora de la Bitácora) — hecho

Construida dentro de la Bitácora: tres preguntas, prioridades que se marcan la semana siguiente y recordatorio de lunes a miércoles. Ver `CLAUDE.md`.

**La evidencia.** Un metaanálisis de 138 estudios (Harkin y colaboradores, 2016)
encontró que **vigilar el progreso ayuda a conseguir metas** (d = 0,40). El efecto
es mayor cuando el progreso **se registra físicamente**, que es exactamente lo que
hace una bitácora.

**El módulo.** El resumen de la semana pasa de texto libre a tres preguntas cortas:
qué salió bien, qué cambiar, y las tres prioridades de la semana siguiente, cada
una con su «si… entonces…». La semana siguiente muestra si se cumplieron.

---

## 3. Módulos para la app en general

- **Calendario editorial.** El sitio tiene **cero artículos publicados**, y el
  efecto Zeigarnik aplica igual: una idea sin fecha sigue rondando sin avanzar.
  Ideas de artículo con fecha objetivo, que se convierten en borrador con un clic.
- **Inicio que mira hacia delante.** El dashboard habla de lo que pasó. Un bloque
  «Hoy» con lo que vence (renovaciones, pendientes planificados para hoy, hábitos
  por marcar) lo vuelve la página de arranque del día.
- **Edición en línea en Juegos y Libros.** Rellenar 66 juegos llevó 102 minutos de
  abrir y cerrar formularios.
- **«¿Terminado hoy?»** Al marcar algo como terminado, un botón en el aviso pone la
  fecha de fin de hoy, para que la bitácora lo cuente sin estampar fechas a ciegas.

---

## 4. Deuda técnica

- **Scopes de Google.** Quitar `analytics.readonly` y `webmasters.readonly` del
  login una vez confirmado que la service account lee. Si no, el token sigue
  caducando cada 7 días.
- **Copia automática fuera de Neon.** Hoy depende de que alguien la descargue.
- **Advertencia del build** por el `export *` sobre el cliente CommonJS de Prisma:
  no rompe nada, pero tapa avisos nuevos entre el ruido.

---

## Orden acordado

El 4 de octubre se revisaron doce propuestas y **todas se quedan**; esto es el
orden en que se construyen.

| fase | qué | estado |
| --- | --- | --- |
| 1 | Pendientes (2.2) y revisión semanal (2.4) | **hecho** |
| 2 | Metas y hábitos (2.1) | **hecho** |
| 3 | «Hoy» en el dashboard | **hecho** |
| 4 | Calendario editorial (3) | **hecho** |
| 5 | Bloques de enfoque (2.3) | **hecho** |
| 6 | Notas, presupuesto del mes, aprendizaje, oportunidades, rendimiento móvil del sitio y edición rápida en listas | siguiente, a elegir |
| — | Subir lo hecho a git (0) y probar el móvil en un teléfono real (1) | en paralelo, cuanto antes |

**Hecho:** los 37 certificados de Platzi están en Perfil → Certificados, en los dos
idiomas (`npm run certificates:platzi`), cada uno con la imagen de su diploma
(`npm run certificates:diplomas`) y texto alternativo en los dos idiomas.

## Fuentes

- Gollwitzer y Sheeran (2006), Sheeran, Listrom y Gollwitzer (2024): [resumen de los dos metaanálisis](https://siliconcanals.com/t-implementation-intentions-when-where-how-goal-achievement/), [NCI — implementation intentions](https://cancercontrol.cancer.gov/brp/research/constructs/implementation-intentions)
- Lally y colaboradores (2010): [qué encontró de verdad el estudio](https://www.thebehavioralscientist.com/articles/how-long-to-form-a-habit), [BPS Research Digest](https://bps.org.uk/research-digest/how-form-habit)
- Masicampo y Baumeister (2011): [Examine — planificación y atención](https://examine.com/conditions/focus-attention/faq/how-could-lack-of-planning-affect-focus-and-attention)
- Harkin y colaboradores (2016), *Psychological Bulletin*: [White Rose eprints](https://eprints.whiterose.ac.uk/91437/)
- Leroy (2009), residuo de atención: [Universidad de Washington Bothell](https://www.uwb.edu/business/faculty/sleroy/attention-residue)
- Biwer y colaboradores, pausas Pomodoro frente a pausas libres: [PubMed](https://pubmed.ncbi.nlm.nih.gov/36859717/)
