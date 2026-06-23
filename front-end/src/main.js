import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import initInactivity from './utils/inactivity'
import { removeAuthToken, getAuthToken } from './api/sessionService'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Déconnecte l'utilisateur après 15 minutes d'inactivité (clic / mouvement / clavier / touch)
initInactivity({
	onTimeout() {
		// invalidate token on server, then remove locally and redirect
		(async () => {
			try {
				const token = getAuthToken()
				if (token) {
					await fetch('/api/auth/invalidate', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${token}`,
						},
					})
				}
			} catch (e) {
				console.warn('Failed to invalidate session on server', e)
			} finally {
				removeAuthToken()
				try {
					router.replace('/login')
				} catch (e) {
					console.warn('Failed to redirect to login after inactivity', e)
				}
			}
		})()
	},
})

app.mount('#app')
