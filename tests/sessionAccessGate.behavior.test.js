import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { JSDOM } from 'jsdom'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createTestServer } from './viteTestServer.js'
import { SESSION_ACCESS, SESSION_AREA, decideSessionAccess } from '../src/features/session/sessionAccess.js'
import { notifySessionChanged } from '../src/services/sessionEvents.js'
import { setToken } from '../src/services/api.js'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Event = dom.window.Event
globalThis.sessionStorage = dom.window.sessionStorage

const { act, cleanup, render, waitFor } = await import('@testing-library/react')
const server = await createTestServer()
const { default: SessionAccessGate } = await server.ssrLoadModule('/src/components/SessionAccessGate.jsx')

test.afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

test.after(async () => {
  await server.close()
  dom.window.close()
})

function jwt(claims) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode(claims)}.`
}

function decisionResolver({ token, user }) {
  return async ({ area }) => decideSessionAccess({ token, user, area })
}

function renderProtected({ path, area, resolver, protectedText, extraRoutes = [] }) {
  return render(React.createElement(MemoryRouter, { initialEntries: [path] },
    React.createElement(Routes, null,
      React.createElement(Route, {
        path,
        element: React.createElement(SessionAccessGate, { area, resolver, apiActive: true }, React.createElement('div', null, protectedText)),
      }),
      ...extraRoutes.map(([routePath, text]) => React.createElement(Route, { key: routePath, path: routePath, element: React.createElement('div', null, text) })),
    )))
}

test('MASTER confirmado acessa /plataforma', async () => {
  const view = renderProtected({
    path: '/plataforma',
    area: SESSION_AREA.PLATFORM,
    resolver: decisionResolver({ token: jwt({ perfil: 'MASTER' }), user: { perfil: 'MASTER' } }),
    protectedText: 'Área MASTER',
  })
  assert.ok(await view.findByText('Área MASTER'))
})

test('ADMIN pendente é enviado ao Wizard', async () => {
  const view = renderProtected({
    path: '/admin',
    area: SESSION_AREA.ADMIN,
    resolver: decisionResolver({ token: jwt({ perfil: 'ADMIN', condominio_id: 'c-1' }), user: { perfil: 'ADMIN', configuracaoInicial: 'PENDENTE' } }),
    protectedText: 'Dashboard ADMIN',
    extraRoutes: [['/admin/configuracao-inicial', 'Setup Wizard']],
  })
  assert.ok(await view.findByText('Setup Wizard'))
  assert.equal(view.queryByText('Dashboard ADMIN'), null)
})

test('ADMIN concluído acessa o Dashboard', async () => {
  const view = renderProtected({
    path: '/admin',
    area: SESSION_AREA.ADMIN,
    resolver: decisionResolver({ token: jwt({ perfil: 'ADMIN', condominio_id: 'c-1' }), user: { perfil: 'ADMIN', configuracaoInicial: 'CONCLUIDA' } }),
    protectedText: 'Dashboard ADMIN',
  })
  assert.ok(await view.findByText('Dashboard ADMIN'))
})

test('troca de token invalida imediatamente a autorização enquanto o gate permanece montado', async () => {
  setToken(jwt({ perfil: 'MASTER', id: 'old' }))
  let calls = 0
  let releaseSecond
  const resolver = async () => {
    calls += 1
    if (calls === 1) return { status: SESSION_ACCESS.ALLOWED, destination: '' }
    return new Promise((resolve) => { releaseSecond = resolve })
  }
  const view = renderProtected({
    path: '/plataforma',
    area: SESSION_AREA.PLATFORM,
    resolver,
    protectedText: 'Sessão antiga',
    extraRoutes: [['/', 'Login']],
  })
  assert.ok(await view.findByText('Sessão antiga'))

  await act(async () => { setToken(jwt({ perfil: 'MASTER', id: 'new' })) })
  assert.equal(view.queryByText('Sessão antiga'), null)
  assert.ok(view.getByText('Verificando sua sessão'))
  await waitFor(() => assert.equal(calls, 2))

  await act(async () => { releaseSecond({ status: SESSION_ACCESS.REDIRECT, destination: '/' }) })
})

test('falha de /usuarios/me não renderiza conteúdo protegido', async () => {
  const view = renderProtected({
    path: '/plataforma',
    area: SESSION_AREA.PLATFORM,
    resolver: async () => { throw new Error('Servidor indisponível') },
    protectedText: 'Área protegida',
  })
  assert.ok(await view.findByText('Não foi possível confirmar seu acesso'))
  assert.ok(view.getByText('Servidor indisponível'))
  assert.equal(view.queryByText('Área protegida'), null)
})

test('resposta atrasada da sessão antiga não substitui a decisão da sessão nova', async () => {
  let calls = 0
  let releaseOld
  const resolver = async () => {
    calls += 1
    if (calls === 1) return new Promise((resolve) => { releaseOld = resolve })
    return { status: SESSION_ACCESS.ALLOWED, destination: '' }
  }
  const view = renderProtected({ path: '/plataforma', area: SESSION_AREA.PLATFORM, resolver, protectedText: 'Sessão nova autorizada' })
  await waitFor(() => assert.equal(calls, 1))

  await act(async () => { notifySessionChanged() })
  assert.ok(await view.findByText('Sessão nova autorizada'))
  assert.equal(calls, 2)

  await act(async () => { releaseOld({ status: SESSION_ACCESS.ERROR, destination: '', message: 'Resposta antiga' }) })
  assert.ok(view.getByText('Sessão nova autorizada'))
  assert.equal(view.queryByText('Resposta antiga'), null)
})
