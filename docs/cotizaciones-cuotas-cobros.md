# Cotizaciones, cuotas y cuentas de cobro

Implementación y comprobaciones: 28 de octubre de 2026. Las dos migraciones se aplicaron a la base habitual después de la autorización explícita del propietario. El código no se desplegó.

## Uso

1. Abre **Precios → Cuotas y cobros**. También puedes entrar desde una cotización o desde **Trabajos → Cobros**.
2. Selecciona una cotización o un proyecto. El valor y la moneda proceden del acuerdo guardado; el plan no vuelve a calcular la tarifa.
3. Completa los datos privados del emisor y del destinatario. Puedes guardar tus datos de emisor, banco e instrucciones para reutilizarlos.
4. Elige cuántas cuotas quieres (1 a 100), y repártelas por **importes** o **porcentajes**. El reparto en partes iguales es opcional. Puedes cambiar cada importe, porcentaje, nombre del hito y vencimiento. Por ejemplo: 40 % de anticipo, 35 % al desarrollar y 25 % al entregar.
5. La suma debe coincidir exactamente con el total o con el 100 %. Al repartir porcentajes, la última cuota absorbe únicamente los centavos residuales. No se aplica otro redondeo comercial a las cuotas.
6. Guarda el plan y descarga la cotización. Si nació de una cotización, primero acéptala: se crea o reutiliza su trabajo vinculado y se conecta el plan.
7. Emite una cuenta por la cuota correspondiente. Para tarifas mensuales o por hora, indica el periodo que estás cobrando.
8. Registra los abonos realmente recibidos, con fecha y referencia. Cada cuenta y la lista de trabajos muestran abonos y saldo. El registro es manual: no verifica transferencias bancarias ni mueve dinero en Wallet.

Una vez emitida una cuenta, el acuerdo se conserva y se bloquea su edición. Descargar documentos no genera otra cuenta ni altera su importe. Una cuenta sin abonos puede anularse indicando el motivo y reemitirse; el documento anulado permanece en el historial. Las cuentas con abonos no se anulan desde este flujo.

## Pagos por avances, sin cuotas definidas

En **Modalidad de pago**, elige **Pagos por avances · sin cuotas definidas** y guarda el acuerdo. Esta opción usa el valor total del proyecto, pero no exige distribuirlo, completar porcentajes ni decidir cuántos pagos habrá.

- **Registrar dinero recibido:** indica importe, fecha y proyecto o avance pagado. La referencia es opcional. Puedes recibir $300.000 por el diseño y después $200.000 por otro avance; cada pago descuenta su valor real del saldo.
- **Anotar un próximo pago:** permite dejar el importe vacío y escribir solo el mes, una fecha completa o ninguna fecha. El botón **Próximo mes** completa el mes siguiente. Una previsión no cuenta como dinero recibido.
- **Ya recibí este pago:** permite confirmar una previsión con el importe y la fecha reales, aunque difieran de lo previsto. Se vincula con el pago recibido y se conserva el registro original; la lista muestra los datos realmente recibidos cuando queda confirmada.
- Puedes retirar una previsión pendiente. Los pagos recibidos y las previsiones ya confirmadas conservan su historial.
- El resumen muestra valor acordado, recibido y saldo; **Trabajos** refleja los mismos abonos y saldo.

Los datos del documento aparecen plegados como opcionales en este modo: no necesitas CC/NIT para anotar dinero recibido. Puedes completarlos después para preparar una cotización. Registrar un avance no emite automáticamente una cuenta de cobro ni mueve dinero en Wallet.

El historial se conserva al editar los datos del acuerdo. Una vez que existen pagos recibidos, el importe/moneda del contrato y su modalidad se protegen para evitar perder o reinterpretar dinero ya registrado. Los reintentos con el mismo identificador no duplican pagos y los pagos simultáneos se validan contra el saldo dentro de una transacción serializable.

Esta modalidad utiliza los detalles JSON versionados del plan y su revisión existente; no requiere otra migración. Las escrituras de pruebas se realizaron únicamente en PostgreSQL local con datos ficticios.

La interfaz nueva está en `apps/admin/src/components/FlexibleProjectPayments.tsx`, integrada con `PricingBilling.tsx`. La validación y las transacciones se ampliaron en `billing-values.ts` y `billing.ts`; el resumen de Trabajos se actualizó en `client-projects.ts`. Los contratos se ampliaron en `packages/shared/src/billing.ts`. Las verificaciones específicas están en `scripts/check-flexible-billing.ts` y `scripts/check-flexible-billing-ui.cjs`.

