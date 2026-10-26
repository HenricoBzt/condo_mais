import { apiPost } from './api.js'

// Conclui o Setup Wizard: o backend gera as unidades e grava tudo numa transação.
// 201 = concluído; 409 = a configuração deste condomínio já tinha sido concluída.
export function salvarConfiguracaoInicial(payload, options = {}) {
  return apiPost('/condominios/configuracao-inicial', payload, { ...options, expectedStatus: 201 })
}
