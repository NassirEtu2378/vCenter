import { createRouter, createWebHistory } from 'vue-router'
import { getAuthToken } from '@/api/sessionService'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('../views/Dashboard.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to, from) => {
  const token = getAuthToken()

  if (to.meta.requiresAuth && !token) {
    return '/login'
  }

  // optionnel : empêcher retour login si déjà connecté
  // if (to.path === '/login' && token) {
  //   return '/dashboard'
  // }

  return true
})

export default router