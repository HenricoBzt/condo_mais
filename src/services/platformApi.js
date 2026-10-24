import { ApiError, apiGet, apiPost, apiPut } from './api.js'
import { assertPlatformCondominiumDto, assertPlatformCondominiumListDto } from '../features/platform/platformData.js'

export async function listarCondominiosPlataforma(options) {
  const resposta = await apiGet('/plataforma/condominios', {}, options)
  return assertPlatformCondominiumListDto(resposta)
}

export async function buscarCondominioPlataforma(id, options) {
  const identificador = String(id || '').trim()
  if (!identificador) throw new ApiError(400, 'Condomínio não informado.')
  const resposta = await apiGet(`/plataforma/condominios/${encodeURIComponent(identificador)}`, {}, options)
  return assertPlatformCondominiumDto(resposta)
}

export async function criarCondominioPlataforma(dados, options = {}) {
  const resposta = await apiPost('/plataforma/condominios', dados, { ...options, expectedStatus: 201 })
  return assertPlatformCondominiumDto(resposta)
}

function platformCondominiumPath(id, suffix = '') {
  const identificador = String(id || '').trim()
  if (!identificador) throw new ApiError(400, 'Condomínio não informado.')
  return `/plataforma/condominios/${encodeURIComponent(identificador)}${suffix}`
}

async function platformPut(id, suffix, body, options = {}) {
  const resposta = await apiPut(platformCondominiumPath(id, suffix), body, { ...options, expectedStatus: 200 })
  return assertPlatformCondominiumDto(resposta)
}

function assertResultingStatus(condominium, expectedStatus, actionLabel) {
  if (condominium.status !== expectedStatus) {
    throw new ApiError(502, `O servidor não confirmou a ${actionLabel} solicitada. Consulte novamente os detalhes antes de tentar outra vez.`)
  }
  return condominium
}

export function atualizarCondominioPlataforma(id, dados, options) {
  return platformPut(id, '', dados, options)
}

export async function ativarCondominioPlataforma(id, options) {
  const condominium = await platformPut(id, '/ativar', undefined, options)
  return assertResultingStatus(condominium, 'ATIVO', 'ativação')
}

export async function desativarCondominioPlataforma(id, options) {
  const condominium = await platformPut(id, '/desativar', undefined, options)
  return assertResultingStatus(condominium, 'INATIVO', 'desativação')
}
