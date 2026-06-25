import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Get configuration from localStorage or Environment variables
const getFirebaseConfig = () => {
  const savedConfig = localStorage.getItem('dashy_firebase_config');
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    } catch (e) {
      console.error('Error al parsear configuración local de Firebase:', e);
    }
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
  };
};

const config = getFirebaseConfig();
const isConfigValid = !!(config.apiKey && config.projectId);

let db = null;
let firebaseApp = null;

if (isConfigValid) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();
    db = getFirestore(firebaseApp);
    console.log('Firebase inicializado correctamente con credenciales.');
  } catch (error) {
    console.error('Error al inicializar Firebase SDK:', error);
  }
} else {
  console.warn('Firebase no configurado. Utilizando base de datos local simulada (LocalStorage).');
}

export { db, isConfigValid, config };
