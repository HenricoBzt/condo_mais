import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { JSDOM } from 'jsdom'
import { createTestServer } from './viteTestServer.js'
import { buildingGeometry, createTower, getTowerFloors } from '../src/features/setupWizard/verticalSetup.js'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Event = dom.window.Event
// Usuário que prefere menos movimento: o giro automático começa desligado
dom.window.matchMedia = (query) => ({ matches: query.includes('reduce'), addEventListener() {}, removeEventListener() {} })

const { cleanup, fireEvent, render, within } = await import('@testing-library/react')
const server = await createTestServer()
const { default: BuildingPreview } = await server.ssrLoadModule('/src/components/BuildingPreview.jsx')

test.afterEach(() => cleanup())
test.after(async () => { await server.close(); dom.window.close() })

const tower = (overrides) => ({ ...createTower('t-1'), name: 'Torre A', floorCount: '10', unitsPerFloor: '4', ...overrides })

test('andares da torre com a mesma numeração do backend (separador, dígitos, início)', () => {
  const floors = getTowerFloors(tower({ floorCount: '2', unitsPerFloor: '3', firstFloor: '5', firstUnit: '3', unitDigits: '3', separator: '-' }))
  assert.deepEqual(floors, [{ floor: 5, numbers: ['5-003', '5-004', '5-005'] }, { floor: 6, numbers: ['6-003', '6-004', '6-005'] }])
  assert.deepEqual(getTowerFloors(tower({ floorCount: '0' })), [])
})

test('geometria cabe no palco em qualquer configuração permitida', () => {
  const pequeno = buildingGeometry('10', '4')
  assert.equal(pequeno.showLabels, true)
  assert.equal(pequeno.detailedWindows, true)
  for (const [floors, per] of [['1', '1'], ['100', '100'], ['100', '1'], ['1', '100'], ['40', '30']]) {
    const g = buildingGeometry(floors, per)
    assert.ok(g.height <= 380 + 10 + 42 + 100 * 3, `${floors}x${per} altura ${g.height}`)
    assert.ok(g.width <= 320, `${floors}x${per} largura ${g.width}`)
    assert.ok(g.depth >= 70 && g.depth <= Math.max(g.width, 70))
  }
  const grande = buildingGeometry('100', '100')
  assert.equal(grande.showLabels, false)
  assert.equal(grande.detailedWindows, false)
})

test('prévia mostra o total, a numeração e o andar selecionado; troca de andar pela lista e pelas setas', () => {
  const view = render(React.createElement(BuildingPreview, { tower: tower(), totalUnits: 52, towerCount: 2 }))
  assert.ok(view.getByText('unidades em 2 torres', { exact: false }))
  assert.ok(view.getByText('101 → 1004'))
  const unidades = () => within(view.getByRole('list', { name: /Apartamentos do andar/ })).getAllByRole('listitem').map((item) => item.textContent)
  assert.deepEqual(unidades(), ['Apto101', 'Apto102', 'Apto103', 'Apto104'])
  // No primeiro andar não há "andar abaixo"
  assert.equal(view.getByRole('button', { name: 'Andar abaixo' }).disabled, true)

  fireEvent.click(view.getByRole('button', { name: /^Andar 7/ }))
  assert.deepEqual(unidades(), ['Apto701', 'Apto702', 'Apto703', 'Apto704'])
  assert.ok(view.getByText('701 a 704'))
  fireEvent.click(view.getByRole('button', { name: 'Andar acima' }))
  assert.deepEqual(unidades()[0], 'Apto801')
  fireEvent.click(view.getByRole('button', { name: /^Andar 10/ }))
  assert.equal(view.getByRole('button', { name: 'Andar acima' }).disabled, true)
})

test('clicar num andar do prédio também seleciona, mas soltar um arraste não', () => {
  const view = render(React.createElement(BuildingPreview, { tower: tower() }))
  const rows = view.container.querySelectorAll('.building-row--pick')
  assert.equal(rows.length, 10)
  fireEvent.click(rows[2]) // de cima para baixo: andar 8
  assert.ok(view.getByText('801 a 804'))

  const stage = view.container.querySelector('.building-preview__stage')
  fireEvent.pointerDown(stage, { clientX: 100, clientY: 100 })
  fireEvent.pointerMove(stage, { clientX: 180, clientY: 110 })
  fireEvent.click(rows[5])
  fireEvent.pointerUp(stage)
  assert.ok(view.getByText('801 a 804'))
})

test('giro: começa parado para quem prefere menos movimento, liga pelo botão e os 90° mudam a vista', () => {
  const view = render(React.createElement(BuildingPreview, { tower: tower() }))
  const auto = view.getByRole('button', { name: /Giro automático/ })
  assert.equal(auto.getAttribute('aria-pressed'), 'false')
  const vista = () => view.container.querySelector('.building-preview__view span').textContent
  assert.equal(vista(), 'Frente · 328°')
  fireEvent.click(view.getByRole('button', { name: 'Girar 90 graus para a direita' }))
  assert.equal(vista(), 'Lateral esquerda · 58°')
  fireEvent.change(view.getByLabelText('Ângulo de rotação do prédio'), { target: { value: '180' } })
  assert.equal(vista(), 'Fundos · 180°')
  fireEvent.click(view.getByRole('button', { name: 'Vista inicial' }))
  assert.equal(vista(), 'Frente · 328°')
  fireEvent.click(auto)
  assert.equal(auto.getAttribute('aria-pressed'), 'true')
})

test('configuração máxima renderiza sem janela por unidade e resume a lista de andares', () => {
  const view = render(React.createElement(BuildingPreview, { tower: tower({ floorCount: '50', unitsPerFloor: '100', unitDigits: '3' }) }))
  assert.equal(view.container.querySelectorAll('.building-window').length, 0)
  assert.equal(view.container.querySelectorAll('.building-row--pick').length, 50)
  const andar50 = view.getByRole('button', { name: /^Andar 50/ })
  assert.equal(within(andar50).getAllByText(/^50\d{3}$/).length, 8)
  assert.ok(within(andar50).getByText('+92'))
  // O andar selecionado mostra todas as 100 unidades
  assert.equal(within(view.getByRole('list', { name: /Apartamentos do andar/ })).getAllByRole('listitem').length, 100)
})

test('etapa 4 com duas torres: abas trocam o prédio exibido e o total soma as duas', async () => {
  const { UnitsStep } = await server.ssrLoadModule('/src/pages/desktop/VerticalSetupWizardExperience.jsx')
  const { MemoryRouter } = await import('react-router-dom')
  const towers = [tower(), { ...createTower('t-2'), name: 'Torre B', floorCount: '3', unitsPerFloor: '4', firstFloor: '1', firstUnit: '1', unitDigits: '2', separator: '-' }]
  const view = render(React.createElement(MemoryRouter, null, React.createElement(UnitsStep, { towers })))
  assert.ok(view.getByText('unidades em 2 torres', { exact: false }))
  assert.equal(view.container.querySelector('.building-total p strong').textContent, '52')
  const abaB = view.getByRole('button', { name: /Torre B/ })
  assert.equal(abaB.getAttribute('aria-pressed'), 'false')
  fireEvent.click(abaB)
  assert.equal(abaB.getAttribute('aria-pressed'), 'true')
  assert.ok(view.getByText('1-01 → 3-04'))
  assert.equal(view.container.querySelectorAll('.building-row--pick').length, 3)
})
