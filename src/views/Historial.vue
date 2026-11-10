<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const movimientos = ref([])
let unsub = null

onMounted(() => {
  // Reglas de Firestore obligan a que usuarioId == uid autenticado,
  // así que un usuario no puede leer el historial de otro cambiando el id.
  const q = query(
    collection(db, 'historial_apuestas'),
    where('usuarioId', '==', auth.usuario.uid),
    orderBy('timestamp', 'desc')
  )
  unsub = onSnapshot(q, (snap) => {
    movimientos.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  })
})
onUnmounted(() => unsub && unsub())
</script>

<template>
  <section class="card-registro">
    <h2>Historial</h2>
    <ul>
      <li v-for="m in movimientos" :key="m.id">
        {{ m.fecha }} — {{ m.tipo }} — {{ Number(m.monto).toLocaleString('es-CO') }} COP
        <template v-if="m.tipoApuesta && m.estado === 'pendiente'">
          <p>{{ m.selecciones?.length > 1 ? 'Apuesta combinada' : 'Apuesta activa' }} · Apostado: {{ Number(m.numValor || 0).toLocaleString('es-CO') }} COP · Ganancia potencial original: {{ (Number(m.numValor || 0) * Number(m.cuota || 0)).toLocaleString('es-CO') }} COP</p>
          <button type="button" disabled title="Las APIs conectadas no ofrecen una cotización de cash out verificable.">Cash out no disponible</button>
          <small>El proveedor no ofrece un valor cash out verificable para esta apuesta. No se calcula ni se procesa un importe estimado.</small>
        </template>
      </li>
    </ul>
    <p v-if="!movimientos.length">Aún no tienes movimientos.</p>
  </section>
</template>
