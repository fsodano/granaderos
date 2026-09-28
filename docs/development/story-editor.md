# Editor de historia: fichas jugables

El editor de historia se abre en `/story`, desde el menú del juego o desde el constructor de sectores. El constructor existente permanece en `/editor` con sus mapas, edificios y pruebas.

## Fichas aplicadas a la campaña

Nombres, apodos, retratos, biografías, función mostrada, diez atributos iniciales y paga mensual. El catálogo permite crear, duplicar y quitar contratables y habitantes nuevos. Se pueden buscar personajes, deshacer y rehacer cambios, recuperar el borrador e importar o exportar el paquete. Los retratos pueden usar imágenes locales o archivos PNG, JPEG y WebP de hasta 250 KB.

“Iniciar campaña con estas fichas” crea una campaña real con una copia validada de las definiciones. La identidad SHA-256 acompaña al paquete y se comprueba al importar la partida. El perfil editado llega a la contratación, al despliegue táctico y al guardado. Las campañas del editor tienen su propio guardado; no reemplazan la campaña normal ni la de pruebas.

Se conserva la economía publicada: `economyVersion: 2`, tesorería en pesos, compras y contratación por los plazos publicados, incluidos contratos semanales y mensuales de especialistas. No se restauran las antiguas cadenas de recursos estratégicos.

Los contratables del boletín no generan encuentros antes de ser contratados. Sus fichas no muestran controles de aparición. El boletín permite elegir un destino de llegada controlado con infraestructura de recepción: posta, cuartel, puerto o embarcadero. Una celda de agua o un paso cordillerano no sirven por sí solos. Los puertos y embarcaderos solo se habilitan en localidades con acceso al río navegable.

## Crear y sustituir contratables

Cada candidato nuevo tiene identidad propia. Duplicar copia su ficha, retrato y equipo, pero crea otra identidad. Eliminar un candidato del catálogo lo excluye de las campañas nuevas; no modifica una partida ya iniciada. Se puede quitar todo el catálogo de contratables y crear otro. Las referencias de aparición impiden eliminar un personaje mientras otra regla lo use.

Las identidades nuevas no reciben poderes por ocupar el número de un mando histórico. El paquete de cada partida queda fijado al iniciarla, y el guardado conserva la correspondencia entre sus personajes y sus hojas de servicio. Los candidatos eliminados no se restauran al cargar.

La ficha permite elegir especialidades aplicadas por las reglas actuales, equitación y progreso por experiencia o nivel fijo. Equitación experta garantiza una destreza ecuestre mínima de 80. Con ambas opciones de progreso se conserva el entrenamiento práctico de atributos. Las especialidades llegan al combate y a la instrucción de milicia; un instructor nuevo puede guardar y continuar un curso. Los contratables nuevos pueden tener carácter, frases y apariencia propios. Los habitantes nuevos tienen diálogos con opciones. Los encargos editables se conectan a las opciones de diálogo y tienen un registro en la carta de campaña.

Todos estos candidatos se incorporan por contrato desde el boletín. Una paga de cero es un contrato gratuito con el plazo elegido, no servicio permanente. El editor protege a los mandos históricos de eliminación y duplicación hasta separar sus funciones de campaña. El arma blanca inicial todavía usa el valor general existente.

## Crear habitantes del mundo

«Crear habitante» agrega una identidad propia. Puede tener retrato, apariencia, atributos, saludo, habilidades y una ubicación fija, sorteada al inicio o elegida cada día entre las celdas marcadas. No ocupa un puesto histórico ni aparece en el boletín. Sin una aparición configurada queda fuera del mapa.

La opción «Puede incorporarse a la escuadra» permite elegir entre un interlocutor civil y un recluta local. Para incorporarlo hay que encontrarlo y conversar junto a él. Su ficha define el liderazgo mínimo, la cantidad de localidades seguras y una localidad concreta que deba estar liberada, si corresponde. Retiro y Buenos Aires cuentan como una localidad para ese requisito. Un habitante muerto, inconsciente o cautivo no puede incorporarse.

El «Tipo de servicio» permite elegir servicio permanente sin paga o contrato por un día, una semana o un mes. En el segundo caso, la paga mensual define el precio base. El editor muestra los tres precios iniciales: el importe diario se redondea hacia arriba, la semana usa siete días y el mes treinta. La experiencia puede aumentar el precio futuro. Un contrato de cero pesos conserva su vencimiento. El arma de la ficha se entrega al incorporarse; todavía no representa un inventario de NPC que se pueda saquear. El equipo blanco inicial conserva la regla general del juego.

