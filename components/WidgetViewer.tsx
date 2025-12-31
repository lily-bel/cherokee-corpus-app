
import React, { useState, useEffect } from 'react';
import { ArrowLeft } from './Icons';

interface WidgetViewerProps {
    widget: { name: string; content: string; isBuiltIn: boolean; path?: string };
    onClose: () => void;
}

const WidgetViewer: React.FC<WidgetViewerProps> = ({ widget, onClose }) => {
    const [content, setContent] = useState<string>('');
    // const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const load = async () => {
            if (widget.isBuiltIn && widget.path) {
                // For built-in, we can just set the src, but to ensure full screen and proper loading we might want to fetch it?
                // Actually, if we use src directly, it's easier for relative paths if any.
                // But user said "runs in an iframe".
                // Let's try using src for built-in and srcDoc for custom.
            } else {
                setContent(widget.content);
            }
        };
        load();
    }, [widget]);

    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col">
            <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 justify-between bg-white dark:bg-slate-900 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full -ml-2">
                        <ArrowLeft size={24} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">{widget.name}</h2>
                </div>
            </div>
            <div className="flex-1 relative bg-slate-100 dark:bg-slate-900">
                {widget.isBuiltIn && widget.path ? (
                    <iframe
                        src={widget.path}
                        className="w-full h-full border-0"
                        title={widget.name}
                        allowFullScreen
                    />
                ) : (
                    <iframe
                        srcDoc={content}
                        className="w-full h-full border-0"
                        title={widget.name}
                        allowFullScreen
                    />
                )}
            </div>
        </div>
    );
};

export default WidgetViewer;
