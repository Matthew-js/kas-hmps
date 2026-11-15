import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import { initAuth } from './stores/auth.js'
import './assets/main.css'

// Pulihkan sesi login dulu, baru mount (supaya guard router tahu status login).
initAuth().then(() => createApp(App).use(router).mount('#app'))
