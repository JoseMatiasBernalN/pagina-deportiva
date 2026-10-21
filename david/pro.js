
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
export const db = getFirestore(initializeApp(firebaseConfig));
export { collection, getDocs, addDoc };

export const $ = s => document.querySelector(s);
export const money = n => '$' + Math.round(n).toLocaleString('es-CO') + ' COP';
export const saldo = () => parseInt(localStorage.getItem('usuario_saldo') || 0);
export const logueado = () => localStorage.getItem('sesion_activa') === 'true';
export const esDemo = () => localStorage.getItem('usuario_id') === 'demo';

export function pintarSaldo() {
  const e = $('#saldoJuego'); if (e) e.textContent = money(saldo());
}

export function toast(msg, ok = true) {
  const t = $('#toast'); if (!t) return alert(msg);
  t.textContent = msg; t.style.display = 'block';
  t.style.background = ok ? '#16a34a' : '#dc2626'; t.style.color = '#fff';
  clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 3200);
}

export function entrarDemo() {
  localStorage.setItem('sesion_activa', 'true');
  localStorage.setItem('usuario_nombre', 'Demo');
  localStorage.setItem('usuario_saldo', '100000');
  localStorage.setItem('usuario_id', 'demo');
  location.reload();
}

export async function setSaldo(n) {
  localStorage.setItem('usuario_saldo', n); pintarSaldo();
  if (logueado() && !esDemo()) {
    try { await updateDoc(doc(db, 'usuarios', localStorage.getItem('usuario_id')), { saldo: n }); }
    catch (e) { console.warn('No se pudo guardar el saldo en Firebase', e); }
  }
}

export async function mover(datos) {
  if (esDemo()) return;
  try {
    await addDoc(collection(db, 'historial_apuestas'), {
      usuarioId: localStorage.getItem('usuario_id'),
      fecha: new Date().toLocaleDateString(), timestamp: new Date(), ...datos
    });
  } catch (e) { console.warn('No se pudo guardar el movimiento', e); }
}

export function encabezado() {
  const b = $('#bloqueUsuario'); if (!b) return;
  b.innerHTML = logueado()
    ? `<span>Hola, ${localStorage.getItem('usuario_nombre')}</span> <button class="btn-cerrar-sesion" id="salir">Salir</button>`
    : `<button class="btn-cerrar-sesion" id="demoBtn">Modo demo</button>`;
  $('#salir')?.addEventListener('click', () => { localStorage.setItem('sesion_activa', 'false'); location.reload(); });
  $('#demoBtn')?.addEventListener('click', entrarDemo);
  pintarSaldo();
}
