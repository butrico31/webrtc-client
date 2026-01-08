// ======================================================
// 🚀 Ponto de Entrada da Aplicação
// ======================================================
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WebRTCPhone from './WebRTCPhone';

// Estilos globais
const globalStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    margin: 0;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
`;

// Injeta estilos globais
const styleSheet = document.createElement("style");
styleSheet.innerText = globalStyles;
document.head.appendChild(styleSheet);

// Renderiza aplicação
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WebRTCPhone />} />
        <Route path="/:numero" element={<WebRTCPhone />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);