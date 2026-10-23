export async function authenticateAndEnter({ authenticate, restoreSession, navigate, getSessionKey, invalidateSession }) {
  let authenticatedSessionKey = ''
  try {
    const result = await authenticate()
    authenticatedSessionKey = getSessionKey?.() || ''
    await restoreSession()
    navigate(result.path)
    return result
  } catch (error) {
    const sessionStillBelongsToAttempt = !getSessionKey || !authenticatedSessionKey || getSessionKey() === authenticatedSessionKey
    if (sessionStillBelongsToAttempt) invalidateSession?.()
    throw error
  }
}
