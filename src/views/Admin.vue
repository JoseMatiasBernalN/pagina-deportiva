<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthStore } from '../stores/auth'

// SEGURIDAD: la ruta /admin ya estÃ¡ protegida por el router guard
// (requiereStaff), que a su vez depende del rol leÃ­do en vivo de
// Firestore â€” no de un localStorage.getItem('es_admin') que
// cualquiera podÃ­a falsificar en la consola. Y aunque alguien
// lograra entrar a esta vista, las reglas de Firestore (no estas
// lÃ­neas de Vue) son las que de verdad bloquean sus escrituras si no
// tiene el rol correcto.
const auth = useAuthStore()
const partidos = ref([])
const nuevoLocal = ref('')
const nuevoVisitante = ref('')
let unsub = null

onMounted(() => {
  unsub = onSnapshot(collection(db, 'partidos'), (snap) => {
    partidos.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  })
})
onUnmounted(() => unsub && unsub())

async function crearPartido() {
  if (!nuevoLocal.value || !nuevoVisitante.value) return
  await addDoc(collection(db, 'partidos'), {
    local: nuevoLocal.value.trim(),
    visitante: nuevoVisitante.value.trim(),
    creadoEn: new Date()
  })
  nuevoLocal.value = ''
  nuevoVisitante.value = ''
}

async function eliminarPartido(id) {
  if (!confirm('Â¿Eliminar este partido?')) return
  await deleteDoc(doc(db, 'partidos', id))
}
</script>

<template>
  <section class="card-registro">
    <h2>Panel de Control â€” {{ auth.esAdmin ? 'Administrador' : 'Moderador' }}</h2>

    <form @submit.prevent="crearPartido">
      <label>Equipo local</label>
      <input v-model="nuevoLocal" required />
      <label>Equipo visitante</label>
      <input v-model="nuevoVisitante" required />
      <button class="btn-submit" type="submit">Crear partido</button>
    </form>

    <h3>Partidos activos</h3>
    <div v-for="p in partidos" :key="p.id" style="border:1px solid #cbd5e1; padding:10px; margin-bottom:8px; border-radius:6px;">
      <strong>{{ p.local }} vs {{ p.visitante }}</strong>
      <button v-if="auth.esAdmin" @click="eliminarPartido(p.id)" style="margin-left:10px;">Eliminar</button>
    </div>
    <p v-if="!partidos.length">No hay partidos registrados.</p>
  </section>
</template>
