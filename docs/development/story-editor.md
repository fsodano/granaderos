# Editor de historia: fichas jugables

El editor de historia se abre en `/story`, desde el menú del juego o desde el constructor de sectores. El constructor existente permanece en `/editor` con sus mapas, edificios y pruebas.

El ejemplo **La ruta de las postas** se puede cargar, editar y descargar desde el editor. Su [guía](example-post-campaign.md) explica el recorrido y cómo recuperar el borrador anterior.

## Fichas aplicadas a la campaña

Nombres, apodos, retratos, biografías, función mostrada, diez atributos iniciales y paga mensual. El catálogo permite crear, duplicar y quitar contratables y habitantes nuevos. Se pueden buscar personajes, deshacer y rehacer cambios, recuperar el borrador e importar o exportar el paquete. Los retratos pueden usar imágenes locales o archivos PNG, JPEG y WebP de hasta 250 KB.

“Iniciar campaña con estas fichas” crea una campaña real con una copia validada de las definiciones. La identidad SHA-256 acompaña al paquete y se comprueba al importar la partida. El perfil editado llega a la contratación, al despliegue táctico y al guardado. Las campañas del editor tienen su propio guardado; no reemplazan la campaña normal ni la de pruebas.

Se conserva la economía publicada: `economyVersion: 2`, tesorería en pesos, compras y contratación por los plazos publicados, incluidos contratos semanales y mensuales de especialistas. No se restauran las antiguas cadenas de recursos estratégicos.

Los contratables del boletín no generan encuentros antes de ser contratados. Sus fichas no muestran controles de aparición. El boletín permite elegir un destino de llegada controlado con infraestructura de recepción: posta, cuartel, puerto o embarcadero. Una celda de agua o un paso cordillerano no sirven por sí solos. Los puertos y embarcaderos solo se habilitan en localidades con acceso al río navegable.

## Crear y sustituir contratables

Cada candidato nuevo tiene identidad propia. Duplicar copia su ficha, retrato y equipo, pero crea otra identidad. Eliminar un candidato del catálogo lo excluye de las campañas nuevas; no modifica una partida ya iniciada. Se puede quitar todo el catálogo de contratables y crear otro. Las referencias de aparición impiden eliminar un personaje mientras otra regla lo use.

Las identidades nuevas no reciben poderes por ocupar el número de un mando histórico. El paquete de cada partida queda fijado al iniciarla, y el guardado conserva la correspondencia entre sus personajes y sus hojas de servicio. Los candidatos eliminados no se restauran al cargar.

La ficha permite elegir especialidades aplicadas por las reglas actuales, equitación y progreso por experiencia o nivel fijo. Equitación experta garantiza una destreza ecuestre mínima de 80. Con ambas opciones de progreso se conserva el entrenamiento práctico de atributos. Las especialidades llegan al combate y a la instrucción de milicia; un instructor nuevo puede guardar y continuar un curso. Los contratables nuevos pueden tener carácter, frases y apariencia propios. Los habitantes nuevos tienen diálogos con opciones. Los encargos editables se conectan a las opciones de diálogo y tienen un registro en la carta de campaña.

Todos estos candidatos se incorporan por contrato desde el boletín. Una paga de cero es un contrato gratuito con el plazo elegido, no servicio permanente. El avance histórico protege a sus mandos. Con capítulos propios, podés quitarlos o copiarlos como habitantes independientes, sin transferir sus funciones históricas. La ficha permite elegir el arma principal y el arma blanca inicial. Un paquete anterior sin esta selección conserva el equipo original del personaje.

## Suministros iniciales de cada personaje

En la ficha, **Suministros iniciales** permite configurar cargas de cebo, pedernales, raciones, antorchas, vendas y boleadoras. Cada cantidad debe ser un entero de 0 a 1000. Cero significa que no lleva ese suministro. **Restablecer suministros originales** recupera 50 cargas, 4 pedernales, 2 raciones, 2 antorchas, 2 vendas y 1 juego de boleadoras.

La campaña asigna esas cantidades una sola vez. El personaje las lleva al incorporarse, tanto por llegada contratada como por reclutamiento en el lugar. Guardar, renovar, despedir y volver a contratar conservan lo que quede; no entregan otro lote. Duplicar copia las cantidades con una identidad distinta. Los paquetes anteriores conservan los valores originales. Deshacer, rehacer, importar y exportar incluyen esta configuración.

La munición inicial del despliegue se configura en **Reglas**. La reposición pagada del taller conserva sus cantidades y precios publicados; no usa la dotación inicial como objetivo. Tampoco cambia el equipo del granadero creado por el jugador.

Los habitantes con ficha llevan estos suministros desde su aparición. Con **Recoger equipo**, podés seleccionarlos cuando estén muertos o inconscientes y junto al combatiente. La acción cuesta 8 PA en combate y muestra las cantidades recogidas. Lo que retirás deja de pertenecer al habitante. Cambiar de celda, incorporarse, salir del servicio o cargar la partida conserva lo que queda. Un sucesor usa sus propias cantidades; no copia las del cuerpo anterior. Las armas, armaduras, regalos e inventarios completos de habitantes siguen pendientes. Véase la [verificación de suministros civiles](../verification/civilian-finite-supplies.md).

## Estado inicial de cada personaje

En **Estado inicial** podés definir salud, energía, fatiga, sangrado y heridas vendadas. La salud va de 1 al máximo de la ficha. Energía y fatiga van de 0 a 100; sangrado, de 0 a 10. Las heridas vendadas no pueden superar la salud perdida. Para que haya sangrado debe quedar una herida sin vendar. Todos los valores son enteros. Si reducís el atributo Salud, revisá el estado inicial: el editor bloquea valores incompatibles.

**Restablecer estado sano** recupera la salud máxima, 100 de energía y cero fatiga, sangrado y heridas vendadas. Duplicar copia estos valores; deshacer permite recuperar los anteriores. Se asignan una sola vez al crear la campaña. Guardar, renovar o volver a contratar conserva los cambios del juego. Un candidato del boletín sigue fuera del mapa hasta su llegada contratada.

Podés crear un habitante herido con 1 de salud y energía mayor que 0. Primero habrá que estabilizarlo con vendas para conversar. Una vez incorporado puede recibir atención médica y recuperar la salud restante. El sangrado avanza mientras su sector está abierto y, una vez registrado, también al salir. Los segundos pendientes se conservan al guardar. Un habitante con energía 0 empieza inconsciente. Mientras su sector está abierto, recupera 10 de energía por fase civil: cada 6 segundos de exploración o una vez por ronda completa de combate. Puede conversar al recuperar energía si tiene al menos 15 de salud. El tiempo fuera del sector no le concede esa recuperación. La [verificación del estado inicial](../verification/character-starting-condition.md) registra los recorridos y los límites.

## Crear habitantes del mundo

«Crear habitante» agrega una identidad propia. Puede tener retrato, apariencia, atributos, saludo, habilidades y una ubicación fija, sorteada al inicio o elegida cada día entre las celdas marcadas. No ocupa un puesto histórico ni aparece en el boletín. Sin una aparición configurada queda fuera del mapa.

La opción «Puede incorporarse a la escuadra» permite elegir entre un interlocutor civil y un recluta local. Para incorporarlo hay que encontrarlo y conversar junto a él. Su ficha define el liderazgo mínimo, la cantidad de localidades seguras y una localidad concreta que deba estar liberada, si corresponde. Retiro y Buenos Aires cuentan como una localidad para ese requisito. Un habitante muerto, inconsciente o cautivo no puede incorporarse.

El «Tipo de servicio» permite elegir servicio permanente sin paga o contrato por un día, una semana o un mes. En el segundo caso, la paga mensual define el precio base. El editor muestra los tres precios iniciales: el importe diario se redondea hacia arriba, la semana usa siete días y el mes treinta. La experiencia puede aumentar el precio futuro. Un contrato de cero pesos conserva su vencimiento. El arma de la ficha se entrega al incorporarse; todavía no representa un inventario de NPC que se pueda saquear. El equipo blanco inicial conserva la regla general del juego.

