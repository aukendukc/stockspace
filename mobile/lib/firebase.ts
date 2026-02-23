import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword as firebaseUpdatePassword,
  GoogleAuthProvider,
  User,
  signOut as firebaseSignOut,
  Auth,
} from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// Firebase設定（google-services.json / GoogleService-Info.plist から）
const firebaseConfig = {
  apiKey: "AIzaSyAHfgVPj1pZw6LUQd1UEBwyaSgozKwyzpM",
  authDomain: "stockspace-76437.firebaseapp.com",
  projectId: "stockspace-76437",
  storageBucket: "stockspace-76437.firebasestorage.app",
};

// Web OAuth用クライアントID（google-services.json oauth_client client_type:3）
export const GOOGLE_WEB_CLIENT_ID =
  "356977356481-c1dihop5saiqvjc8ic1t7mg8v1ngober.apps.googleusercontent.com";

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

/** React Native では AsyncStorage を渡して認証状態を永続化する（アプリ再起動後もログイン維持） */
export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  const firebaseApp = getFirebaseApp();
  try {
    authInstance = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch (e) {
    // 既に getAuth で初期化されている場合（Web など）
    authInstance = getAuth(firebaseApp);
  }
  return authInstance;
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
}

export async function signInWithGoogleIdToken(idToken: string): Promise<User> {
  const credential = GoogleAuthProvider.credential(idToken);
  const auth = getFirebaseAuth();
  const { user } = await signInWithCredential(auth, credential);
  return user;
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  return user;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }
  await firebaseUpdatePassword(user, newPassword);
}
