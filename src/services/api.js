import { notifySessionChanged } from './sessionEvents.js'

// Cliente HTTP da API Condo+. Sem VITE_API_URL, o app continua usando apenas os mocks locais.
const env = import.meta.env || {}
const TOKEN_KEY = 'condoplus.token'

export const API_URL = (env.VITE_API_URL || '').replace(/\/+$/, '')

export function apiEnabled() { return Boolean(API_URL) }

export class ApiError extends Error {
  constructor(status, message) { super(message); this.name = 'ApiError'; this.status = status }
}

// Token da sessão, gravado no login. sessionStorage: some ao fechar a aba.
export function getToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}

export function setToken(token) {
  try {
    const previous = sessionStorage.getItem(TOKEN_KEY) || ''
    if (token) sessionStorage.setItem(TOKEN_KEY, token); else sessionStorage.removeItem(TOKEN_KEY)
    if (previous !== (token || '')) notifySessionChanged()
  } catch { /* sem sessionStorage */ }
}

// Lê as claims do JWT sem validar a assinatura: serve só para escopo de requisição; quem valida é o servidor.
export function tokenClaims(token = getToken()) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(Array.from(atob(payload), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')))
  } catch { return null }
}

export function condominioIdFromToken(token = getToken()) { return tokenClaims(token)?.condominio_id || '' }

function errorMessage(status) {
  if (status === 401) return 'Sessão inválida ou expirada. Entre novamente.'
  if (status === 403) return 'Você não tem permissão para esta operação.'
  if (status === 404) return 'Registro não encontrado.'
  if (status >= 500) return 'O servidor não conseguiu concluir a operação. Tente novamente.'
  return 'Não foi possível concluir a operação.'
}

// A API responde erros como ErroResponseDTO { status, erro, mensagem, caminho, timestamp }.
// A mensagem do servidor só é exibida em erros de negócio; sessão (401) e falhas internas (5xx) usam texto fixo.
async function responseError(response) {
  const fallback = errorMessage(response.status)
  if (response.status === 401 || response.status >= 500) return new ApiError(response.status, fallback)
  let body = null
  try { body = await response.json() } catch { /* corpo vazio ou não JSON */ }
  const message = typeof body?.mensagem === 'string' && body.mensagem.trim() ? body.mensagem.trim() : fallback
  return new ApiError(response.status, message)
}

async function request(method, path, { params = {}, body, fetchImpl = fetch } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
  const token = getToken()
  const headers = { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  let response
  try {
    response = await fetchImpl(`${API_URL}${path}${query ? `?${query}` : ''}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique sua conexão.')
  }
  if (!response.ok) throw await responseError(response)
  if (response.status === 204) return null
  // DELETE e alguns PUT respondem 200 sem corpo; /auth/primeiro-acesso responde texto puro
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

export function apiGet(path, params = {}, { fetchImpl } = {}) { return request('GET', path, { params, fetchImpl }) }

export function apiPost(path, body, { fetchImpl } = {}) { return request('POST', path, { body, fetchImpl }) }

export function apiPut(path, body, { fetchImpl } = {}) { return request('PUT', path, { body, fetchImpl }) }

export function apiDelete(path, { fetchImpl } = {}) { return request('DELETE', path, { fetchImpl }) }
