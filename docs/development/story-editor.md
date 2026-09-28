# Editor de historia: fichas jugables

El editor de historia se abre en `/story`, desde el menú del juego o desde el constructor de sectores. El constructor existente permanece en `/editor` con sus mapas, edificios y pruebas.

## Fichas aplicadas a la campaña

Nombres, apodos, retratos, biografías, función mostrada, diez atributos iniciales y paga mensual. El catálogo permite crear, duplicar y quitar personajes contratables. Se pueden buscar personajes, deshacer y rehacer cambios, recuperar el borrador e importar o exportar el paquete. Los retratos pueden usar imágenes locales o archivos PNG, JPEG y WebP de hasta 250 KB.

“Iniciar campaña con estas fichas” crea una campaña real con una copia validada de las definiciones. La identidad SHA-256 acompaña al paquete y se comprueba al importar la partida. El perfil editado llega a la contratación, al despliegue táctico y al guardado. Las campañas del editor tienen su propio guardado; no reemplazan la campaña normal ni la de pruebas.

Se conserva la economía publicada: `economyVersion: 2`, tesorería en pesos, compras y contratación por los plazos publicados, incluidos contratos semanales y mensuales de especialistas. No se restauran las antiguas cadenas de recursos estratégicos.

Los contratables del boletín no generan encuentros antes de ser contratados. Sus fichas no muestran controles de aparición. El boletín permite elegir un destino de llegada controlado con infraestructura de recepción: posta, cuartel, puerto o embarcadero. Una celda de agua o un paso cordillerano no sirven por sí solos. Los puertos y embarcaderos solo se habilitan en localidades con acceso al río navegable.

## Crear y sustituir contratables

Cada candidato nuevo tiene identidad propia. Duplicar copia su ficha, retrato y equipo, pero crea otra identidad. Eliminar un candidato del catálogo lo excluye de las campañas nuevas; no modifica una partida ya iniciada. Se puede quitar todo el catálogo de contratables y crear otro. Las referencias de aparición impiden eliminar un personaje mientras otra regla lo use.

Las identidades nuevas no reciben poderes por ocupar el número de un mando histórico. El paquete de cada partida queda fijado al iniciarla, y el guardado conserva la correspondencia entre sus personajes y sus hojas de servicio. Los candidatos eliminados no se restauran al cargar.

La ficha permite elegir especialidades aplicadas por las reglas actuales, equitación y progreso por experiencia o nivel fijo. Equitación experta garantiza una destreza ecuestre mínima de 80. Con ambas opciones de progreso se conserva el entrenamiento práctico de atributos. Las especialidades llegan al combate y a la instrucción de milicia; un instructor nuevo puede guardar y continuar un curso. Los contratables nuevos pueden tener carácter, frases y apariencia propios. Los diálogos con opciones y encargos siguen pendientes.

Todos estos candidatos se incorporan por contrato desde el boletín. Una paga de cero es un contrato gratuito con el plazo elegido, no servicio permanente. El editor protege a los mandos históricos de eliminación y duplicación hasta separar sus funciones de campaña. El arma blanca inicial todavía usa el valor general existente.

## Habilidades de combate

Cada personaje puede recibir o perder cualquiera de las 19 habilidades de combate. La lista incluye protección de compañeros, contragolpe, tiro y movimiento rápidos, atención médica, exploración nocturna, carga montada, intimidación y apoyo de mando, recarga y artillería. Cada opción explica su efecto. Ninguna casilla marcada significa que el personaje no tiene esas ventajas, aunque conserve un nombre o identidad históricos. Los personajes nuevos empiezan sin habilidades; duplicar conserva la selección efectiva.

Las acciones, las decisiones enemigas, los efectos sobre compañeros cercanos y los costes mostrados usan estas opciones. La hoja de servicio muestra las habilidades elegidas y las especialidades del personaje. Las reglas de distancia, facción, dotación y estado siguen vigentes. Por ejemplo, un protector debe estar junto al mando, tener salud y puntos de acción, y solo puede interponerse una vez por turno. Un mando con liderazgo de al menos 90 conserva la protección prevista por las reglas generales; la habilidad «Mando protegido» permite recibirla sin ese umbral.

Las habilidades acompañan a la incorporación local, los contactos de misión, los soldados, los aliados temporales y los guardados. Las partidas rechazan listas inválidas o diferentes de las definidas para esa campaña. Las campañas normales y los paquetes anteriores sin este campo conservan sus capacidades históricas. Las funciones estratégicas, requisitos de reclutamiento y servicio de los mandos históricos todavía necesitan su propia configuración.

