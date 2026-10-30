import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCMHrQ8QlJ95pHGqSmNmaoQtTasZMEpvFc",
  authDomain: "biomedaccess-15ef1.firebaseapp.com",
  projectId: "biomedaccess-15ef1",
  storageBucket: "biomedaccess-15ef1.firebasestorage.app",
  messagingSenderId: "917840526780",
  appId: "1:917840526780:web:7fcf2575171992a34dbfb9"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail };
