# Cálculos automáticos de Precios

## Edición de cifras

`PricingNumberInput` agrupa los miles mientras se escribe: `9386000` se muestra como
`9.386.000`. Conserva el cursor al editar dentro de una cifra, los valores negativos,
el cero explícito y los decimales con coma. Un punto decimal recién escrito se convierte
en coma. Al pegar, se respeta el valor de los formatos admitidos por `parseNumber`:
`1.234,50` y `1234.50` representan el mismo importe. No cambia el parser de otros módulos.

Se aplica a la calculadora, periodos financieros, parámetros, servicios, tramos,
factores regionales, ingresos estimados y precios de referencia.

## Redondeo comercial

El usuario confirmó estos pasos iniciales:

- Normal: hacia arriba en pasos de **100.000 COP** (`9.386.000 → 9.400.000`).
- Familiar: después del porcentaje, hacia abajo en pasos de **1.000.000 COP**
  (`9.386.000 → 9.000.000`).

Ambos pasos se editan en Parámetros; el familiar aparece junto al porcentaje familiar.
Si el importe es menor que el paso configurado, se reduce el paso automáticamente a
una décima del orden de magnitud del importe, como mínimo un centavo:
`42.350 → 42.000` familiar, usando un paso de `1.000`.

La tarifa normal conserva el piso de costos. La familiar aplica el porcentaje completo
a los honorarios y permite bajar del piso. Luego redondea hacia abajo el total, conservando
como mínimo los costos directos más los viáticos. Un descuento del 100 % deja solamente
esos gastos; sin gastos, el importe es cero.

El snapshot registra por separado el descuento porcentual y el ajuste adicional por
redondeo. Las cotizaciones anteriores conservan sus resultados y su explicación histórica.
El catálogo también muestra el recomendado familiar con la nueva regla.

## Periodos financieros

Con activos y pasivos presentes, patrimonio se calcula como **activos − pasivos**, se
muestra como un campo automático y se deriva de nuevo en el servidor al guardar. Puede
ser negativo. Sin ambos datos se permite registrar un patrimonio conocido manualmente.

El resumen se actualiza mientras se escribe: patrimonio, costo utilizado, utilidad
operacional y neta, ingreso mensual y utilidad operacional mensual. No transforma campos
vacíos en ceros ni suma otra vez compras/clase 7 si ya está el costo 61. Los importes anuales
se dividen entre 12 para el presupuesto mensual.

## Región y estrato

La vista automática y el snapshot comparten la misma resolución del ingreso regional.
Para personas se prioriza el ingreso registrado, incluso si es cero; después el periodo
financiero y, por último, la referencia según lugar y estrato. Las empresas usan su análisis
financiero. El estrato no reemplaza un ingreso conocido.

Los escenarios comerciales y las referencias estadísticas se identifican en pantalla con
su base, año y fuente. Un escenario no es una medición oficial por estrato ni un salario
personal. La capacidad entra con su peso configurado y el piso normal puede hacer que un
cambio de estrato no cambie el precio final. El formulario muestra ese presupuesto para
que el efecto sea visible.

Guardar un cambio del cliente, sus periodos o sus parámetros invalida la revisión anterior;
no se sigue mostrando un snapshot calculado con datos viejos.

## Migración y compatibilidad

`20261028010000_pricing_commercial_rounding` agrega `family_rounding` con valor inicial
`1.000.000` y cambia el paso normal a `100.000`. No cambia el porcentaje familiar,
otros parámetros ni cotizaciones guardadas. `check-pricing-rounding.ts --migrate` hace
un respaldo temporal de parámetros y compara hashes de snapshots/importes antes y después;
rechaza aplicar otras migraciones pendientes.

La aplicación detecta el esquema anterior mediante una consulta de lectura y sigue abriendo
con los pasos nuevos. Avisa en Parámetros que falta migrar para guardar la configuración;
evita escrituras parciales. Reiniciar el servidor después de aplicar la migración renueva
esa detección. Un error transitorio de la consulta no queda cacheado.

La aplicación de la migración a la base configurada quedó pendiente de autorización explícita
después de que el revisor automático rechazara esa operación. Se probó en PostgreSQL temporal
local (`127.0.0.1:55432`), sin modificar el esquema de la base configurada.

## Comprobaciones reproducibles

Los scripts de datos ficticios exigen host, puerto y usuario de PostgreSQL local para evitar
escrituras accidentales sobre una base remota:

- `seed-pricing-local-qa.ts`: usuario ficticio, parámetros y tres bases municipales.
- `check-pricing.ts --fixtures --family`: sesión temporal y comprobaciones de persistencia.
- `check-pricing-automation-db.ts`: patrimonio guardado y equivalencia entre cálculo local
  y snapshot para Pasto/Medellín por estrato.
- `check-pricing-automation-ui.cjs`: Chrome, formato/cursor/pegado, capacidad regional,
  prioridad de ingreso cero, patrimonio negativo/positivo y guardado de parámetros.
- `check-pricing-rounding.ts --simulate-legacy-local` y UI `--legacy`: compatibilidad del
  esquema anterior y rechazo claro de un guardado incompleto.

Las capturas se guardan en `%TEMP%/nassican-pricing-qa`, sin publicar sesiones ni credenciales.
