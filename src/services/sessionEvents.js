export const SESSION_CHANGED_EVENT = 'condoplus:session-changed'

function eventTarget() {
  return typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null
}

export function notifySessionChanged() {
  const target = eventTarget()
  if (target) target.dispatchEvent(new Event(SESSION_CHANGED_EVENT))
}

export function subscribeToSessionChanges(listener) {
  const target = eventTarget()
  if (!target) return () => {}
  target.addEventListener(SESSION_CHANGED_EVENT, listener)
  return () => target.removeEventListener(SESSION_CHANGED_EVENT, listener)
}
