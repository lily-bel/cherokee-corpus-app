import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Save, RotateCcw, X } from './Icons';
import { renderStyledText } from '../utils';

const AudioRecorder = ({ onSave, onCancel, title, syllabary, transliteration }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [speakerName, setSpeakerName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [streamReady, setStreamReady] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        // Pre-request microphone access to reduce lag
        const initStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
                setStreamReady(true);
            } catch (err) {
                console.error("Error accessing microphone:", err);
                setError("Could not access microphone. Please check permissions.");
            }
        };
        initStream();

        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            if (timerRef.current) clearInterval(timerRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const startRecording = async () => {
        if (!streamRef.current) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
            } catch (err) {
                console.error("Error accessing microphone:", err);
                setError("Could not access microphone. Please check permissions.");
                return;
            }
        }

        try {
            const mediaRecorder = new MediaRecorder(streamRef.current);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                // Don't stop tracks here so we can re-record quickly
            };

            mediaRecorder.start();
            setIsRecording(true);
            setError(null);
            setRecordingTime(0);

            timerRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error starting recorder:", err);
            setError("Could not start recording.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const togglePlayback = () => {
        if (!audioPlayerRef.current || !audioUrl) return;

        if (isPlaying) {
            audioPlayerRef.current.pause();
            setIsPlaying(false);
        } else {
            audioPlayerRef.current.play();
            setIsPlaying(true);
        }
    };

    const handleReRecord = () => {
        setAudioBlob(null);
        setAudioUrl(null);
        setIsPlaying(false);
        setRecordingTime(0);
    };

    const handleSave = () => {
        if (audioBlob && speakerName.trim()) {
            onSave(audioBlob, speakerName.trim());
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Record Audio</h3>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex flex-col items-center gap-6">
                    <div className="text-center">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">Recording for</p>
                        {syllabary && <h4 className="text-2xl font-noto-cherokee font-bold text-slate-800 dark:text-slate-100 mb-1">{renderStyledText(syllabary)}</h4>}
                        {title && <h5 className="text-lg font-noto-serif text-amber-700 dark:text-amber-500 font-medium mb-1">{renderStyledText(title)}</h5>}
                        {transliteration && <p className="text-sm font-noto-serif text-slate-500 dark:text-slate-400 italic">{renderStyledText(transliteration)}</p>}
                    </div>

                    {!audioBlob ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-50 dark:bg-red-900/20 animate-pulse' : 'bg-slate-50 dark:bg-slate-800'}`}>
                                <button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 ${isRecording ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}
                                >
                                    {isRecording ? <Square size={24} className="fill-current" /> : <Mic size={32} />}
                                </button>
                            </div>
                            <div className="text-2xl font-mono font-bold text-slate-700 dark:text-slate-300">
                                {formatTime(recordingTime)}
                            </div>
                            <p className="text-sm text-slate-400">
                                {isRecording ? "Recording... Tap to stop" : "Tap microphone to start"}
                            </p>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col gap-6">
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 flex items-center gap-4">
                                <button
                                    onClick={togglePlayback}
                                    className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md hover:bg-amber-600 transition-colors shrink-0"
                                >
                                    {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current" />}
                                </button>
                                <div className="flex-1">
                                    <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className={`h-full bg-amber-500 transition-all duration-200 ${isPlaying ? 'w-full animate-[width_linear]' : 'w-0'}`} style={{ animationDuration: `${recordingTime}s` }}></div>
                                    </div>
                                    <div className="flex justify-between mt-1 text-xs text-slate-400 font-mono">
                                        <span>0:00</span>
                                        <span>{formatTime(recordingTime)}</span>
                                    </div>
                                </div>
                                <audio
                                    ref={audioPlayerRef}
                                    src={audioUrl}
                                    onEnded={() => setIsPlaying(false)}
                                    className="hidden"
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleReRecord}
                                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <RotateCcw size={18} /> Re-record
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Speaker Name</label>
                                <input
                                    type="text"
                                    value={speakerName}
                                    onChange={(e) => setSpeakerName(e.target.value)}
                                    placeholder="Enter your name..."
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-amber-500 transition-colors"
                                    autoFocus
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={!speakerName.trim()}
                                className="w-full py-4 bg-slate-900 dark:bg-slate-700 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                <Save size={20} /> Save Recording
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-3 rounded-lg w-full">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AudioRecorder;
