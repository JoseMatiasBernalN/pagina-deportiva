<script setup>
import ChatbotAssistant from '../components/ChatbotAssistant.vue'
import HomeEventCard from '../components/HomeEventCard.vue'
import LiveEventCard from '../components/LiveEventCard.vue'

const events = [
  {
    home: 'Real Madrid', away: 'Barcelona', homeOdds: 2.10, drawOdds: 3.25, awayOdds: 3.50,
    image: '/imagenes/realmadrir_vs_barcelona.jpg'
  },
  {
    home: 'Brasil', away: 'Colombia', homeOdds: 1.75, drawOdds: 3.40, awayOdds: 4.50,
    image: '/imagenes/colombia_vs_brasil.jpg'
  },
  {
    home: 'Lakers', away: 'Warriors', homeOdds: 1.90, drawOdds: null, awayOdds: 1.95,
    image: '/imagenes/Warriors_vs_Lakers.jpg'
  }
]

const liveEvents = [
  {
    title: 'Liga PlayExpert', alt: 'Fútbol en Vivo', image: '/imagenes/Millonarios_vs_Nacional.jpg',
    description: 'Sigue el partido en tiempo real y apuesta mientras se desarrolla la acción. Millonarios vs Nacional.'
  },
  {
    title: 'NBA Basketball', alt: 'Baloncesto en Vivo', image: '/imagenes/Warriors_vs_Lakers_envivo.jpg',
    description: 'No te pierdas la emocionante temporada de la NBA. Apuesta en vivo con las mejores cuotas.'
  },
  {
    title: 'Clásico Sudamericano de Clubes', alt: 'Voleibol en Vivo', image: '/imagenes/Power_Arregoces_vs_U_Católica.jpg',
    description: 'Sigue la acción punto a punto. Apuesta en directo al ganador del set o del partido.',
    detail: '**Power Arregoces vs. U. Católica**'
  },
  {
    title: 'US Open - Cuartos de Final', alt: 'Tenis en Vivo', image: '/Grand_Slam_Tenis.jpg',
    description: 'Apuesta al próximo juego, al ganador del set o al resultado final del partido.',
    detail: '**Alcaraz vs. Sinner**'
  }
]
</script>

<template>
  <div class="hero-video">
    <video class="bg-video" autoplay muted loop playsinline>
      <source src="/videos/VIDEO.mp4" type="video/mp4" />
      Tu navegador no soporta videos HTML5.
    </video>
    <img :src="'/img/sports-bg.jpg'" alt="Fondo alternativo" class="bg-image" />
    <div class="hero-content">
      <h1>¡Las Mejores Apuestas Deportivas!</h1>
      <p>Gana grande con PlayExpert. Las mejores cuotas en fútbol, baloncesto, tenis y más. ¡Regístrate ahora y obtén un bono de bienvenida de hasta $500.000!</p>
      <router-link to="/registro" class="btn">Regístrate y Gana</router-link>
    </div>
  </div>

  <div id="eventos" class="eventos">
    <HomeEventCard v-for="event in events" :key="event.home + event.away" :event="event" />
  </div>

  <div id="myModal" class="modal">
    <div class="modal-content" id="modalContent"></div>
  </div>

  <section class="apuestas-live">
    <h2>Apuestas en Vivo</h2>
    <div class="live-contenido">
      <LiveEventCard v-for="event in liveEvents" :key="event.title" :event="event" />
    </div>
  </section>

  <footer class="footer">
    <div class="footer-top">
      <div class="logo-social">
        <img src="/imagenes/logo.png" alt="PlayExpert Logo" class="logo" />
        <div class="logo-text" style="font-size: 1.5rem;">PlayExpert</div>
        <p>¡Síguenos!</p>
        <div class="redes-sociales">
          <a href="https://www.facebook.com" target="_blank" rel="noreferrer"><img src="/imagenes/Facebook_Logo_2023.png" alt="Facebook" /></a>
          <a href="https://twitter.com" target="_blank" rel="noreferrer"><img src="/imagenes/Logo_of_Twitter.svg.png" alt="Twitter" /></a>
          <a href="https://www.instagram.com/playexpert_?igsh=MTFqOWw1OGVybW9kZg==" target="_blank" rel="noreferrer"><img src="/imagenes/Instagram-Icon.png" alt="Instagram" /></a>
        </div>
      </div>
      <div class="newsletter">
        <h2>¿Buscas Ofertas Exclusivas?</h2>
        <p>Suscríbete para recibir promociones especiales en tu correo.</p>
        <div class="subscribe">
          <input type="email" placeholder="correo@mail.com" />
          <button>Suscribirme</button>
        </div>
      </div>
    </div>

    <div class="footer-links">
      <div><h3>Deportes</h3><p>Fútbol</p><p>Baloncesto</p><p>Tenis</p><p>Boxeo</p></div>
      <div><h3>Apuestas</h3><p>Apuestas en Vivo</p><p>Apuestas Virtuales</p><p>Promociones</p><p>Resultados</p></div>
      <div><h3>Soporte</h3><p>Ayuda</p><p>Preguntas Frecuentes</p><p>Contacto</p><router-link to="/juego-responsable" class="responsible-link">Juego Responsable</router-link></div>
    </div>

    <div class="footer-bottom">
      <p>© 2025 PlayExpert Colombia. Juego responsable. Prohibida la participación de menores de edad.</p>
    </div>
  </footer>

  <ChatbotAssistant />
</template>

<style scoped>
.responsible-link{display:inline-block;margin-top:5px;color:#fff;text-decoration:none;transition:color .2s ease}.responsible-link:hover{color:#f5c542;text-decoration:underline}
</style>
