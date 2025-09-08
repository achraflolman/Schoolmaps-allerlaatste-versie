import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/app-check';

// ##################################################################
// #  BELANGRIJK: VERVANG MET JE ECHTE FIREBASE-CONFIGURATIE    #
// ##################################################################
// Voor een productie-app, gebruik omgevingsvariabelen om deze informatie op te slaan.
const firebaseConfig = {
    apiKey: "AIzaSyAQf8SV7qf8FQkh7ayvRlBPR1-fRJ6d3Ks", // Verbeterde API-sleutel
    authDomain: "schoolmaps-6a5f3.firebaseapp.com",
    databaseURL: "https://schoolmaps-6a5f3.firebaseio.com",
    projectId: "schoolmaps-6a5f3",
    storageBucket: "schoolmaps-6a5f3.appspot.com", // GECORRIGEERD: .firebasestorage.app is gewijzigd in .appspot.com
    messagingSenderId: "336929063264",
    appId: "1:336929063264:web:b633f4f66fd1b204899e05",
    measurementId: "G-8KKCCFBFSL"
};

// Applicatie-ID (gebruikt voor Firestore-verzamelingen volgens gebruikersrichtlijnen)
// Zorg ervoor dat dit overeenkomt met de appId in je firebaseConfig.
export const appId = firebaseConfig.appId;

// Initialiseer de Firebase-app, maar alleen als deze nog niet is geïnitialiseerd.
// Dit voorkomt fouten tijdens de ontwikkeling met hot-reloading.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// --- INITIALISEER FIREBASE SERVICES EN EXPORTEER ZE ---
// Deze code moet NA firebase.initializeApp() komen om de "Component not registered" fout te voorkomen.
export const auth = firebase.auth();
export const storage = firebase.storage();
export const EmailAuthProvider = firebase.auth.EmailAuthProvider;

// Initialiseer Firestore met v8 compat API
const db = firebase.firestore();

// --- OPLOSSING VOOR VERBINDINGSPROBLEMEN: DEEL 2 (Long Polling) ---
// Het forceren van long polling kan netwerkbeperkingen (zoals firewalls) omzeilen die
// WebSockets blokkeren, wat een andere veelvoorkomende oorzaak is van de 'unavailable'-fout.
db.settings({
    experimentalForceLongPolling: true,
});

// Voor lokale ontwikkeling, wil je mogelijk de emulators gebruiken.
// Dit helpt productie-verbindings- en factureringsproblemen te voorkomen tijdens de ontwikkeling.
// Om ze te gebruiken, decommentaar je de regels hieronder en start je de Firebase Emulators.
/*
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log("Connecting to Firebase Emulators");
    auth.useEmulator('http://127.0.0.1:9099');
    db.useEmulator('127.0.0.1', 8080);
    storage.useEmulator('127.0.0.1', 9199);
}
*/

export { db };

// Exporteer Timestamp en andere firestore-hulpprogramma's voor gebruik in andere bestanden
export const Timestamp = firebase.firestore.Timestamp;
export const arrayUnion = firebase.firestore.FieldValue.arrayUnion;
export const increment = firebase.firestore.FieldValue.increment;

export default firebase;
