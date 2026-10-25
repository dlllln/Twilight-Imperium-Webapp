import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/exo-2/400.css';
import '@fontsource/exo-2/700.css';
import { App } from './App.tsx';
import './styles.css';
import './artwork/units.css';
import './command-deck.css';
import { installTableTextures } from './render/table-textures.ts';
import { installDraftCarry } from './table/draft-carry.ts';

const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  installDraftCarry();
  void installTableTextures();
}
