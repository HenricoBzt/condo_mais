import test from 'node:test'
import assert from 'node:assert/strict'
import { authenticateAndEnter } from '../src/features/session/authenticatedNavigation.js'

test('navega somente depois da autenticação e da confirmação da sessão', async () => {
  const order = []
  const result = await authenticateAndEnter({
    authenticate: async () => { order.push('authenticate'); return { path: '/admin' } },
    restoreSession: async () => { order.push('restore-session') },
    navigate: (path) => order.push(`navigate:${path}`),
  })
  assert.deepEqual(result, { path: '/admin' })
  assert.deepEqual(order, ['authenticate', 'restore-session', 'navigate:/admin'])
})

test('falha de confirmação após login ou primeiro acesso impede a navegação', async () => {
  const navigations = []
  const invalidations = []
  const error = new Error('Falha em /usuarios/me')
  await assert.rejects(authenticateAndEnter({
    authenticate: async () => ({ path: '/admin' }),
    restoreSession: async () => { throw error },
    navigate: (path) => navigations.push(path),
    getSessionKey: () => 'token-da-tentativa',
    invalidateSession: () => invalidations.push('logout'),
  }), error)
  assert.deepEqual(navigations, [])
  assert.deepEqual(invalidations, ['logout'])
})

test('resposta obsoleta não navega nem encerra uma sessão mais nova', async () => {
  const navigations = []
  const invalidations = []
  let sessionKey = 'token-antigo'
  const error = new Error('Sessão alterada')
  await assert.rejects(authenticateAndEnter({
    authenticate: async () => ({ path: '/admin' }),
    restoreSession: async () => {
      sessionKey = 'token-novo'
      throw error
    },
    navigate: (path) => navigations.push(path),
    getSessionKey: () => sessionKey,
    invalidateSession: () => invalidations.push('logout'),
  }), error)
  assert.deepEqual(navigations, [])
  assert.deepEqual(invalidations, [])
})
