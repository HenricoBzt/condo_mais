import { ApiError } from '../../services/api.js'

const text = (value) => typeof value === 'string' ? value.trim() : ''
const upper = (value) => text(value).toUpperCase()
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CPF_PATTERN = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?$/
const OPERATIONAL_STATUSES = new Set(['ATIVO', 'INATIVO'])
const SETUP_STATUSES = new Set(['PENDENTE', 'CONCLUIDA'])
const MODELS = new Set(['VERTICAL', 'HORIZONTAL', 'EDIFICIO'])

function invalidPayload() {
  return new ApiError(502, 'O servidor retornou dados de condomínio em formato inválido.')
}

function isValidLocalDateTime(value) {
  if (typeof value !== 'string') return false
  const match = LOCAL_DATE_TIME_PATTERN.exec(value)
  if (!match) return false
  const [, year, month, day, hour, minute, second] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    && date.getUTCSeconds() === second
}

function isValidAdministrator(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && UUID_PATTERN.test(value.id)
    && text(value.nome) !== ''
    && typeof value.cpf === 'string'
    && CPF_PATTERN.test(value.cpf)
    && OPERATIONAL_STATUSES.has(value.status)
    && typeof value.primeiroAcessoPendente === 'boolean'
    && (value.email === null || typeof value.email === 'string')
}

export function assertPlatformCondominiumDto(value) {
  const valid = value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && UUID_PATTERN.test(value.id)
    && text(value.nome) !== ''
    && text(value.cnpj) !== ''
    && OPERATIONAL_STATUSES.has(value.status)
    && SETUP_STATUSES.has(value.configuracaoInicial)
    && (value.modelo === null || MODELS.has(value.modelo))
    && isValidLocalDateTime(value.criadoEm)
    && Array.isArray(value.administradores)
    && value.administradores.every(isValidAdministrator)
  if (!valid) throw invalidPayload()
  return value
}

export function assertPlatformCondominiumListDto(values) {
  if (!Array.isArray(values)) throw invalidPayload()
  values.forEach(assertPlatformCondominiumDto)
  return values
}

export function normalizePlatformCondominium(value = {}) {
  assertPlatformCondominiumDto(value)
  return {
    id: value.id,
    nome: text(value.nome),
    cnpj: text(value.cnpj),
    status: value.status,
    configuracaoInicial: value.configuracaoInicial,
    modelo: value.modelo,
    criadoEm: value.criadoEm,
    administradores: value.administradores.map((admin) => ({
      id: admin.id,
      nome: text(admin.nome),
      cpf: admin.cpf,
      email: admin.email === null ? null : admin.email.trim(),
      status: admin.status,
      primeiroAcessoPendente: admin.primeiroAcessoPendente,
    })),
  }
}

export function normalizePlatformCondominiums(values) {
  assertPlatformCondominiumListDto(values)
  return values.map(normalizePlatformCondominium)
}

export function platformIndicators(condominiums = []) {
  return condominiums.reduce((totals, condominium) => {
    totals.total += 1
    if (condominium.status === 'ATIVO') totals.active += 1
    if (condominium.status === 'INATIVO') totals.inactive += 1
    if (condominium.configuracaoInicial === 'PENDENTE') totals.pending += 1
    if (condominium.configuracaoInicial === 'CONCLUIDA') totals.completed += 1
    return totals
  }, { total: 0, active: 0, inactive: 0, pending: 0, completed: 0 })
}

function searchable(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function filterPlatformCondominiums(condominiums = [], filters = {}) {
  const query = searchable(filters.query).trim()
  const operationalStatus = upper(filters.operationalStatus)
  const setupStatus = upper(filters.setupStatus)
  return condominiums.filter((condominium) => {
    const matchesQuery = !query || searchable(`${condominium.nome} ${condominium.cnpj}`).includes(query)
    return matchesQuery
      && (!operationalStatus || condominium.status === operationalStatus)
      && (!setupStatus || condominium.configuracaoInicial === setupStatus)
  })
}

export function platformModelLabel(model) {
  return { VERTICAL: 'Condomínio vertical', HORIZONTAL: 'Condomínio horizontal', EDIFICIO: 'Edifício pequeno' }[model] || 'Não definido'
}

export function platformDateLabel(value) {
  if (!value) return 'Não informada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Não informada'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(date)
}
