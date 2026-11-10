<script setup>
import { ref } from 'vue'
import { doc, updateDoc, increment, addDoc, collection } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const monto = ref(null)
const mensaje = ref('')

async function retirar() {
  mensaje.value = ''
  const valor = Number(monto.value)
  if (!valor || valor <= 0) { mensaje.value = 'Ingresa un monto válido.'; return }
  // Validación que el sitio original NO tenía: no dejar retirar más
  // saldo del que realmente existe en Firestore (antes solo se
  // comparaba contra el saldo copiado en localStorage).
  if (valor > auth.saldo) { mensaje.value = 'No tienes saldo suficiente.'; return }

  await updateDoc(doc(db, 'usuarios', auth.usuario.uid), { saldo: increment(-valor) })
  await addDoc(collection(db, 'historial_apuestas'), {
    usuarioId: auth.usuario.uid,
    tipo: 'retiro',
    monto: valor,
    fecha: new Date().toLocaleDateString(),
    timestamp: new Date()
  })
  mensaje.value = '¡Retiro realizado con éxito!'
  monto.value = null
}
</script>

<template>
  <section class="card-registro">
    <h2>Retirar</h2>
    <p>Saldo disponible: {{ auth.saldo.toLocaleString('es-CO') }} COP</p>
    <form @submit.prevent="retirar">
      <label>Monto (COP)</label>
      <input v-model="monto" type="number" min="1" required />
      <p v-if="mensaje">{{ mensaje }}</p>
      <button class="btn-submit" type="submit">Retirar</button>
    </form>
  </section>
</template>
