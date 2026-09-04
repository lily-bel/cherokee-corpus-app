import React, { useState } from 'react';
import { Modal } from './UI';
import { useAuth } from './AuthContext';
import { GoogleIcon, FacebookIcon, CloudCheck, AlertCircle } from './Icons';

interface AuthModalProps {
  onClose: () => void;
  onSyncNow?: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSyncNow }) => {
  const { 
    user, 
    loginWithGoogle, 
    loginWithFacebook, 
    loginWithEmail, 
    signupWithEmail, 
    resetPassword, 
    logout,
    syncStatus,
    lastSynced 
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleGoogle = async () => {
    clearMessages();
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err.message || 'Google sign-in failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFacebook = async () => {
    clearMessages();
    setIsSubmitting(true);
    try {
      await loginWithFacebook();
      onClose();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err.message || 'Facebook sign-in failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        await loginWithEmail(email, password);
        onClose();
      } else if (mode === 'signup') {
        if (!password || password.length < 6) {
          setErrorMessage('Password must be at least 6 characters long.');
          setIsSubmitting(false);
          return;
        }
        await signupWithEmail(email, password, displayName);
        onClose();
      } else if (mode === 'forgot') {
        if (!email) {
          setErrorMessage('Please enter your email address.');
          setIsSubmitting(false);
          return;
        }
        await resetPassword(email);
        setSuccessMessage('Password reset email sent! Check your inbox.');
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication error';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsSubmitting(true);
    try {
      await logout();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // If user is already logged in, show Profile & Sync view
  if (user) {
    return (
      <Modal title="Account & Backup" onClose={onClose}>
        <div className="space-y-6">
          {/* User Info Card */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                className="w-14 h-14 rounded-full object-cover border-2 border-amber-500 shadow-sm"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xl border-2 border-amber-500/30">
                {(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                {user.displayName || 'Cherokee Learner'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                {user.email}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Online Sync Active
                </span>
              </div>
            </div>
          </div>

          {/* Cloud Sync Status */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {syncStatus === 'syncing' ? (
                  <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                ) : syncStatus === 'error' ? (
                  <AlertCircle size={18} className="text-red-500" />
                ) : (
                  <CloudCheck size={18} className="text-emerald-500" />
                )}
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Cloud Backup Status
                </span>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {lastSynced ? `Last synced ${new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not synced yet'}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Your custom words, sentences, notes, conjugations, lists, and package installations are automatically backed up to your account.
              <span className="block mt-1 text-slate-400 dark:text-slate-500 italic">
                (Note: Audio recordings and widgets are kept locally to conserve cloud quota.)
              </span>
            </p>

            {onSyncNow && (
              <button
                type="button"
                onClick={onSyncNow}
                disabled={isSubmitting || syncStatus === 'syncing'}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                {syncStatus === 'syncing' ? 'Backing Up...' : 'Back Up Now'}
              </button>
            )}
          </div>

          {/* Sign Out Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-semibold transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // Not logged in: Show Auth Forms
  return (
    <Modal title={mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'} onClose={onClose}>
      <div className="space-y-5">
        {/* Tabs for Sign In vs Sign Up */}
        {mode !== 'forgot' && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setMode('signin'); clearMessages(); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mode === 'signin' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); clearMessages(); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mode === 'signup' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error / Success Banners */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CloudCheck size={16} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Social Logins */}
        {mode !== 'forgot' && (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm flex items-center justify-center gap-3 transition-colors disabled:opacity-60"
            >
              <GoogleIcon size={18} />
              <span>Continue with Google</span>
            </button>
            <button
              type="button"
              onClick={handleFacebook}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl text-sm font-semibold shadow-sm flex items-center justify-center gap-3 transition-colors disabled:opacity-60"
            >
              <FacebookIcon size={18} className="fill-white" />
              <span>Continue with Facebook</span>
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
              <span className="flex-shrink mx-3 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                or with email
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Name (optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your Name"
                className="w-full px-3 py-2 bg-transparent border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 bg-transparent border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); clearMessages(); }}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-transparent border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl text-sm shadow-md transition-colors disabled:opacity-50"
          >
            {isSubmitting 
              ? 'Processing...' 
              : mode === 'signin' 
                ? 'Sign In' 
                : mode === 'signup' 
                  ? 'Create Account' 
                  : 'Send Reset Link'
            }
          </button>

          {mode === 'forgot' && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setMode('signin'); clearMessages(); }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </form>
      </div>
    </Modal>
  );
};
