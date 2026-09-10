import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import './style.css';
import './assets/fleet-map.css';
import App from './App.vue';
import { setupNumberInputScrollGuard } from './utils/numberInputGuard';

setupNumberInputScrollGuard();

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.mount('#app');

