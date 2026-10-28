import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { JSDOM } from 'jsdom'
import { createTestServer } from './viteTestServer.js'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Event = dom.window.Event
globalThis.sessionStorage = dom.window.sessionStorage

// Liga o modo API só neste servidor de testes (Vite expõe variáveis VITE_ do ambiente)
process.env.VITE_API_URL = 'http://api.test'
const server = await createTestServer()
delete process.env.VITE_API_URL
const { act, cleanup, render, waitFor } = await import('@testing-library/react')
const { AppDataProvider, useAppData } = await server.ssrLoadModule('/src/context/AppDataContext.jsx')

const jwt = (claims) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.assinatura`
}

const encomenda = (id, status, codigo) => ({
  id, codigoIdentificacao: codigo, status, observacao: null, dataHoraRecebimento: '2026-10-27T10:00:00',
  apartamentoId: 'a-101', apartamentoNumero: '101', torreNome: 'Torre A', moradorNome: 'Carla', porteiroRecebimentoNome: 'João',
})

// API falsa: o que cada rota responde e o que foi chamado
function fakeApi({ packages = [], packagesStatus = 200 } = {}) {
  const calls = []
  let list = [...packages]
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname
    const method = init.method || 'GET'
    calls.push({ method, path, body: init.body ? JSON.parse(init.body) : undefined })
    const reply = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => (body === undefined ? '' : JSON.stringify(body)) })
    if (path === '/usuarios/me') return reply(200, { id: 'u-1', nome: 'João', perfil: 'PORTARIA', condominioNome: 'Residencial' })
    if (path === '/condominios/torres') return reply(200, [{ id: 't-a', nome: 'Torre A' }])
    if (path === '/condominios/apartamentos') return reply(200, [{ id: 'a-101', numero: '101', torreId: 't-a', status: 'OCUPADO' }])
    if (path === '/usuarios') return reply(403, {})
    if (path === '/interativo/avisos' && method === 'GET') return reply(200, [{ id: 'av-1', titulo: 'Falta de água', conteudo: 'Bomba', prioridade: 'URGENTE', dataValidade: null, ativo: true, criadoEm: '2026-10-27T09:00:00', autorNome: 'Admin', torreId: null, torreNome: null }])
    if (path === '/interativo/avisos' && method === 'POST') return reply(200, {})
    if (path === '/interativo/avisos/av-1' && method === 'DELETE') return reply(200, undefined)
    if (path === '/portaria/encomendas' && method === 'GET') return packagesStatus === 200 ? reply(200, list) : reply(packagesStatus, { mensagem: 'Falha nas encomendas' })
    if (path === '/portaria/encomendas/recebimento') { list = [encomenda('e-new', 'AGUARDANDO RETIRADA', 'NOVA1'), ...list]; return reply(200, list[0]) }
    if (path.endsWith('/retirada')) { list = list.map((item) => item.id === 'e-1' ? { ...item, status: 'RETIRADA' } : item); return reply(200, list[0]) }
    return reply(404, {})
  }
  return calls
}

function renderProvider() {
  const state = {}
  function Probe() { Object.assign(state, useAppData()); return null }
  render(React.createElement(AppDataProvider, null, React.createElement(Probe)))
  return state
}

test.afterEach(() => { cleanup(); sessionStorage.clear() })
test.after(async () => { await server.close(); dom.window.close() })

test('com a API ligada, a sessão da portaria carrega as encomendas reais junto com os cadastros', async () => {
  fakeApi({ packages: [encomenda('e-1', 'AGUARDANDO RETIRADA', 'BR123')] })
  sessionStorage.setItem('condoplus.token', jwt({ perfil: 'PORTARIA', condominio_id: 'c-1', exp: Math.floor(Date.now() / 1000) + 3600 }))
  const state = renderProvider()
  await waitFor(() => assert.equal(state.remote.packages.status, 'success'))
  assert.equal(state.data.packages.length, 1)
  assert.equal(state.data.packages[0].code, 'BR123')
  assert.equal(state.data.packages[0].status, 'AGUARDANDO_RETIRADA')
  assert.equal(state.data.units.length, 1)
})

test('registrar e dar baixa passam pelo servidor e recarregam a lista', async () => {
  const calls = fakeApi({ packages: [encomenda('e-1', 'AGUARDANDO RETIRADA', 'BR123')] })
  sessionStorage.setItem('condoplus.token', jwt({ perfil: 'PORTARIA', condominio_id: 'c-1', exp: Math.floor(Date.now() / 1000) + 3600 }))
  const state = renderProvider()
  await waitFor(() => assert.equal(state.remote.packages.status, 'success'))

  await act(async () => { await state.actions.addPackageRemote({ tower: 'Torre A', unit: '101', code: 'NOVA1' }) })
  assert.deepEqual(calls.find((call) => call.path.endsWith('/recebimento')).body, { apartamentoId: 'a-101', codigoIdentificacao: 'NOVA1', observacao: null })
  await waitFor(() => assert.equal(state.data.packages.length, 2))

  await act(async () => { await state.actions.withdrawPackageRemote('e-1') })
  await waitFor(() => assert.equal(state.data.packages.find((item) => item.id === 'e-1').status, 'RETIRADA'))
})

test('falha só nas encomendas não derruba os cadastros', async () => {
  fakeApi({ packagesStatus: 400 })
  sessionStorage.setItem('condoplus.token', jwt({ perfil: 'PORTARIA', condominio_id: 'c-1', exp: Math.floor(Date.now() / 1000) + 3600 }))
  const state = renderProvider()
  await waitFor(() => assert.equal(state.remote.packages.status, 'error'))
  assert.equal(state.remote.packages.error, 'Falha nas encomendas')
  assert.equal(state.remote.units.status, 'success')
  assert.equal(state.data.units.length, 1)
  assert.deepEqual(state.data.packages, [])
})

test('comunicados também carregam na sessão e publicar/excluir passam pela API', async () => {
  const calls = fakeApi()
  sessionStorage.setItem('condoplus.token', jwt({ perfil: 'PORTARIA', condominio_id: 'c-1', exp: Math.floor(Date.now() / 1000) + 3600 }))
  const state = renderProvider()
  await waitFor(() => assert.equal(state.remote.notices.status, 'success'))
  assert.equal(state.data.notices[0].title, 'Falta de água')
  assert.equal(state.data.notices[0].status, 'ATIVO')

  await act(async () => { await state.actions.saveNoticeRemote({ title: 'Novo', content: 'Texto', priority: 'NORMAL' }) })
  assert.deepEqual(calls.find((call) => call.method === 'POST' && call.path === '/interativo/avisos').body, { titulo: 'Novo', conteudo: 'Texto', prioridade: 'NORMAL', dataValidade: null, torreId: null })
  await act(async () => { await state.actions.deleteNoticeRemote('av-1') })
  assert.ok(calls.some((call) => call.method === 'DELETE' && call.path === '/interativo/avisos/av-1'))
  // Depois de cada comando a lista é recarregada do servidor
  assert.ok(calls.filter((call) => call.method === 'GET' && call.path === '/interativo/avisos').length >= 3)
})
