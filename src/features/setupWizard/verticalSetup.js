export const SETUP_STEPS = [
  'Dados do condomínio',
  'Modelo residencial',
  'Torres',
  'Prévia das unidades',
  'Áreas comuns',
  'Resumo',
]

export const PREDEFINED_COMMON_AREAS = [
  'Salão de Festas',
  'Piscina',
  'Churrasqueira',
  'Academia',
  'Playground',
  'Quadra Esportiva',
  'Espaço Gourmet',
  'Sala de Reuniões',
]

export function createTower(id = 'tower-1') {
  return {
    id,
    name: '',
    floorCount: '1',
    unitsPerFloor: '4',
    firstFloor: '1',
    firstUnit: '1',
    unitDigits: '2',
    separator: '',
  }
}

export function createInitialSetupDraft() {
  return {
    condominium: { name: '', address: '', city: '', state: '' },
    residentialModel: 'VERTICAL',
    towers: [createTower()],
    commonAreas: [],
    customAreas: [],
  }
}

const integer = (value) => Number.parseInt(String(value), 10)
const normalized = (value) => String(value || '').trim().toLocaleLowerCase('pt-BR')

export function generateTowerUnits(tower) {
  const floorCount = integer(tower.floorCount)
  const unitsPerFloor = integer(tower.unitsPerFloor)
  const firstFloor = integer(tower.firstFloor)
  const firstUnit = integer(tower.firstUnit)
  const unitDigits = integer(tower.unitDigits)
  if ([floorCount, unitsPerFloor, firstFloor, firstUnit, unitDigits].some((value) => !Number.isInteger(value) || value < 1)) return []

  const units = []
  for (let floorOffset = 0; floorOffset < floorCount; floorOffset += 1) {
    const floor = firstFloor + floorOffset
    for (let unitOffset = 0; unitOffset < unitsPerFloor; unitOffset += 1) {
      const sequence = String(firstUnit + unitOffset).padStart(unitDigits, '0')
      units.push({
        id: `${tower.id}-${floor}-${sequence}`,
        towerId: tower.id,
        towerName: tower.name.trim(),
        floor,
        number: `${floor}${tower.separator || ''}${sequence}`,
      })
    }
  }
  return units
}

export const generateUnits = (towers) => towers.flatMap(generateTowerUnits)

export function summarizeUnitsByFloor(units, { maxFloors = 5, maxUnitsPerFloor = 8 } = {}) {
  const groups = [...units.reduce((map, unit) => {
    if (!map.has(unit.floor)) map.set(unit.floor, [])
    map.get(unit.floor).push(unit)
    return map
  }, new Map()).entries()].map(([floor, floorUnits]) => ({ floor, units: floorUnits }))
  const visible = groups.length <= maxFloors ? groups : [...groups.slice(0, 3), ...groups.slice(-2)]
  return {
    omittedFloors: Math.max(0, groups.length - visible.length),
    floors: visible.map((group) => ({
      floor: group.floor,
      total: group.units.length,
      numbers: group.units.slice(0, maxUnitsPerFloor).map((unit) => unit.number),
      omittedUnits: Math.max(0, group.units.length - maxUnitsPerFloor),
    })),
  }
}

function validatePositiveInteger(value, label, maximum) {
  const parsed = integer(value)
  if (!Number.isInteger(parsed) || parsed < 1) return `${label} deve ser um número inteiro maior que zero.`
  if (maximum && parsed > maximum) return `${label} deve ser no máximo ${maximum}.`
  return ''
}

export function validateTowerDetails(towers) {
  if (!towers.length) return [{ message: 'Adicione pelo menos uma torre.' }]
  const errors = []
  const names = new Set()
  towers.forEach((tower, index) => {
    const label = tower.name.trim() || `Torre ${index + 1}`
    if (!tower.name.trim()) errors.push({ field: `tower.${tower.id}.name`, message: `Informe o nome da Torre ${index + 1}.` })
    else if (names.has(normalized(tower.name))) errors.push({ field: `tower.${tower.id}.name`, message: `O nome “${tower.name.trim()}” está repetido.` })
    else names.add(normalized(tower.name))
    for (const [field, error] of [
      ['floorCount', validatePositiveInteger(tower.floorCount, `Quantidade de andares de ${label}`, 100)],
      ['unitsPerFloor', validatePositiveInteger(tower.unitsPerFloor, `Apartamentos por andar de ${label}`, 100)],
      ['firstFloor', validatePositiveInteger(tower.firstFloor, `Primeiro andar de ${label}`, 999)],
      ['firstUnit', validatePositiveInteger(tower.firstUnit, `Primeiro apartamento de ${label}`, 999)],
      ['unitDigits', validatePositiveInteger(tower.unitDigits, `Quantidade de dígitos de ${label}`, 4)],
    ]) if (error) errors.push({ field: `tower.${tower.id}.${field}`, message: error })
  })
  if (generateUnits(towers).length > 5000) errors.push({ message: 'A prévia está limitada a 5.000 unidades por configuração.' })
  return errors
}

