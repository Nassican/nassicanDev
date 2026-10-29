# Ayuda contextual y cotizaciones PDF

Cada campo de Precios tiene un botón de pregunta con su explicación cuando está
registrado en `pricing-help.ts`. Incluye ejemplos y las reglas del motor, también
para campos contables PUC/NIIF/210, parámetros, tramos, regiones, mercado y resultados.
`PricingLabel` mantiene el botón fuera del `label` para evitar activar el campo o
checkbox al consultar la ayuda. Los selectores del mapa usan el mismo componente.

`PricingHelp` usa un popover nativo en la capa superior, por lo que no queda recortado
por tarjetas o paneles con scroll. Abre con clic, toque o teclado; cierra con Escape,
otro botón de ayuda o pulsación fuera. Conserva `aria-expanded` y `aria-describedby`,
se mantiene dentro de la pantalla y actualiza su posición al desplazar o redimensionar.

## Descargar una propuesta

- En **Cotizaciones**, pulsar **Descargar PDF** en la cotización guardada.
- En **Calcular**, guardar primero la cotización; aparece el mismo botón mientras
  el borrador actual coincide con el que se acaba de guardar. Si se modifica, hay que
  guardar la nueva propuesta para descargarla desde ese formulario.

La descarga genera un archivo real, no una captura de pantalla ni un diálogo de
impresión. Muestra Nassican con su logotipo original, referencia estable, cliente,
ubicación, fecha de emisión, vigencia, estado, servicio, componentes del paquete,
alcance y precio final con su moneda y unidad. Usa el nombre y correo públicos del
perfil si están disponibles. Plazo y forma de pago quedan por acordar; no inventa
anticipos, impuestos o fechas de entrega.

`quoteDocument()` construye una lista explícita de datos públicos a partir del
snapshot guardado y del importe final actual. El precio manual tiene prioridad sobre
el sugerido. El PDF no incluye patrimonio, ingresos, estrato, costos internos, factores
de capacidad, referencias de mercado ni notas internas. Los paquetes antiguos sin
componentes siguen siendo exportables. Soporta COP, USD y demás monedas registradas,
incluido un importe cero, por hora, mensual o proyecto.

`GET /api/precios/cotizaciones/[id]/pdf` comprueba sesión y acceso activo mediante
`requireUser()` antes de consultar la cotización. Devuelve 404 para identificadores
inválidos o inexistentes. Las descargas se sirven con `application/pdf`, disposición
de adjunto, nombre seguro y `Cache-Control: private, no-store`. Descargar no actualiza
snapshot, precio, estado, proyecto ni fechas; tampoco marca la propuesta como enviada.

## Implementación y comprobaciones

`pdf-lib` se ejecuta en el servidor Node y no entra al bundle del navegador. El
logotipo `src/app/icon.png` está incluido explícitamente en el trazado de archivos
de Next para esta ruta. El PDF A4 incorpora saltos de página, encabezado de continuación,
numeración y ajuste de palabras largas. Usa fuentes PDF estándar con acentos españoles;
los caracteres no compatibles se sustituyen por `?` para evitar errores de exportación.

- Pruebas unitarias de contenido público, importe final, fechas de Bogotá, moneda,
  campos históricos y paginación.
- `check-pricing-pdf.ts`: ejemplos ficticios en la carpeta temporal, incluidos un
  alcance de ocho páginas y un precio mensual en USD.
- `check-pricing-help-pdf-ui.cjs`: Chrome real, teclado/clic/Escape, posición móvil,
  ambos temas, descarga desde calculadora y lista, 404 y denegación sin sesión.
- `check-pricing-pdf-state.ts --record` y sin argumentos: compara el estado de la
  cotización ficticia antes y después de descargar. Exige PostgreSQL local de QA.

Los PDFs se renderizaron y revisaron visualmente con PyMuPDF y se verificaron con
extracción de texto mediante pypdf. Las capturas, archivos ficticios y hashes quedan
en `%TEMP%/nassican-pricing-qa`; no contienen cotizaciones reales.

Este cambio no requiere migración de base de datos. La autorización pendiente para
la migración anterior de redondeo es independiente.
