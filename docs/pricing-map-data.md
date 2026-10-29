# Mapa de referencia de precios

`apps/admin/src/lib/data/pricing-colombia-map.json` es una base geográfica
derivada separada del código del panel y de sus datos de precios. Conserva
atribución, licencia, año de referencia, enlace de geometría y SHA-256.

- Fuente: geoBoundaries gbOpen, Colombia ADM1, identificador COL-ADM1-13589884.
- Procedencia declarada por la fuente: OpenStreetMap, Wambacher.
- Año representado: 2017. Compilación de origen: 12 de diciembre de 2023.
- Licencia de la geometría y de este archivo derivado: **Open Data Commons
  Open Database License 1.0 (ODbL)**.
- [Licencia completa](https://opendatacommons.org/licenses/odbl/1-0/).
- [Metadatos](https://www.geoboundaries.org/api/current/gbOpen/COL/ADM1/).
- [Geometría original fijada a una revisión](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/COL/ADM1/geoBoundaries-COL-ADM1_simplified.geojson).
- [Atribución OpenStreetMap](https://www.openstreetmap.org/copyright).

Se modificó la representación: proyección equirectangular de visualización,
simplificación Douglas–Peucker a 0,7 unidades de pantalla, redondeo y conversión
a trazados SVG. `scripts/build-pricing-map.py` reproduce el archivo desde una
copia de esa geometría en el directorio temporal `nassican-pricing-map`.

La geometría sirve para navegar por 32 departamentos y Bogotá D.C. No es
cartografía municipal, delimitación legal actualizada ni un mapa de tarifas
observadas. Los nombres visibles se toman del catálogo DIVIPOLA actual del
panel cuando existen. La fuente, el año y la licencia se muestran en ambas
pantallas. No se geocodifican clientes ni direcciones.

El mapa se entrega desde el propio panel: no solicita teselas, claves de API,
ubicación del navegador ni servicios geográficos en tiempo de ejecución.
La selección también está disponible por teclado y mediante un selector.
Los precios nacionales no colorean departamentos como si fueran datos locales.

La navegación permite zoom hasta 32 veces, encuadre de un departamento,
desplazamiento con ratón, flechas y arrastre táctil opcional. El encuadre se
limita a la extensión completa de la geometría y preserva sus proporciones.
Bogotá y San Andrés/Providencia tienen accesos ampliados para que sus pequeñas
figuras no sean la única forma de seleccionarlos. Esto no cambia la precisión
ni el año de los datos originales.

El selector de Mercado indica el número de referencias elegibles de cada
departamento, separa las zonas con y sin datos para los filtros elegidos y
ofrece un acceso independiente a las referencias nacionales. Sus cantidades
no equivalen al número de proveedores ni a precios municipales observados.

Al elegir un departamento aparece el selector municipal. En Mercado solo
ofrece municipios con comparables elegibles para las condiciones seleccionadas;
en Regiones ofrece las localidades de ese departamento y su base de referencia.
Las opciones cambian y la selección anterior se limpia cuando cambia el
departamento. El filtrado municipal no transforma la geometría departamental
en una cartografía de municipios ni asigna precios nacionales como precios
municipales.