La conversación muestra el plazo y el precio antes de contratar; el botón queda deshabilitado si faltan pesos. El servicio empieza en esa celda, sin viaje de llegada. Al vencer durante un despliegue, el personaje espera a que salgas del sector. Después vuelve según su aparición configurada, conservando su salud. Puede renovarse el contrato desde la campaña. Despedirlo no devuelve el anticipo.

Duplicar un habitante copia su configuración y sus celdas con otra identidad. Eliminarlo quita su aparición; si otra regla depende de él, primero se debe quitar esa referencia. Deshacer, rehacer, exportar y recuperar el borrador conservan estos cambios. Las campañas ya iniciadas mantienen su propio paquete. Los mandos necesarios siguen protegidos en el avance histórico; los capítulos propios permiten reemplazar su elenco.

Los habitantes usan la salud persistente: cambiar de celda, guardar o incorporarse no los cura. Si dejan la escuadra, vuelven con su estado de soldado. Su progreso puede conservar el nivel inicial o ganar experiencia según la ficha.

## Reemplazar el elenco histórico

Elegí **Capítulos propios** en **Reglas**. Después podés eliminar un personaje histórico desde su ficha. Si un capítulo, diálogo, encargo o sucesor lo usa, primero quitá o cambiá esa referencia. Eliminarlo también quita su aparición. La campaña nueva no lo restaura como contacto ni al guardar y cargar.

**Copiar como habitante independiente** conserva la ficha, retrato, equipo, voz, apariencia, habilidades y celdas del personaje en una identidad nueva. La copia empieza como recluta local, con servicio permanente sin paga, progreso por experiencia y sin requisitos históricos de incorporación. Su saludo, diálogo, servicio y apariciones se pueden editar. No recibe funciones estratégicas por tener el retrato o los atributos del original. Podés cambiarle el nombre y después quitar al original. Deshacer y rehacer conservan ambos pasos.

En **Reglas**, **Incluir habitantes genéricos del mapa original** controla los contactos sin ficha original, como el sargento del cuartel o los guías de las postas. Desactivá la opción para usar solamente los habitantes de tu catálogo. No elimina personajes con ficha. Las campañas normales y los paquetes anteriores incluyen esos contactos.

Podés quitar todo el elenco y crear otro. Un catálogo vacío permite crear al granadero del jugador al iniciar. El editor no reutiliza los puestos reservados de personajes originales para una identidad nueva. Las campañas iniciadas conservan su propio catálogo y esta opción, aunque después cambies el borrador.

Si volvés al avance histórico con mandos faltantes, el inicio queda bloqueado hasta recuperarlos. El botón para preparar la fundición usa al responsable de fundición elegido en Reglas. Sin responsable no aparece, salvo que la fundición ya esté organizada. La copia de un mando no hereda ese taller, su bonificación estratégica ni su papel de misión. Asigná la fundición y la marcha de forma explícita. Las facciones, los mandos enemigos, la diplomacia y los eventos del mundo todavía requieren su propia edición.

## Funciones de campaña

En **Reglas**, elegí el **Responsable de fundición** y el **Responsable de marcha**. Podés usar personajes nuevos, asignar ambos papeles a la misma persona o elegir **Ninguno**. La asignación queda guardada al iniciar la campaña. No cambia una partida ya iniciada. Antes de eliminar un personaje asignado, quitá o reasigná su función. Deshacer, rehacer y **Restaurar funciones originales** conservan ese control. Restaurar usa Beltrán y San Martín solamente si siguen en el catálogo.

El responsable debe haberse incorporado, estar vivo, libre y con servicio vigente. Un contratado que todavía viaja no activa la función. La muerte, el cautiverio y el fin del contrato la desactivan. El responsable de marcha evita el aumento de fatiga por viajes de todas las escuadras, tanto entre celdas como entre localidades.

El responsable de fundición usa el proyecto de **Fundición y preparación**. La tesorería muestra su nombre y el motivo de un bloqueo. La fundición ya pagada permanece organizada si su responsable muere o deja el servicio. La intensidad de la ventaja de marcha todavía conserva su valor original.

Estos papeles no transfieren misiones, pertenencias, habilidades de combate ni requisitos de incorporación. Un sucesor no los hereda automáticamente. La campaña histórica necesita la fundición para avanzar: si la desactivás, usá capítulos propios con otros objetivos.

## Fundición y preparación

En **Reglas**, elegí la localidad, el nombre de la fundición, el nombre del ejército y los costos de organización y financiación. Se admiten once localidades terrestres con instalaciones. Cada costo puede ser de 0 a 1000000 pesos enteros. Cero permite completar ese paso sin costo. Los valores originales son Mendoza, El Plumerillo, Ejército de los Andes y 500/3000 pesos.

La localidad debe estar bajo tu control y el responsable de fundición debe estar incorporado, vivo, libre y en servicio. Organizar el proyecto cobra una vez y aplica la mejora local de lealtad en esa localidad. Financiar el ejército cobra el segundo costo una vez. Las definiciones y los pasos cumplidos quedan guardados con la campaña.

Una fundición organizada ofrece reparación y abastecimiento en su localidad mientras esté bajo tu control y comunicada con el cuartel. Los talleres que ya existían siguen disponibles. Una ocupación o un corte de suministro bloquean esos servicios; no borran la preparación pagada. Podés deshacer cambios, restaurar los valores originales y probarlos en una campaña nueva.

Esta opción no mueve edificios tácticos ni cambia los nombres del mapa. La campaña histórica todavía requiere controlar y fortificar Mendoza y los pasos de Cuyo, comprar tres cañones y acordar el paso con los pehuenches. Sus textos de preparación muestran el proyecto y precio elegidos. Para otra historia, usá capítulos propios. Podés usar la organización y la financiación como condiciones de capítulos o diálogos. La edición de otros servicios sigue pendiente.

## Diálogos con opciones

En la ficha de un habitante nuevo, activá «Escribir una conversación con opciones». Elegí el comienzo y escribí la respuesta del personaje. «Agregar pasaje» crea otra respuesta. «Agregar opción» permite escribir lo que el jugador puede decir y elegir la respuesta siguiente.

Los títulos sirven para organizar el diálogo; el jugador ve el texto y las opciones. Un pasaje sin opciones termina ese tramo. Para volver a una pregunta anterior, agregá una opción que conduzca a ella. Se admiten hasta 30 pasajes y 12 opciones por pasaje. Podés conservar pasajes sin conectar mientras escribís. El editor avisa que todavía no tienen entrada y protege de eliminación los que ya están referenciados.

Al jugar, acercate al habitante y elegí «Conversar». La partida conserva el pasaje actual aunque cierres la conversación, salgas del sector o incorpores y luego despidas al personaje. Volver a conversar retoma ese pasaje. Una elección atrasada no reemplaza una rama ya elegida. Los habitantes muertos o inconscientes no pueden conversar.

Deshacer, rehacer, duplicar, recuperar el borrador e importar/exportar conservan el diálogo. La copia de un personaje tiene su propio diálogo y progreso. Cada opción puede tener hasta seis condiciones. Todas deben cumplirse para mostrarla. Podés exigir un intervalo de días, pesos disponibles, el control patriota o realista de una localidad, o que un personaje esté vivo, muerto, incorporado o presente en el mundo. Un límite máximo vacío no tiene tope. El primer día es el día 1. «Presente en el mundo» significa que ya apareció, tiene una celda asignada y no está incorporado ni cautivo. El control se consulta sobre las localidades existentes; la selección de celdas de aparición conserva todo el mapa.

Las condiciones de personaje también pueden usar su salud actual:

