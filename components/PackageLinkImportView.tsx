import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { usePackageManager } from './PackageManagerContext';
import { usePackageImport } from './usePackageHooks';
import { DictionaryDB } from '../firebase';
import { Download, Check, Box, ArrowLeft, AlertCircle, GoogleIcon, FacebookIcon, UserIcon } from './Icons';
import { AuthModal } from './AuthModal';

interface PackageLinkImportViewProps {
  packageId: string;
  onImportSuccess: (pkgName: string) => void;
  onDismiss: () => void;
}

export const PackageLinkImportView: React.FC<PackageLinkImportViewProps> = ({
  packageId,
  onImportSuccess,
  onDismiss
}) => {
  const { user, loginWithGoogle, loginWithFacebook } = useAuth();
  const { packages } = usePackageManager();
  const { importPackageFromJson } = usePackageImport();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packageData, setPackageData] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const isAlreadyInstalled = packages.some(p => p.id === packageId);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPackage = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await DictionaryDB.getPublicPackageWithData(packageId);
        if (!result) {
          setError(`Package "${packageId}" was not found or is no longer shared publicly.`);
        } else {
          setPackageData(result.packageData);
        }
      } catch (err: any) {
        console.error("Error fetching shared package:", err);
        setError(err.message || 'Failed to fetch package from cloud.');
      } finally {
        setLoading(false);
      }
    };

    fetchPackage();
  }, [packageId, user]);

  const handleImport = async () => {
    if (!packageData) return;
    setIsImporting(true);
    try {
      const color = packageData.metadata?.color || '#ef4444';
      const installedPkg = await importPackageFromJson(packageData, color);
      setImportSuccess(true);
      onImportSuccess(installedPkg.name);
    } catch (err: any) {
      console.error("Import failed:", err);
      setError(err.message || 'Failed to install package.');
    } finally {
      setIsImporting(false);
    }
  };

  // 1. Not Logged In View: Prompt login
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F9F9F7] dark:bg-slate-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 text-center">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Box size={28} />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 font-noto-serif">
              Sign In to View Package
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
              This Cherokee language package has been shared with you via public link. Please sign in to preview and import it into your dictionary.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => loginWithGoogle()}
              className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm flex items-center justify-center gap-3 transition-colors"
            >
              <GoogleIcon size={18} />
              <span>Continue with Google</span>
            </button>
            <button
              onClick={() => loginWithFacebook()}
              className="w-full py-2.5 px-4 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl text-sm font-semibold shadow-sm flex items-center justify-center gap-3 transition-colors"
            >
              <FacebookIcon size={18} className="fill-white" />
              <span>Continue with Facebook</span>
            </button>
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <UserIcon size={18} />
              <span>Sign In with Email</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onDismiss}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Skip and go to Dictionary
            </button>
          </div>
        </div>

        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} />
        )}
      </div>
    );
  }

  // 2. Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F9F9F7] dark:bg-slate-950 p-4">
        <div className="p-8 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 font-noto-serif">
            Loading shared package details...
          </p>
        </div>
      </div>
    );
  }

  // 3. Error State (Package not found or deleted)
  if (error || !packageData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F9F9F7] dark:bg-slate-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 text-center">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle size={26} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Package Not Found</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {error || `The package with ID "${packageId}" could not be located.`}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold rounded-xl text-sm transition-colors"
          >
            Go to Dictionary
          </button>
        </div>
      </div>
    );
  }

  // 4. Package Detail & Import Page
  const meta = packageData.metadata || {};
  const stats = meta.stats || {
    words: Array.isArray(packageData.base_forms) ? packageData.base_forms.length : 0,
    sentences: Array.isArray(packageData.sentences) ? packageData.sentences.length : 0,
    glosses: Array.isArray(packageData.sentence_joins) ? packageData.sentence_joins.length : 0,
    word_forms: Array.isArray(packageData.conjugations) ? packageData.conjugations.length : 0,
    lists: Array.isArray(packageData.lists) ? packageData.lists.length : 0,
  };

  const color = meta.color || '#ef4444';
  const initials = meta.name ? (meta.name.split(' ').length > 1 ? (meta.name.split(' ')[0][0] + meta.name.split(' ')[1][0]).toUpperCase() : meta.name.substring(0, 2).toUpperCase()) : 'PK';

  return (
    <div className="min-h-screen bg-[#F9F9F7] dark:bg-slate-950 flex flex-col justify-between">
      {/* Top bar */}
      <header className="px-4 h-12 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
        <button
          onClick={onDismiss}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-600 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Dictionary</span>
        </button>
        <span className="text-xs font-mono text-slate-400">
          Public Package Link
        </span>
      </header>

      {/* Main card */}
      <main className="max-w-xl w-full mx-auto p-4 flex-1 flex items-center">
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0"
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold font-noto-serif text-slate-900 dark:text-slate-100 truncate">
                {meta.name || 'Shared Package'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                by <span className="font-semibold text-slate-700 dark:text-slate-300">{meta.author || 'Anonymous'}</span>
                {meta.date_created && (
                  <span className="ml-2 font-mono">
                    • {new Date(meta.date_created).toLocaleDateString()}
                  </span>
                )}
              </p>
              {packageData.updateOf && (
                <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                  Update of: {packageData.updateOf.substring(0, 8)}...
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {meta.description && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {meta.description}
              </p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
              <span className="block text-base font-bold text-slate-800 dark:text-slate-100 font-mono">
                {stats.words || 0}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Words
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
              <span className="block text-base font-bold text-slate-800 dark:text-slate-100 font-mono">
                {stats.sentences || 0}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Sentences
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
              <span className="block text-base font-bold text-slate-800 dark:text-slate-100 font-mono">
                {stats.glosses || 0}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Glosses
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
              <span className="block text-base font-bold text-slate-800 dark:text-slate-100 font-mono">
                {stats.word_forms || 0}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Forms
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
              <span className="block text-base font-bold text-slate-800 dark:text-slate-100 font-mono">
                {stats.lists || 0}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Lists
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
              <span className="block text-base font-bold text-slate-800 dark:text-slate-100 font-mono">
                {meta.app_version || '1.0'}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Version
              </span>
            </div>
          </div>

          {/* Import Action */}
          <div className="space-y-3 pt-2">
            {importSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
                  <Check size={18} />
                </div>
                <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  Successfully Installed!
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  This package is now active in your dictionary and synced to your installed packages list.
                </p>
                <button
                  onClick={onDismiss}
                  className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  Open Dictionary
                </button>
              </div>
            ) : isAlreadyInstalled ? (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs text-center font-medium">
                  This package is already installed on your device.
                </div>
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  {isImporting ? 'Reinstalling...' : <><Download size={18} /> Re-import / Update Package</>}
                </button>
              </div>
            ) : (
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>Installing Package...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>Import Package</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="p-4 text-center text-xs text-slate-400">
        ᏣᎳᎩ-English Dictionary Corpus App
      </footer>
    </div>
  );
};