## Documentos

El PDF usa papelería comercial A4 de Nassican: logo original, márgenes laterales de 20 mm, referencia, fecha, datos de ambas partes, concepto, alcance, tabla de cuotas, valor en letras, condiciones y numeración de páginas. Las tablas repiten sus encabezados al continuar en otra página. El documento de cobro incluye medio de pago, abonos y saldo, y conserva el valor original emitido.

La maquetación intenta que el documento quepa en una página automáticamente. Primero conserva el diseño normal si ya cabe; si ocupa más, prueba dos distribuciones más compactas, con menos espacios y texto principal de al menos 9 puntos. Retira únicamente repeticiones exactas del concepto o del emisor, cuyos datos siguen en el encabezado. Si el contenido completo necesita varias páginas, conserva la distribución con menos páginas y mantiene encabezados, tablas y numeración. No recorta el alcance, las cuotas, los abonos ni las condiciones para forzar una sola hoja.

`scripts/check-commercial-pdf-layout.ts` compara ejemplos sintéticos y comprueba que la presentación no modifique el acuerdo. Una cotización con datos completos, ocho entregables y cuatro cuotas, y una cuenta con cuatro abonos y datos bancarios, pasaron de dos páginas a una. Se verificaron texto, importes, márgenes y tamaño del cuerpo, y se inspeccionaron las páginas renderizadas. Los documentos extensos y de cien hitos conservaron su contenido completo en varias páginas.

Los datos financieros privados usados por la calculadora (ingresos, activos, pasivos, patrimonio, estrato y explicación interna del precio) no forman parte del PDF. Los datos bancarios aparecen en la cuenta cuando tú los completas, no en el sitio público.

La cuenta de cobro no es factura electrónica ni documento soporte DIAN. No se dedujo tu condición tributaria, responsabilidad de IVA o retenciones. La [documentación oficial DIAN](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documento-soporte-adquisiciones-no-obligados/) explica el documento soporte que genera el adquirente cuando corresponde. Esta implementación no sustituye ese procedimiento ni afirma cumplir obligaciones tributarias específicas de tu actividad.

## Archivos y propósito

Las rutas de esta tabla son relativas a la raíz del repositorio.