| Estado | Qué exige |
| --- | --- |
| Consciente | Está vivo, tiene al menos 15 de salud y energía mayor que 0. |
| Inconsciente | Está vivo, pero tiene menos de 15 de salud o energía 0. |
| Herido | Está vivo y su salud es menor que su máximo actual. |
| Con hemorragia | Está vivo y tiene sangrado. |
| Consciente y sin sangrado | Puede estar herido, pero está consciente y no sangra. |
| Salud completa y consciente | Está consciente, no sangra y alcanzó su máximo actual. |

Podés usar estos estados en diálogos, capítulos y condiciones de derrota. Por ejemplo, una respuesta puede aparecer después de estabilizar a un habitante. Un objetivo de rescate puede exigir **Consciente y sin sangrado**, o **Salud completa y consciente** si necesitás toda la recuperación. Un muerto no cumple ninguno de esos estados físicos.

Estar sano no significa estar en el mapa ni incorporado. Agregá condiciones de presencia o servicio cuando las necesites. En el sector abierto, el diálogo consulta la condición táctica actual, también para un aliado de misión. Las derrotas se comprueban al confirmar ese estado; los capítulos se completan al salir. Sin el estado actual de un soldado desplegado, el juego no usa su hoja anterior para dar por cumplida una condición física. Estas condiciones no curan, pagan ni generan respuestas automáticas: el autor escribe la opción y el resultado.

El juego comprueba las condiciones al mostrar las opciones y al elegirlas. Una opción puede aparecer al pasar de día o después de la muerte de otro personaje. Las referencias a personajes impiden eliminarlos mientras una conversación los use. Las condiciones no cambian el estado por sí solas. Para cambiar el dinero disponible, agregá una operación en «Pago o recompensa».

Activá «Cambiar los pesos al elegir esta opción», elegí si el jugador paga o recibe y escribí el importe. El juego muestra esas condiciones antes de elegir. Cada operación se aplica una sola vez por personaje y opción. Guardar, volver a la conversación o incorporar y luego despedir al personaje no la repite. Si faltan fondos, la opción queda desactivada y explica cuánto falta. Las copias de personajes tienen registros independientes. Una opción también puede cambiar un encargo. Si combina ese cambio con pesos, ambos se aplican juntos. Una opción también puede llamar a otro habitante. Las operaciones combinadas se aceptan juntas. La entrega de objetos sigue pendiente.

## Condiciones sobre suministros

En una condición de diálogo, capítulo o derrota, elegí **Suministros de un personaje**. Seleccioná el personaje, el suministro, la cantidad mínima y un máximo opcional. Podés comprobar cargas de cebo, pedernales, raciones, antorchas, vendas o boleadoras. Los límites son inclusivos. Para exigir que no queden vendas, usá mínimo 0 y máximo 0. Un máximo vacío no tiene tope adicional.

Por ejemplo, una respuesta puede exigir que el sanitario conserve cinco vendas después de atender al habitante. Un capítulo puede exigir una compra real de suministros. La condición consulta la cantidad actual y no entrega ni consume objetos. Si también exigís que la persona viva, esté presente o esté incorporada, agregá esas condiciones.

Durante una escena se usa el inventario actual del actor. Fuera de ella se usa lo que conserva su ficha. Un soldado desplegado sin su escena actual no cumple la condición: una cantidad desconocida no significa cero. Las derrotas pueden activarse al confirmar el gasto en la escena; los capítulos esperan hasta cerrarla. El editor protege los personajes usados por estas condiciones. Véase la [verificación de condiciones de suministros](../verification/story-supply-conditions.md).

## Condiciones sobre proyectos

En una condición de diálogo o capítulo, elegí **Estado de un proyecto**. Seleccioná **Organización de la fundición** o **Financiación del ejército**, y elegí **Completado** o **Pendiente**. También se puede usar en las condiciones de derrota.

El juego comprueba el paso realizado por el jugador. Contratar al responsable no lo completa. La condición tampoco organiza el proyecto ni cobra dinero: esos pasos se hacen desde la tesorería. Una preparación pagada sigue completa cuando termina el contrato del responsable o cambia el control de la localidad. Si también precisás servicio vigente o control, agregá esas condiciones por separado.

Por ejemplo, el primer capítulo puede exigir una fundición organizada y el segundo un ejército financiado. Un habitante puede esperar la financiación para aceptar el informe final y pagar la recompensa de un encargo. Las condiciones se vuelven a comprobar al elegir la opción. Los pagos y capítulos cumplidos no se repiten al cargar la partida.

## Movimientos por diálogo

En una opción, activá «Dar una orden de movimiento al elegir esta opción», elegí «Venir a este lugar» y seleccioná otro habitante creado en el editor. Debe estar consciente en el mismo sector y tener un camino libre. El juego elige una casilla disponible junto al interlocutor. El destino queda fijado en ese lugar, aunque después el interlocutor se mueva.

El personaje camina, abre puertas utilizables y espera al llegar. Un bloqueo pausa la marcha; el peligro lo hace buscar refugio y después retomar el camino. Las heridas incapacitantes detienen el movimiento. Guardar y volver al sector conservan la orden. Si su rutina diaria lo lleva a otra celda, esa orden local deja de aplicarse. Incorporarlo lo quita de la escena; si vuelve a la misma aparición, puede retomar el encuentro.

Cada opción emite una sola orden. Otra opción puede darle otro destino. Repetir una opción ya usada no repite la orden anterior. Si faltan el personaje o el camino, la opción explica el problema. Un pago o un cambio de encargo de esa misma opción tampoco se aplica. La referencia impide eliminar al personaje desde el editor.

Para esperar la llegada, agregá la condición «Personaje en su encuentro» a la opción que sigue. Elegí el habitante que debe llegar. La opción aparece cuando está consciente, sin peligro inmediato y en el destino de su última llamada dentro del sector abierto. Una orden pendiente o un tiempo transcurrido no bastan. Podés combinar esta condición con otras y usar la misma opción para completar un encargo o pagar una recompensa una sola vez. Guardar y volver al sector conservan la llegada si el personaje sigue en ese lugar.

Para terminar el encuentro, elegí «Retomar su rutina» en «Orden del personaje». Podés elegir al propio interlocutor o a otro habitante. Debe estar consciente en el sector y tener un encuentro pendiente. La orden libera su destino; las reglas habituales de peligro y conversación siguen vigentes. La condición «Personaje en su encuentro» deja de cumplirse al liberarlo, aunque todavía esté parado en esa casilla.

Podés combinar esa salida con completar el encargo y pagar una recompensa. Todo se aplica junto. Si falta un requisito o dinero, el encuentro conserva su estado. Guardar conserva la salida. Una opción ya usada no libera un encuentro posterior ni repite el pago; para otro encuentro usá otra opción.

Por ahora el destino es el lugar del interlocutor. Faltan los marcadores del mapa, las acciones al llegar, las secuencias de varios actores y los disparadores automáticos. Esta función no permite llamar a candidatos del boletín ni cambia las escenas históricas.

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

Las habilidades acompañan a la incorporación local, los contactos de misión, los soldados, los aliados temporales y los guardados. Las partidas rechazan listas inválidas o diferentes de las definidas para esa campaña. Las campañas normales y los paquetes anteriores sin este campo conservan sus capacidades históricas. La fundición y la marcha se asignan en Reglas. Los demás papeles históricos, requisitos de reclutamiento y servicio de los mandos todavía necesitan su propia configuración.

## Carácter, frases y apariencia

Cada ficha puede elegir un retrato de la biblioteca, conservar una imagen importada y seleccionar por separado uno de los ocho tipos de apariencia ya disponibles. La vista previa muestra el cuerpo con el arma asignada. Elegir un retrato no cambia el cuerpo ni los atributos. La apariencia llega al soldado, al contacto local y al comandante aliado; también se conserva al volver a entrar y al guardar. El personaje correspondiente en Yatasto usa su ficha. Todavía no se edita el color de piel ni se crean animaciones nuevas desde este formulario.