La conversación muestra el plazo y el precio antes de contratar; el botón queda deshabilitado si faltan pesos. El servicio empieza en esa celda, sin viaje de llegada. Al vencer durante un despliegue, el personaje espera a que salgas del sector. Después vuelve según su aparición configurada, conservando su salud. Puede renovarse el contrato desde la campaña. Despedirlo no devuelve el anticipo.

Duplicar un habitante copia su configuración y sus celdas con otra identidad. Eliminarlo quita su aparición; si otra regla depende de él, primero se debe quitar esa referencia. Deshacer, rehacer, exportar y recuperar el borrador conservan estos cambios. Las campañas ya iniciadas mantienen su propio paquete. Los mandos históricos siguen protegidos hasta separar sus funciones de campaña.

Los habitantes usan la salud persistente: cambiar de celda, guardar o incorporarse no los cura. Si dejan la escuadra, vuelven con su estado de soldado. Su progreso puede conservar el nivel inicial o ganar experiencia según la ficha.

## Diálogos con opciones

En la ficha de un habitante nuevo, activá «Escribir una conversación con opciones». Elegí el comienzo y escribí la respuesta del personaje. «Agregar pasaje» crea otra respuesta. «Agregar opción» permite escribir lo que el jugador puede decir y elegir la respuesta siguiente.

Los títulos sirven para organizar el diálogo; el jugador ve el texto y las opciones. Un pasaje sin opciones termina ese tramo. Para volver a una pregunta anterior, agregá una opción que conduzca a ella. Se admiten hasta 30 pasajes y 12 opciones por pasaje. Podés conservar pasajes sin conectar mientras escribís. El editor avisa que todavía no tienen entrada y protege de eliminación los que ya están referenciados.

Al jugar, acercate al habitante y elegí «Conversar». La partida conserva el pasaje actual aunque cierres la conversación, salgas del sector o incorpores y luego despidas al personaje. Volver a conversar retoma ese pasaje. Una elección atrasada no reemplaza una rama ya elegida. Los habitantes muertos o inconscientes no pueden conversar.

Deshacer, rehacer, duplicar, recuperar el borrador e importar/exportar conservan el diálogo. La copia de un personaje tiene su propio diálogo y progreso. Cada opción puede tener hasta seis condiciones. Todas deben cumplirse para mostrarla. Podés exigir un intervalo de días, pesos disponibles, el control patriota o realista de una localidad, o que un personaje esté vivo, muerto, incorporado o presente en el mundo. Un límite máximo vacío no tiene tope. El primer día es el día 1. «Presente en el mundo» significa que ya apareció, tiene una celda asignada y no está incorporado ni cautivo. El control se consulta sobre las localidades existentes; la selección de celdas de aparición conserva todo el mapa.

El juego comprueba las condiciones al mostrar las opciones y al elegirlas. Una opción puede aparecer al pasar de día o después de la muerte de otro personaje. Las referencias a personajes impiden eliminarlos mientras una conversación los use. Las condiciones no cambian el estado por sí solas. Para cambiar el dinero disponible, agregá una operación en «Pago o recompensa».

Activá «Cambiar los pesos al elegir esta opción», elegí si el jugador paga o recibe y escribí el importe. El juego muestra esas condiciones antes de elegir. Cada operación se aplica una sola vez por personaje y opción. Guardar, volver a la conversación o incorporar y luego despedir al personaje no la repite. Si faltan fondos, la opción queda desactivada y explica cuánto falta. Las copias de personajes tienen registros independientes. Una opción también puede cambiar un encargo. Si combina ese cambio con pesos, ambos se aplican juntos. Estas operaciones todavía no entregan objetos ni ordenan movimientos.

## Encargos

En «Encargos», creá un título y un objetivo. Podés buscar, duplicar, eliminar, deshacer y recuperar los cambios. Una conversación que usa el encargo impide eliminarlo hasta quitar esa referencia. Duplicar crea otra identidad; las conversaciones existentes siguen usando el original.

En una opción del diálogo, activá «Cambiar un encargo al elegir esta opción». Elegí el encargo y el resultado: iniciar, completar o fallar. El recorrido permitido es «Sin iniciar» → «En curso» → «Completado» o «Fallido». Un estado final no se reinicia. El juego desactiva un cambio que no corresponde al estado actual y explica la causa.

