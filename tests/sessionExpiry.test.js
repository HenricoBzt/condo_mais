import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createTestServer } from './viteTestServer.js'
import { apiGet, clearExpiredSessionNotice, getToken, hasExpiredSessionNotice, setToken, tokenExpired, tokenExpiresAt } from '../src/services/api.js'
import { logout } from '../src/services/authApi.js'
import { SESSION_ACCESS, SESSION_AREA, decideSessionAccess, resolveSessionAccess } from '../src/features/session/sessionAccess.js'

// sessionStorage mínimo para o Node; cada teste começa sem sessão.
const storage = new Map()
globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) }
globalThis.window = new EventTarget()

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const jwt = (claims) => `${base64url({ alg: 'HS256' })}.${base64url(claims)}.assinatura`
const nowSeconds = () => Math.floor(Date.now() / 1000)
const unauthorized = { fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => '{}' }) }

test.afterEach(() => storage.clear())

test('lê o vencimento pela claim exp', () => {
  const exp = nowSeconds() + 60
  assert.equal(tokenExpiresAt(jwt({ exp })), exp * 1000)
  assert.equal(tokenExpired(jwt({ exp })), false)
  assert.equal(tokenExpired(jwt({ exp: nowSeconds() - 1 })), true)
  // Sem exp (ou token malformado), quem decide é o servidor
  assert.equal(tokenExpiresAt(jwt({ perfil: 'MORADOR' })), 0)
  assert.equal(tokenExpired(jwt({ perfil: 'MORADOR' })), false)
  assert.equal(tokenExpired('nao-e-jwt'), false)
})

test('token vencido não libera nenhuma área', () => {
  const token = jwt({ perfil: 'MORADOR', condominio_id: 'c-1', exp: nowSeconds() - 5 })
  assert.equal(decideSessionAccess({ token, user: { perfil: 'MORADOR' }, area: SESSION_AREA.MORADOR }).status, SESSION_ACCESS.NO_SESSION)
})

test('token vencido encerra a sessão sem consultar o servidor e deixa aviso para o login', async () => {
  const token = jwt({ perfil: 'PORTARIA', condominio_id: 'c-1', exp: nowSeconds() - 5 })
  setToken(token)
  let calls = 0
  const result = await resolveSessionAccess({ area: SESSION_AREA.PORTARIA, token, loadCurrentUser: async () => { calls += 1; return { perfil: 'PORTARIA' } } })
  assert.equal(result.status, SESSION_ACCESS.NO_SESSION)
  assert.equal(calls, 0)
  assert.equal(getToken(), '')
  assert.equal(hasExpiredSessionNotice(), true)
})

test('401 do servidor encerra a sessão com aviso; sair pelo menu não mostra aviso', async () => {
  setToken(jwt({ perfil: 'MORADOR', exp: nowSeconds() + 3600 }))
  await assert.rejects(apiGet('/usuarios/me', {}, unauthorized), (error) => error.status === 401)
  assert.equal(getToken(), '')
  assert.equal(hasExpiredSessionNotice(), true)

  clearExpiredSessionNotice()
  setToken(jwt({ perfil: 'MORADOR', exp: nowSeconds() + 3600 }))
  logout()
  assert.equal(getToken(), '')
  assert.equal(hasExpiredSessionNotice(), false)
})

test('401 sem sessão (ex.: senha errada no login) não gera aviso de expiração', async () => {
  await assert.rejects(apiGet('/auth/login', {}, unauthorized), (error) => error.status === 401)
  assert.equal(hasExpiredSessionNotice(), false)
})

test('tela de login mostra o aviso de sessão expirada só quando ele existe', async () => {
  const server = await createTestServer()
  try {
    const { default: LoginPage } = await server.ssrLoadModule('/src/pages/auth/LoginPage.jsx')
    const { AppDataProvider } = await server.ssrLoadModule('/src/context/AppDataContext.jsx')
    const render = () => renderToStaticMarkup(React.createElement(AppDataProvider, null, React.createElement(MemoryRouter, null, React.createElement(LoginPage))))

    assert.doesNotMatch(render(), /Sua sessão expirou/)
    storage.set('condoplus.sessaoExpirada', '1')
    assert.match(render(), /role="status"[^>]*>Sua sessão expirou\. Entre novamente para continuar\./)
  } finally {
    await server.close()
  }
})