| Archivo                                                                                   | Cambio                                                                                                                        |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/billing.ts`, `packages/shared/src/index.ts`                          | Contratos de partes, emisor, cuotas, acuerdo y cuenta emitida.                                                                |
| `packages/db/prisma/schema.prisma`                                                        | Modelos `BillingIssuerSettings`, `BillingPlan`, `BillingCharge` y `BillingReceipt`, y relaciones con cotizaciones y trabajos. |
| `packages/db/prisma/migrations/20261028020000_billing_plans/migration.sql`                | Tablas, restricciones de importes, consecutivo y unicidad de cuenta activa por cuota.                                         |
| `packages/db/src/json.ts`                                                                 | Escritura tipada de los documentos JSON privados.                                                                             |
| `packages/db/src/backup.ts`                                                               | Incluye los cuatro modelos en los respaldos generales.                                                                        |
| `apps/admin/src/lib/billing-values.ts`                                                    | Validación de partes, fechas, importes, precisión monetaria, porcentajes y suma exacta del plan.                              |
| `apps/admin/src/lib/billing.ts`                                                           | Lectura y guardado, emisión, anulación, abonos idempotentes y transacciones serializables.                                    |
| `apps/admin/src/lib/billing-values.test.ts`                                               | Pruebas de reparto, validación, precisión y cantidades en letras.                                                             |
| `apps/admin/src/lib/money-words.ts`                                                       | Cantidades en letras para COP, USD y EUR.                                                                                     |
| `apps/admin/src/lib/commercial-pdf.ts`                                                    | Papelería PDF compartida, tablas y paginación.                                                                                |
| `apps/admin/src/lib/pricing-quote-pdf.ts`                                                 | Sustituye el diseño de tarjetas por el documento comercial.                                                                   |
| `apps/admin/src/lib/pricing-quote-document.ts`                                            | Añade el plan acordado al documento permitido para exportar.                                                                  |
| `apps/admin/src/app/(panel)/precios/cobros/page.tsx`                                      | Nueva pantalla privada.                                                                                                       |
| `apps/admin/src/app/(panel)/precios/cobros/actions.ts`                                    | Acciones autenticadas, auditoría y mensajes ante conflictos.                                                                  |
| `apps/admin/src/components/PricingBilling.tsx`                                            | Editor de partes y cuotas, emisión, historial y registro de abonos.                                                           |
| `apps/admin/src/components/PricingPdfDownload.tsx`                                        | Descargas de cotización, plan y cuenta.                                                                                       |
| `apps/admin/src/components/PricingTabs.tsx`, `PricingQuotes.tsx`, `PricingCalculator.tsx` | Acceso al flujo desde Precios. Los dos últimos archivos también están en `apps/admin/src/components/`.                        |
| `apps/admin/src/components/ClientProjectsModule.tsx`                                      | Enlace a cobros y resumen de abonos/saldo del trabajo.                                                                        |
| `apps/admin/src/lib/pricing.ts`                                                           | Vincula el plan al aceptar una cotización y verifica que el acuerdo conserve su importe.                                      |
| `apps/admin/src/app/(panel)/precios/actions.ts`                                           | Presenta los errores del acuerdo al aceptar.                                                                                  |
| `apps/admin/src/lib/client-projects.ts`                                                   | Agrega saldos por trabajo y protege los importes de acuerdos emitidos.                                                        |
| `apps/admin/src/app/(panel)/trabajos/actions.ts`                                          | Presenta los errores al editar un trabajo.                                                                                    |
| `apps/admin/src/app/api/precios/cotizaciones/[id]/pdf/route.ts`                           | Adjunta cuotas vigentes a la cotización sin recalcular el precio guardado.                                                    |
| `apps/admin/src/app/api/precios/planes/[id]/pdf/route.ts`                                 | Exporta la propuesta de un plan, incluso para un trabajo independiente.                                                       |
| `apps/admin/src/app/api/precios/cobros/[id]/pdf/route.ts`                                 | Exporta la cuenta emitida con su historial y saldo.                                                                           |
| `apps/admin/next.config.ts`                                                               | Incluye el logo en el empaquetado de las tres rutas PDF.                                                                      |
| `scripts/check-billing.ts`                                                                | Prueba de dominio y concurrencia limitada a PostgreSQL desechable en loopback.                                                |
| `scripts/check-billing-ui.cjs`                                                            | Recorrido real en Chrome, descargas, conexión con Trabajos y presentación móvil/escritorio.                                   |
| `scripts/check-pricing-pdf.ts`                                                            | Muestras sintéticas: documento normal, alcance extenso y cien cuotas.                                                         |
| `scripts/check-pricing-rounding.ts`                                                       | Opción explícita `--with-billing` para aceptar únicamente las dos migraciones comerciales revisadas.                          |
| `docs/cotizaciones-cuotas-cobros.md`                                                      | Uso, archivos, activación pendiente y resultados de comprobación.                                                             |

## Activación completada con autorización

Se creó un respaldo completo de esquema y datos mediante `pg_dump`, se restauró en PostgreSQL local desechable y se comprobó la coincidencia de los conteos de las 98 tablas, los hashes de datos comerciales y los ajustes. Las dos migraciones pasaron primero sobre esa copia y después se aplicaron a la base habitual autorizada. El formulario ya reconoce las tablas y habilita guardar y emitir. Las cotizaciones anteriores permanecen intactas.

Las migraciones aplicadas son:

- `20261028010000_pricing_commercial_rounding`: añade el paso familiar sin alterar las cotizaciones históricas ni el descuento guardado.
- `20261028020000_billing_plans`: añade las tablas de cuotas y cobros.

La revisión automática había rechazado aplicar DDL a la conexión habitual porque podía corresponder a una base compartida o de producción. El propietario autorizó explícitamente ese paso antes de la ejecución. No se publicaron cambios ni se modificaron credenciales o configuración de producción.

La comprobación posterior confirmó que los registros comerciales y los conteos de las tablas anteriores se conservaron; únicamente se añadieron dos entradas al historial de migraciones y las cuatro tablas de cobros vacías. El descuento familiar y los demás ajustes se preservaron. Los pasos quedaron en $100.000 normal y $1.000.000 familiar. El panel de desarrollo se reinició y respondió HTTP 200 en `/login`; la carga de datos de cobros se comprobó sin crear cotizaciones, cuentas ni abonos reales.

El respaldo completo y los informes privados de verificación quedaron fuera del repositorio, en `%LOCALAPPDATA%\Nassican\Backups\nassican-commercial-backup-2026-10-29T04-26-28-990Z`. Se comprobó la integridad SHA-256 al copiarlo a esa ubicación permanente. La copia restaurada de prueba se eliminó y PostgreSQL local se detuvo.

El procedimiento de activación utilizado fue el siguiente. Para otro destino sigue siendo necesario identificarlo y autorizarlo; no se debe volver a ejecutar como si estas migraciones siguieran pendientes:

1. Crear y verificar un respaldo completo por el procedimiento habitual del propietario/proveedor. El respaldo completo debe cubrir también la recuperación de esquema; una exportación JSON de datos no reemplaza ese respaldo.
2. Revisar `prisma migrate status` contra ese destino. Solo deben estar pendientes las migraciones comerciales anteriores que aún no estén aplicadas.
3. Ejecutar, desde la raíz y **únicamente después de autorización**:

   ```powershell
   npx.cmd tsx --conditions=react-server --tsconfig apps/admin/tsconfig.json scripts/check-pricing-rounding.ts --migrate --with-billing
   ```

   El script rechaza otras migraciones pendientes, guarda una copia privada de los ajustes en TEMP y compara el hash de snapshots, importes y estados de cotizaciones antes/después. Esa copia de ajustes complementa el respaldo completo; no lo sustituye.

4. Comprobar que el formulario permita guardar, preparar un plan real y revisar el PDF antes de enviarlo. La publicación del código es un paso separado y también requiere autorización.

## Pruebas realizadas

- `npm.cmd run typecheck`: correcto en todos los workspaces.
- `npm.cmd run lint`: sin errores ni advertencias de código tras corregir el parámetro sin uso; continúa el aviso informativo preexistente de datos de `baseline-browser-mapping`.
- `npm.cmd test`: 420 pruebas correctas (80 compartidas/DB, 10 SEO, 330 admin), incluidas las validaciones de pagos flexibles y sus previsiones.
- `npm.cmd run build`: ambas aplicaciones compilaron para producción. Prisma se generó localmente; este comando no aplicó migraciones.
- `check-billing.ts` en la base sintética: cuotas exactas, rechazo de emisión antes de aceptación, un solo trabajo vinculado, emisión repetida sin duplicado, bloqueo del acuerdo emitido, abono parcial, reintento idempotente, rechazo de sobrepago, rechazo de anulación con abonos, anulación/reemisión sin abonos y snapshots sin alteraciones.
- Dos abonos concurrentes que juntos excedían el saldo: solo uno pudo confirmarse. PostgreSQL rechazó la otra transacción por conflicto; el mensaje esperado de Prisma no representó un fallo de la prueba.
- `check-billing-ui.cjs` sobre Next compilado: reparto 40/35/25, aceptación, vínculo con Trabajos, emisión, abono, limpieza del formulario y descarga real de cotización/cuenta. Anchos 1440 y 390, temas claro/oscuro, sin excepciones JavaScript ni desbordamiento horizontal.
- PDF renderizado e inspeccionado visualmente con PyMuPDF; identificaciones completas comprobadas por extracción. Con el ajuste compacto del 29 de octubre, el alcance extenso y la tabla de 100 cuotas quedaron en 5 páginas cada uno, conservando texto, divisas, importes, márgenes, hito final y encabezados repetidos. Los ejemplos habituales de cotización y cuenta pasaron de 2 páginas a 1.
- Scripts TypeScript comprobados con un `tsconfig` temporal, sin incorporarlo al repositorio.
- `check-flexible-billing.ts`: pagos sin cuotas ni documentos de identificación obligatorios, importes desiguales, previsión de importe desconocido, confirmación, rechazo de sobrepago y fecha futura en un pago recibido, reintentos idempotentes, historial conservado al editar, contrato protegido y solo un abono concurrente confirmado cuando juntos superarían el saldo.
- `check-flexible-billing-ui.cjs`: proyecto independiente de $1.000.000, pagos de $300.000 y $200.000, previsión para el mes siguiente sin importe, confirmación con importe real, formulario de previsión sin guardar conservado al registrar otro pago, recarga/edición sin pérdida del historial, retiro de previsión, rechazo de sobrepago y liquidación final. Se comprobó además la descarga de cotización; anchos 1440/390 y ambos temas, sin desbordamiento horizontal ni excepciones de página. El flujo anterior de cuotas volvió a pasar en la misma compilación.

Las cuotas no crean suscripciones automáticas ni débitos bancarios. Si necesitas facturación electrónica, retenciones o conciliación bancaria, requieren un alcance adicional acorde con tu situación real.