Usá «Estado de un encargo» como condición para mostrar las respuestas de cada etapa. Podés combinarla con días, pesos, control o estado de personajes. Una persona puede ofrecer el encargo y otra recibir el resultado. Para exigir una localidad liberada, agregá esa condición a la opción que lo completa. Para una reacción elegida por el jugador, configurá esas condiciones en una opción de fracaso de otro interlocutor disponible. Para un fallo automático, usá el plazo o los personajes necesarios del encargo.

El campo «Plazo desde la aceptación» admite de 1 a 720 horas. Dejalo vacío para no limitar el tiempo. Cuenta desde el momento real de aceptación e incluye viajes, esperas y acciones dentro del sector. Si vence mientras está en curso, el encargo queda fallido una sola vez. Completalo antes del límite para conservar el resultado. El tiempo no corre para un encargo sin iniciar.

En «Personajes necesarios para el encargo», elegí hasta seis personas que deban seguir vivas. Si muere cualquiera mientras está en curso, falla una sola vez y conserva la causa. Si una ya murió, no se puede iniciar. Se aplica tanto a habitantes como a combatientes incorporados. Las heridas, la inconsciencia o la salida del servicio no son una muerte. Un encargo completado conserva su resultado aunque después muera alguien. La referencia protege al personaje de eliminación en el editor.

La carta de campaña muestra el título, objetivo, estado y días de inicio/resolución desde que se acepta el encargo. También muestra los minutos restantes, el vencimiento y si falló por el plazo o la muerte de una persona necesaria. Cerrá la conversación y pulsá M para consultar la carta. Los encargos sin iniciar no revelan su descripción. Guardar conserva la secuencia de cambios y cada operación ya realizada. Repetir una opción consumida conserva el estado y no vuelve a pagar. Los encargos históricos del Cabildo conservan sus reglas originales.

## Habilidades de combate

Cada personaje puede recibir o perder cualquiera de las 19 habilidades de combate. La lista incluye protección de compañeros, contragolpe, tiro y movimiento rápidos, atención médica, exploración nocturna, carga montada, intimidación y apoyo de mando, recarga y artillería. Cada opción explica su efecto. Ninguna casilla marcada significa que el personaje no tiene esas ventajas, aunque conserve un nombre o identidad históricos. Los personajes nuevos empiezan sin habilidades; duplicar conserva la selección efectiva.

Las acciones, las decisiones enemigas, los efectos sobre compañeros cercanos y los costes mostrados usan estas opciones. La hoja de servicio muestra las habilidades elegidas y las especialidades del personaje. Las reglas de distancia, facción, dotación y estado siguen vigentes. Por ejemplo, un protector debe estar junto al mando, tener salud y puntos de acción, y solo puede interponerse una vez por turno. Un mando con liderazgo de al menos 90 conserva la protección prevista por las reglas generales; la habilidad «Mando protegido» permite recibirla sin ese umbral.

Las habilidades acompañan a la incorporación local, los contactos de misión, los soldados, los aliados temporales y los guardados. Las partidas rechazan listas inválidas o diferentes de las definidas para esa campaña. Las campañas normales y los paquetes anteriores sin este campo conservan sus capacidades históricas. Las funciones estratégicas, requisitos de reclutamiento y servicio de los mandos históricos todavía necesitan su propia configuración.

## Carácter, frases y apariencia

Cada ficha puede elegir un retrato de la biblioteca, conservar una imagen importada y seleccionar por separado uno de los ocho tipos de apariencia ya disponibles. La vista previa muestra el cuerpo con el arma asignada. Elegir un retrato no cambia el cuerpo ni los atributos. La apariencia llega al soldado, al contacto local y al comandante aliado; también se conserva al volver a entrar y al guardar. El personaje correspondiente en Yatasto usa su ficha. Todavía no se edita el color de piel ni se crean animaciones nuevas desde este formulario.

El carácter describe al personaje en su hoja de servicio, sin modificar su moral. Las siete frases corresponden a incorporación, detección de enemigos, sector asegurado, herida, agotamiento, muerte y fin de campaña. Cada frase admite hasta 800 caracteres; una frase vacía mantiene el silencio. El contratado pronuncia su incorporación al llegar, una sola vez. Las frases tácticas se disparan por los eventos reales y el cierre de campaña usa las frases de los compañeros vivos.