El carácter describe al personaje en su hoja de servicio, sin modificar su moral. Las siete frases corresponden a incorporación, detección de enemigos, sector asegurado, herida, agotamiento, muerte y fin de campaña. Cada frase admite hasta 800 caracteres; una frase vacía mantiene el silencio. El contratado pronuncia su incorporación al llegar, una sola vez. Las frases tácticas se disparan por los eventos reales y el cierre de campaña usa las frases de los compañeros vivos.

También podés escribir **Al recibir primeros auxilios de otra persona**. La frase aparece en el registro táctico después de un tratamiento válido que usa vendas, si el paciente está consciente. Un paciente crítico responde al recuperar la consciencia, no después de cada paso incompleto. Si sigue sin energía, permanece en silencio aunque recupere el aliento más tarde. No se activa por vendarse solo, descansar, cargar la partida ni repetir una orden rechazada. No concede recompensas ni cambia un encargo. Dejala vacía para mantener el silencio. Los paquetes anteriores conservan sus siete frases sin cambios. Véase la [verificación de respuestas médicas](../verification/authored-treatment-speech.md).

Estas opciones participan en la recuperación del borrador, deshacer/rehacer, duplicación, exportación, inicio y guardado. Los paquetes anteriores sin estos campos conservan sus perfiles. Las partidas rechazan voces o apariencias que difieren de la definición incluida. Los habitantes nuevos tienen un saludo editable. Las ramificaciones de texto para habitantes nuevos se editan desde su ficha. Las condiciones de las opciones ya consultan el estado de campaña. Los pagos y recompensas en pesos ya se aplican una vez con un registro guardado. Los estados de encargos tienen condiciones, efectos y registro de campaña. Los objetos todavía necesitan sus propios controles y reglas. En **Reglas** ya podés definir capítulos propios y sus textos de victoria y derrota.

La prueba de incorporación también detectó que Cabral, Dorrego y Paroissien no tenían una condición regional adicional y se rechazaban después de cumplir el encuentro. Ahora pueden incorporarse al cumplir su conversación local, liderazgo, control y demás condiciones del encuentro. La contratación remota sigue bloqueada para ellos.

## Llegadas y contratos

La sección Llegadas permite elegir la infraestructura disponible. La ficha de cada contratado permite definir entre 0 y 168 horas de viaje; los paquetes nuevos usan 6 horas. Las campañas normales y los paquetes anteriores sin este campo conservan la llegada inmediata. No se modifican los plazos publicados de un día, una semana o un mes, incluidos los especialistas de élite.

El anticipo se paga una vez. Durante el viaje el personaje no está en el mapa ni en la escuadra. Su contrato comienza al llegar. Si pierde el destino, hay enemigos o un bloqueo impide la recepción por agua, espera fuera del mapa. Los puntos con una posta o un cuartel conservan su acceso terrestre durante el bloqueo. Si el sector está abierto, la llegada espera a que el jugador salga; una llegada remota tampoco modifica la escuadra desplegada.

El boletín muestra las llegadas pendientes, el destino y el tiempo restante. Cambiar el destino reinicia el viaje sin otro pago. Cancelar devuelve el anticipo una sola vez. El guardado conserva el pedido y valida el personaje, el destino, el plazo, el anticipo y el reloj. El viaje usa la duración definida en la ficha; todavía no simula una ruta geográfica de transporte.

## Armas de fuego aplicadas a la campaña

Cada arma puede tener su propio nombre, imagen, daño, alcance, costes de disparo, puntería y recarga, capacidad, peso y precio. Se pueden crear variantes de una misma familia y asignarlas a los personajes. La imagen puede ser un archivo PNG, JPEG o WebP de hasta 250 KB. El campo de prueba y la campaña usan la misma definición.

Las variantes aparecen por separado en la armería. Cada ejemplar conserva su identidad, desgaste y atasco al equiparlo o devolverlo. Las familias importadas usan el puerto y los plazos configurados en **Reglas**, con demoras por bloqueo u ocupación. El inventario, las armas recuperadas y el equipo abandonado muestran el nombre y la imagen propios. Disparar, recargar, recuperar un arma, cambiarla y volver al mapa conservan su definición.

Los **PA para levantar el arma** están incluidos en los **PA de disparo**. Por ejemplo, con 20 PA de disparo y 7 PA para levantarla, el primer disparo cuesta 20 y el siguiente 13 mientras el tirador conserve la posición. La puntería se suma por separado. Moverse, recargar, cambiar de postura o de arma, o quedar incapacitado vuelve a bajar el arma. Los fallos de chispa conservan la carga y la posición; volver a cebar exige prepararla de nuevo. Un valor de cero mantiene el mismo costo en cada disparo. Las armas actuales conservan cero. El control de disparo muestra la preparación y descarga en combate, y los segundos reales durante la exploración. Véase la [verificación](../verification/authored-weapon-readiness.md).

Las partidas nuevas del editor guardan estas definiciones por referencia al paquete incluido. La imagen no se repite por cada ejemplar. Al cargar se comprueba la identidad del paquete y cada referencia; también se admiten las definiciones completas guardadas anteriormente. Las campañas normales y las campañas antiguas con solo fichas conservan su catálogo publicado.

La munición mantiene la economía existente: se compra la cantidad de cartuchos configurada en **Reglas** por arma de fuego al entrar al sector (diez por defecto) y se devuelve el valor de los cartuchos restantes al salir. Los cartuchos de un arma guardada en la mochila siguen en esa arma. Cambiar un arma en la armería se hace fuera del sector y devuelve el arma descargada. La disponibilidad comercial sigue siendo ilimitada; todavía no hay cantidades y reposición configurables por comerciante.

La artillería, los accesorios, los tipos de munición y el coste de levantar el arma siguen pendientes de edición. Las opciones de manejo todavía no integradas bloquean el inicio de campaña.

## Armas blancas aplicadas a la campaña

La sección **Armas** incluye las nueve familias de fuego y las cinco de armas blancas. Usá **Crear arma blanca** para agregar una variante de sable, bayoneta, lanza o facón. Podés editar nombre, imagen, daño, PA de ataque, alcance cuerpo a cuerpo, peso y precio. El alcance admite decimales entre 1 y 4 casillas. La familia conserva sus técnicas: desvío con sable, derribo con lanza, contragolpe con facón e intercepción con bayoneta. La bayoneta usa los PA, el daño y el alcance editados también al detener una carga.

En la ficha del personaje, **Arma principal** admite un arma de fuego o blanca. **Arma blanca** elige su equipo secundario. **Equipo original del personaje** conserva el valor general para paquetes anteriores. El editor impide eliminar una variante asignada a cualquiera de los dos espacios. Copiar el personaje, deshacer, rehacer y lanzar la campaña conservan estas selecciones. El campo de prueba sigue siendo una prueba de tiro; un personaje con arma principal blanca debe probarse en la campaña.

Cada variante tiene su propio precio y existencias en la armería. Al equiparla, el arma anterior vuelve como un ejemplar separado. El nombre y la imagen propios aparecen en la hoja de servicio, la armería, los dos espacios del inventario y la mochila. Las armas blancas recuperadas del espacio principal de un cuerpo pueden equiparse en cualquiera de los dos espacios. Los cambios, el regreso a campaña y el guardado conservan su definición y estado. El peso de las armas blancas editadas cuenta mientras están equipadas o guardadas; cambiar de mano activa no modifica ese peso.

Los residentes todavía no tienen inventario civil: esta asignación se aplica a su equipo militar al incorporarse. El saqueo del espacio secundario de un cuerpo, el desgaste cuerpo a cuerpo, los accesorios y la edición de técnicas especiales requieren entregas separadas. Esta entrega no acredita el sistema completo de inventario o combate sin armas.

## Armamento de enemigos y milicias

La sección Armas incluye el armamento de las tropas. Se puede elegir un arma principal de fuego o blanca, o ninguna, para oficiales, infantería y veteranos enemigos y para cada uno de los tres grados de milicia. El editor impide eliminar un arma mientras alguna tropa la use. Estas asignaciones se guardan con el borrador y participan en deshacer, rehacer, importación y exportación. Los paquetes anteriores sin estas opciones conservan las armas originales y pueden activar su configuración desde la misma sección.

Usá **Configurar armas blancas de enemigos** o **Configurar armas blancas de milicias** para elegir además el arma secundaria de cada tipo de tropa. Cada espacio puede usar una variante distinta. **Arma blanca original** conserva la secundaria original de ese tipo. No significa dejarlo sin arma blanca. Estos campos también participan en deshacer, rehacer, importación, exportación y la protección contra eliminar armas en uso. Se pueden configurar las secundarias sin cambiar las principales.

Las asignaciones se aplican cuando se crea un soldado. Las tropas que ya existen conservan su equipo, munición y desgaste al regresar al sector y al completar nuevos cursos de ascenso. Elegir otra arma para el nuevo grado no reemplaza el arma de un soldado existente. Una tropa cuya arma principal es blanca, o no tiene arma principal, no recibe cartuchos ni cebo. Las nuevas tropas enemigas reciben trece cartuchos en total y las milicias seis por defecto. Podés cambiar ambas cantidades en **Reglas**. Se distribuyen entre carga y reserva según la capacidad real del arma.

La inteligencia artificial usa los valores del arma elegida. Si lleva un arma de fuego, cambia a la secundaria editada cuando el enemigo está a su alcance o el arma de fuego está descargada y el enemigo está cerca. Vuelve al arma de fuego al alejarse el blanco, si tiene carga o está lo bastante lejos para recargar. Cambiar de mano cuesta los 4 PA habituales. Un soldado derribado se levanta antes de cambiar de arma. Los soldados con arma blanca principal usan su alcance y coste de ataque editados. El equipo recuperado conserva su definición, imagen y carga. Al regresar del combate, la devolución de cartuchos incluye las cargas recuperadas de enemigos. Volver a un combate pendiente usa las existencias reales de los soldados guardados, sin volver a acreditar cargas recuperadas antes.

## Capítulos propios y final de campaña

En **Reglas → Objetivos y final de campaña**, elegí **Capítulos propios**. Escribí la introducción y los textos de victoria y derrota. Agregá entre uno y doce capítulos. Cada capítulo tiene nombre, objetivo visible y entre una y seis condiciones. Podés subirlo, bajarlo, eliminarlo y deshacer o rehacer cada cambio.

Las condiciones permiten usar el día, los pesos disponibles, el control de una localidad, el estado de un personaje, sus suministros, un encargo o un proyecto. Todas las condiciones de un capítulo deben cumplirse. Los capítulos se evalúan en orden después de las acciones de campaña y al avanzar el reloj; varios pueden completarse en el mismo momento. Los capítulos ya cumplidos conservan su resultado aunque después cambie el control o termine un contrato. La contratación pendiente no cuenta como incorporación: el personaje debe llegar y entrar en servicio.

Un encuentro táctico puede completar un encargo, pero el capítulo y la victoria esperan hasta salir de la escena. Para exigir que un personaje llegue a un encuentro, completá un encargo mediante una opción con esa condición de llegada y usá el encargo en el capítulo. La carta, el escritorio y el cuaderno muestran los objetivos propios. Al completar el último, el juego registra la victoria una sola vez y muestra tu texto. Los personajes incorporados que siguen vivos también dicen su frase de cierre configurada.

**Derrota de campaña** permite hasta seis condiciones adicionales. La derrota ocurre cuando se cumplen todas. Una lista vacía no agrega ninguna. La pérdida del cuartel y la pérdida de todos los combatientes al resolver una salida táctica siguen siendo derrotas. El fallo de un encargo por plazo o muerte puede terminar la campaña, incluso dentro de una escena; el jugador todavía puede volver al mapa para cerrarla. Si victoria y derrota coinciden, prevalece la derrota. Un final durante la aproximación impide abrir el combate; una derrota durante un viaje conserva la última posición alcanzada.

El contenido y la secuencia de capítulos cumplidos quedan en la partida. Cambiar el borrador no cambia una campaña iniciada. No se puede eliminar un personaje o encargo usado por estos objetivos. Elegir **Campaña histórica original** recupera el avance original; deshacer recupera los capítulos propios anteriores.

Este control reemplaza el avance, los objetivos y el final originales. San Lorenzo y Yatasto quedan disponibles solamente con el avance histórico. El mapa, la economía, las incursiones, los contactos y los requisitos de reclutamiento históricos siguen vigentes. Los capítulos propios no habilitan esas funciones por su número. Bouchard y San Martín conservan requisitos de incorporación ligados a las misiones originales y no pueden incorporarse con capítulos propios. Para una historia propia, usá habitantes nuevos; los papeles de esas misiones todavía no se reasignan. Los capítulos propios permiten quitar y copiar los mandos como habitantes independientes. Podés asignar la fundición y la marcha a esos habitantes desde Reglas. Los otros papeles históricos y la composición completa de una segunda campaña siguen pendientes.

## Fondos y abastecimiento

En **Reglas** podés definir los fondos iniciales y los cartuchos por combatiente de la escuadra, enemigo nuevo y miliciano nuevo. Los fondos permiten entre 0 y 1.000.000 de pesos; cada cantidad permite entre 0 y 100 cartuchos enteros. **Restaurar fondos y cartuchos originales** vuelve a 3.200 pesos y 10, 13 y 6 cartuchos, respectivamente. Deshacer recupera los valores anteriores.

Los fondos se entregan una sola vez al crear la campaña. Cada entrada o ataque compra la cantidad indicada por cada arma principal de fuego de la escuadra, al precio configurado (1 peso por defecto). La carga nunca supera la capacidad del arma; el resto queda en reserva. Salir devuelve el valor de los cartuchos restantes según las reglas de recuperación existentes. La pantalla de campaña muestra el precio real antes de entrar.

Cero deja las armas descargadas y sin reserva. Las armas principales blancas no reciben cartuchos. Las tropas guardadas conservan lo que les queda; la regla de enemigos y milicias solo se aplica al crear soldados. Los aliados temporales de misiones conservan su abastecimiento propio. El precio por cartucho se configura en la misma sección. El cebo, las piedras y los tipos de munición aún no son configurables.

Un borrador anterior usa los valores originales. La campaña guarda su propia copia de las reglas: cambiar el borrador no cambia una partida existente, y cargar una partida no vuelve a entregar los fondos iniciales.

## Atención médica y descanso

En **Reglas → Atención médica y descanso** podés configurar la medicina mínima,
la salud base por hora, cuántos puntos de medicina suman un punto de curación,
el precio de las vendas, la energía y fatiga del médico, la recuperación base
por descanso y las horas necesarias para recuperar un punto de salud estable.

Cada campo admite solo enteros dentro del rango indicado. La medicina mínima va
de 0 a 100; la salud base y el intervalo de habilidad, de 1 a 100; el precio,
de 0 a 10.000 pesos; los costos y ritmos de energía/fatiga, de 0 a 100; y el
intervalo de curación por descanso, de 1 a 168 horas. Cero permite vendas
gratuitas, elimina ese costo de trabajo o desactiva ese ritmo de recuperación.
Las heridas y la visión nocturna modifican los ritmos base de descanso.

El precio de las vendas rige tanto para la compra por cantidad como para la
reposición de provisiones del taller. La atención sigue gastando una venda por
hora de trabajo. Detener la hemorragia tiene prioridad sobre recuperar salud.
La atención necesita presencia segura y real en la misma celda. Los mismos
valores rigen para **Médico de milicias**, que atiende a los heridos de la
guarnición con sus propias vendas. La pantalla de campaña muestra su salud y la pérdida horaria por hemorragia. La milicia herida fuera del sector abierto usa el mismo porcentaje de daño horario; el médico trabaja antes de ese daño. Abrir la conferencia de Yatasto no detiene las heridas ni la atención de la guarnición que quedó en la ciudad. Si un soldado muere, deja de contar como defensor. Su cuerpo y sus objetos permanecen en la escena guardada conocida. [Heridas de milicias verificadas](../verification/unloaded-militia-wounds.md).
[Atención a milicias verificada](../verification/strategic-militia-care.md).

**Restaurar atención y descanso originales** recupera los valores originales.
Podés deshacerlo. Las partidas iniciadas conservan sus reglas y las horas de
recuperación ya transcurridas. Cambiar el borrador no cambia una partida guardada.
El umbral crítico, los primeros auxilios tácticos y la recuperación diaria
mantienen sus valores actuales. La recuperación diaria no cura a una persona que
sigue sangrando o tiene menos de 15 de salud. [Reglas de atención verificadas](../verification/authored-care-rules.md).

**Daño horario de hemorragia (%)** admite de 0 a 100 y usa 25 por defecto.
Fuera del despliegue táctico, cada cambio de hora resta ese porcentaje de la
intensidad de la hemorragia, redondeado hacia arriba. Por ejemplo, intensidad 5
al 25 % resta 2 de salud. Cero desactiva ese daño. El médico atiende primero;
el descanso solo no detiene la pérdida. La regla también se aplica durante la
marcha y mientras usás otra escuadra. Los candidatos no contratados y los que
todavía están llegando quedan fuera de este reloj. Las bajas y el momento de
muerte se conservan al guardar. [Alcance verificado](../verification/strategic-military-wounds.md).

## Ascensos de milicias

En la carta de campaña, **Tipo de instrucción** permite elegir entre formar
tres nuevos cívicos o ascender a tres cívicos a montoneros. Podés ampliar la
guarnición aunque ya haya candidatos para ascender. La pantalla muestra el
precio y las horas del curso elegido. Si faltan pesos, plazas, abastecimiento,
un instructor o participantes estables, explica el motivo y bloquea el cobro.
La elección se conserva mientras seguís viendo esa localidad; al volver a
abrirla se muestra la sugerencia inicial. El curso ya pagado sí queda guardado
con la campaña. [Controles verificados](../verification/militia-course-choice.md).

Los nuevos cursos de ascenso promueven a tres cívicos a montoneros y conservan
a los tres soldados que participan.
Necesitan al menos 15 de salud, más de 10 de energía y no pueden estar sangrando,
inconscientes, en fuga ni desplegados. El mapa muestra quiénes están en el curso
y su salud. Ascender no los cura ni repone sus armas o suministros. Suspender el
curso los devuelve al grado anterior sin devolver los pesos gastados. Las
partidas antiguas con cursos que solo guardaban cantidades conservan ese
contrato anterior. [Ascensos y compatibilidad](../verification/militia-training-identities.md).

Los veteranos nuevos ascienden por experiencia de combate. Un primer impacto
que hiere a un rival apto suma un punto; abatirlo eleva ese registro a tres. No
se suman puntos repetidos por el mismo rival, ni por dañar civiles, aliados o
enemigos ya indefensos. Al regresar vivo, cada miliciano puede ganar un grado
si obtuvo puntos nuevos: dos para montonero y cinco para veterano. En **Reglas → Ascensos de milicias** podés cambiar los puntos necesarios: de 1
a 99 para montonero y de 2 a 100 para veterano. El segundo valor debe superar al
primero. También podés cambiar la puntería y el liderazgo ganados por ascenso
(de 0 a 100) y los niveles de experiencia ganados (de 0 a 9). Cero conserva ese
atributo. La puntería y el liderazgo tienen un máximo de 100; el nivel, de 10.
Las mejoras también rigen para el curso pagado a montonero. La salud, el arma y los suministros restantes se conservan.
La lista de salud de la guarnición muestra el grado y los puntos. Los cursos de
veteranos ya pagados en partidas anteriores conservan su contrato.
[Ascensos en combate verificados](../verification/militia-combat-progression.md).

**Restaurar ascensos de milicias originales** recupera los umbrales 2 y 5 y las
mejoras 8, 5 y 1. Podés deshacer el cambio. Las reglas quedan guardadas al iniciar
la campaña; cambiar el borrador después no cambia la partida. El mapa muestra
los umbrales de esa partida. El precio y la duración de los cursos siguen sus
reglas actuales. [Verificación de reglas editables](../verification/authored-militia-progression.md).

## Milicias en combate

La guarnición actúa por su cuenta. Usa las armas, los cartuchos y las reglas
guardadas con esa campaña. Sus disparos de reacción consumen los mismos puntos
de acción que su turno. Las tarjetas de la guarnición muestran salud y estado;
no permiten dar órdenes directas. Podés seleccionar a un integrante de la
escuadra para atender a un miliciano herido. Al volver y guardar se conservan
sus heridas, bajas, armas, suministros restantes y experiencia.
[Alcance verificado y pendientes](../verification/autonomous-militia-combat.md).

En exploración, las milicias recorren puntos del mapa. Cada seis segundos pueden
avanzar una casilla y gastar energía, sin consumir puntos de acción ni munición.
Si el paso las dejaría con menos de 50 de energía, descansan ese intervalo.
El contacto real con enemigos detiene la patrulla e inicia los turnos. Pausar
la exploración o esconder la pestaña detiene ese reloj. El guardado conserva
posiciones, energía y ritmo de patrulla. [Verificación](../verification/militia-exploration-patrols.md).

En **Reglas → Patrullas de milicias** podés activar o desactivar las patrullas y
la búsqueda, cambiar los intervalos por punto y definir la reserva de energía
y su recuperación. Los valores originales son 8 intervalos, 50 de reserva y 10
de recuperación. En exploración cada intervalo dura seis segundos; durante la
búsqueda en combate equivale a un turno. La recuperación se aplica al descanso
de patrulla en exploración y nunca supera 100. No cura heridas ni repone munición.

Desactivar las patrullas deja a la milicia en su puesto cuando no ve enemigos.
Puede seguir combatiendo y reaccionando. **Restaurar patrullas de milicias
originales** recupera las opciones iniciales. Podés deshacer o rehacer los cambios.
La configuración queda guardada con la campaña nueva, aunque después cambies el
borrador. Los puntos del recorrido y los límites de búsqueda en combate aún son
fijos. [Reglas verificadas](../verification/authored-militia-patrols.md).

## Distribuir milicias

En la campaña, abrí **Distribuir milicias** en la ficha del sector. Elegí destino,
grado y cantidad, y usá **Trasladar defensores**. Solo se puede mover gente entre
sectores propios conectados de la misma ciudad. El área actual de Buenos Aires
incluye Retiro y Ensenada. **Distribuir de forma pareja** muestra el resultado
previsto antes de aplicar el reparto.

El traslado es inmediato y conserva heridas, armas, munición y experiencia. No
cobra pesos ni adelanta el reloj. Los heridos inestables y los alumnos permanecen
en su sector. Cada destino admite 60 plazas, incluida la instrucción. Al entrar,
los trasladados aparecen en terreno exterior conectado al acceso de llegada.
Estas áreas, límites y accesos todavía no son campos editables.
[Verificación y pendientes](../verification/city-militia-distribution.md).

## Elegir la batería

