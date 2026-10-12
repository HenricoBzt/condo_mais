import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createInitialWizardState,
  createTower,
  duplicateUnits,
  generateTowerUnits,
  generateUnits,
  summarizeUnitsByFloor,
  validateCommonAreas,
  validateStep,
  validateStepDetails,
  validateTowers,
  wizardReducer,
} from '../src/features/setupWizard/verticalSetup.js'

const validTower = (changes = {}) => ({ ...createTower('tower-a'), name: 'Torre A', floorCount: '3', unitsPerFloor: '2', firstFloor: '1', firstUnit: '1', unitDigits: '2', ...changes })

test('gera unidades por andar com numeração configurável', () => {
  const units = generateTowerUnits(validTower())
  assert.equal(units.length, 6)
  assert.deepEqual(units.map((unit) => unit.number), ['101', '102', '201', '202', '301', '302'])
  assert.deepEqual(units.map((unit) => unit.floor), [1, 1, 2, 2, 3, 3])
  const separated = generateTowerUnits(validTower({ floorCount: '1', firstFloor: '4', firstUnit: '7', unitDigits: '3', separator: '-' }))
  assert.deepEqual(separated.map((unit) => unit.number), ['4-007', '4-008'])
})

test('múltiplas torres preservam contexto e permitem números iguais entre torres', () => {
  const units = generateUnits([validTower(), validTower({ id: 'tower-b', name: 'Torre B' })])
  assert.equal(units.length, 12)
  assert.equal(units.filter((unit) => unit.number === '101').length, 2)
  assert.deepEqual(duplicateUnits(units), [])
})

test('bloqueia nomes de torres repetidos e valores inválidos', () => {
  assert.match(validateTowers([validTower(), validTower({ id: 'tower-b', name: ' torre a ' })]).join(' '), /repetido/i)
  const errors = validateTowers([validTower({ floorCount: '0', unitsPerFloor: 'abc', unitDigits: '5' })])
  assert.ok(errors.some((error) => /maior que zero/i.test(error)))
  assert.ok(errors.some((error) => /no máximo 4/i.test(error)))
})

test('valida dados obrigatórios e duplicidade de áreas personalizadas', () => {
  const state = createInitialWizardState()
  assert.equal(validateStep(0, state.draft).length, 4)
  const details = validateStepDetails(0, state.draft)
  assert.deepEqual(details.map((error) => error.field), ['condominium.name', 'condominium.address', 'condominium.city', 'condominium.state'])
  assert.equal(details[2].message, 'Informe a cidade.')
  const draft = { ...state.draft, commonAreas: ['Piscina'], customAreas: [{ id: '1', name: ' piscina ' }] }
  assert.match(validateCommonAreas(draft)[0], /duplicadas/i)
})

test('resume prévia extensa sem alterar totais nem exemplos reais', () => {
  const units = generateTowerUnits(validTower({ floorCount: '10', unitsPerFloor: '20' }))
  const summary = summarizeUnitsByFloor(units)
  assert.equal(units.length, 200)
  assert.equal(summary.floors.length, 5)
  assert.equal(summary.omittedFloors, 5)
  assert.deepEqual(summary.floors.map((group) => group.floor), [1, 2, 3, 9, 10])
  assert.equal(summary.floors[0].numbers[0], '101')
  assert.equal(summary.floors[0].numbers.length, 8)
  assert.equal(summary.floors[0].omittedUnits, 12)
})

test('reducer preserva dados ao navegar e mantém estado isolado', () => {
  let state = createInitialWizardState()
  state = wizardReducer(state, { type: 'UPDATE_CONDOMINIUM', field: 'name', value: 'Condomínio Teste' })
  state = wizardReducer(state, { type: 'UPDATE_TOWER', id: 'tower-1', field: 'name', value: 'Torre Norte' })
  state = wizardReducer(state, { type: 'GO_TO_STEP', step: 3 })
  state = wizardReducer(state, { type: 'GO_TO_STEP', step: 1 })
  assert.equal(state.draft.condominium.name, 'Condomínio Teste')
  assert.equal(state.draft.towers[0].name, 'Torre Norte')
  assert.equal(state.step, 1)
  assert.equal(state.maxVisited, 3)
})

test('reducer adiciona e remove torres sem alterar as restantes', () => {
  let state = createInitialWizardState()
  state = wizardReducer(state, { type: 'UPDATE_TOWER', id: 'tower-1', field: 'name', value: 'Torre A' })
  state = wizardReducer(state, { type: 'ADD_TOWER' })
  state = wizardReducer(state, { type: 'UPDATE_TOWER', id: 'tower-2', field: 'name', value: 'Torre B' })
  assert.deepEqual(state.draft.towers.map((tower) => tower.name), ['Torre A', 'Torre B'])
  state = wizardReducer(state, { type: 'REMOVE_TOWER', id: 'tower-1' })
  assert.deepEqual(state.draft.towers.map((tower) => tower.name), ['Torre B'])
})