## Carácter, frases y apariencia

Cada ficha puede elegir un retrato de la biblioteca, conservar una imagen importada y seleccionar por separado uno de los ocho tipos de apariencia ya disponibles. La vista previa muestra el cuerpo con el arma asignada. Elegir un retrato no cambia el cuerpo ni los atributos. La apariencia llega al soldado, al contacto local y al comandante aliado; también se conserva al volver a entrar y al guardar. El personaje correspondiente en Yatasto usa su ficha. Todavía no se edita el color de piel ni se crean animaciones nuevas desde este formulario.

El carácter describe al personaje en su hoja de servicio, sin modificar su moral. Las siete frases corresponden a incorporación, detección de enemigos, sector asegurado, herida, agotamiento, muerte y fin de campaña. Cada frase admite hasta 800 caracteres; una frase vacía mantiene el silencio. El contratado pronuncia su incorporación al llegar, una sola vez. Las frases tácticas se disparan por los eventos reales y el cierre de campaña usa las frases de los compañeros vivos.

Estas opciones participan en la recuperación del borrador, deshacer/rehacer, duplicación, exportación, inicio y guardado. Los paquetes anteriores sin estos campos conservan sus perfiles. Las partidas rechazan voces o apariencias que difieren de la definición incluida. Los saludos, las conversaciones ramificadas, las misiones y los finales alternativos todavía requieren sus propios editores y reglas.

La prueba de incorporación también detectó que Cabral, Dorrego y Paroissien no tenían una condición regional adicional y se rechazaban después de cumplir el encuentro. Ahora pueden incorporarse al cumplir su conversación local, liderazgo, control y demás condiciones del encuentro. La contratación remota sigue bloqueada para ellos.

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

## Recorrer celdas del mapa

La carta de operaciones permite seleccionar las 1188 celdas de la cuadrícula con el ratón o las flechas del teclado. Las celdas terrestres fuera de una localidad y los barrios distintos tienen una ubicación, una escena y objetos propios. El marcador de la escuadra, la organización de unidades y la vista de objetos usan esa ubicación exacta. No se trasladan a la ciudad más cercana.

La marcha hacia una celda muestra el recorrido y las horas previstas. Cada tramo consume dos horas, o cuatro en terreno montañoso. Se comprueban el control, el invierno, las incursiones y los contratos durante el recorrido. Si se interrumpe la marcha, la escuadra conserva la última celda alcanzada. Los contratados que llegan durante la marcha permanecen en su destino de recepción. No se incorporan a una escuadra que pasa cerca.

El sector principal de cada localidad conserva su nombre, plano y guardados anteriores. Las rutas existentes entre esos sectores mantienen sus tiempos y transportes. Para salir de ellas hacia otras celdas se usa marcha a pie. Los barrios comparten el control de su localidad; liberarla habilita sus barrios. Los ingresos, las guarniciones, los talleres y los puntos de recepción no se multiplican en cada barrio o celda rural. El terreno abierto no genera una nueva localidad ni es un destino válido para contratar.

Las nuevas escenas tienen terreno esquemático estable. Sus puertas, cambios en el terreno, equipo y objetos se conservan al salir, guardar y regresar. Las partidas comprueban que cada escena pertenece a su celda. El terreno de las celdas nuevas se guarda sin repetir coordenadas y tipos iguales; al entrar se recupera el plano completo, incluidos los cambios. Esto reduce el tamaño del guardado al explorar muchas celdas, sin borrar escenas anteriores. El agua abierta se puede seleccionar, pero la marcha terrestre no puede entrar; las flotillas actuales usan rutas entre localidades y todavía no permiten explorar celdas de agua.

## Apariciones aplicadas a la campaña

Cada personaje de encuentro puede tener una celda fija, una ubicación elegida una vez al iniciar la campaña o un rango con cambios diarios a las 04:00. El mapa admite celdas terrestres de distintas regiones, incluidos barrios y terreno abierto. Quitar la aparición deja al personaje fuera del mapa. Los contratables del boletín no pueden tener apariciones.

Los cambios diarios admiten probabilidad, sorteo entre las celdas marcadas o alternancia entre dos celdas. Se puede proteger la celda abierta o suspender todos los cambios del personaje mientras alguna celda de su rango está abierta. Un sorteo que apunta a la celda abierta cancela ese traslado; no vuelve a sortear para forzar otro destino. Un personaje presente no desaparece de la escena abierta al cambiar el día.

