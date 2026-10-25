import '@fontsource/press-start-2p/400.css';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

// No StrictMode: it would mount the Phaser game twice in development.
createRoot(document.getElementById('root')!).render(<App />);
