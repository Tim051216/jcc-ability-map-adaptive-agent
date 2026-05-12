import { TOKEN_NAME, USER_KEY } from '@/config/global'

const DEV_TOKEN = 'dev-admin-token'

function isLocalHost() {
  const host = window.location.hostname
  return host === '127.0.0.1' || host === 'localhost'
}

export function isDevAuthEnabled() {
  const mode = import.meta.env.MODE
  return (
    import.meta.env.VITE_ENABLE_DEV_AUTH === 'true' &&
    (mode === 'devlocal' || mode === 'development') &&
    isLocalHost()
  )
}

export function clearDevSession() {
  const token = sessionStorage.getItem(TOKEN_NAME)
  if (token === DEV_TOKEN) {
    sessionStorage.removeItem(TOKEN_NAME)
    sessionStorage.removeItem(USER_KEY)
  }
}

export function ensureDevSession() {
  if (!isDevAuthEnabled()) {
    return null
  }

  const existingToken = sessionStorage.getItem(TOKEN_NAME)
  const existingUser = sessionStorage.getItem(USER_KEY)
  if (existingToken && existingUser) {
    return {
      token: existingToken,
      user: JSON.parse(existingUser)
    }
  }

  const session = {
    token: DEV_TOKEN,
    user: {
      id: 1001,
      userId: 1001,
      name: 'A3 Admin',
      type: 2,
      icon: ''
    }
  }

  sessionStorage.setItem(TOKEN_NAME, session.token)
  sessionStorage.setItem(USER_KEY, JSON.stringify(session.user))
  return session
}
