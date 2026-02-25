import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  const msg = "Error: No s'ha trobat l'element 'root' a index.html";
  console.error(msg);
  document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: sans-serif;">${msg}</div>`;
} else {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    console.error("Error durant el renderitzat de React:", error);
    rootElement.innerHTML = `<div style="color: red; padding: 20px; font-family: sans-serif;">
      <h2>S'ha produït un error en carregar l'aplicació</h2>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
    </div>`;
  }
}
