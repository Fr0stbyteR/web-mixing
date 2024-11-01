import './index.scss';
import './vscode.css';
import "@vscode/codicons/dist/codicon.css";
import "@vscode/codicons/dist/codicon.ttf";
import "@vscode/codicons/dist/codicon.svg";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
    <App />
    </StrictMode>,
);
