import { getAuthToken } from '@/api/sessionService'

export function requireAuth(to, from, next) {
  const token = getAuthToken()

  if (!token) {
    return next('/login')
  }

  return next()
}