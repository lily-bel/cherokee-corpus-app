import React, { useState, useEffect } from 'react';
import { Modal } from './UI';
import { AlertCircle, MessageSquare } from './Icons';
import { User } from '../firebase';

// Web3Forms public access key (https://web3forms.com/)
export const WEB3FORMS_ACCESS_KEY =
  (import.meta as any).env?.VITE_WEB3FORMS_ACCESS_KEY || '3f07d392-f09a-4b36-a7c7-a16d89ab5645';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  appVersion?: string;
  onSuccess?: (message: string) => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  user,
  appVersion = '1.0.2',
  onSuccess,
}) => {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEmail(user?.email || '');
      setMessage('');
      setError('');
    }
  }, [isOpen, user?.email]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedMessage = message.trim();
    const trimmedEmail = email.trim();

    if (!trimmedMessage) {
      setError('Please enter your issue or feedback.');
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address or leave it blank.');
      return;
    }

    if (!WEB3FORMS_ACCESS_KEY || WEB3FORMS_ACCESS_KEY === 'YOUR_WEB3FORMS_ACCESS_KEY') {
      setError('Feedback is not configured yet (missing Web3Forms access key).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, string> = {
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `Cherokee Corpus App Feedback (v${appVersion})`,
        from_name: 'Cherokee Corpus App',
        message: trimmedMessage,
        app_version: appVersion,
        signed_in: user ? 'Yes' : 'No',
        user_id: user?.uid || 'anonymous',
        platform: navigator.userAgent,
        page_url: window.location.href,
      };

      if (trimmedEmail) {
        payload.email = trimmedEmail;
        payload.replyto = trimmedEmail;
      }

      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to send feedback. Please try again.');
      }

      onSuccess?.('Feedback sent! Thank you.');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to send feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Send Feedback" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Report a bug or issue with an entry. Or suggest ideas.
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Your Issue or Feedback <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            autoFocus
            required
            placeholder="Describe what happened or what you'd like to see improved..."
            className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900/40 resize-y"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Email Address <span className="text-slate-400 font-normal normal-case">(optional, so I may ask follow-up questions)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900/40"
          />
        </div>

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !message.trim()}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageSquare size={16} />
            <span>{isSubmitting ? 'Sending...' : 'Send Feedback'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
