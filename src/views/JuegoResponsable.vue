<template>
  <main class="responsible-page">
    <header class="responsible-heading">
      <span>PLAYEXPERT · INFORMACIÓN</span>
      <h1>Juego responsable</h1>
      <p>El juego debe ser una actividad recreativa. No es una forma de obtener ingresos ni de resolver problemas económicos.</p>
    </header>

    <section class="responsible-grid">
      <article class="responsible-card">
        <h2>Recomendaciones</h2>
        <ul>
          <li>Define de antemano cuánto tiempo y dinero puedes dedicar al entretenimiento.</li>
          <li>No apuestes dinero destinado a vivienda, alimentación, transporte o deudas.</li>
          <li>No intentes recuperar pérdidas aumentando tus apuestas.</li>
          <li>Haz pausas y evita jugar cuando estés bajo presión o alterado.</li>
          <li>Si jugar deja de ser divertido, detente y busca apoyo de alguien de confianza.</li>
        </ul>
      </article>

      <article class="responsible-card">
        <h2>Límites y pausas</h2>
        <p>Esta versión no tiene límites de depósito ni autoexclusión aplicados de forma segura por un servidor. Los controles del navegador no impedirían que alguien los eludiera.</p>
        <p>Por esa razón, no presentamos una pausa de cuenta como protección activa. Las apuestas y saldos del proyecto son demostrativos y no deben utilizarse con dinero real.</p>
      </article>

      <article class="responsible-card">
        <h2>Ayuda y soporte</h2>
        <p>No hay un canal de atención especializado conectado en esta aplicación. No inventamos teléfonos, servicios de ayuda ni certificaciones.</p>
        <p>Si esto es una demostración académica, consulta al responsable de tu proyecto. Ante una preocupación personal, contacta a un profesional o a los servicios de apoyo disponibles en tu localidad.</p>
      </article>

      <p class="responsible-note">Solo para personas mayores de edad. Esta demostración no está habilitada para apuestas con dinero real.</p>
    </section>
  </main>
</template>

<style scoped>
.responsible-page{max-width:1050px;margin:40px auto;padding:24px;color:#f8fafc}.responsible-heading{padding:28px;border:1px solid #ffffff1c;border-radius:16px;background:linear-gradient(135deg,#0b2d50,#071a31);box-shadow:0 16px 38px #02081766}.responsible-heading span{color:#38bdf8;font-size:.72rem;font-weight:900;letter-spacing:.16em}.responsible-heading h1{margin:10px 0;color:#facc15;font-size:clamp(1.8rem,4vw,2.6rem)}.responsible-heading p{max-width:720px;color:#d2deed;line-height:1.7}.responsible-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:18px}.responsible-card{padding:22px;border:1px solid #ffffff18;border-radius:14px;background:#10243e;line-height:1.65}.responsible-card h2{margin:0 0 12px;color:#7dd3fc;font-size:1.15rem}.responsible-card p,.responsible-card li{color:#d2deed}.responsible-card ul{padding-left:20px}.responsible-card li+li{margin-top:8px}.responsible-note{grid-column:1/-1;margin:0;padding:14px;border-left:3px solid #facc15;background:#facc1510;color:#fde68a}@media(max-width:680px){.responsible-page{margin:18px auto;padding:14px}.responsible-grid{grid-template-columns:1fr}.responsible-note{grid-column:auto}}
</style>
