# Estudio del flujo de cotizaciones, trabajos y pagos

Fecha: 29 de octubre de 2026.

## Método y alcance

Se revisaron el código y los recorridos de Calcular, Cotizaciones, Trabajos y Cuotas y cobros. Se comparó la misma operación antes y después en Chrome, usando el mismo proyecto ficticio: valor de $1.000.000 y un pago recibido de $300.000. Se probó a 1440 × 1000 y a 390 × 1000, con emulación táctil en el segundo caso y ambos temas.

Es una revisión funcional con tareas guiadas y mediciones de interfaz. No se cronometraron personas ni se midió productividad real. Los píxeles y campos siguientes describen ese caso controlado; no equivalen a segundos ahorrados.

## Flujo observado

| Tarea                             | Recorrido anterior                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Preparar una cotización           | Calcular → elegir/guardar cliente → servicios y alcance → revisar precio → guardar → descargar PDF o configurar pagos.             |
| Aceptar y comenzar a cobrar       | Abrir cobros → salir a Cotizaciones → cambiar estado a aceptada → volver a cobros → registrar pago o emitir cuenta.                |
| Registrar un avance de un trabajo | Trabajos → Cobros → seleccionar modalidad si era nuevo → guardar acuerdo → pasar configuración/documentos → registrar lo recibido. |
| Anotar el siguiente pago          | Pasar por el formulario de pago recibido y el historial para llegar al formulario de previsión.                                    |
| Consultar saldo y documentos      | Volver a una pantalla que anteponía la preparación del acuerdo al uso cotidiano.                                                   |

El cálculo de precios ya separa costo interno, referencia de mercado y precio final. La fricción principal del recorrido cotidiano estaba en la presentación y la navegación entre pantallas.

## Hallazgos y cambios implementados

| Hallazgo                                                                                          | Cambio                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Aceptar la cotización exigía salir y regresar.                                                    | Se puede **Confirmar aceptación del cliente** desde la pantalla de pagos. El botón explica cuándo corresponde usarlo; después reutiliza la creación y vinculación existentes del trabajo.                          |
| La configuración se mostraba antes que el registro de un pago, incluso cuando ya estaba guardada. | El saldo y el formulario operativo van primero en pagos por avances. La configuración queda plegada y tiene un acceso directo para editarla.                                                                       |
| Los dos formularios y el historial competían por espacio.                                         | **Registrar dinero recibido** y **Anotar un próximo pago** se abren por separado. El historial se consulta en un desplegable con su cantidad de registros. Los borradores sobreviven al cambiar entre formularios. |
| Volver a descargar el PDF requería pasar por la configuración.                                    | La descarga está accesible junto al acuerdo guardado. Se deshabilita si hay cambios del documento sin guardar.                                                                                                     |
| El guardado seguía habilitado sin cambios.                                                        | El acuerdo guardado solo vuelve a guardarse cuando se modifica.                                                                                                                                                    |
| Desde Trabajos, un acuerdo nuevo no aprovechaba el contexto de registrar un pago.                 | El acceso **Cobros** propone pagos por avances cuando aún no hay plan. Si ya existe un acuerdo con cuotas, conserva esa modalidad.                                                                                 |
| Cambiar el selector de acuerdo podía perder un borrador de pago.                                  | El aviso al cambiar de acuerdo incluye también los formularios de pagos, además de los datos del documento.                                                                                                        |
| Las ayudas tenían forma rectangular y su área táctil invadía la fila del campo.                   | Botones circulares, con foco visible. Mantienen 40 px de área táctil; la etiqueta reserva su espacio para no tapar el control.                                                                                     |
| Algunos enlaces describían solo cuotas aunque también permiten avances y documentos.              | Acciones más claras: **Gestionar pagos y documentos** y **Continuar con pagos y documentos**. Las rutas y el acceso conocido de Cuotas y cobros se conservan.                                                      |

## Comparación de interfaz

Medición con el mismo proyecto, su configuración guardada y el formulario de dinero recibido abierto. Se excluyeron campos plegados, controles transparentes internos del calendario y elementos fuera de la presentación visible del formulario. La posición del importe se mide desde la parte superior del documento.

| Medida                                                                                  |     Antes |    Ahora |
| --------------------------------------------------------------------------------------- | --------: | -------: |
| Campos presentados en el caso comparado                                                 |        11 |        5 |
| Posición del importe recibido, escritorio                                               | 1240,5 px | 767,5 px |
| Posición del importe recibido, móvil táctil                                             | 1673,1 px |  1057 px |
| Cambios de página necesarios para confirmar aceptación desde cobros y regresar          |         2 |        0 |
| Superposición vertical de ayudas con la fila de sus controles, móvil del caso comparado |        11 |        0 |

La posición depende de la longitud del título, el tamaño de pantalla y el contenido. Se conservaron las ayudas de tamaño táctil amplio aunque requieren más altura por etiqueta; el espacio principal se recuperó plegando preparación e historial y mostrando una tarea cada vez.

## Recorrido recomendado ahora

### Si vas a cotizar

