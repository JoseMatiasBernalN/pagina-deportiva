import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-00o24gnM90kAe7_7W02jcE_S0pDxB0",
  authDomain: "playexpert.firebaseapp.com",
  projectId: "playexpert",
  storageBucket: "playexpert.firebasestorage.app",
  messagingSenderId: "2187644623",
  appId: "1:2187644623:web:361a0220c3a86fad9231ba",
  measurementId: "G-RYBNWRYNFJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const correo = document.getElementById('correo').value.trim();
      const password = document.getElementById('password').value.trim();

      try {
        const usuariosRef = collection(db, "usuarios");
        const q = query(usuariosRef, where("correo", "==", correo));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          alert('Correo o contraseña incorrectos.');
          return;
        }

        let usuarioEncontrado = false;
        
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          if (userData.password === password) {
            
            // Validar si la cuenta está bloqueada
            if (userData.bloqueado === true) {
              alert('Esta cuenta ha sido bloqueada por motivos de seguridad.');
              usuarioEncontrado = true; // Para que no muestre el error de contraseña incorrecta
              return;
            }

            usuarioEncontrado = true;
            
            // Guardar datos básicos en el navegador
            localStorage.setItem('sesion_activa', 'true');
            localStorage.setItem('usuario_nombre', userData.nombre);
            localStorage.setItem('usuario_correo', userData.correo);
            localStorage.setItem('usuario_saldo', userData.saldo);
            localStorage.setItem('usuario_id', doc.id); 

            // Redirección inteligente según el rol (Admin o Moderador van a admin.html)
            if (userData.rol === "admin" || userData.rol === "moderador") {
              localStorage.setItem('es_admin', userData.rol === "admin" ? 'true' : 'false');
              alert(`¡Bienvenido ${userData.rol === "admin" ? "Administrador" : "Moderador"}!`);
              window.location.href = 'admin.html';
            } else {
              localStorage.setItem('es_admin', 'false');
              alert('¡Inicio de sesión exitoso!');
              window.location.href = 'cuenta.html';
            }
          }
        });

        if (!usuarioEncontrado) {
          alert('Correo o contraseña incorrectos.');
        }

      } catch (error) {
        console.error("Error al iniciar sesión: ", error);
        alert('Error al conectar con la base de datos.');
      }
    });
  }
});