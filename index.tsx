import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './components/AuthContext';
import { CorpusProvider } from './components/CorpusContext';
import { PackageManagerProvider } from './components/PackageManagerContext';
import { ReaderProvider } from './components/ReaderContext';
import './index.css';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <AuthProvider>
            <PackageManagerProvider>
                <CorpusProvider>
                    <ReaderProvider>
                        <App />
                    </ReaderProvider>
                </CorpusProvider>
            </PackageManagerProvider>
        </AuthProvider>
    );
    console.log("Root rendered.");
}