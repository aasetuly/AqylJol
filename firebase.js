/* AqylJol — подключение к Firebase (проект aqylzhol). Подключается в каждом HTML как <script type="module">.
   Конфиг веб-приложения не секретный; доступ к данным защищают правила Firebase. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect,
         GoogleAuthProvider, signOut, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCvbFOGcULO-yBxPYTymmT_M5LRHKrDDqE",
  authDomain: "aqylzhol.firebaseapp.com",
  projectId: "aqylzhol",
  storageBucket: "aqylzhol.firebasestorage.app",
  messagingSenderId: "945223942941",
  appId: "1:945223942941:web:24cd704ef1cf6c53bfd7f4",
  measurementId: "G-EV53XG52YL"
};

const app = initializeApp(firebaseConfig);
window.AqylFB = {
  app,
  auth: getAuth(app),
  onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, updateProfile
};
window.dispatchEvent(new Event("aqyl-fb-ready"));

import "./sync.js";