En **Escritorio → Tesorería → Comprar armas y revisar equipo**, la batería muestra
las piezas que saldrán en el próximo ataque. Elegí hasta tres y usá
**Preparar batería**. Si dejás todos los espacios en **Sin pieza**, esa elección
se conserva al guardar y aunque compres otro cañón. Podés elegir piezas de nuevo
más adelante. La pantalla impide preparar más unidades de un modelo que las
existentes. Elegir no cobra dinero ni adelanta el reloj.
[Verificación y alcance pendiente](../verification/explicit-artillery-selection.md).

## Cañones emplazados

Al atacar, cada cañón elegido sale una vez de la armería y queda en ese sector.
Conserva su ubicación, orientación, carga y munición al guardar y volver. Ganar
el combate captura las piezas. Retirarse puede dejarlas en manos realistas.
**Piezas emplazadas en este sector** muestra el dueño, la carga y las reservas.
Preparar una batería vacía no retira los cañones que ya están allí.

Por ahora, la recuperación estratégica, el transporte y la reposición de esas
piezas siguen pendientes de integración. Los perfiles de artillería todavía no
se editan desde la ficha de armas. [Verificación](../verification/stationed-artillery.md).

## Territorio inicial

En **Reglas**, la tabla **Territorio al iniciar la campaña** define el control patriota o realista y la lealtad de las trece localidades. La lealtad permite valores enteros de 0 a 100. **Restaurar territorio original** vuelve a Retiro patriota con 65% de lealtad y las otras localidades realistas con 25%. Podés deshacer y rehacer los cambios.

En **Cuartel general** podés elegir una de las once localidades con acceso compatible. Los pasos no son cuarteles. La primera escuadra comienza allí y esa localidad pasa a control patriota; podés cambiar después el control del cuartel anterior. El cuartel elegido debe seguir bajo control patriota al inicio. **Restaurar territorio original** también vuelve a elegir Retiro. Cada localidad comparte el control con sus barrios. El terreno abierto permanece neutral. Las apariciones de personajes siguen usando cualquier celda terrestre desde su propia ficha.

El control inicial habilita los destinos de contratación que también tengan infraestructura de recepción. No abre una ruta de abastecimiento a través de localidades enemigas: una Mendoza patriota puede seguir incomunicada con un cuartel situado en Retiro. Los ingresos y los requisitos de instrucción de milicia usan el control y la lealtad reales. Comenzar con una localidad no entrega una recompensa de conquista, tropas ni una misión completada.

El escritorio muestra las localidades iniciales; la carta muestra el control actual. La campaña guarda una copia de las opciones y aplica el territorio solo al comenzar. Las conquistas, pérdidas y cambios de lealtad posteriores se conservan al cargar. Los borradores anteriores mantienen el inicio original. El cuartel elegido es el origen de abastecimiento y dispone de sala de armas y taller. Las compras locales, la creación del personaje, las reparaciones y la reposición funcionan con sus reglas de control y comunicación. La pérdida del cuartel termina la campaña. Las incursiones por calendario conservan la protección que antes tenía Retiro.

Revisá **Llegadas** para habilitar la recepción en la nueva base. La contratación conserva sus requisitos de control, infraestructura y bloqueo. Los talleres históricos de Retiro, Córdoba y Mendoza siguen existiendo y requieren comunicación con el cuartel. El puerto de importaciones se configura por separado. La selección del cuartel no mueve a los contactos históricos. Los capítulos y el final se configuran por separado en **Objetivos y final de campaña**.

## Puerto y plazos de importación

En **Reglas → Importaciones de armas** podés elegir Buenos Aires, Ensenada, San Nicolás o Santa Fe. **Sin importaciones** impide nuevos pedidos de armas importadas. Las compras locales siguen disponibles y los personajes conservan las armas que ya tienen. Esta regla afecta las familias Brown Bess y Baker y sus variantes; elegir qué familias se importan todavía no está disponible.

Los plazos mínimo y máximo permiten entre 1 y 720 horas enteras. El mínimo no puede superar al máximo. Usá valores iguales para una entrega de plazo fijo. El plazo se sortea una sola vez al comprar y queda guardado con el pedido. **Restaurar importaciones originales** vuelve a Ensenada y al intervalo de 72 a 120 horas; deshacer recupera los valores anteriores.

El pedido necesita el puerto bajo control patriota, comerciantes dispuestos a negociar y la sala de armas del cuartel comunicada. Se paga por adelantado. Un bloqueo permite encargar, pero demora la entrega. La pérdida del puerto también retiene los pedidos. Las incursiones de esa misma hora se resuelven antes de entregar las armas. Al recuperar las condiciones, el pedido se entrega una vez sin cambiar el plazo ni cobrar de nuevo.

La armería muestra el puerto, los plazos y las demoras por bloqueo u ocupación. Deshabilita los pedidos que no se pueden aceptar y conserva las compras locales. Cada variante importada llega como un ejemplar con su propia definición e imagen. El abastecimiento usa la armería general publicada; no hay todavía almacenes portuarios físicos ni transporte de estos pedidos hasta el cuartel. La recepción de contratados se configura por separado en **Llegadas**.

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

En el campo táctico podés usar los cursores normales para atacar o atender a un habitante. Las armas y las trampas pueden herirlo. La hemorragia continúa al salir del sector y mientras usás otra escuadra. Volver a entrar o cargar una partida no reinicia el intervalo. Un personaje inconsciente no puede caminar ni conversar. Los [primeros auxilios](../gameplay/characters/field-first-aid.md) gastan una venda por aplicación efectiva y estabilizan a un herido crítico hasta 15 puntos de salud. Pueden requerir varias aplicaciones según la habilidad del sanitario. No recuperan la salud restante. Las heridas vendadas y los suministros gastados se conservan al volver a entrar y al reclutar al habitante. En un taller abastecido podés comprar vendas por cantidad o reponer las que falten de la dotación inicial del personaje. Ambas opciones usan el precio de esta campaña: 10 pesos por venda con las reglas originales.

La muerte cancela los traslados y el reclutamiento. El cuerpo queda en su escena. La campaña aplica una vez la consecuencia local de lealtad y marca como fallido un encargo pendiente de ese contacto. Si muere un mando indispensable de la historia original, la campaña termina. San Martín comparte su salud entre sus funciones de contacto y aliado.

Los seis suministros personales se pueden configurar y recoger de un cuerpo o una persona inconsciente. El equipo completo, las armas, las armaduras y el cautiverio siguen pendientes. Las heridas se conservan fuera de la escena. Un habitante reclutado puede recibir [atención médica en campaña](../gameplay/characters/strategic-medical-care.md) y conserva la salud recuperada al dejar el servicio. El despido o vencimiento del contrato devuelve al habitante ya conocido sus heridas actuales y sus provisiones restantes, antes de volver a encontrarlo. Si aún sangra, el tiempo fuera de servicio continúa esa herida. No recibe otra dotación inicial. La [verificación del regreso](../verification/civilian-service-return.md) cubre estos cambios de función. El cuidado médico de habitantes fuera del servicio sigue pendiente. La [continuidad de las hemorragias](../verification/unloaded-civilian-bleeding.md) conserva el cuerpo, la causa de muerte y el plazo del sucesor sin repetir sus consecuencias. La [verificación](../verification/civilian-state.md) detalla las pruebas y los límites.

## Aparición después de una muerte

En la ficha de un habitante nuevo, elegí «Aparece después de la muerte de» y el personaje que debe morir. Configurá la demora mínima y máxima, en minutos, y sus celdas de llegada. Cero permite una aparición inmediata. El sucesor empieza fuera del mapa y no figura como contacto antes de activarse.

La muerte confirmada programa la aparición una sola vez. La demora se sortea una vez y se guarda; al vencer, se elige una celda del rango. Guardar, cargar o volver a comprobar la muerte no repite los sorteos. Si la celda elegida está abierta, la llegada espera a que el jugador salga, sin elegir otra. La misma regla se aplica si el personaje anterior muere después de incorporarse a la escuadra: se activa al confirmar la baja durante el combate, sin esperar a salir del sector.

