/** Plain-language explanations of the rules actually used by the calculator. */
const help: Record<string, string> = {
  "Elegir cliente":
    "Selecciona quién recibirá la propuesta. Su ingreso o periodo financiero ayuda a estimar capacidad; no sustituye tus costos de trabajo.",
  Nombre: "Nombre de la persona o empresa. Aparecerá como destinatario en la cotización PDF.",
  Tipo: "Persona natural: usa ingreso mensual. Empresa: usa sus periodos financieros, el tramo de ingresos y su salud financiera.",
  "Actividad económica":
    "Describe a qué se dedica el cliente. Es contexto, no una conversión automática a ingresos.",
  "Estrato (0 a 6)":
    "Clasificación de la vivienda. Si falta el ingreso conocido, se busca una referencia del lugar y estrato. Los escenarios comerciales se identifican como estimados. El estrato 0 es sin clasificación.",
  "Ingreso mensual, COP":
    "Ingreso mensual conocido del cliente. Tiene prioridad sobre las estimaciones por región y estrato. Dejar vacío permite estimar; escribir 0 registra un ingreso de cero.",
  "Origen del ingreso":
    "Observado: respaldado por datos. Declarado: informado por el cliente. Estimado: aproximación. Sin dato: desconocido. El origen influye en la confianza, no inventa ingresos.",
  Zona: "Registra si el cliente está en zona urbana o rural. Es contexto de ubicación; no agrega un recargo automático por sí solo.",
  "Fecha de creación":
    "Fecha de inicio de la actividad del cliente, no la fecha de esta cotización. Se puede registrar solo el año si no conoces el día.",
  Notas: "Contexto interno del cliente. Estas notas no se incluyen en el PDF para enviar.",
  "Título de la cotización":
    "Nombre de la propuesta que verás en la lista y en el PDF. Usa una descripción breve del trabajo.",
  Servicio:
    "Selecciona el trabajo a cotizar. Carga sus horas típicas, unidad, mínimo y porcentaje de capacidad. Puedes añadir otros servicios compatibles.",
  "Servicio adicional":
    "Permite reunir servicios de la misma unidad en una cotización. Suma horas y mínimos una sola vez; costos directos y viáticos se registran para el conjunto.",
  "Nivel de alcance":
    "Básico, estándar o avanzado describe la profundidad del trabajo. El mercado se compara con el mismo alcance, unidad y modalidad.",
  Cobro:
    "Por proyecto: importe del alcance completo. Mensual: importe de cada mes. Por hora: valor de una hora. No se mezclan estas unidades al comparar.",
  "Horas estimadas":
    "Tiempo de trabajo necesario para este alcance. Horas × costo por hora forma parte del piso; ajusta las horas típicas si el trabajo cambia.",
  "Horas estimadas al mes":
    "Horas de trabajo previstas cada mes. La propuesta mensual cotiza ese esfuerzo recurrente.",
  "Origen de las horas":
    "Indica si las horas se midieron en un trabajo real, fueron declaradas o son una estimación. Sirve para valorar la confianza del cálculo.",
  "Costos directos, COP":
    "Gastos propios de este trabajo, como licencias o recursos. Regístralos una sola vez. Se conservan al aplicar tarifa familiar; escribe 0 si no existen.",
  "Origen de los costos":
    "Indica si los gastos están respaldados, declarados o estimados. No transforma un costo desconocido en cero.",
  "Descripción del alcance":
    "Explica qué entregas y qué incluye el trabajo. Se guarda con la propuesta y aparece en el PDF para el cliente.",
  Modalidad:
    "Remota, presencial o híbrida. En presencial e híbrida, los días y gastos diarios calculan viáticos. El mercado se compara por modalidad.",
  "Días de desplazamiento":
    "Número de días con viaje. Viáticos = días × (transporte + alojamiento + alimentación por día). En remoto no se cobran viáticos.",
  "Precio final editable, COP":
    "Importe que decides ofrecer al cliente. Si lo dejas vacío se usa el sugerido. El PDF muestra este valor guardado, aunque lo hayas ajustado manualmente.",
  Vigencia:
    "Fecha hasta la que mantienes la propuesta. Se incluye en el PDF. Si la dejas vacía, el documento indicará que no tiene fecha de vigencia definida.",
  "Ingreso mensual objetivo, COP":
    "Lo que buscas ganar cada mes por tu trabajo. Junto con gastos fijos y horas facturables determina tu costo por hora.",
  "Gastos fijos mensuales, COP":
    "Gastos mensuales para operar, como internet y herramientas. Costo por hora = (ingreso objetivo + gastos fijos) ÷ horas facturables.",
  "Horas facturables al mes":
    "Horas que puedes cobrar, sin incluir administración o búsqueda de clientes. Divide entre estas horas tus necesidades mensuales para calcular el costo por hora.",
  "Recargo sobre el costo (%)":
    "Porcentaje que se agrega al costo por hora para obtener la tarifa objetivo. Un 30 % convierte 100.000 de costo en 130.000 de tarifa.",
  "Descuento familiar (%)":
    "Porcentaje completo sobre honorarios, de 0 a 100. Puede bajar del piso de costos. Conserva costos directos y viáticos; luego aplica el redondeo familiar hacia abajo.",
  "Redondeo hacia arriba, COP":
    "Paso comercial del sugerido normal. Con 100.000, 9.386.000 pasa a 9.400.000. Para importes menores que el paso se usa uno más pequeño.",
  "Redondeo familiar hacia abajo, COP":
    "Paso aplicado después del descuento familiar. Con 1.000.000, 9.386.000 pasa a 9.000.000. Reduce el paso en importes pequeños y conserva los gastos directos y viáticos.",
  "Tope sobre utilidad (%)":
    "Parte máxima de la utilidad operacional mensual que se toma como capacidad de una empresa. Solo puede aplicarse si hay datos para calcular la utilidad.",
  "Umbral de deuda baja (%)":
    "Límite de pasivos ÷ activos a partir del cual se aplica el multiplicador de deuda media a la capacidad empresarial.",
  "Umbral de deuda alta (%)":
    "Por encima de este porcentaje de pasivos ÷ activos se aplica el multiplicador de deuda alta. No modifica directamente el costo de tu trabajo.",
  "Umbral de margen bajo (%)":
    "Un margen operacional inferior a este porcentaje reduce la capacidad mediante el multiplicador de margen bajo.",
  "Umbral de margen alto (%)":
    "Un margen operacional superior a este porcentaje usa el multiplicador de margen alto. Margen = utilidad operacional ÷ ingresos operacionales.",
  "Umbral de liquidez":
    "Referencia para activo corriente ÷ pasivo corriente. Por debajo se aplica el multiplicador de baja liquidez.",
  "Mínimo de salud (al menos 0,5)":
    "Piso del factor que combina deuda, margen y liquidez de una empresa. 0,5 equivale a conservar al menos la mitad de la capacidad antes de otros topes.",
  "Evidencia para confianza alta (%)":
    "Porcentaje mínimo de entradas observadas o declaradas para mostrar confianza alta. Estimaciones y datos ausentes no cuentan como evidencia verificada.",
  "Evidencia para confianza media (%)":
    "Porcentaje mínimo de entradas observadas o declaradas para mostrar confianza media; por debajo se muestra baja.",
  "Umbral de valor atípico respecto a la mediana":
    "Detecta referencias alejadas de la mediana según este multiplicador. Es una señal para revisar el mercado y no una prueba de que el precio sea incorrecto.",
  "Antigüedad máxima de referencias, meses":
    "Ventana deseada para referencias del mercado. Las referencias antiguas se identifican para revisar su vigencia; no se convierten en ofertas actuales.",
  "Sin 61: usar inventario inicial + 62 menos inventario final":
    "Si falta el costo 61 y hay inventarios completos, estima costo = inventario inicial + compras − inventario final. No vuelve a sumar compras si ya existe 61.",
  "Sin 61 ni inventarios: aproximar con 62":
    "Permite usar compras como costo aproximado cuando falta 61 y no hay inventarios completos. Baja la confianza porque comprar no equivale siempre a vender.",
  "Sin 61 ni 62: aproximar con clase 7":
    "Usa costos de producción como última aproximación. Nunca suma clase 7 junto con costo 61 o compras 62.",
  "Periodo usado para calcular":
    "Periodo financiero que orienta la capacidad del cliente. Los importes anuales se convierten a valores mensuales dividiendo entre 12.",
  "Inicio del periodo":
    "Inicio del periodo que cubren todos los importes financieros. Puedes escribir año, año-mes o fecha completa.",
  "Fin del periodo": "Final del mismo periodo financiero. Debe ser igual o posterior al inicio.",
  "Duración de los importes":
    "Anual divide ingresos y utilidad entre 12. Mensual usa los importes tal como los registraste. No mezcles meses y años en el mismo formulario.",
  "Fuente financiera":
    "Identifica de dónde provienen los datos: estados financieros, declaración de renta, información declarada o estimación. Influye en la confianza.",
  "Nombres del formulario":
    "PUC y NIIF cambian las etiquetas contables. Formulario 210 usa un único renglón de costos y deducciones para evitar restarlo dos veces.",
  "Nombre del servicio":
    "Nombre comercial del trabajo o paquete que podrás seleccionar en la calculadora y mostrar al cliente.",
  "Horas típicas":
    "Esfuerzo habitual de este servicio. Sirve como punto de partida; puedes ajustarlo al alcance de cada cotización.",
  "Porcentaje del ingreso de la persona (0 a 100)":
    "Parte del ingreso mensual que orienta la capacidad para este servicio. Escribe 1 para 1 %. En un conjunto se toma el porcentaje mayor, no se suman.",
  "Mínimo del servicio, COP":
    "Valor mínimo normal del alcance. Junto con tus costos determina el piso. La tarifa familiar puede quedar por debajo.",
  "Precio recomendado, COP":
    "Referencia comercial editable del catálogo. Orienta tu oferta, pero no es una venta observada ni sustituye el cálculo de costos y mercado.",
  "Unidad por defecto":
    "Unidad que carga este servicio: proyecto, mes u hora. Los servicios agrupados deben compartir unidad.",
  "Alcance y entregables":
    "Describe qué recibe el cliente. Se propone como descripción al seleccionar el servicio y puede aparecer en el PDF.",
  "Desde, COP al mes": "Ingreso operacional mensual mínimo incluido en este tramo empresarial.",
  "Hasta, COP al mes":
    "Límite superior excluido de este tramo. El último tramo puede quedar vacío para no tener límite superior.",
  "Porcentaje del ingreso (%)":
    "Parte del ingreso operacional mensual que orienta la cuota de capacidad de una empresa. Escribe 1 para 1 %, no 0,01.",
  "Cuota mínima, COP":
    "Mínimo orientativo de capacidad del tramo, antes de salud financiera y topes. No es el piso de costos del trabajo.",
  "Cuota máxima, COP":
    "Máximo orientativo de capacidad del tramo, antes de aplicar la salud financiera y el tope por utilidad.",
  "Piso por costos":
    "Máximo entre el mínimo del servicio y el esfuerzo a costo más gastos directos y viáticos. La tarifa normal lo conserva; la familiar puede bajar del piso.",
  Mercado:
    "Referencia de ofertas comparables del mismo servicio, alcance, unidad y modalidad, convertidas a COP y ajustadas por ubicación cuando hay factores. Sin muestras compatibles queda sin dato.",
  "Rango de referencias, antes del redondeo":
    "Intervalo de referencias disponibles, respetando el piso. No es una promesa de precio ni un intervalo estadístico de confianza.",
  "Tarifa efectiva sugerida":
    "Precio sugerido ÷ horas de la cotización. Ayuda a revisar cuánto estás cobrando realmente por cada hora prevista.",
  "Confianza del cálculo":
    "Proporción de entradas observadas o declaradas entre horas, costos, capacidad e información de mercado. Una confianza alta no garantiza que el cliente acepte el precio.",
  "Utilidad operacional del periodo":
    "Ingresos operacionales menos costo de ventas y gastos de administración y ventas. En formulario 210, los costos y deducciones se restan una sola vez.",
  "Utilidad neta del periodo":
    "Utilidad operacional más otros ingresos, menos gastos no operacionales e impuesto de renta. Si falta algún dato no se supone que sea cero.",
  "EBITDA aproximado":
    "Utilidad operacional más depreciaciones y amortizaciones registradas. Es una aproximación con los datos del periodo.",
  "Ingresos operacionales mensuales":
    "Ingresos del periodo convertidos a una base mensual. Un dato anual se divide entre 12; uno mensual se conserva.",
  "Ingreso mensual · anual ÷ 12":
    "Los ingresos anuales del periodo se dividen entre 12 para compararlos con presupuestos y gastos mensuales.",
  "Ingreso mensual":
    "Ingreso operacional del periodo mensual registrado; no se divide otra vez entre 12.",
  "Utilidad operacional mensual":
    "Utilidad operacional del periodo dividida entre 12 si los importes son anuales. Orienta el tope de capacidad por utilidad.",
  "Costo utilizado (sin duplicados)":
    "Costo 61 si existe. Si falta, se consulta la alternativa habilitada de inventarios y compras, compras o clase 7, sin sumar dos alternativas a la vez.",
  "Margen operacional":
    "Utilidad operacional dividida entre ingresos operacionales. Sirve para ajustar la salud financiera; un ingreso cero no permite calcular este cociente.",
  Endeudamiento:
    "Pasivos totales divididos entre activos totales. Se compara con los umbrales de deuda configurados para ajustar capacidad.",
  Liquidez:
    "Activo corriente dividido entre pasivo corriente. Un resultado menor que el umbral configurado reduce la capacidad mediante el factor de baja liquidez.",
  "Salud financiera":
    "Multiplica los factores aplicables de deuda o patrimonio, margen y liquidez. Se conserva como mínimo el factor configurado; no aumenta ni disminuye el costo por hora de tu trabajo.",
  "Factor manual":
    "Multiplicador comercial por lugar y modalidad. 1 es neutral, 0,9 reduce un 10 % y 1,1 aumenta un 10 %. Un valor distinto de 1 necesita justificación.",
  "Servicio del factor":
    "Permite un factor exclusivo de un servicio. Sin servicio, el factor sirve como referencia general de esa región y modalidad.",
  "Modalidad del factor":
    "Modalidad a la que corresponde el multiplicador regional. Un factor remoto no reemplaza automáticamente uno presencial.",
  "Fecha del factor":
    "Fecha de la evidencia o decisión que respalda este factor. Ayuda a priorizar referencias de la misma región y especificidad.",
  "Justificación del factor":
    "Fuente y explicación del multiplicador. Distingue un estudio o muestras observadas de una decisión comercial manual.",
  "Servicio observado":
    "Servicio cuyas ofertas observadas se usarán para comparar medianas regionales. Se necesitan muestras compatibles en ambas regiones.",
  "Estrato estimado":
    "Estrato al que corresponde esta referencia de ingreso. Sin estrato representa una base regional general; no es un ingreso medido para todos los estratos.",
  "Ingreso mensual estimado, COP":
    "Referencia mensual del lugar y estrato, no un ingreso personal verificado. Tiene prioridad sobre un escenario comercial equivalente; un ingreso real del cliente tiene prioridad sobre ambos.",
  "Fecha del ingreso estimado":
    "Año o fecha de la fuente del ingreso. En escenarios comerciales corresponde a la base y no a una nueva medición por estrato.",
  "Justificación del ingreso estimado":
    "Indica fuente, año y método. Explica si se trata de una medición, un promedio regional o un escenario comercial.",
  "Servicio a comparar":
    "Filtra las referencias por servicio. Todos muestra grupos separados; no mezcla precios de servicios diferentes en un promedio único.",
  "Alcance a comparar":
    "Elige básico, estándar o avanzado. Todos mantiene cada alcance en su grupo para que las cifras sigan siendo comparables.",
  "Unidad a comparar":
    "Filtra por proyecto, mes u hora. Todos muestra grupos independientes, sin sumar ni promediar unidades distintas.",
  "Modalidad a comparar":
    "Filtra ofertas remotas, presenciales o híbridas. Todos las presenta separadas.",
  "Precio de referencia":
    "Precio publicado, declarado u observado para el alcance y unidad registrados. Revisa moneda, fecha, impuestos y condiciones del proveedor antes de compararlo.",
  Proveedor:
    "Persona o empresa que publicó o cotizó el precio. Permite contar proveedores distintos y revisar la fuente.",
  "Enlace de la fuente":
    "URL de la oferta o evidencia original para volver a comprobar precio, fecha, alcance y condiciones.",
  "Servicio de referencia":
    "Servicio al que pertenece el precio del proveedor. Solo se compara con el mismo servicio o alcance conjunto registrado.",
  Unidad:
    "Indica si el precio corresponde al proyecto, a cada mes o a una hora. No compares importes de unidades diferentes como si fueran equivalentes.",
  "Modalidad de referencia":
    "Modalidad de la oferta original: remota, presencial o híbrida. Conserva sus condiciones al compararla.",
  "Fuente de referencia":
    "Indica dónde se obtuvo la oferta: precio publicado, cotización u otra fuente. Usa el enlace para revisar las condiciones.",
  "Origen del precio":
    "Observado si hay evidencia real; declarado si fue informado; estimado si es una aproximación. Un precio publicado no demuestra que se haya vendido a ese valor.",
  Moneda:
    "Moneda de la oferta original. COP se compara directamente y USD requiere una TRM disponible; las monedas sin conversión no se mezclan.",
  "Fecha de referencia":
    "Fecha del precio original. Las referencias futuras no se usan y las antiguas se señalan para revisar su vigencia.",
  "Alcance observado":
    "Nivel de alcance que comparten las muestras usadas para obtener un factor regional: básico, estándar o avanzado.",
  "Unidad observada":
    "Unidad común de las muestras: proyecto, mes u hora. No se calcula un factor mezclando unidades.",
  "Modalidad observada":
    "Modalidad común de las ofertas usadas para estimar el factor: remota, presencial o híbrida.",
};

