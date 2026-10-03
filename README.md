# Granaderos

**Formá un ejército. Mantenelo abastecido. Conducilo a la batalla.**

https://github.com/user-attachments/assets/a40025a0-ea01-4085-bcb4-ee8519b1f45e

**Presentación · 45 segundos · Textos en español y música original.** [Leer los textos](assets/video/intro/captions.es.srt) · [Descargar el video](assets/video/intro/granaderos-intro.mp4) · [Fuentes del video](assets/video/intro/README.md)

Granaderos es un juego de estrategia y combate táctico por turnos para navegador, ambientado en la Guerra de la Independencia argentina. Reclutá combatientes, administrá fondos y alianzas, y dirigí a cada soldado en el campo de batalla. El juego toma como referencia **Jagged Alliance 2 v1.13** y adapta sus sistemas a las armas y condiciones de la época.

La interfaz del juego y este README están en **español**. El código y la mayor parte de la documentación están en inglés.

**Se puede jugar y sigue en desarrollo.** El juego y el editor de historia todavía no están completos. Consultá el [registro de avances publicados](docs/verification/published-progress.md) para conocer las funciones entregadas, las pruebas realizadas y las validaciones pendientes. El [registro histórico de validación del entorno de desarrollo](docs/verification/gameplay-completion.md) conserva pruebas y limitaciones de etapas anteriores. Sus resultados corresponden a las fechas y versiones indicadas.