La campaña conserva el reloj y un estado aleatorio propio para estas decisiones. Abrir una ficha, consultar contactos, guardar o cargar no vuelve a sortear. El personaje aparece en la escena de su celda y se puede conversar o incorporar allí si cumple sus requisitos. Los requisitos históricos regionales todavía son los originales, aunque se cambie la ubicación.

Al trasladarse se elimina la copia de la escena anterior. La nueva escena inicia una rutina local; no copia coordenadas, casas o destinos del sector anterior. Volver al mismo sector sin un traslado conserva la rutina guardada. La correspondencia muestra la ubicación fija conocida o el último encuentro; no revela el resultado de los sorteos.

Esta entrega integra los personajes de encuentro existentes. La salud y la muerte de estos personajes ya se conservan en campaña. No incorpora todavía inventarios de NPC editables, cautiverio, nuevas identidades de encuentro ni transferencia de funciones a un sucesor. Las condiciones de muerte se pueden simular en el editor, pero bloquean el inicio de campaña hasta completar esas funciones. Las escenas de misión especiales conservan su elenco propio.

Las partidas anteriores mantienen sus encuentros originales. Las nuevas campañas usan una versión explícita con presencia guardada; quitar ese registro o cambiar posiciones por fuera del rango invalida el archivo. Las pruebas exportadas del simulador pasan a la versión 2 por el cambio en las reglas de sorteo: los archivos de prueba de versión 1 se rechazan con un aviso para crear una prueba nueva. El paquete de contenido y las partidas anteriores mantienen su compatibilidad.

## Heridas y muerte de los habitantes

Las heridas pertenecen al personaje. Guardar, cambiar de celda o incorporarlo a la escuadra no restaura su salud. La salud máxima usa su ficha. Al incorporarse deja de existir como NPC en las escenas guardadas. Si luego deja el servicio, conserva su estado de soldado.

En el campo táctico podés usar los cursores normales para atacar o atender a un habitante. Las armas y las trampas pueden herirlo. La hemorragia continúa mientras la escena está abierta. Un personaje inconsciente no puede caminar ni conversar. Los primeros auxilios gastan una carga de vendas, detienen la hemorragia y estabilizan a un herido crítico en 15 puntos; no lo curan por completo. Las vendas gastadas no se reponen al volver a entrar. En un taller abastecido podés reponer provisiones: cada carga de vendas que falta cuesta 10 pesos, hasta recuperar las dos cargas iniciales.

La muerte cancela los traslados y el reclutamiento. El cuerpo queda en su escena. La campaña aplica una vez la consecuencia local de lealtad y marca como fallido un encargo pendiente de ese contacto. Si muere un mando indispensable de la historia original, la campaña termina. San Martín comparte su salud entre sus funciones de contacto y aliado.

Esto todavía no permite crear NPC nuevos, editar sus pertenencias, saquearlos, mantenerlos cautivos ni activar sucesores. No se inventa equipo para sus cuerpos. Las heridas se conservan fuera de la escena, pero todavía no se simula atención médica o hemorragia mientras el sector está cerrado. La [verificación](../verification/civilian-state.md) detalla las pruebas y los límites.

## Borradores que todavía no llegan a la campaña

El mapa permite marcar cualquier celda con una X desde la ficha del personaje, incluido terreno fuera de las localidades. Se pueden simular ubicaciones con una semilla. Las ubicaciones fijas, el sorteo inicial y los cambios diarios ya se aplican a las nuevas campañas. Crear personajes de encuentro, eliminar mandos históricos y usar opciones de historia no compatibles todavía bloquea el inicio de campaña.

Los mandos históricos conservan su servicio permanente, requisitos de reclutamiento y funciones de campaña. Sus habilidades de combate ya son configurables. Quedan pendientes su extracción, las identidades nuevas de encuentro, las sucesiones por muerte, los diálogos y encargos editables, las escenas dirigidas y la composición completa de campaña. Esta entrega no completa todo el editor de historia.

## Validación

`tests/story-editor.test.mjs` monta el formulario, recupera y modifica un borrador, usa deshacer y rehacer, inicia una campaña, contrata al personaje, lo despliega y guarda sus datos. También comprueba las imágenes de armas, la recuperación de datos inválidos y el bloqueo de opciones no aplicadas.

`tests/campaign-content.test.mjs` cubre identidad, guardado, contratos, retratos, atributos, separación de partidas y rechazo de definiciones alteradas. `tests/content-system.test.mjs` cubre el formato, las referencias y las simulaciones deterministas. Las pruebas de economía, contratos y sectores existentes se mantienen como controles de integración.