1. En **Calcular**, prepara y guarda la cotización.
2. En **Continuar con pagos y documentos**, elige cuotas o pagos por avances y guarda el acuerdo.
3. Descarga la cotización desde esa pantalla.
4. Cuando el cliente haya aceptado, usa **Confirmar aceptación del cliente**. El proyecto se conecta sin ir a otra página.
5. Registra dinero recibido o emite la cuenta de la cuota correspondiente.

### Si ya tienes un trabajo y te pagaron

1. En **Trabajos**, abre **Cobros**.
2. Si todavía no tiene acuerdo, revisa el valor y guarda la modalidad propuesta de pagos por avances. Puedes escoger cuotas si ya hay un reparto acordado.
3. En los acuerdos guardados, registra el importe y el avance pagado; la fecha ya propone el día actual.
4. Usa **Anotar un próximo pago** cuando necesites una previsión; importe y fecha siguen siendo opcionales.

Abrir la pantalla no acepta una cotización ni crea registros financieros por sí solo. El guardado inicial y la aceptación siguen siendo acciones explícitas.

## Verificación

- `npm.cmd test`: 420 pruebas correctas.
- `npm.cmd run typecheck`: correcto en todos los workspaces.
- `npm.cmd run lint`: sin errores de código; se conserva el aviso informativo anterior sobre la antigüedad de `baseline-browser-mapping`.
- `npm.cmd run build`: ambas aplicaciones compilaron.
- `check-pricing-flow-ui.cjs`: geometría circular, controles sin superposición, tooltip dentro de la pantalla, toque, Enter y Escape; aceptación, vinculación y pago sin salir de la ruta; aviso que conserva el borrador si se cancela el cambio de acuerdo; entrada desde Trabajos y respeto de planes anteriores con cuotas.
- `check-pricing-flow-fixtures.ts --verify`: snapshot de la cotización sin cambios y mismo plan vinculado al proyecto aceptado; abrir un trabajo nuevo no crea un plan automáticamente.
- `check-billing-ui.cjs`: cuotas 40/35/25, aceptación, cuentas, abono y descargas PDF.
- `check-flexible-billing-ui.cjs`: pagos desiguales, previsión sin importe, confirmación, edición y recarga sin pérdida, rechazo de sobrepago, saldo final y descarga PDF.
- Capturas revisadas en claro/oscuro, escritorio y móvil táctil; sin desbordamiento horizontal ni excepciones JavaScript en los recorridos verificados.

Las pruebas de escritura se limitaron a PostgreSQL ficticio en loopback. No se cambiaron importes, descuentos, acuerdos o estados reales para realizar el estudio. No hizo falta una migración ni se desplegaron cambios.

## Archivos del cambio

| Archivo                                                                         | Función                                                                                                                    |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/admin/src/components/PricingHelp.tsx`                                     | Ayuda circular, icono y conservación del popover accesible.                                                                |
| `apps/admin/src/components/PricingFields.tsx`, `apps/admin/src/app/globals.css` | Espacio de etiqueta adaptado al área táctil de la ayuda.                                                                   |
| `apps/admin/src/components/PricingBilling.tsx`                                  | Jerarquía de acciones, configuración plegada, aceptación en contexto, protección del borrador y guardado solo con cambios. |
| `apps/admin/src/components/FlexibleProjectPayments.tsx`                         | Formularios por tarea, historial plegable, borradores conservados y foco al confirmar una previsión.                       |
| `apps/admin/src/components/PricingPdfDownload.tsx`                              | Permite deshabilitar la descarga mientras el documento tiene cambios sin guardar.                                          |
| `apps/admin/src/components/ClientProjectsModule.tsx`                            | Acceso contextual desde el trabajo a la modalidad por avances.                                                             |
| `apps/admin/src/components/PricingCalculator.tsx`, `PricingQuotes.tsx`          | Etiquetas de continuidad hacia pagos y documentos; ambos están en `apps/admin/src/components/`.                            |
| `apps/admin/src/app/(panel)/precios/cobros/page.tsx`                            | Intención inicial de pago, conservando cualquier modalidad ya guardada.                                                    |
| `apps/admin/src/app/(panel)/precios/actions.ts`                                 | Actualiza la pantalla de cobros tras aceptar una cotización. La autenticación existente se conserva.                       |
| `scripts/check-pricing-flow-fixtures.ts`, `scripts/check-pricing-flow-ui.cjs`   | Casos ficticios, comparación antes/después y verificación del recorrido.                                                   |
| `scripts/check-billing-ui.cjs`, `scripts/check-flexible-billing-ui.cjs`         | Adaptación de recorridos previos a los desplegables y al nuevo acceso contextual.                                          |

## Siguientes validaciones útiles

1. Observar tu uso real con las tareas anteriores y anotar dónde vuelves a dudar o repites datos. Eso permite priorizar por frecuencia real, sin deducirla únicamente del código.
2. Si aumentan los acuerdos, evaluar un selector con búsqueda por proyecto y cliente. Actualmente conserva el selector existente.
3. Evaluar por separado la preparación de una cotización nueva: los datos financieros y el estudio de mercado requieren otro recorrido distinto del registro diario de pagos. No conviene mezclar esas dos tareas en el mismo formulario operativo.