const financial: [RegExp, string][] = [
  [
    /activo total|patrimonio bruto/i,
    "Total de bienes y derechos del cliente. Con pasivos conocidos permite calcular patrimonio = activos − pasivos. No es ingreso mensual.",
  ],
  [
    /activo corriente/i,
    "Activos disponibles o realizables en el corto plazo. Junto con pasivo corriente permite calcular liquidez.",
  ],
  [
    /pasivo total|deudas/i,
    "Total de obligaciones del cliente. Se resta de activos para obtener patrimonio y se divide entre activos para calcular endeudamiento.",
  ],
  [
    /pasivo corriente/i,
    "Obligaciones del corto plazo. Liquidez = activo corriente ÷ pasivo corriente; con denominador cero queda sin indicador.",
  ],
  [
    /patrimonio/i,
    "Activos menos pasivos. Se calcula y guarda automáticamente cuando ambos están presentes; puede ser negativo. Si faltan, puedes registrar un patrimonio conocido.",
  ],
  [
    /41|ingresos de actividades/i,
    "Ventas o ingresos operacionales del periodo completo. Si el periodo es anual, se divide entre 12 para obtener la referencia mensual.",
  ],
  [
    /42|otros ingresos/i,
    "Ingresos del periodo fuera de la actividad principal. Se usan para calcular utilidad neta cuando el resto de datos está completo.",
  ],
  [
    /\b51\b|administraci/i,
    "Gastos administrativos del periodo. Se restan para calcular utilidad operacional. Escribe 0 si no existen; vacío significa desconocido.",
  ],
  [
    /\b52\b|gastos.*ventas|distribuci/i,
    "Gastos comerciales del periodo. Se restan de los ingresos para calcular utilidad operacional, sin duplicar el costo de ventas.",
  ],
  [
    /53|no operacionales|financieros/i,
    "Gastos no operacionales del periodo. Se restan al calcular utilidad neta; no se confunden con el ingreso operacional.",
  ],
  [
    /54|impuesto/i,
    "Impuesto de renta registrado para el periodo financiero. Sirve para calcular utilidad neta; no agrega ni calcula impuestos de esta cotización.",
  ],
  [
    /61|costo de ventas/i,
    "Costo final de ventas o servicios del periodo. Si está presente, no se vuelven a sumar compras 62 ni costos de producción clase 7.",
  ],
  [
    /62|compras/i,
    "Compras del periodo. Sin costo 61 se pueden usar con inventarios, o como aproximación habilitada. No se suman otra vez si existe 61.",
  ],
  [
    /producci|clase 7/i,
    "Costos de producción del periodo. Se usan como aproximación solo si falta 61 y no hay compras 62, y la opción está habilitada.",
  ],
  [
    /depreciaci|amortizaci/i,
    "Gasto contable por uso de activos. Se suma a la utilidad operacional para aproximar EBITDA cuando existe el dato.",
  ],
  [
    /inventario inicial/i,
    "Valor del inventario al comenzar el periodo. Sin 61: inventario inicial + compras − inventario final estima el costo.",
  ],
  [
    /inventario final/i,
    "Valor del inventario al cerrar el periodo. Se resta al estimar costo con compras e inventario inicial.",
  ],
  [
    /210|deducciones/i,
    "Costos y deducciones totales del formulario 210. Se restan una sola vez; no se vuelven a restar 51, 52 ni 61.",
  ],
];