[Jugar en el navegador](https://fsodano.github.io/granaderos/) · [Ejecutar en tu equipo](#ejecutar-en-tu-equipo) · [Cómo se juega](#cómo-se-juega) · [Desarrollo](#desarrollo) · [Documentación](docs/README.md)

## Jugar en el navegador

Abrí [Granaderos en GitHub Pages](https://fsodano.github.io/granaderos/). No requiere instalación. Elegí **Nueva campaña** para iniciar una campaña o **Combate de San Lorenzo** para jugar una batalla independiente.

El juego guarda el progreso en el navegador. Usá **Guardar** para exportar una partida y **Importar partida** para cargarla. GitHub Pages y localhost usan espacios de almacenamiento separados. Para trasladar una campaña entre ambos, exportá la partida e importala en el otro sitio.

## Ejecutar en tu equipo

Instalá **Node.js 22.13.0 o posterior** y npm. Después, ejecutá:

```sh
git clone https://github.com/fsodano/granaderos.git
cd granaderos
npm ci --prefix web
npm run dev
```

Abrí [localhost:3000](http://localhost:3000) o la dirección que indique el servidor de desarrollo.

Elegí **Nueva campaña** para comenzar en el despacho del Retiro. Retiro es el único sector bajo tu control. Contratá combatientes o creá tu propio personaje sin costo. La primera persona que entre en servicio permite avanzar el capítulo inicial, sin un pago adicional a la academia. Las contrataciones usan el precio indicado y los combatientes deben llegar antes de incorporarse a la fuerza. **Combate de San Lorenzo** inicia una batalla independiente.

El juego guarda el progreso de la campaña en el navegador. Usá **Guardar** para exportar una partida a un archivo y **Importar partida** para cargarla.

La pantalla de inicio también permite abrir el [editor de historia](docs/development/story-editor.md) en `/story` y el [editor de sectores](docs/development/sector-editor.md) en `/editor`.

El juego para navegador usa JavaScript y React. No requiere el submódulo del motor ni una instalación original de JA2.

## Cómo se juega

La campaña conecta las decisiones estratégicas con los combates tácticos. Las heridas y el equipo de los soldados se conservan entre encuentros. Las bajas y la munición utilizada afectan las decisiones posteriores.

| En el mapa de campaña | En el campo de batalla |
| --- | --- |
| Contratá combatientes, formá escuadras y pagá contratos. | Explorá sectores y entrá en combate por turnos al encontrar enemigos. |
| Asegurá rutas, comprá equipo y financiá el ejército. | Administrá puntos de acción, munición, recargas y el estado de las armas. |
| Entrená milicias, repará equipo y atendé a los heridos. | Usá el terreno, las líneas de visión, el humo y la postura. |
| Negociá alianzas y defendé los sectores capturados. | Combatí con armas de fuego, armas blancas, caballería y artillería con dotación. |

La campaña usa pesos como único recurso estratégico. Los ingresos de las poblaciones, las misiones pagadas y el dinero recuperado financian el reclutamiento, el equipo y los preparativos. No hay reservas de materiales, cadenas de producción, convoyes de recursos ni cuidado de caballos. Iniciá una campaña nueva después de la actualización económica: las partidas con la economía anterior no se convierten.

Podés seleccionar, visitar y explorar las casillas terrestres y los distritos urbanos. Cada uno conserva su propia escena. Las casillas de aguas abiertas no permiten el desplazamiento terrestre.

La campaña comienza con Retiro bajo tu control. Sus capítulos recorren San Lorenzo, la campaña del norte y Yatasto, El Plumerillo y los preparativos del Ejército de los Andes. Los mapas y los acontecimientos son interpretaciones históricas adaptadas al juego.

Consultá el **Manual de campaña** dentro del juego para comenzar. Los [controles tácticos](docs/gameplay/tactical/TACTICAL-HOTKEYS.md) explican los comandos de teclado y mouse. El [índice de documentación](docs/README.md) reúne las guías de los sistemas y los registros de verificación.

## Rostros de la campaña

<table>
  <tr>
    <td align="center"><img src="web/public/art/portrait-0.webp" width="180" alt="Retrato pintado de Martín Miguel de Güemes utilizado en el juego"><br><strong>Martín Miguel de Güemes</strong></td>
    <td align="center"><img src="web/public/art/portrait-3.webp" width="180" alt="Retrato pintado de Juan Bautista Cabral utilizado en el juego"><br><strong>Juan Bautista Cabral</strong></td>
    <td align="center"><img src="web/public/art/portrait-1.webp" width="180" alt="Retrato pintado de Juana Azurduy utilizado en el juego"><br><strong>Juana Azurduy</strong></td>
  </tr>
</table>

Las figuras históricas sirven junto a voluntarios remunerados ficticios y un personaje personalizado. Sus atributos, equipo y condiciones de reclutamiento son diferentes.

Las imágenes anteriores son **ilustraciones del juego, no capturas de una partida**. Se conservan las instrucciones de generación y los archivos fuente de las pinturas y los retratos creados con IA. Los rasgos de los personajes y los detalles de los uniformes son interpretaciones artísticas. Consultá la [documentación gráfica](assets/README.md) y las [referencias de los retratos](assets/portrait-references.md) para conocer sus fuentes y limitaciones.

## Desarrollo

Después de instalar las dependencias de la interfaz web, ejecutá estos comandos desde la raíz del repositorio:

```sh
npm run test:quick   # Pruebas para el trabajo habitual
npm test             # Todas las pruebas, incluidas las rutas completas de campaña
npm run typecheck    # Validación de TypeScript
npm run build        # Compilación y validación de la exportación estática en dist/
```

La [guía de desarrollo](docs/development/getting-started.md#checks) explica cómo elegir pruebas específicas, rápidas o completas. Ejecutá todas las pruebas antes de una publicación o de un cambio en las reglas de juego compartidas.

Consultá primero el [registro de avances publicados](docs/verification/published-progress.md) para conocer el alcance probado y el trabajo pendiente. El [índice de verificación](docs/verification/README.md) también conserva registros históricos del entorno de desarrollo. Las pruebas automáticas cubren situaciones específicas. La validación completa de la campaña también requiere pruebas de juego.

| Ruta | Contenido |
| --- | --- |
| [web/](web/) | Interfaz para navegador, editores e ilustraciones utilizadas por el juego |
| [game/](game/) | Reglas tácticas, sistemas de campaña, mapas y validación de partidas guardadas |
| [assets/](assets/) | Fuentes gráficas, instrucciones de generación, referencias y exportaciones |
| [tests/](tests/) | Pruebas de reglas e integración |
| [tools/](tools/) | Herramientas de compilación, recursos gráficos y verificación |
| [docs/](docs/README.md) | Guías, documentos de diseño y registros de verificación |
| `engine/`, `native/`, `patches/`, `mod/` | Código del proyecto original y trabajo previo de conversión nativa |

La [guía de desarrollo](docs/development/getting-started.md) detalla la instalación, los archivos generados y las comprobaciones. La versión para navegador es el juego principal. La conversión nativa anterior tiene requisitos de compilación y ejecución separados.

Para contribuir, identificá los criterios de aceptación pertinentes en el [registro de avances publicados](docs/verification/published-progress.md) y el [índice de documentación](docs/README.md). Presentá una solicitud de cambios con un alcance definido y pruebas de verificación. Los recursos generados deben poder reproducirse a partir de sus archivos fuente. Indicá qué comportamiento comprobaste en el navegador.

[VERSION](VERSION) registra la versión de desarrollo. Para publicar la versión 1.0.0, la especificación suministrada debe superar su auditoría de finalización.
