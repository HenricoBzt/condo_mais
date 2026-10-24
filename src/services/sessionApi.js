import { apiGet } from './api.js'

export function carregarSessaoAtual(options) {
  return apiGet('/usuarios/me', {}, options)
}
