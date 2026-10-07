# Granadero · Laboratorio 3D

Laboratorio independiente de personajes animados en Three.js, con cámara ortográfica isométrica y controles HTML. El ángulo queda fijo y el soldado se muestra a escala de juego. El acercamiento permite inspeccionar la figura y las armas sin cambiar la proyección.

## Abrir

Desde esta carpeta, con Node.js 22 o posterior:

```sh
npm ci
npm run dev
```

Abrir [http://localhost:3147](http://localhost:3147). El servidor escucha sólo en el equipo local. Para usar otro puerto, definir `GRANADERO_PLAYGROUND_PORT`.

## Probar

| Control | Resultado |
| --- | --- |
| Personaje | Comparar la referencia aprobada del granadero con los ocho personajes del juego. Conserva el equipo, la acción elegida, la piel, la cámara y la velocidad. |
| Caminar / Correr | Marcha o carrera de combate con el arma seleccionada; sin arma usa las manos libres. |
| Fusil / Pistola + Disparar | Apuntar, disparar con retroceso y volver a la postura de espera. |
| Movimiento de ataque | Elegir un corte, estocada, golpe con el arma o puñetazo; también permite alternar variantes. |
| Cuchillo | Hoja de 18 cm; dos cortes, estocada, marcha y carrera. |
| Blanco / Moreno / Negro | Cambiar la piel del mismo cuerpo y conservar su equipo. |
| Recorrer el terreno | Centrar el recorrido y desplazarse sobre el suelo durante la marcha o carrera. |
| Pausar / Velocidad | Detener la animación o cambiar su velocidad. |
| Acercar / Alejar / arrastrar / rueda | Cambiar el acercamiento o mover la vista, con ángulo isométrico fijo. |
| Mostrar cuadrícula / Luz nocturna | Comparar la lectura del soldado con otra iluminación. |

Con el lienzo enfocado: `Espacio` pausa, `F` ejecuta la acción del arma y `R` restaura la cámara táctica.

## Personajes del juego

El selector incluye granadero, realista, trabajador, cirujano, gaucho, fraile, exploradora y mujer con rebozo. La **referencia aprobada** del granadero sigue como opción inicial. La opción **Granadero · juego** permite compararla con la versión de producción.

Cada personaje usa su cuerpo LOD0 y su esqueleto nativo. Los cuerpos masculinos y femeninos cargan bancos separados. Los controles muestran las 29 acciones revisadas de un solo contacto; la combinación de dos cortes sigue disponible sólo en la referencia. Las armas se fijan a los agarres de cada cuerpo. La estocada de fusil muestra la bayoneta montada. La piel y los materiales de la figura seleccionada se copian antes de editarlos.

El servidor de desarrollo expone `/models/characters/` desde `../../web/public/models/characters/`. No copia modelos dentro de `public/assets`. Después de reconstruir la biblioteca, recargar la página permite ver los archivos nuevos. `npm run build` copia al directorio ignorado `dist` los ocho cuerpos LOD0, los dos bancos de movimiento, el equipo y las texturas compartidas que usan esos archivos. La exportación funciona con `npm run preview`, sin depender del servidor del juego.

Para revisar una biblioteca provisional sin sustituir los archivos del juego, iniciar el servidor con `GRANADERO_CHARACTER_LIBRARY=/ruta/absoluta/a/modelos npm run dev`. Esa carpeta debe contener el manifiesto, los cuerpos, los bancos de movimiento, el equipo y sus texturas. La variable sólo cambia el origen del servidor de desarrollo; no cambia los archivos que copia `npm run build`. Seleccionar **Granadero · juego** u otro personaje del juego: la referencia aprobada sigue usando su archivo independiente.

## Modelo de referencia y animaciones

El archivo [granadero.glb](public/assets/granadero.glb) contiene geometría, materiales, texturas, esqueleto y 30 acciones:

| Equipo | Acciones |
| --- | --- |
| Sin arma | Reposo, caminar, correr, puñetazo |
| Fusil | Apuntar, disparar, caminar, correr, estocada de bayoneta, culatazo |
| Pistola | Apuntar, disparar, caminar, correr, golpe de pistola |
| Sable | Guardia, corte descendente, corte horizontal, revés, combinación, estocada, golpe de empuñadura, caminar, correr |
| Cuchillo | Guardia, corte, revés, estocada, caminar, correr |

El [inventario de movimientos](motion-inventory.json) registra sus nombres, tiempos, eventos, procedencia y estado de aprobación junto con la huella exacta del modelo. Se actualiza con `node tools/report-motion.mjs` después de cada exportación.

`AnimationMixer` interpola las posiciones y rotaciones de los huesos. Cada arma sigue la mano derecha. Los marcadores de boca del arma colocan el destello y el humo. Sus tiempos de disparo proceden del [manifiesto](public/assets/asset-manifest.json).

La fuente editable está en [granadero.blend](authoring/granadero.blend). El [script de construcción](authoring/build_human.py) reproduce la escena, las acciones y el GLB. Se verificó con Blender 5.0.0 Alpha:

```sh
blender --background --factory-startup --python authoring/build_human.py -- --publish
```

El cuerpo completo conserva las proporciones, articulaciones y pesos de la anatomía adulta MakeHuman/MPFB, publicada bajo CC0. Mide 1,76 m sin el gorro. El uniforme y las armas se construyen para esta prueba a partir de las fotografías de referencia. Caminar, correr y permanecer quieto usan movimiento humano grabado por CMU, adaptado al esqueleto. Las manos y las acciones con armas son poses propias. La [procedencia](authoring/SOURCES.md) distingue las fuentes y sus condiciones de uso. La carpeta `authoring` conserva las fuentes y la información de procedencia. Las imágenes de referencia que proporcionó el usuario orientan la apariencia; no forman parte del modelo exportado.

Sin `--publish`, el constructor deja los resultados en `authoring/human-review/` para revisarlos antes de sustituir el modelo del navegador. El nombre anterior, `build_granadero.py`, es un acceso compatible al mismo constructor.

## Verificación y exportación

```sh
npm test
npm run build
npm run preview
```

Para reproducir la revisión de poses desde la escena guardada:

```sh
blender --background --python authoring/review_actions.py
```

Este comando guarda cuatro fases isométricas por acción, salvo el reposo, en `authoring/human-review/action-review/`. El índice incluye la versión del modelo y el tiempo de cada imagen. No modifica el modelo del navegador.

Las pruebas verifican el archivo GLB, la deformación con varios huesos, las 30 acciones, la integridad del manifiesto, los marcadores del arma y la reproducción con Three.js. También miden continuidad de ciclos, apoyo de los pies, contribución del torso, contacto de la mano de apoyo y cambios bruscos de la muñeca. Las pruebas del selector cargan los ocho cuerpos, verifican sus 53 huesos, las acciones, los agarres y la independencia entre figuras. Las pruebas del servidor cubren los modelos y todas sus texturas externas tanto en desarrollo como en `dist`.

La revisión visual del navegador comprueba la lectura a escala táctica, los agarres, la marcha, la carrera, las acciones y los cambios de piel. La referencia conserva detalle para inspección cercana. Los personajes de producción disponen de tres niveles de detalle; este laboratorio usa LOD0 para revisar su apariencia. La vista de una figura no mide el rendimiento de un sector con muchos personajes. Las pruebas automáticas no certifican la calidad visual. Caminar y correr conservan el arma seleccionada. Una integración con el combate de Granaderos requerirá conectar el lienzo a las posiciones y acciones de la simulación.

### Revisión de armas cuerpo a cuerpo

El sable usa preparación, corte, seguimiento y regreso a la guardia. La cadera inicia el giro, el torso lo sigue y la mano libre acompaña el cuerpo. El cuchillo tiene una hoja de 18 cm y mango de madera de 11 cm; es una propuesta visual, no una réplica documentada de un arma reglamentaria. Las acciones avanzan un pie antes del contacto y recuperan su postura después. La pistola conserva el agarre con una mano como decisión provisional de arte.

El selector permite probar cada acción por separado o alternar entre variantes. Una acción en curso debe terminar antes de iniciar otra.

### Presentación de figura humana

La vista inicia con bordes suavizados, sombras de contacto y materiales con detalle. La dirección visual busca una figura humana pequeña con aspecto de actor digitalizado: anatomía realista, rostro legible, tela y cuero reconocibles. «Comparar estilo pixelado» conserva el filtro anterior para comparar a la misma escala. El resultado sigue siendo un modelo 3D, no fotografías de actores ni un atlas final de sprites.

### Ritmo y apoyo del combate

A velocidad 1×, cada corte de sable dura 0,8 s y cada corte de cuchillo 0,64 s, con preparación, golpe y recuperación. La trayectoria usa interpolación continua para que la hoja no se detenga al pasar por la pose de impacto. El pie adelantado se planta antes del contacto; el pie trasero permite el giro del cuerpo. Caminar y correr parten de capturas CMU; las manos y los codos se adaptan al equipo. La vuelta de prueba usa un radio de 3 m.

El disparo ocurre a los 0,08 s del tiempo visible: el retroceso es breve y la recuperación más lenta. Muñeca, pecho, rodillas y brazo libre responden en fases distintas. Estas acciones muestran un disparo aislado, no un ciclo de recarga ni una cadencia de fuego histórica.

El sombrero sigue las formas de la fotografía aportada durante la revisión: banda amarilla ancha, escarapela celeste y blanca, placa frontal de bronce, cordón rojo, borde de visera y penacho más alto. Es una interpretación simplificada para la escala de juego; la fotografía no certifica la configuración de un año histórico concreto.

El brazo libre acompaña cada corte con apertura del codo, retirada de la mano, giro de muñeca y recuperación. El revés usa una trayectoria distinta; el cuchillo reduce su amplitud. Las pruebas verifican movimiento de la mano libre y separación entre la muñeca y el segmento de la hoja, además del apoyo de los pies.

El registro de acciones, cambios, límites y condiciones de reutilización se mantiene en [MOTION_REVIEW.md](MOTION_REVIEW.md). La revisión del 6 de octubre agrega respuesta del brazo libre al disparar, respiración resuelta con los brazos y giro escalonado de cadera/torso con pivote del pie trasero.

La velocidad base aprobada es 1,25 veces la del archivo: el control muestra 1× para ese ritmo. Los tiempos exportados se dividen por 1,25 durante la reproducción.

### Revisión de combate cercano

El selector «Movimiento de ataque» permite probar cada acción: cortes de sable en ambos sentidos, combinación enlazada, estocadas de sable/cuchillo/bayoneta, golpe de empuñadura, golpe de pistola, culatazo y puñetazo. Las variantes son candidatas de animación; todavía no simulan contacto con un adversario. La bayoneta queda montada en el fusil. Caminar y correr conservan el arma seleccionada.
