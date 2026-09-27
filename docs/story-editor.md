# Editor de historia: fichas jugables

El editor de historia se abre en `/story`, desde el menú del juego o desde el constructor de sectores. El constructor existente permanece en `/editor` con sus mapas, edificios y pruebas.

## Fichas aplicadas a la campaña

Nombres, apodos, retratos, biografías, función mostrada, diez atributos iniciales y paga mensual de los personajes existentes. Se pueden buscar personajes, deshacer y rehacer cambios, recuperar el borrador e importar o exportar el paquete. Los retratos pueden usar imágenes locales o archivos PNG, JPEG y WebP de hasta 250 KB.

“Iniciar campaña con estas fichas” crea una campaña real con una copia validada de las definiciones. La identidad SHA-256 acompaña al paquete y se comprueba al importar la partida. El perfil editado llega a la contratación, al despliegue táctico y al guardado. Las campañas del editor tienen su propio guardado; no reemplazan la campaña normal ni la de pruebas.

Se conserva la economía publicada: `economyVersion: 2`, tesorería en pesos, compras y contratación por los plazos publicados, incluidos contratos semanales y mensuales de especialistas. No se restauran las antiguas cadenas de recursos estratégicos.

Los contratables del boletín no generan encuentros antes de ser contratados. Sus fichas no muestran controles de aparición. Esta entrega aún no incorpora la elección ni el tiempo de llegada a un destino: ese cambio requiere la siguiente integración del sistema de contratación.

## Borradores que todavía no llegan a la campaña

El paquete también permite preparar armas y apariciones, probar disparos y recargas en un campo aislado y simular ubicaciones con una semilla. El mapa permite marcar cualquier celda con una X desde la ficha del personaje, incluido terreno fuera de las localidades. Las imágenes de armas proceden del catálogo de su familia.

Estas opciones no se anuncian como comportamiento integrado. Cambiar armas o ubicaciones bloquea el inicio de campaña hasta que el motor consuma esas definiciones. También se rechazan nuevos personajes, eliminaciones y opciones de historia no compatibles, en lugar de descartarlas silenciosamente. El coste de levantar el arma no se edita en esta entrega; el coste de disparo corresponde a la simulación publicada.

Las habilidades, el servicio, los requisitos de reclutamiento y las funciones históricas conservan las reglas existentes. Quedan pendientes su extracción, las armas físicas configurables, las llegadas, las apariciones en el mundo, los diálogos y encargos editables, las escenas y la composición completa de campaña. Esta entrega no completa todo el editor de historia.

## Validación

`tests/story-editor.test.mjs` monta el formulario, recupera y modifica un borrador, usa deshacer y rehacer, inicia una campaña, contrata al personaje, lo despliega y guarda sus datos. También comprueba las imágenes de armas, la recuperación de datos inválidos y el bloqueo de opciones no aplicadas.

`tests/campaign-content.test.mjs` cubre identidad, guardado, contratos, retratos, atributos, separación de partidas y rechazo de definiciones alteradas. `tests/content-system.test.mjs` cubre el formato, las referencias y las simulaciones deterministas. Las pruebas de economía, contratos y sectores existentes se mantienen como controles de integración.
