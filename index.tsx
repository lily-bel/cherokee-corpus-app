import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CorpusProvider } from './components/CorpusContext';
import './index.css';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <CorpusProvider>
            <App />
        </CorpusProvider>
    );
    console.log("Root rendered.");
}