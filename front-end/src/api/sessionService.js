const AUTH_TOKEN_KEY = 'backend_auth_token'

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  }
}

export function removeAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}
