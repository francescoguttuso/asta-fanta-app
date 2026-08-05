// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCMibX1obk-pQ5RS4D0jdtsqJOJDIdok5c",
  authDomain: "astafanta-9a49d.firebaseapp.com",
  projectId: "astafanta-9a49d",
  storageBucket: "astafanta-9a49d.firebasestorage.app",
  messagingSenderId: "862180230703",
  appId: "1:862180230703:web:db70c6fd3febb7a25d68da",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
