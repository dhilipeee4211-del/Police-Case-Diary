import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Use environment variables for production/Vercel deployment
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

let app: any = null;
let auth: any = null;
let db: any = null;
let provider: any = null;
let isFirebaseInitialized = false;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app, import.meta.env.VITE_FIREBASE_DATABASE_ID || "c7d17f7b-a173-4208-a3a4-73a656abd345");
    provider = new GoogleAuthProvider();
    // Request Workspace scopes
    provider.addScope('https://www.googleapis.com/auth/documents');
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    isFirebaseInitialized = true;
  } catch (err) {
    console.warn("Failed to initialize Firebase services, falling back to guest mode simulation.", err);
  }
} else {
  console.info("Firebase config incomplete or not provided. Running in Guest / Local mode only.");
}

export { db };

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory.
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!isFirebaseInitialized || !auth) {
    // If Firebase is not configured, immediately fire onAuthFailure 
    // so the app can transition to Guest Access / local storage safely without getting stuck.
    setTimeout(() => {
      if (onAuthFailure) onAuthFailure();
    }, 0);
    return () => {}; // No-op unsubscribe function
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!isFirebaseInitialized || !auth || !provider) {
    throw new Error('Google Sign-In is not available because Firebase is not configured. Please define VITE_FIREBASE_API_KEY, or continue as Guest Officer.');
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  if (isFirebaseInitialized && auth) {
    await auth.signOut();
  }
  cachedAccessToken = null;
};