El sucesor es otra persona: usa su propia salud, retrato, atributos y equipo asignado. El cuerpo del anterior permanece en su escena. No recibe automáticamente su inventario, pertenencias o funciones de campaña. Si tiene un recorrido diario, comienza a usarlo después de aparecer. Su muerte puede activar a otro sucesor; las dependencias circulares se rechazan.

Esta opción activa habitantes nuevos. Los mandos históricos conservan sus papeles de misión. En el avance histórico, la muerte de un mando indispensable termina la campaña, aunque otra aparición dependa de ella. Con capítulos propios, una identidad histórica no impone esa derrota: agregá una condición de muerte si esa persona es indispensable para tu historia. La transferencia de una función histórica o de mercadería necesita su propia configuración.

## Borradores que todavía no llegan a la campaña

El mapa permite marcar cualquier celda con una X desde la ficha del personaje, incluido terreno fuera de las localidades. Se pueden simular ubicaciones con una semilla. Las ubicaciones fijas, el sorteo inicial y los cambios diarios ya se aplican a las nuevas campañas. Eliminar mandos históricos bloquea el inicio si se conserva el avance histórico. Las opciones de historia no compatibles también impiden iniciar.

Los mandos históricos conservan su servicio permanente, requisitos de reclutamiento y papeles de misión. Sus habilidades de combate, la asignación de fundición y marcha, y los nombres, ubicación y costos de la fundición ya son configurables. Quedan pendientes su extracción, las transferencias de funciones a sucesores, los efectos sobre objetos y funciones de campaña, los objetivos sobre objetos y escoltas, las escenas dirigidas y la composición completa de campaña. Esta entrega no completa todo el editor de historia.

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

`tests/dialogue-movements.test.mjs` comprueba la llamada real, marcha, espera, guardado, reentrada, nuevas órdenes, muerte y cambio diario de sector. Las pruebas de rutinas usan casas preparadas para comprobar puertas, obstáculos, alarma y refugio. El editor y el juego montados comprueban creación, referencias y ejecución con guardado. La [verificación de encuentros](../verification/dialogue-movements.md) detalla sus límites.

`tests/meeting-arrivals.test.mjs` comprueba llegada real, rechazo anticipado, reentrada y recompensa única. Algunos casos preparados aíslan alarma, incapacidad y bloqueo; la recuperación usa el reloj y la marcha habituales. El editor y el juego montados verifican la condición y su guardado. La [verificación de llegada](../verification/meeting-arrivals.md) registra el alcance.

`tests/meeting-release.test.mjs` comprueba salida real, rutina posterior, guardado, salida desde el propio personaje y transacciones combinadas. El editor montado conserva la orden; el juego montado verifica una salida y una recompensa tras un doble clic. La [verificación de salida](../verification/meeting-release.md) registra el alcance.

`tests/content-blades.test.mjs` comprueba combate, intercepción, IA, peso, variantes de armería, cambios entre espacios, estado conservado, regreso y guardado, imágenes compartidas y paquetes anteriores. Las pruebas montadas verifican creación, asignación, protección de referencias, compra, imagen secundaria y cambio de mano con guardado activo. Son pruebas limitadas; no acreditan una campaña completa.

`tests/force-blades.test.mjs` cubre ambos espacios de enemigos y milicias, cartuchos según el arma principal, decisiones de cambio de la IA, tropas guardadas y recuperación de un arma principal con retirada y reentrada. Usa tropas reales emitidas por campaña en escenarios pequeños preparados. El editor montado conserva ambas selecciones y las aplica a un ataque real. Ver [armas blancas de las tropas](../verification/force-blades.md).

`tests/campaign-rules.test.mjs` cubre fondos iniciales, valores válidos, copias guardadas, cobros y devoluciones, cargas nulas y milicias con cartuchos consumidos. El editor montado modifica, restaura, deshace y lanza las reglas. La pantalla montada comprueba el precio, la entrada, la salida y el guardado automático. Ver [fondos y abastecimiento](../verification/campaign-supply-rules.md).

`tests/starting-territory.test.mjs` verifica formato, inicio, contratación y llegada, abastecimiento, ingresos diarios, requisitos de milicia, viajes y entrada real, ataque a un vecino ocupado y guardados. El editor montado configura el territorio, valida límites, deshace y lanza la campaña. La comprobación de escritorio y mapa usa la vista renderizada, sin una sesión de navegador. Ver [territorio inicial](../verification/starting-territory.md).

`tests/campaign-headquarters.test.mjs` comprueba los once destinos, el inicio y suministro alternativos, creación, compra, taller, contratación y viaje reales, entrada y ataque, protección ante incursiones, derrota y guardados. La pérdida del cuartel y el desgaste para probar el taller usan estados preparados, sin afirmar victorias enemigas ni desgaste obtenido en combate. El editor montado configura y lanza la base; el escritorio y cuaderno muestran su nombre. Ver [cuartel general](../verification/campaign-headquarters.md).

`tests/import-supply-rules.test.mjs` verifica puertos, plazos, pedidos deshabilitados, cobro único, plazo guardado, entrega, bloqueo y ocupación, variantes equipadas y guardados. Una incursión naval real que coincide con la entrega conserva el pedido pendiente. El editor y la armería montados cubren los controles, deshacer, lanzar, comprar y mostrar las demoras. Ver [importaciones configurables](../verification/import-supply-rules.md).

`tests/campaign-story.test.mjs` verifica capítulos ordenados, llegada pagada, vencimiento de contrato, encargos resueltos por diálogo, derrota por plazo y muerte táctica real, finales simultáneos, interrupción de viajes y guardados inválidos. El editor montado cubre orden, condiciones, referencias, deshacer y lanzamiento; las vistas muestran el objetivo y el final propios. La [verificación de capítulos](../verification/campaign-story.md) distingue estas rutas breves de la campaña completa pendiente.

`tests/campaign-cast.test.mjs` recorre contratación, encuentro, diálogo, encargo y final con solo dos identidades nuevas; comprueba un elenco vacío con granadero gratuito, los habitantes genéricos opcionales y que los personajes eliminados no vuelvan al cargar. El editor montado copia y reemplaza un mando, guarda su incorporación local y verifica que no herede la bonificación de marcha. La [verificación del elenco](../verification/campaign-cast.md) registra los límites.

## Recargas que duran varios turnos

El valor de recarga de un arma puede superar los puntos de acción de un turno.
**Recargar** usa los puntos disponibles y conserva el avance en esa arma.
En el turno siguiente podés continuar. El botón muestra el coste de esta orden
y cuánto trabajo quedará. Solo una carga terminada consume un cartucho.
Un arma con varios cañones puede cargar uno antes de terminar el siguiente.

Guardar, cambiar de arma o recogerla conserva su avance. En exploración se gasta
tiempo: el contacto con un enemigo o la caída del soldado interrumpe el trabajo.
El avance no se completa gratis al pasar a combate. La artillería mantiene sus
reglas separadas. Véase la [verificación de recargas](../verification/partial-firearm-reloads.md).

### Precio de los cartuchos

En **Reglas → Fondos y abastecimiento**, el **Precio del cartucho** acepta un
importe entero entre cero y un millón de pesos. Si no se configura, vale un
peso, igual que antes. La escuadra paga al entrar o atacar un sector. La salida
devuelve el valor de los cartuchos que realmente quedan. Por ejemplo, siete
cartuchos a tres pesos cuestan 21; si se dispara uno, se devuelven 18.

El precio queda guardado con la campaña. Cambiar el borrador no modifica una
partida en curso. Restaurar las reglas originales devuelve el precio a un peso
y restaura los fondos y cantidades iniciales. El precio cero conserva las
cantidades y permite abastecer sin pago. La armería y el botón de entrada muestran
el precio de esa partida. Véase la [verificación](../verification/authored-cartridge-price.md).
