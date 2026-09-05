import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Granaderos — La independencia se conquista', description: 'Un juego de estrategia y combate táctico por turnos en las Provincias Unidas del Río de la Plata, 1810–1820.' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="es-AR"><body>{children}</body></html>; }