Estas opciones participan en la recuperación del borrador, deshacer/rehacer, duplicación, exportación, inicio y guardado. Los paquetes anteriores sin estos campos conservan sus perfiles. Las partidas rechazan voces o apariencias que difieren de la definición incluida. Los habitantes nuevos tienen un saludo editable. Las ramificaciones de texto para habitantes nuevos se editan desde su ficha. Las condiciones de las opciones ya consultan el estado de campaña. Los pagos y recompensas en pesos ya se aplican una vez con un registro guardado. Los estados de encargos tienen condiciones, efectos y registro de campaña. Los objetos y finales alternativos todavía necesitan sus propios controles y reglas.

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

Los personajes de encuentro existentes y los habitantes nuevos usan estas apariciones. La salud y la muerte se conservan en campaña. Todavía faltan inventarios de NPC editables, cautiverio y transferencia de funciones a un sucesor. Los habitantes nuevos pueden activarse por la muerte de otro personaje. Los mandos históricos todavía no pueden usarse como sucesores. Las escenas de misión especiales conservan su elenco propio.

Las partidas anteriores mantienen sus encuentros originales. Las nuevas campañas usan una versión explícita con presencia guardada; quitar ese registro o cambiar posiciones por fuera del rango invalida el archivo. Las pruebas exportadas del simulador pasan a la versión 2 por el cambio en las reglas de sorteo: los archivos de prueba de versión 1 se rechazan con un aviso para crear una prueba nueva. El paquete de contenido y las partidas anteriores mantienen su compatibilidad.

## Heridas y muerte de los habitantes

Las heridas pertenecen al personaje. Guardar, cambiar de celda o incorporarlo a la escuadra no restaura su salud. La salud máxima usa su ficha. Al incorporarse deja de existir como NPC en las escenas guardadas. Si luego deja el servicio, conserva su estado de soldado.

En el campo táctico podés usar los cursores normales para atacar o atender a un habitante. Las armas y las trampas pueden herirlo. La hemorragia continúa mientras la escena está abierta. Un personaje inconsciente no puede caminar ni conversar. Los primeros auxilios gastan una carga de vendas, detienen la hemorragia y estabilizan a un herido crítico en 15 puntos; no lo curan por completo. Las vendas gastadas no se reponen al volver a entrar. En un taller abastecido podés reponer provisiones: cada carga de vendas que falta cuesta 10 pesos, hasta recuperar las dos cargas iniciales.

La muerte cancela los traslados y el reclutamiento. El cuerpo queda en su escena. La campaña aplica una vez la consecuencia local de lealtad y marca como fallido un encargo pendiente de ese contacto. Si muere un mando indispensable de la historia original, la campaña termina. San Martín comparte su salud entre sus funciones de contacto y aliado.

Todavía no se pueden editar sus pertenencias, saquearlos ni mantenerlos cautivos. No se inventa equipo para sus cuerpos. Las heridas se conservan fuera de la escena, pero todavía no se simula atención médica o hemorragia mientras el sector está cerrado. La [verificación](../verification/civilian-state.md) detalla las pruebas y los límites.

## Aparición después de una muerte

En la ficha de un habitante nuevo, elegí «Aparece después de la muerte de» y el personaje que debe morir. Configurá la demora mínima y máxima, en minutos, y sus celdas de llegada. Cero permite una aparición inmediata. El sucesor empieza fuera del mapa y no figura como contacto antes de activarse.

La muerte confirmada programa la aparición una sola vez. La demora se sortea una vez y se guarda; al vencer, se elige una celda del rango. Guardar, cargar o volver a comprobar la muerte no repite los sorteos. Si la celda elegida está abierta, la llegada espera a que el jugador salga, sin elegir otra. La misma regla se aplica si el personaje anterior muere después de incorporarse a la escuadra: se activa al confirmar la baja durante el combate, sin esperar a salir del sector.

El sucesor es otra persona: usa su propia salud, retrato, atributos y equipo asignado. El cuerpo del anterior permanece en su escena. No recibe automáticamente su inventario, pertenencias o funciones de campaña. Si tiene un recorrido diario, comienza a usarlo después de aparecer. Su muerte puede activar a otro sucesor; las dependencias circulares se rechazan.

Esta opción activa habitantes nuevos. Los mandos históricos conservan sus funciones originales. La muerte de un mando indispensable todavía termina la campaña, aunque otra aparición dependa de ella. La transferencia de una función histórica o de mercadería necesita su propia configuración.

