import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { JSDOM } from 'jsdom'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { createTestServer } from './viteTestServer.js'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Event = dom.window.Event
globalThis.sessionStorage = dom.window.sessionStorage

const { act, cleanup, fireEvent, render, waitFor } = await import('@testing-library/react')
const server = await createTestServer()
const { PlatformDataProvider, usePlatformData } = await server.ssrLoadModule('/src/context/PlatformDataContext.jsx')
const { default: PlatformDashboardPage } = await server.ssrLoadModule('/src/pages/platform/PlatformDashboardPage.jsx')
const { default: PlatformCondominiumsPage } = await server.ssrLoadModule('/src/pages/platform/PlatformCondominiumsPage.jsx')
const { default: PlatformCondominiumDetailPage } = await server.ssrLoadModule('/src/pages/platform/PlatformCondominiumDetailPage.jsx')
const { default: PlatformLayout } = await server.ssrLoadModule('/src/layouts/PlatformLayout.jsx')
const { setToken } = await server.ssrLoadModule('/src/services/api.js')

const firstId = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'
const records = [
  { id: firstId, nome: 'Residencial Aurora', cnpj: '11.111.111/0001-11', status: 'ATIVO', configuracaoInicial: 'PENDENTE', modelo: null, criadoEm: '2026-10-20T10:00:00', administradores: [] },
  { id: secondId, nome: 'Bosque Verde', cnpj: '22.222.222/0001-22', status: 'INATIVO', configuracaoInicial: 'CONCLUIDA', modelo: 'VERTICAL', criadoEm: '2026-10-21T10:00:00', administradores: [] },
]

test.beforeEach(() => setToken('sessao-master'))
test.afterEach(() => { cleanup(); sessionStorage.clear() })
test.after(async () => { await server.close(); dom.window.close() })

function renderPage({ path, route, page, listLoader = async () => records, detailLoader = async () => records[0] }) {
  return render(React.createElement(MemoryRouter, { initialEntries: [path] },
    React.createElement(Routes, null,
      React.createElement(Route, { element: React.createElement(PlatformDataProvider, { listLoader, detailLoader, apiActive: true }, React.createElement(Outlet)) },
        React.createElement(Route, { path: route, element: React.createElement(page) }),
      ),
    )))
}

test('Dashboard renderiza os cinco indicadores derivados da API', async () => {
  const view = renderPage({ path: '/plataforma', route: '/plataforma', page: PlatformDashboardPage })
  assert.ok(await view.findByText('Total de condomínios'))
  const values = [...view.container.querySelectorAll('.stat-card > strong')].map((element) => element.textContent)
  assert.deepEqual(values, ['2', '1', '1', '1', '1'])
})

test('listagem pesquisa, filtra e limpa filtros localmente', async () => {
  const view = renderPage({ path: '/plataforma/condominios', route: '/plataforma/condominios', page: PlatformCondominiumsPage })
  assert.ok(await view.findByText('Residencial Aurora'))
  assert.ok(view.getByText('Bosque Verde'))
  fireEvent.change(view.getByPlaceholderText('Buscar por nome ou CNPJ'), { target: { value: 'aurora' } })
  assert.equal(view.queryByText('Bosque Verde'), null)
  fireEvent.change(view.getByLabelText('Status operacional'), { target: { value: 'INATIVO' } })
  assert.ok(await view.findByText('Nenhum condomínio corresponde aos filtros'))
  fireEvent.click(view.getByText('Limpar filtros'))
  assert.ok(view.getByText('Bosque Verde'))
})

test('lista vazia, carregamento, erro e retry têm estados claros', async () => {
  const empty = renderPage({ path: '/plataforma/condominios', route: '/plataforma/condominios', page: PlatformCondominiumsPage, listLoader: async () => [] })
  assert.ok(await empty.findByText('Nenhum condomínio cadastrado'))
  cleanup()

  let release
  const loading = renderPage({ path: '/plataforma/condominios', route: '/plataforma/condominios', page: PlatformCondominiumsPage, listLoader: () => new Promise((resolve) => { release = resolve }) })
  assert.ok(loading.getByText('Carregando condomínios'))
  await act(async () => release([]))
  cleanup()

  let attempts = 0
  const error = renderPage({ path: '/plataforma/condominios', route: '/plataforma/condominios', page: PlatformCondominiumsPage, listLoader: async () => { attempts += 1; return attempts === 1 ? [{}] : records } })
  assert.ok(await error.findByText('O servidor retornou dados de condomínio em formato inválido.'))
  fireEvent.click(error.getByText('Tentar novamente'))
  assert.ok(await error.findByText('Residencial Aurora'))
  assert.equal(attempts, 2)
})

test('detalhe usa endpoint próprio e não apresenta telefone ausente do contrato', async () => {
  let requestedId = ''
  const detail = { ...records[0], administradores: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', nome: 'Maria Souza', cpf: '529.982.247-25', email: 'maria@exemplo.com', telefone: '11999999999', status: 'ATIVO', primeiroAcessoPendente: true }] }
  const view = renderPage({ path: `/plataforma/condominios/${firstId}`, route: '/plataforma/condominios/:id', page: PlatformCondominiumDetailPage, detailLoader: async (id) => { requestedId = id; return detail } })
  assert.ok(await view.findByText('Maria Souza'))
  assert.equal(requestedId, firstId)
  assert.ok(view.getByText('Primeiro acesso pendente'))
  assert.equal(view.queryByText('11999999999'), null)
})

test('troca de sessão limpa dados antigos e ignora resposta atrasada', async () => {
  let call = 0
  let releaseOld
  const listLoader = () => {
    call += 1
    if (call === 1) return new Promise((resolve) => { releaseOld = resolve })
    return Promise.resolve([{ ...records[1], nome: 'Condomínio da sessão nova' }])
  }
  function Probe() {
    const state = usePlatformData()
    return React.createElement('div', null, state.listStatus, ' ', state.condominiums.map((item) => item.nome).join(','))
  }
  const view = renderPage({ path: '/probe', route: '/probe', page: Probe, listLoader })
  await waitFor(() => assert.equal(call, 1))
  await act(async () => setToken('sessao-master-nova'))
  assert.equal(view.queryByText('Residencial Aurora'), null)
  assert.ok(await view.findByText(/Condomínio da sessão nova/))
  await act(async () => releaseOld([{ ...records[0], nome: 'Dados da sessão antiga' }]))
  assert.equal(view.queryByText(/Dados da sessão antiga/), null)
  assert.ok(view.getByText(/Condomínio da sessão nova/))
})

test('menu restaura o foco ao fechar com Escape e tabela tem legenda acessível', async () => {
  const view = render(React.createElement(MemoryRouter, { initialEntries: ['/plataforma/condominios'] },
    React.createElement(Routes, null,
      React.createElement(Route, { element: React.createElement(PlatformLayout) },
        React.createElement(Route, { path: '/plataforma/condominios', element: React.createElement(PlatformDataProvider, { listLoader: async () => records, apiActive: true }, React.createElement(PlatformCondominiumsPage)) }),
      ),
    )))
  const openButton = view.getByRole('button', { name: 'Abrir menu' })
  fireEvent.click(openButton)
  const closeButton = view.getByRole('button', { name: 'Fechar menu' })
  assert.equal(document.activeElement, closeButton)
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => assert.equal(document.activeElement, openButton))
  assert.ok(await view.findByText('Residencial Aurora'))
  assert.ok(view.getByText('Condomínios cadastrados na plataforma'))
})
