import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyCNeFF1DNZdak4kojVPycx77i87widEhYI",
  authDomain: "buyala-weighbridge.firebaseapp.com",
  projectId: "buyala-weighbridge",
  storageBucket: "buyala-weighbridge.firebasestorage.app",
  messagingSenderId: "1016028497692",
  appId: "1:1016028497692:web:5ff8b68b2c0a22ea50dcd9",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
let database: Firestore;
try {
  database = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch {
  database = getFirestore(firebaseApp);
}
export const firestore = database;
