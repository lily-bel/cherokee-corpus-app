import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  auth, 
  googleProvider, 
  facebookProvider, 
  DictionaryDB, 
  User 
} from '../firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail,
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

export interface CloudLibraryData {
  customDictionaries?: Record<string, any>;
  personalWords?: any[];
  userSentences?: any[];
  userGlosses?: any[];
  userWordForms?: Record<string, string>;
  userNotes?: Record<string, string>;
  customLists?: Record<string, any>;
  customListOrder?: string[];
  favorites?: string[];
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  syncStatus: SyncStatus;
  lastSynced: number | null;
  loginWithGoogle: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  setSyncStatus: (status: SyncStatus) => void;
  recordSyncSuccess: () => void;
  syncLibraryToCloud: (libraryData: CloudLibraryData, installedPackageIds: string[]) => Promise<void>;
  loadAndMergeCloudData: (currentLocal: CloudLibraryData, installedPackageIds: string[]) => Promise<{
    mergedLibrary: CloudLibraryData;
    mergedInstalledIds: string[];
  }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

// -------------------------------------------------------------
// Cloud Library Merger
// Merges local and cloud data smoothly without losing data
// -------------------------------------------------------------
export function mergeLibraryData(local: CloudLibraryData, cloud: CloudLibraryData): CloudLibraryData {
  // 1. Custom Dictionaries
  const customDictionaries = {
    ...(cloud.customDictionaries || {}),
    ...(local.customDictionaries || {})
  };

  // 2. Personal Words (deduplicate by id / Index)
  const wordMap = new Map<string, any>();
  (cloud.personalWords || []).forEach(w => {
    const key = w.id || w.Index;
    if (key) wordMap.set(key, w);
  });
  (local.personalWords || []).forEach(w => {
    const key = w.id || w.Index;
    if (key) {
      const existing = wordMap.get(key);
      wordMap.set(key, { ...existing, ...w });
    }
  });
  const personalWords = Array.from(wordMap.values());

  // 3. User Sentences (deduplicate by id)
  const sentenceMap = new Map<string, any>();
  (cloud.userSentences || []).forEach(s => {
    if (s.id) sentenceMap.set(s.id, s);
  });
  (local.userSentences || []).forEach(s => {
    if (s.id) {
      const existing = sentenceMap.get(s.id);
      sentenceMap.set(s.id, { ...existing, ...s });
    }
  });
  const userSentences = Array.from(sentenceMap.values());

  // 4. User Glosses (deduplicate by id or sentence_id + word_index + entry_id)
  const glossMap = new Map<string, any>();
  (cloud.userGlosses || []).forEach(g => {
    const key = g.id || `${g.sentence_id}_${g.word_index}_${g.entry_id}`;
    glossMap.set(key, g);
  });
  (local.userGlosses || []).forEach(g => {
    const key = g.id || `${g.sentence_id}_${g.word_index}_${g.entry_id}`;
    const existing = glossMap.get(key);
    glossMap.set(key, { ...existing, ...g });
  });
  const userGlosses = Array.from(glossMap.values());

  // 5. User Word Forms (combine keys)
  const userWordForms = {
    ...(cloud.userWordForms || {}),
    ...(local.userWordForms || {})
  };

  // 6. User Notes (combine keys)
  const userNotes = {
    ...(cloud.userNotes || {}),
    ...(local.userNotes || {})
  };

  // 7. Custom Lists (combine by list id)
  const customLists = {
    ...(cloud.customLists || {}),
    ...(local.customLists || {})
  };

  // 8. Custom List Order (union of ids)
  const cloudOrder = cloud.customListOrder || [];
  const localOrder = local.customListOrder || [];
  const listOrderSet = new Set<string>([...localOrder, ...cloudOrder]);
  const customListOrder = Array.from(listOrderSet);

  // 9. Favorites (union of ids)
  const cloudFavs = cloud.favorites || [];
  const localFavs = local.favorites || [];
  const favSet = new Set<string>([...localFavs, ...cloudFavs]);
  const favorites = Array.from(favSet);

  return {
    customDictionaries,
    personalWords,
    userSentences,
    userGlosses,
    userWordForms,
    userNotes,
    customLists,
    customListOrder,
    favorites
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<number | null>(() => {
    const saved = localStorage.getItem('cherokee_app_last_synced');
    return saved ? parseInt(saved, 10) : null;
  });

  const recordSyncSuccess = useCallback(() => {
    const now = Date.now();
    setLastSynced(now);
    setSyncStatus('synced');
    try {
      localStorage.setItem('cherokee_app_last_synced', String(now));
    } catch {
      // ignore
    }
  }, []);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Update user metadata in Firebase dictionary/users/$userId/metadata
        try {
          await DictionaryDB.saveUserMetadata(currentUser.uid, {
            displayName: currentUser.displayName || 'Anonymous User',
            email: currentUser.email || '',
            photoURL: currentUser.photoURL || '',
          });
        } catch (err) {
          console.warn('Failed to update user metadata in Firebase:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } finally {
      setLoading(false);
    }
  };

  const loginWithFacebook = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, facebookProvider);
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } finally {
      setLoading(false);
    }
  };

  const signupWithEmail = async (email: string, pass: string, displayName?: string) => {
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (displayName && cred.user) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setSyncStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Syncs the user's library and installed packages to Firebase RTDB under dictionary/users/$userId/
   */
  const syncLibraryToCloud = useCallback(async (
    libraryData: CloudLibraryData, 
    installedPackageIds: string[]
  ) => {
    if (!auth.currentUser) return;
    setSyncStatus('syncing');
    try {
      const uid = auth.currentUser.uid;
      // 1. Save library (audio & widgets excluded)
      await DictionaryDB.saveUserLibrary(uid, libraryData);
      // 2. Sync installed packages list
      await DictionaryDB.syncInstalledPackages(uid, installedPackageIds);
      recordSyncSuccess();
    } catch (e) {
      console.error('Failed to sync data to Firebase:', e);
      setSyncStatus('error');
    }
  }, [recordSyncSuccess]);

  /**
   * Loads user library & installed packages from Firebase and merges with local data.
   */
  const loadAndMergeCloudData = useCallback(async (
    currentLocal: CloudLibraryData, 
    installedPackageIds: string[]
  ): Promise<{ mergedLibrary: CloudLibraryData; mergedInstalledIds: string[] }> => {
    if (!auth.currentUser) {
      return { mergedLibrary: currentLocal, mergedInstalledIds: installedPackageIds };
    }

    setSyncStatus('syncing');
    try {
      const uid = auth.currentUser.uid;
      const [cloudLib, cloudInstalled] = await Promise.all([
        DictionaryDB.getUserLibrary(uid),
        DictionaryDB.getInstalledPackages(uid)
      ]);

      const mergedLibrary = mergeLibraryData(currentLocal, cloudLib || {});
      
      const cloudInstalledIds = Object.keys(cloudInstalled || {}).filter(k => cloudInstalled[k]);
      const mergedInstalledIds = Array.from(new Set([...installedPackageIds, ...cloudInstalledIds]));

      // Save merged result back to cloud immediately so both sides are synced
      await Promise.all([
        DictionaryDB.saveUserLibrary(uid, mergedLibrary),
        DictionaryDB.syncInstalledPackages(uid, mergedInstalledIds)
      ]);

      recordSyncSuccess();
      return { mergedLibrary, mergedInstalledIds };
    } catch (e) {
      console.error('Failed to load and merge cloud data:', e);
      setSyncStatus('error');
      return { mergedLibrary: currentLocal, mergedInstalledIds: installedPackageIds };
    }
  }, [recordSyncSuccess]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        syncStatus,
        lastSynced,
        loginWithGoogle,
        loginWithFacebook,
        loginWithEmail,
        signupWithEmail,
        resetPassword,
        logout,
        setSyncStatus,
        recordSyncSuccess,
        syncLibraryToCloud,
        loadAndMergeCloudData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
