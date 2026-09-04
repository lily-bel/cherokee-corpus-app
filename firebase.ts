import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  FacebookAuthProvider, 
  User 
} from "firebase/auth";
import { 
  getDatabase, 
  ref, 
  get, 
  set, 
  update, 
  remove, 
  onValue, 
  off
} from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCxYBxXlHDxLdzWKj8Lul5sNiNBuRJMeC8",
  authDomain: "cherokee-language-exerci-5bac5.firebaseapp.com",
  databaseURL: "https://cherokee-language-exerci-5bac5-default-rtdb.firebaseio.com",
  projectId: "cherokee-language-exerci-5bac5",
  storageBucket: "cherokee-language-exerci-5bac5.firebasestorage.app",
  messagingSenderId: "913050570673",
  appId: "1:913050570673:web:cf48e318cdd61203f77790",
  measurementId: "G-BYMFFX7BFR"
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
const rawDb = getDatabase(app);

// Auth Providers
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

export type { User };

// -------------------------------------------------------------
// Firebase Realtime Database Key Sanitization Helpers
// RTDB keys cannot contain '.', '#', '$', '/', '[', or ']'
// -------------------------------------------------------------
function encodeFirebaseKey(key: string): string {
  return key
    .replace(/%/g, '%25')
    .replace(/\./g, '%2E')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/\//g, '%2F')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D');
}

function decodeFirebaseKey(key: string): string {
  return key
    .replace(/%5D/g, ']')
    .replace(/%5B/g, '[')
    .replace(/%2F/g, '/')
    .replace(/%24/g, '$')
    .replace(/%23/g, '#')
    .replace(/%2E/g, '.')
    .replace(/%25/g, '%');
}

export function encodeFirebaseData(val: any): any {
  if (val === undefined) return null;
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map(encodeFirebaseData);
  }
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      result[encodeFirebaseKey(k)] = encodeFirebaseData(v);
    }
  }
  return result;
}

export function decodeFirebaseData(val: any): any {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map(decodeFirebaseData);
  }
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    result[decodeFirebaseKey(k)] = decodeFirebaseData(v);
  }
  return result;
}

// -------------------------------------------------------------
// Strict Database Wrapper: Forces the parent "dictionary" object
// Prevents any access or modification outside the dictionary node.
// -------------------------------------------------------------
function safeDictionaryPath(subPath: string = ''): string {
  let p = subPath.trim().replace(/^\/+|\/+$/g, '');
  if (p === 'dictionary') {
    p = '';
  } else if (p.startsWith('dictionary/')) {
    p = p.slice('dictionary/'.length);
  }
  
  // Guard against path traversal attempts
  if (p.includes('..')) {
    throw new Error(`Security Violation: Illegal path traversal detected: '${subPath}'`);
  }
  return p ? `dictionary/${p}` : 'dictionary';
}

export const DictionaryDB = {
  /**
   * Safe low-level read strictly scoped under /dictionary
   */
  async get(subPath: string = ''): Promise<any> {
    const dbRef = ref(rawDb, safeDictionaryPath(subPath));
    const snap = await get(dbRef);
    return decodeFirebaseData(snap.val());
  },

  /**
   * Safe low-level write strictly scoped under /dictionary
   */
  async set(subPath: string, value: any): Promise<void> {
    const dbRef = ref(rawDb, safeDictionaryPath(subPath));
    const sanitized = encodeFirebaseData(value);
    await set(dbRef, sanitized);
  },

  /**
   * Safe low-level update strictly scoped under /dictionary
   */
  async update(subPath: string, values: Record<string, any>): Promise<void> {
    const dbRef = ref(rawDb, safeDictionaryPath(subPath));
    const sanitized = encodeFirebaseData(values);
    await update(dbRef, sanitized);
  },

  /**
   * Safe low-level delete strictly scoped under /dictionary
   */
  async remove(subPath: string): Promise<void> {
    const dbRef = ref(rawDb, safeDictionaryPath(subPath));
    await remove(dbRef);
  },

  /**
   * Safe listener strictly scoped under /dictionary
   */
  onValue(subPath: string, callback: (data: any) => void): () => void {
    const dbRef = ref(rawDb, safeDictionaryPath(subPath));
    const unsubscribe = onValue(dbRef, (snap) => {
      callback(decodeFirebaseData(snap.val()));
    });
    return () => off(dbRef, 'value', unsubscribe);
  },

  // -----------------------------------------------------------
  // Domain Specific Scoped APIs
  // -----------------------------------------------------------

  // Public packages pointers: dictionary/public_packages/$packageId -> { author: $userId }
  async getPublicPackagePointer(packageId: string): Promise<{ author: string } | null> {
    return await this.get(`public_packages/${packageId}`);
  },

  async setPublicPackagePointer(packageId: string, authorId: string): Promise<void> {
    await this.set(`public_packages/${packageId}`, { author: authorId });
  },

  async removePublicPackagePointer(packageId: string): Promise<void> {
    await this.remove(`public_packages/${packageId}`);
  },

  async getAllPublicPackages(): Promise<Record<string, { author: string }>> {
    return (await this.get('public_packages')) || {};
  },

  // User packages: dictionary/users/$userId/packages/$packageId
  async saveUserPackage(userId: string, packageId: string, packageData: any): Promise<void> {
    await this.set(`users/${userId}/packages/${packageId}`, packageData);
  },

  async getUserPackage(userId: string, packageId: string): Promise<any | null> {
    return await this.get(`users/${userId}/packages/${packageId}`);
  },

  async getUserPackages(userId: string): Promise<Record<string, any>> {
    return (await this.get(`users/${userId}/packages`)) || {};
  },

  async removeUserPackage(userId: string, packageId: string): Promise<void> {
    await this.remove(`users/${userId}/packages/${packageId}`);
    // Also remove pointer if it exists in public_packages
    await this.removePublicPackagePointer(packageId);
  },

  // High-level resolution for shared package links:
  // Reads public_packages/$packageId to find author, then users/$author/packages/$packageId
  async getPublicPackageWithData(packageId: string): Promise<{ packageId: string; author: string; packageData: any } | null> {
    const pointer = await this.getPublicPackagePointer(packageId);
    if (!pointer || !pointer.author) {
      return null;
    }
    const pkgData = await this.getUserPackage(pointer.author, packageId);
    if (!pkgData) {
      return null;
    }
    return {
      packageId,
      author: pointer.author,
      packageData: pkgData
    };
  },

  // User Library: dictionary/users/$userId/library
  async getUserLibrary(userId: string): Promise<any | null> {
    return await this.get(`users/${userId}/library`);
  },

  async saveUserLibrary(userId: string, libraryData: any): Promise<void> {
    await this.set(`users/${userId}/library`, libraryData);
  },

  // Installed Packages: dictionary/users/$userId/installedPackages
  async getInstalledPackages(userId: string): Promise<Record<string, boolean>> {
    return (await this.get(`users/${userId}/installedPackages`)) || {};
  },

  async setInstalledPackage(userId: string, packageId: string, installed: boolean): Promise<void> {
    if (installed) {
      await this.set(`users/${userId}/installedPackages/${packageId}`, true);
    } else {
      await this.remove(`users/${userId}/installedPackages/${packageId}`);
    }
  },

  async syncInstalledPackages(userId: string, packageIds: string[]): Promise<void> {
    const map: Record<string, boolean> = {};
    packageIds.forEach(id => {
      map[id] = true;
    });
    await this.set(`users/${userId}/installedPackages`, map);
  },

  // User Metadata: dictionary/users/$userId/metadata
  async getUserMetadata(userId: string): Promise<any | null> {
    return await this.get(`users/${userId}/metadata`);
  },

  async saveUserMetadata(userId: string, metadata: Record<string, any>): Promise<void> {
    await this.update(`users/${userId}/metadata`, {
      ...metadata,
      lastActive: Date.now()
    });
  }
};
