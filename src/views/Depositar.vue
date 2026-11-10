<script setup>
import { ref } from 'vue'
import { doc, updateDoc, increment, addDoc, collection } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const monto = ref(null)
const mensaje = ref('')

// NOTA DE SEGURIDAD (léela también en el README):
// Esto sigue siendo una escritura hecha desde el navegador, así que
// las reglas de Firestore (firestore.rules) son las que de verdad
// evitan que alguien ponga un monto absurdo: limitan el saldo a un
// máximo razonable y prohíben tocar "rol"/"bloqueado". Para dinero
// real, lo correcto es mover esto a una Cloud Function que valide
// contra una pasarela de pago real; aquí se deja documentado como
// siguiente paso porque es un proyecto académico sin pasarela de pago.
async function depositar() {
  mensaje.value = ''
  const valor = Number(monto.value)
  if (!valor || valor <= 0) { mensaje.value = 'Ingresa un monto válido.'; return }

  await updateDoc(doc(db, 'usuarios', auth.usuario.uid), { saldo: increment(valor) })
  await addDoc(collection(db, 'historial_apuestas'), {
    usuarioId: auth.usuario.uid,
    tipo: 'deposito',
    monto: valor,
    fecha: new Date().toLocaleDateString(),
    timestamp: new Date()
  })
  mensaje.value = '¡Depósito realizado con éxito!'
  monto.value = null
}
</script>

<template>
  <section class="card-registro">
    <h2>Depositar</h2>
    <form @submit.prevent="depositar">
      <label>Monto (COP)</label>
      <input v-model="monto" type="number" min="1" required />
      <p v-if="mensaje">{{ mensaje }}</p>
      <button class="btn-submit" type="submit">Depositar</button>
    </form>
  </section>
</template>
