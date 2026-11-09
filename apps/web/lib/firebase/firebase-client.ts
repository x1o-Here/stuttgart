import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

// Prevent multiple app initialization
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);

/**
 * Local development without touching real data: set
 * NEXT_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1 and run `firebase emulators:start`
 * (Firestore on 8080, Auth on 9099). See the "Developing safely" section in README.md.
 */
export const firebaseEmulatorHost =
  process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST ?? "";

const connected = globalThis as { __stuttgartEmulators?: boolean };
if (firebaseEmulatorHost && !connected.__stuttgartEmulators) {
  connectFirestoreEmulator(db, firebaseEmulatorHost, 8080);
  connectAuthEmulator(auth, `http://${firebaseEmulatorHost}:9099`, {
    disableWarnings: true,
  });
  connected.__stuttgartEmulators = true; // survive hot reloads
}
