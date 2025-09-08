
import 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/app-check';

// The UMD scripts from gstatic CDN are not true ES modules and instead attach
// the `firebase` object to the global `window` scope. This is the correct way
// to access it in this module-based environment.
const firebase = (window as any).firebase;

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


// --- FIX FOR CONNECTION ISSUES: PART 1 (App Check) ---
// Initialize and activate App Check. This is a common solution for 'unavailable' errors
// when App Check is enforced on the Firebase project.
const RECAPTCHA_SITE_KEY = 'YOUR_RECAPTCHA_V3_SITE_KEY_HERE';

if (RECAPTCHA_SITE_KEY === 'YOUR_RECAPTCHA_V3_SITE_KEY_HERE') {
    // MODIFIED: Changed from a fatal error to a console warning.
    // This allows the app to load for development, but App Check will not work.
    // The app will likely still fail to connect to Firestore if App Check is enforced in your Firebase project.
    // You MUST replace the placeholder key to fix this for production.
    console.warn(
        "WARNING: Firebase App Check is not configured.\n\n" +
        "Go to 'services/firebase.ts', find the RECAPTCHA_SITE_KEY constant, and replace the placeholder with your actual reCAPTCHA v3 site key from the Google Cloud Console.\n\n" +
        "The application will not connect to Firebase services until this is configured."
    );
} else {
    try {
        const appCheck = firebase.appCheck();
        appCheck.activate(
          RECAPTCHA_SITE_KEY,
          true
        );
    } catch (error) {
        console.error("App Check initialization failed. This may be expected on unsupported domains (e.g. localhost without a debug token).", error);
    }
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

export default firebase;