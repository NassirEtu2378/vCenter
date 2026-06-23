const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000 // 15 minutes

import { getAuthToken } from '@/api/sessionService'

export function initInactivity({ timeoutMs = DEFAULT_TIMEOUT_MS, onTimeout } = {}) {
  if (typeof onTimeout !== 'function') {
    throw new Error('onTimeout callback is required')
  }

  let timer = null
  const events = ['mousemove', 'mousedown', 'click', 'scroll', 'keydown', 'touchstart']

  // inter-tab channel to broadcast activity
  const channelName = 'app-inactivity'
  let bc = null
  try {
    bc = new BroadcastChannel(channelName)
    bc.onmessage = () => {
      resetTimer()
    }
  } catch (e) {
    bc = null
  }

  const broadcastActivity = () => {
    if (bc) bc.postMessage('activity')
    else localStorage.setItem(`__${channelName}`, Date.now().toString())
  }

  // send keepalive to server when user is active
  const sendKeepalive = async () => {
    try {
      const token = getAuthToken()
      if (!token) return
      await fetch('/api/auth/keepalive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
    } catch (err) {
      // ignore network errors
    }
  }

  const resetTimer = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      cleanup()
      onTimeout()
    }, timeoutMs)
  }

  const handleEvent = () => {
    resetTimer()
    broadcastActivity()
    sendKeepalive()
  }

  const start = () => {
    events.forEach(e => window.addEventListener(e, handleEvent, true))
    // listen for localStorage fallback
    window.addEventListener('storage', (ev) => {
      if (ev.key === `__${channelName}`) resetTimer()
    })
    resetTimer()
  }

  const cleanup = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    events.forEach(e => window.removeEventListener(e, handleEvent, true))
    if (bc) {
      try { bc.close() } catch (e) {}
      bc = null
    }
  }

  start()

  return {
    stop: cleanup,
    reset: resetTimer,
  }
}

export default initInactivity
