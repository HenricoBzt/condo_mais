import { ApiError, apiGet, apiPost } from './api.js'
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
