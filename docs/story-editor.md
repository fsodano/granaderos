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

## Armas de fuego aplicadas a la campaña

Cada arma puede tener su propio nombre, imagen, daño, alcance, costes de disparo, puntería y recarga, capacidad, peso y precio. Se pueden crear variantes de una misma familia y asignarlas a los personajes. La imagen puede ser un archivo PNG, JPEG o WebP de hasta 250 KB. El campo de prueba y la campaña usan la misma definición.

Las variantes aparecen por separado en la armería. Cada ejemplar conserva su identidad, desgaste y atasco al equiparlo o devolverlo. Las familias importadas conservan la entrega por Ensenada y sus demoras por bloqueo. El inventario, las armas recuperadas y el equipo abandonado muestran el nombre y la imagen propios. Disparar, recargar, recuperar un arma, cambiarla y volver al mapa conservan su definición.

Las partidas nuevas del editor guardan estas definiciones por referencia al paquete incluido. La imagen no se repite por cada ejemplar. Al cargar se comprueba la identidad del paquete y cada referencia; también se admiten las definiciones completas guardadas anteriormente. Las campañas normales y las campañas antiguas con solo fichas conservan su catálogo publicado.

La munición mantiene la economía existente: se compran diez cartuchos por arma al entrar al sector y se devuelve el valor de los cartuchos restantes al salir. Los cartuchos de un arma guardada en la mochila siguen en esa arma. Cambiar un arma en la armería se hace fuera del sector y devuelve el arma descargada. La disponibilidad comercial sigue siendo ilimitada; todavía no hay cantidades y reposición configurables por comerciante.

Esta entrega admite armas de fuego de las familias existentes. Las armas blancas, la artillería, los accesorios, los tipos de munición y el coste de levantar el arma siguen pendientes. Las opciones de manejo todavía no integradas bloquean el inicio de campaña.

## Armamento de enemigos y milicias

La sección Armas de fuego incluye el armamento de las tropas. Se puede elegir un arma del catálogo, o ninguna, para oficiales, infantería y veteranos enemigos y para cada uno de los tres grados de milicia. El editor impide eliminar un arma mientras alguna tropa la use. Estas asignaciones se guardan con el borrador y participan en deshacer, rehacer, importación y exportación. Los paquetes anteriores sin estas opciones conservan las armas originales y pueden activar su configuración desde la misma sección.

Las asignaciones se aplican cuando se crea un soldado. Las tropas que ya existen conservan su equipo, munición y desgaste al regresar al sector. Una tropa sin arma de fuego no recibe cartuchos ni cebo. Las nuevas tropas enemigas reciben trece cartuchos en total y las milicias seis, distribuidos entre carga y reserva según la capacidad real del arma. Estas cantidades corresponden al abastecimiento actual; todavía no son una regla editable.

La inteligencia artificial usa el coste de disparo, alcance y capacidad del arma elegida. El equipo recuperado conserva su definición, imagen y carga. Al regresar del combate, la devolución de cartuchos incluye las cargas recuperadas de enemigos. Volver a un combate pendiente usa las existencias reales de los soldados guardados, sin volver a acreditar cargas recuperadas antes.

## Borradores que todavía no llegan a la campaña

El mapa permite marcar cualquier celda con una X desde la ficha del personaje, incluido terreno fuera de las localidades. Se pueden simular ubicaciones con una semilla. Cambiar estas apariciones todavía bloquea el inicio de campaña hasta integrar el recorrido y la presencia en esas celdas. También se rechazan nuevos personajes, eliminaciones y opciones de historia no compatibles.

Las habilidades, el servicio, los requisitos de reclutamiento y las funciones históricas conservan las reglas existentes. Quedan pendientes su extracción, las apariciones en el mundo, los diálogos y encargos editables, las escenas y la composición completa de campaña. Esta entrega no completa todo el editor de historia.

## Validación

`tests/story-editor.test.mjs` monta el formulario, recupera y modifica un borrador, usa deshacer y rehacer, inicia una campaña, contrata al personaje, lo despliega y guarda sus datos. También comprueba las imágenes de armas, la recuperación de datos inválidos y el bloqueo de opciones no aplicadas.

`tests/campaign-content.test.mjs` cubre identidad, guardado, contratos, retratos, atributos, separación de partidas y rechazo de definiciones alteradas. `tests/content-system.test.mjs` cubre el formato, las referencias y las simulaciones deterministas. Las pruebas de economía, contratos y sectores existentes se mantienen como controles de integración.

`tests/hiring-arrivals.test.mjs` comprueba control e infraestructura, bloqueo, incursiones en la misma hora, cobro y devolución únicos, desvíos, guardado y llegada tras salir de un sector. Las pruebas del formulario montado también configuran el viaje y los puntos de llegada, contratan, desvían y cancelan desde el boletín.

`tests/content-weapons.test.mjs` cubre variantes, compra, importación, ejemplares usados, disparos de la IA, abandono, recuperación, cambios de equipo, retirada, guardado y nuevo despliegue. El caso de combate usa un escenario pequeño con el despliegue y el regreso reales de campaña; no sustituye un recorrido completo. También comprueba imágenes grandes compartidas y rechazo de definiciones o referencias alteradas. El formulario montado crea un arma con imagen propia, la asigna, inicia la campaña y equipa un ejemplar desde la armería.

`tests/content-force-equipment.test.mjs` comprueba todas las asignaciones, un ataque de campaña, tropas sin arma, disparos de la IA, recuperación y regreso al combate, instrucción y ascensos de milicia, munición persistente y guardados alterados. Los casos de disparo y recuperación usan terreno compacto y actores generados por la campaña; no representan una prueba completa del mapa o de la campaña. El formulario montado cubre asignación, deshacer/rehacer, protección de referencias y activación en borradores anteriores.
