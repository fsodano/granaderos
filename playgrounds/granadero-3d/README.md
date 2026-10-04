# Granadero · Laboratorio 3D

Prueba independiente de un granadero animado en Three.js, con cámara ortográfica isométrica y controles HTML. El ángulo queda fijo y el soldado se muestra a escala de juego. El acercamiento permite inspeccionar la figura y las armas sin cambiar la proyección.

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
| Caminar / Correr | Marcha o carrera con las manos libres; guarda el arma seleccionada. |
| Fusil / Pistola + Disparar | Apuntar, disparar con retroceso y volver a la postura de espera. |
| Sable + Golpear con el sable | Corte de sable y regreso a la guardia. |
| Blanco / Moreno / Negro | Cambiar la piel del mismo cuerpo y conservar su equipo. |
| Recorrer el patio | Centrar el recorrido y desplazarse sobre el suelo durante la marcha o carrera. |
| Pausar / Velocidad | Detener la animación o cambiar su velocidad. |
| Acercar / Alejar / arrastrar / rueda | Cambiar el acercamiento o mover la vista, con ángulo isométrico fijo. |
| Mostrar cuadrícula / Luz nocturna | Comparar la lectura del soldado con otra iluminación. |

Con el lienzo enfocado: `Espacio` pausa, `F` ejecuta la acción del arma y `R` restaura la cámara táctica.

## Modelo y animaciones

El archivo [granadero.glb](public/assets/granadero.glb) contiene geometría, materiales, texturas, esqueleto y estas acciones:

`Idle`, `Walk`, `Run`, `RifleAim`, `RifleFire`, `SabreReady`, `SabreSlash`, `PistolAim`, `PistolFire`.

`AnimationMixer` interpola las posiciones y rotaciones de los huesos. Cada arma sigue la mano derecha. Los marcadores de boca del arma colocan el destello y el humo. Sus tiempos de disparo proceden del [manifiesto](public/assets/asset-manifest.json).

La fuente editable está en [granadero.blend](authoring/granadero.blend). El [script de construcción](authoring/build_granadero.py) reproduce la escena, las acciones y el GLB. Se verificó con Blender 5.0.0 Alpha:

```sh
blender --background --factory-startup --python authoring/build_granadero.py
```

La anatomía humana y el detalle de piel proceden de activos MakeHuman/MPFB publicados bajo CC0. El uniforme, las armas y las acciones se construyen para esta prueba. La carpeta `authoring` conserva las fuentes y la información de procedencia. Las imágenes de referencia que proporcionó el usuario orientan la apariencia; no forman parte del modelo exportado.

## Verificación y exportación

```sh
npm test
npm run build
npm run preview
```

Las pruebas verifican el archivo GLB, la deformación con varios huesos, las nueve acciones, la integridad del manifiesto, los marcadores del arma y la reproducción con Three.js. También prueban las rutas y dependencias del servidor de desarrollo y de la exportación `dist`.

La revisión visual del navegador comprueba la lectura a escala táctica, los agarres, la marcha, la carrera, las acciones y los cambios de piel. El modelo sigue siendo una prueba de arte y movimiento. Caminar y correr guardan el arma; seleccionar un arma coloca al soldado en su postura de espera. Una integración con el combate de Granaderos requerirá conectar el lienzo a las posiciones y acciones de la simulación.