export function pricingFieldHelp(label: string): string | undefined {
  if (help[label]) return help[label];
  const niifCode = label.match(/\((\d+)\)$/)?.[1];
  if (niifCode) label = `${niifCode} ${label}`;
  if (
    /activo|pasivo|otros ingresos|impuesto|^(1 |2 |3 |41 |42 |51 |52 |53 |54 |61 |62 |7 |14 |210 )|corriente|patrimonio|depreciaciones|actividades ordinarias|gastos de|costo de ventas|inventario/i.test(
      label,
    )
  )
    return financial.find(([pattern]) => pattern.test(label))?.[1];
  if (/^Peso de /.test(label))
    return "Importancia relativa de este criterio en el sugerido. Los pesos se normalizan entre los criterios con datos: si falta mercado, su peso se reparte entre los disponibles.";
  if (/^Multiplicador /.test(label))
    return "Factor aplicado a la capacidad empresarial cuando se cumple esta condición financiera. 0,85 conserva el 85 %, 1 no cambia y 1,1 aumenta un 10 %. No cambia tus costos por hora.";
  if (/^(Transporte|Alojamiento|Alimentación) por día/.test(label))
    return "Gasto previsto por cada día de desplazamiento. Se suma a los otros gastos diarios y se multiplica por los días; en remoto no se cobra.";
  if (/país/i.test(label))
    return "País de esta ubicación. Cambiarlo limpia departamento y municipio para evitar combinaciones incorrectas.";
  if (/municipio|ciudad/i.test(label))
    return "Municipio dentro del departamento elegido. La disponibilidad de referencias se indica en el selector; si faltan, se consulta la base departamental o nacional y se identifica como estimación.";
  if (/departamento|zona a comparar/i.test(label))
    return "Selecciona la zona para consultar referencias. Los conteos indican datos comparables con los filtros actuales; sin datos locales no se inventan ofertas del lugar.";
  if (/descripción del alcance/i.test(label)) return help["Descripción del alcance"];
  return undefined;
}
