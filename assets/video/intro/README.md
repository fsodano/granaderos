# Presentación de Granaderos

Video de 45 segundos con textos en español, capturas reales del juego y música original. Presenta el reclutamiento, los combatientes, el mapa de campaña, el combate, el equipo y el editor de historia. Muestra una versión en desarrollo.

- [Ver o descargar el video](granaderos-intro.mp4).
- [Leer los textos del video](captions.es.srt).
- [Ver la portada](poster.jpg).
- [Consultar las fuentes y la revisión del juego](manifest.json).

Las seis capturas de `source/` se tomaron el 3 de octubre de 2026, a 1280 × 720, desde la revisión `b987d63140019b550f05dad2e5cbfdd37accef79`. Se usó un origen local separado para conservar las partidas del usuario. Las capturas son imágenes fijas, unidas con transiciones; no son una grabación continua de una partida.

La ilustración de apertura y cierre procede de [`web/public/art/san-lorenzo.webp`](../../../web/public/art/san-lorenzo.webp). Su documentación está en el [registro de recursos gráficos](../../README.md). `score.py` genera la música mediante síntesis de cuerdas y percusión. No utiliza muestras, grabaciones ni música externa. Las fuentes Georgia y Arial pertenecen al sistema y no se distribuyen con el video.

## Volver a generar el video

Requiere Python 3.9 o posterior, Pillow, NumPy y FFmpeg con H.264 y AAC. Desde la raíz del repositorio:

```sh
python3 -m pip install Pillow numpy
python3 assets/video/intro/render.py --preview
python3 assets/video/intro/render.py
```

La vista previa se guarda en `.cache/intro-video/contact-sheet.jpg`. El video final se guarda en esta carpeta. La música intermedia queda en `.cache/intro-video/score.wav`. El renderizador también actualiza la portada, los subtítulos y el manifiesto de fuentes.

En macOS se usan Georgia y Arial. En Linux se usan DejaVu Serif y DejaVu Sans. Para elegir otras fuentes, asigná las rutas de sus archivos a `INTRO_SERIF` e `INTRO_SANS`. Un cambio de fuente puede modificar el aspecto del video.

El archivo final usa MP4, H.264, color YUV 4:2:0, 30 cuadros por segundo y audio AAC estéreo. Debe ocupar menos de 10 MiB para facilitar su publicación como adjunto de GitHub.
