import { createRoot } from 'react-dom/client';
import CampaignStudio from './app/studio/page.tsx';
import StoryPage from './app/story/page.tsx';
import EditorPage from './app/editor/page.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('Falta el contenedor del editor de campañas.');
const workspace = new URLSearchParams(window.location.search).get('workspace');
const Workspace =
  workspace === 'story' ? StoryPage : workspace === 'sector' ? EditorPage : CampaignStudio;
createRoot(root).render(<Workspace />);