## Borradores que todavía no llegan a la campaña

El mapa permite marcar cualquier celda con una X desde la ficha del personaje, incluido terreno fuera de las localidades. Se pueden simular ubicaciones con una semilla. Las ubicaciones fijas, el sorteo inicial y los cambios diarios ya se aplican a las nuevas campañas. Eliminar mandos históricos y usar opciones de historia no compatibles todavía bloquea el inicio de campaña.

Los mandos históricos conservan su servicio permanente, requisitos de reclutamiento y funciones de campaña. Sus habilidades de combate ya son configurables. Quedan pendientes su extracción, las transferencias de funciones a sucesores, los efectos sobre objetos y funciones de campaña, los objetivos sobre objetos y escoltas, las escenas dirigidas y la composición completa de campaña. Esta entrega no completa todo el editor de historia.

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

`tests/authored-residents.test.mjs` comprueba habitantes nuevos con saludo, retrato, salud, celdas fijas o sorteadas, traslado diario, incorporación local, condiciones, muerte, progreso, retiro del servicio y guardados. El formulario montado crea un habitante, marca celdas, duplica, elimina, deshace e inicia una campaña con ese encuentro. Los controles de conversación ocultan la incorporación para un habitante no reclutable. Son pruebas acotadas, no una campaña completa.

`tests/death-successors.test.mjs` comprueba bajas civiles y militares, demoras, relojes, guardados, protección de la escena abierta, recorridos diarios y cadenas de sucesión con cuerpos conservados. El editor montado crea la condición y la verifica después de una muerte real en la campaña. La [verificación de sucesores](../verification/death-successors.md) registra su alcance.


`tests/local-contracts.test.mjs` comprueba los tres plazos locales, pago único, requisitos, heridas, vencimiento, regreso, renovación, baja, contrato gratuito y rechazo de guardados alterados. El editor montado configura el servicio, usa deshacer y duplica. La página del juego montada muestra el precio, contrata por el plazo seleccionado y conserva el resultado al guardar. La [verificación de contratos locales](../verification/local-contracts.md) registra el alcance.


`tests/content-dialogue.test.mjs` comprueba ramas, vueltas, finales, continuidad, condiciones físicas de conversación y guardados alterados. El editor montado crea los pasajes, protege referencias, deshace, duplica e inicia una campaña donde se recorre una rama. La página del juego montada usa las opciones, rechaza un segundo clic atrasado y guarda el resultado. La [verificación de diálogos](../verification/authored-dialogues.md) registra su alcance.

`tests/dialogue-conditions.test.mjs` comprueba intervalos, compras reales, muerte de habitantes, estados de personajes, opciones no disponibles y condiciones inválidas. El editor montado configura y conserva estas reglas; la conversación montada muestra una opción al cruzar medianoche. La [verificación de condiciones](../verification/dialogue-conditions.md) separa acciones reales de los estados preparados.

`tests/dialogue-payments.test.mjs` comprueba pagos y recompensas reales, guardados, ciclos, cambios de servicio, identidades independientes, rechazos y registros alterados. El editor montado configura y ejecuta un pago; el juego montado muestra el importe, bloquea fondos insuficientes y conserva una sola recompensa tras un doble clic. La [verificación de pagos](../verification/dialogue-payments.md) registra sus límites.

`tests/content-quests.test.mjs` comprueba aceptación, una condición de día real, finalización con recompensa, fracaso alternativo, participantes distintos, pagos atómicos, estados finales y guardados alterados. El editor montado crea y conecta un encargo; la página del juego muestra su cambio desde la conversación y el registro de campaña. La [verificación de encargos](../verification/authored-quests.md) conserva los límites de esta entrega.

`tests/quest-deadlines.test.mjs` comprueba vencimientos con segundos de aceptación reales, descanso táctico, viajes, espera, finalización previa y registros alterados. El editor conserva el plazo y la página del juego muestra el tiempo restante y el fracaso automático. La [verificación de plazos](../verification/quest-deadlines.md) registra su alcance.

`tests/quest-survival.test.mjs` comprueba muerte civil real, una baja militar en una batalla compacta preparada, aceptación bloqueada tras una muerte, resultados ya completos, heridas y cambios de servicio. El editor montado conserva y protege las referencias; la página del juego registra una muerte real y muestra el fallo guardado. La [verificación de supervivencia](../verification/quest-survival.md) separa esas pruebas de una campaña completa.
