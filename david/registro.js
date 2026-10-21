// --- IMPORTAR FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5dEiWhSrQ8bEEa_1c_tYLzw8MEeLAAj4",
  authDomain: "disenowed-6eb3b.firebaseapp.com",
  projectId: "disenowed-6eb3b",
  storageBucket: "disenowed-6eb3b.firebasestorage.app",
  messagingSenderId: "176191941008",
  appId: "1:176191941008:web:49dce9b511eb9993ab2b15"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- EVALUACIÓN EN TIEMPO REAL DE MAYORÍA DE EDAD ---
const inputNacimiento = document.getElementById('fecha_nacimiento');
const mensajeEdad = document.getElementById('mensaje_edad');

if (inputNacimiento && mensajeEdad) {
  inputNacimiento.addEventListener('change', function() {
    const fechaValor = this.value;
    
    if (!fechaValor) {
      mensajeEdad.textContent = '';
      return;
    }

    const hoy = new Date();
    const nacimiento = new Date(fechaValor);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }

    if (edad >= 18) {
      mensajeEdad.textContent = `✔ Mayor de edad (${edad} años). Puedes registrarte.`;
      mensajeEdad.style.color = '#16a34a'; // Verde
    } else {
      mensajeEdad.textContent = `✖ Menor de edad (${edad} años). Debes ser mayor de 18 años.`;
      mensajeEdad.style.color = '#dc2626'; // Rojo
    }
  });
}

// --- PROCESAR FORMULARIO Y GUARDAR EN LA NUBE ---
const formRegistro = document.getElementById('registroForm');
if (formRegistro) {
  formRegistro.addEventListener('submit', async function(e) {
    e.preventDefault();

    const fechaNacimiento = document.getElementById('fecha_nacimiento').value;
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }

    if (edad < 18) {
      alert('Acceso denegado: Debes ser mayor de 18 años para apostar en PlayExpert.');
      return;
    }

    const nuevoUsuario = {
      nombre: document.getElementById('nombre').value.trim(),
      correo: document.getElementById('correo').value.trim(),
      cedula: document.getElementById('cedula').value.trim(),
      expedicion: document.getElementById('fecha_expedicion').value,
      nacimiento: fechaNacimiento,
      telefono: document.getElementById('telefono').value.trim(),
      ciudad: document.getElementById('ciudad').value.trim(),
      password: document.getElementById('contrasena').value,
      saldo: 50000,
      rol: esAdmin ? "admin" : "cliente",
      fechaRegistro: new Date()
    };

    try {
      // Guardar en la base de datos de Firebase
      await addDoc(collection(db, "usuarios"), nuevoUsuario);

      // Guardar sesión local temporal
      localStorage.setItem('usuario_nombre', nuevoUsuario.nombre);
      localStorage.setItem('usuario_correo', nuevoUsuario.correo);
      localStorage.setItem('usuario_saldo', nuevoUsuario.saldo);
      localStorage.setItem('sesion_activa', 'true');

      alert('¡Registro exitoso en la nube con un bono inicial de $50.000 COP!');
      window.location.href = 'cuenta.html';
    } catch (error) {
      console.error("Error al registrar en Firebase: ", error);
      alert('Hubo un error al conectar con la base de datos.');
    }
  });
}