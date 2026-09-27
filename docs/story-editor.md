# Editor de historia: fichas jugables

El editor de historia se abre en `/story`, desde el menú del juego o desde el constructor de sectores. El constructor existente permanece en `/editor` con sus mapas, edificios y pruebas.

## Fichas aplicadas a la campaña

Nombres, apodos, retratos, biografías, función mostrada, diez atributos iniciales y paga mensual de los personajes existentes. Se pueden buscar personajes, deshacer y rehacer cambios, recuperar el borrador e importar o exportar el paquete. Los retratos pueden usar imágenes locales o archivos PNG, JPEG y WebP de hasta 250 KB.

“Iniciar campaña con estas fichas” crea una campaña real con una copia validada de las definiciones. La identidad SHA-256 acompaña al paquete y se comprueba al importar la partida. El perfil editado llega a la contratación, al despliegue táctico y al guardado. Las campañas del editor tienen su propio guardado; no reemplazan la campaña normal ni la de pruebas.

Se conserva la economía publicada: `economyVersion: 2`, tesorería en pesos, compras y contratación por los plazos publicados, incluidos contratos semanales y mensuales de especialistas. No se restauran las antiguas cadenas de recursos estratégicos.

Los contratables del boletín no generan encuentros antes de ser contratados. Sus fichas no muestran controles de aparición. El boletín permite elegir un destino de llegada controlado con infraestructura de recepción: posta, cuartel, puerto o embarcadero. Una celda de agua o un paso cordillerano no sirven por sí solos. Los puertos y embarcaderos solo se habilitan en localidades con acceso al río navegable.

## Llegadas y contratos

La sección Llegadas permite elegir la infraestructura disponible. La ficha de cada contratado permite definir entre 0 y 168 horas de viaje; los paquetes nuevos usan 6 horas. Las campañas normales y los paquetes anteriores sin este campo conservan la llegada inmediata. No se modifican los plazos publicados de un día, una semana o un mes, incluidos los especialistas de élite.

El anticipo se paga una vez. Durante el viaje el personaje no está en el mapa ni en la escuadra. Su contrato comienza al llegar. Si pierde el destino, hay enemigos o un bloqueo impide la recepción por agua, espera fuera del mapa. Los puntos con una posta o un cuartel conservan su acceso terrestre durante el bloqueo. Si el sector está abierto, la llegada espera a que el jugador salga; una llegada remota tampoco modifica la escuadra desplegada.

El boletín muestra las llegadas pendientes, el destino y el tiempo restante. Cambiar el destino reinicia el viaje sin otro pago. Cancelar devuelve el anticipo una sola vez. El guardado conserva el pedido y valida el personaje, el destino, el plazo, el anticipo y el reloj. El viaje usa la duración definida en la ficha; todavía no simula una ruta geográfica de transporte.

## Borradores que todavía no llegan a la campaña

El paquete también permite preparar armas y apariciones, probar disparos y recargas en un campo aislado y simular ubicaciones con una semilla. El mapa permite marcar cualquier celda con una X desde la ficha del personaje, incluido terreno fuera de las localidades. Las imágenes de armas proceden del catálogo de su familia.

Estas opciones no se anuncian como comportamiento integrado. Cambiar armas o ubicaciones bloquea el inicio de campaña hasta que el motor consuma esas definiciones. También se rechazan nuevos personajes, eliminaciones y opciones de historia no compatibles, en lugar de descartarlas silenciosamente. El coste de levantar el arma no se edita en esta entrega; el coste de disparo corresponde a la simulación publicada.

Las habilidades, el servicio, los requisitos de reclutamiento y las funciones históricas conservan las reglas existentes. Quedan pendientes su extracción, las armas físicas configurables, las apariciones en el mundo, los diálogos y encargos editables, las escenas y la composición completa de campaña. Esta entrega no completa todo el editor de historia.

## Validación

`tests/story-editor.test.mjs` monta el formulario, recupera y modifica un borrador, usa deshacer y rehacer, inicia una campaña, contrata al personaje, lo despliega y guarda sus datos. También comprueba las imágenes de armas, la recuperación de datos inválidos y el bloqueo de opciones no aplicadas.

`tests/campaign-content.test.mjs` cubre identidad, guardado, contratos, retratos, atributos, separación de partidas y rechazo de definiciones alteradas. `tests/content-system.test.mjs` cubre el formato, las referencias y las simulaciones deterministas. Las pruebas de economía, contratos y sectores existentes se mantienen como controles de integración.

`tests/hiring-arrivals.test.mjs` comprueba control e infraestructura, bloqueo, incursiones en la misma hora, cobro y devolución únicos, desvíos, guardado y llegada tras salir de un sector. Las pruebas del formulario montado también configuran el viaje y los puntos de llegada, contratan, desvían y cancelan desde el boletín.
