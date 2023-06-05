// router.js
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'


const routes = [
  { path: '/', component: App },
  { path: '/index.html', component: App },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
