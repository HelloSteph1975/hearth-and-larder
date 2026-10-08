import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/caveat/600.css';
import './theme/tokens.css';
import './theme/global.css';
import './theme/print.css';
import { App } from './App.jsx';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