`tests/hiring-arrivals.test.mjs` comprueba control e infraestructura, bloqueo, incursiones en la misma hora, cobro y devolución únicos, desvíos, guardado y llegada tras salir de un sector. Las pruebas del formulario montado también configuran el viaje y los puntos de llegada, contratan, desvían y cancelan desde el boletín.

`tests/content-weapons.test.mjs` cubre variantes, compra, importación, ejemplares usados, disparos de la IA, abandono, recuperación, cambios de equipo, retirada, guardado y nuevo despliegue. El caso de combate usa un escenario pequeño con el despliegue y el regreso reales de campaña; no sustituye un recorrido completo. También comprueba imágenes grandes compartidas y rechazo de definiciones o referencias alteradas. El formulario montado crea un arma con imagen propia, la asigna, inicia la campaña y equipa un ejemplar desde la armería.

`tests/content-force-equipment.test.mjs` comprueba todas las asignaciones, un ataque de campaña, tropas sin arma, disparos de la IA, recuperación y regreso al combate, instrucción y ascensos de milicia, munición persistente y guardados alterados. Los casos de disparo y recuperación usan terreno compacto y actores generados por la campaña; no representan una prueba completa del mapa o de la campaña. El formulario montado cubre asignación, deshacer/rehacer, protección de referencias y activación en borradores anteriores.

`tests/content-roster.test.mjs` comprueba identidades nuevas, eliminación del catálogo, separación respecto del oficial y la milicia, contratación y llegada, desvío y cancelación, entrenamiento y progreso, guardado y rechazo de identidades inválidas. El combate compacto verifica heridas reales, retirada y nuevo despliegue; no equivale a completar la campaña. El formulario montado crea, duplica, elimina y contrata candidatos nuevos.

`tests/content-presentation.test.mjs` comprueba las frases con eventos tácticos reales, llegada única, silencios, final de campaña, aparición del contacto y comandante, incorporación local, compatibilidad y rechazo de cambios en guardados. El cierre usa un estado final preparado y el combate un terreno compacto; no prueban una campaña entera. El editor montado cubre retrato/apariencia independientes, frases, duplicación y lanzamiento; la prueba de presentación táctica comprueba el cuerpo elegido después de guardar y cargar.


`tests/content-abilities.test.mjs` comprueba las capacidades con acciones de combate, fuego enemigo, apoyo de formación, dotaciones, límites de PA, guardados y compatibilidad. También comprueba quitar habilidades a identidades históricas y cambiar el nombre u orden del catálogo sin cambiar sus capacidades. Las pruebas del editor cubren selección, borradores anteriores, deshacer/rehacer, duplicación y lanzamiento; las de presentación comprueban incorporación local y reentrada en una escena de misión con capacidades editadas. Se usan escenarios de combate acotados; no prueban una campaña completa.

`tests/world-cells.test.mjs` recorre, entra y vuelve a entrar en dos celdas rurales y dos barrios distintos con la campaña real. Comprueba objetos recogidos, puertas, relojes, contratos, llegadas, escuadras separadas, incursiones, servicios, agua, invierno y rechazo de escenas intercambiadas. `tests/world-cells-render.test.mjs` monta la carta de operaciones, selecciona celdas, ordena marchas, entra, guarda y consulta objetos con los controles reales. También se comprueba un recorrido continuo por 40 celdas, que antes excedía el límite de guardado, y el rechazo de terreno comprimido inválido o con un tamaño de expansión excesivo. Estas pruebas no sustituyen la continuidad de NPC ni una campaña completa.

`tests/campaign-presence.test.mjs` comprueba conversación e incorporación en una celda rural mediante movimiento táctico real, guardado activo, reentrada, sorteo único, recorridos diarios, protección de escenas a las 04:00, eliminación de copias antiguas y rechazo de registros inválidos. También comprueba la aparición en un ataque real a un sector enemigo y su guardado activo. Comprueba correspondencia sin revelar sorteos y conservación de contratos fuera del mapa. El editor montado configura las celdas y reglas, usa deshacer/rehacer e inicia un encuentro real. No prueba bajas civiles ni una campaña completa.

`tests/civilian-state.test.mjs` comprueba heridas, muerte, cambios de celda, incorporación, baja del servicio, misiones, lealtad y guardados. `tests/civilian-interaction.test.mjs` usa los controles del campo táctico montado para atacar y atender a un NPC. No equivalen a un recorrido completo de campaña.
