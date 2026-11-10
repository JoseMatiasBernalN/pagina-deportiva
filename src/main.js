import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/estilo.css'
import './assets/pro.css'

createApp(App).use(createPinia()).use(router).mount('#app')
