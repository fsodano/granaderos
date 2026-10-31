import { pagePath } from '../../lib/site-path.js';

export default function EditorLink() {
  return (
    <main>
      <h1>Editor de campañas</h1>
      <p>Abrí el editor de campañas para editar, validar y probar un proyecto.</p>
      <a href={pagePath('/campaign-editor/')}>Abrir editor de campañas</a>
    </main>
  );
}
