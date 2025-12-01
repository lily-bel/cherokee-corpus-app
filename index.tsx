import { createRoot } from 'react-dom/client';
import App from './App';
import { CorpusProvider } from './components/CorpusContext';
import { PackageManagerProvider } from './components/PackageManagerContext';
import './index.css';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <PackageManagerProvider>
            <CorpusProvider>
                <App />
            </CorpusProvider>
        </PackageManagerProvider>
    );
    console.log("Root rendered.");
}