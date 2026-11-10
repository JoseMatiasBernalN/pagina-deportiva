// Store de sesión con Pinia.
//
// CAMBIO DE SEGURIDAD CLAVE respecto al sitio original:
// Antes, "rol", "saldo" y "es_admin" se guardaban en localStorage al
// iniciar sesión y TODA la app confiaba en esos valores. Cualquier
// usuario podia abrir la consola del navegador y escribir:
//   localStorage.setItem('usuario_saldo', '999999999')
//   localStorage.setItem('es_admin', 'true')
// y el sitio se lo creia.
//
// Ahora el perfil (rol, saldo, bloqueado...) se lee EN VIVO desde
// Firestore con onSnapshot, nunca desde localStorage. La app ya no
// decide si alguien es admin o cuanto saldo tiene: lo decide el
// documento real en la base de datos, protegido ademas por las reglas
// de Firestore (ver firestore.rules) que impiden que el propio usuario
// edite su campo "rol" o "bloqueado".
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

export const useAuthStore = defineStore('auth', () => {
  const usuario = ref(null)       // objeto de Firebase Auth (o null)
  const perfil = ref(null)        // documento usuarios/{uid} en vivo
  const cargando = ref(true)      // true hasta que sepamos si hay sesion
  let unsubPerfil = null

  const logueado = computed(() => !!usuario.value)
  const esAdmin = computed(() => perfil.value?.rol === 'admin')
  const esStaff = computed(() => ['admin', 'moderador'].includes(perfil.value?.rol))
  const saldo = computed(() => perfil.value?.saldo ?? 0)
  const bloqueado = computed(() => perfil.value?.bloqueado === true)

  // Escucha el estado de Firebase Auth una sola vez, al arrancar la app.
  const listo = new Promise((resolve) => {
    onAuthStateChanged(auth, (u) => {
      usuario.value = u
      if (unsubPerfil) { unsubPerfil(); unsubPerfil = null }

      if (u) {
        // Escucha en tiempo real el documento del usuario: si el admin
        // cambia su saldo o lo bloquea, se refleja al instante.
        unsubPerfil = onSnapshot(doc(db, 'usuarios', u.uid), (snap) => {
          perfil.value = snap.exists() ? snap.data() : null
        })
      } else {
        perfil.value = null
      }
      cargando.value = false
      resolve()
    })
  })

  async function login(correo, password) {
    const cred = await signInWithEmailAndPassword(auth, correo, password)
    return cred.user
  }

  async function registrar(datos, password) {
    const cred = await createUserWithEmailAndPassword(auth, datos.correo, password)
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      ...datos,
      saldo: 0,
      rol: 'cliente',
      bloqueado: false,
      creadoEn: new Date()
    })
    return cred.user
  }

  async function logout() {
    await signOut(auth)
  }

  return { usuario, perfil, cargando, listo, logueado, esAdmin, esStaff, saldo, bloqueado, login, registrar, logout }
})
