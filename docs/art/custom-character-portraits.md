# Retratos del personaje propio

El creador permite elegir entre los cuatro rostros originales y los 48 retratos del catálogo de contratables. Los 52 retratos aparecen en una cuadrícula desplazable, con una vista del rostro elegido y botones accesibles con teclado.

Elegir un retrato sólo cambia el rostro. El personaje conserva su nombre, apodo, oficio, atributos y respuestas; no adquiere la identidad ni las habilidades del personaje contratado que usa esa imagen.

El catálogo usa archivos locales. El perfil conserva su identificador de retrato durante la creación, el despliegue táctico, el regreso y el guardado. Los perfiles antiguos conservan su retrato. Esta entrega no cambia las familias ni las paletas de las figuras de combate.

Validación: `tests/custom-portraits.test.mjs` recorre los 52 archivos y perfiles, el guardado de campaña y combate, la tira táctica de retratos y el formulario montado. También rechaza identificadores ajenos al catálogo.
