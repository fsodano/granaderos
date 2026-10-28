import { pagePath } from '../../lib/site-path.js';

export default function EditorLink() {
  return (
    <main>
      <h1>Editor de historia</h1>
      <p>
        Abrí el editor de campañas para editar, validar y probar un proyecto.
      </p>
      <a href={pagePath('/campaign-editor/?workspace=story')}>Abrir editor de campañas</a>
    </main>
  );
}