export const validateTowers = (towers) => validateTowerDetails(towers).map((error) => error.message)

export function duplicateUnits(units) {
  const seen = new Set()
  const duplicates = new Set()
  units.forEach((unit) => {
    const key = `${unit.towerId}:${normalized(unit.number)}`
    if (seen.has(key)) duplicates.add(`${unit.towerName} · ${unit.number}`)
    seen.add(key)
  })
  return [...duplicates]
}

export function validateCommonAreas(draft) {
  const allNames = [...draft.commonAreas, ...draft.customAreas.map((area) => area.name)]
  const seen = new Set()
  const duplicates = []
  allNames.forEach((name) => {
    const key = normalized(name)
    if (!key) return
    if (seen.has(key)) duplicates.push(name.trim())
    seen.add(key)
  })
  return duplicates.length ? [`Remova áreas comuns duplicadas: ${[...new Set(duplicates)].join(', ')}.`] : []
}

export function validateStepDetails(step, draft) {
  if (step === 0) {
    const messages = { name: 'Informe o nome do condomínio.', address: 'Informe o endereço.', city: 'Informe a cidade.', state: 'Informe o estado.' }
    return Object.entries(messages).filter(([key]) => !draft.condominium[key].trim()).map(([key, message]) => ({ field: `condominium.${key}`, message }))
  }
  if (step === 2) return validateTowerDetails(draft.towers)
  if (step === 3) {
    const towerErrors = validateTowerDetails(draft.towers)
    if (towerErrors.length) return towerErrors
    const duplicates = duplicateUnits(generateUnits(draft.towers))
    return duplicates.length ? [{ message: `Existem unidades duplicadas: ${duplicates.join(', ')}.` }] : []
  }
  if (step === 4) return validateCommonAreas(draft).map((message) => ({ message }))
  return []
}

export const validateStep = (step, draft) => validateStepDetails(step, draft).map((error) => error.message)

export function wizardReducer(state, action) {
  switch (action.type) {
    case 'UPDATE_CONDOMINIUM':
      return { ...state, draft: { ...state.draft, condominium: { ...state.draft.condominium, [action.field]: action.value } } }
    case 'ADD_TOWER': {
      const nextId = state.nextTowerId + 1
      return { ...state, nextTowerId: nextId, draft: { ...state.draft, towers: [...state.draft.towers, createTower(`tower-${nextId}`)] } }
    }
    case 'UPDATE_TOWER':
      return { ...state, draft: { ...state.draft, towers: state.draft.towers.map((tower) => tower.id === action.id ? { ...tower, [action.field]: action.value } : tower) } }
    case 'REMOVE_TOWER':
      return { ...state, draft: { ...state.draft, towers: state.draft.towers.filter((tower) => tower.id !== action.id) } }
    case 'TOGGLE_AREA': {
      const selected = state.draft.commonAreas.includes(action.name)
      return { ...state, draft: { ...state.draft, commonAreas: selected ? state.draft.commonAreas.filter((name) => name !== action.name) : [...state.draft.commonAreas, action.name] } }
    }
    case 'ADD_CUSTOM_AREA':
      return { ...state, draft: { ...state.draft, customAreas: [...state.draft.customAreas, action.area] } }
    case 'REMOVE_CUSTOM_AREA':
      return { ...state, draft: { ...state.draft, customAreas: state.draft.customAreas.filter((area) => area.id !== action.id) } }
    case 'GO_TO_STEP':
      return { ...state, step: action.step, maxVisited: Math.max(state.maxVisited, action.step), reviewed: false }
    case 'SET_REVIEWED':
      return { ...state, reviewed: true }
    default:
      return state
  }
}

export function createInitialWizardState() {
  return { step: 0, maxVisited: 0, nextTowerId: 1, reviewed: false, draft: createInitialSetupDraft() }
}
