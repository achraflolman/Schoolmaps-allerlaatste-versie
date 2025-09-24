// FIX: Fix Firebase imports to use the v9 compatibility layer, which provides the v8 namespaced API.
// This resolves errors where properties like `apps`, `auth`, and `firestore` were not found on the imported `firebase` object.
import firebase from 'firebase/app';

import 'firebase/auth';

import 'firebase/firestore';

import 'firebase/storage';

// ##################################################################
// #  IMPORTANT: REPLACE WITH YOUR ACTUAL FIREBASE CONFIGURATION    #
// ##################################################################
// For a production app, use environment variables to store this information.
const firebaseConfig = {
  apiKey: "AIzaSyAQf8SV7qf8FQkh7ayvRlBPR1-fRJ6d3Ks", // Corrected API Key
  authDomain: "schoolmaps-6a5f3.firebaseapp.com",
  databaseURL: "https://schoolmaps-6a5f3.firebaseio.com",
  projectId: "schoolmaps-6a5f3",
  storageBucket: "schoolmaps-6a5f3.appspot.com", // CORRECTED: Changed .firebasestorage.app to .appspot.com
  messagingSenderId: "336929063264",
  appId: "1:336929063264:web:b633f4f66fd1b204899e05",
  measurementId: "G-8KKCCFBFSL"
};

// Application ID (used for Firestore collection paths as per user guidelines)
// Ensure this matches the appId in your firebaseConfig.
export const appId = firebaseConfig.appId;

// Initialize Firebase App, but only if it hasn't been initialized already.
// This prevents errors during development with hot-reloading.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}


// Initialize Firebase services
export const auth = firebase.auth();
export const storage = firebase.storage();
export const EmailAuthProvider = firebase.auth.EmailAuthProvider;


// Initialize Firestore with v8 compat API
const db = firebase.firestore();

// --- FIX FOR CONNECTION ISSUES: PART 2 (Long Polling) ---
// Forcing long polling can bypass network restrictions (like firewalls) that block
// WebSockets, which is another common cause for the 'unavailable' error.
db.settings({
    experimentalForceLongPolling: true,
});

// For local development, you might want to use the emulators.
// This helps avoid production connection/billing issues during development.
// To use, uncomment the lines below and run the Firebase Emulators.
/*
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log("Connecting to Firebase Emulators");
    auth.useEmulator('http://127.0.0.1:9099');
    db.useEmulator('127.0.0.1', 8080);
    storage.useEmulator('127.0.0.1', 9199);
}
*/

export { db };

// Exporting Timestamp and other firestore utilities for use in other files
export const Timestamp = firebase.firestore.Timestamp;
export const arrayUnion = firebase.firestore.FieldValue.arrayUnion;
export const increment = firebase.firestore.FieldValue.increment;

// Export the Timestamp TYPE for use in other files without creating circular dependencies.
export type FirebaseTimestamp = firebase.firestore.Timestamp;

export default firebase;