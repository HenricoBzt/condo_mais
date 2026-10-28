import { ApiError, apiGet, apiPost, apiPut } from './api.js'

// "2026-10-27T14:32:05" -> "Hoje · 14:32" ou "27/10 · 14:32", no mesmo formato dos registros da portaria
export function packageTimeLabel(value, now = new Date()) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  return `${sameDay ? 'Hoje' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${time}`
}

// EncomendaResponseDTO -> encomenda das telas. O status vem com espaço ("AGUARDANDO RETIRADA").
export function toPackage(encomenda, now = new Date()) {
  return {
    id: encomenda.id,
    code: encomenda.codigoIdentificacao || '',
    resident: encomenda.moradorNome || '',
    tower: encomenda.torreNome || '',
    unit: encomenda.apartamentoNumero || '',
    unitId: encomenda.apartamentoId || '',
    receivedAt: packageTimeLabel(encomenda.dataHoraRecebimento, now),
    doorman: encomenda.porteiroRecebimentoNome || '',
    status: String(encomenda.status || '').trim().toUpperCase().replace(/\s+/g, '_'),
    withdrawnAt: packageTimeLabel(encomenda.dataHoraRetirada, now),
    withdrawnBy: encomenda.porteiroRetiradaNome || '',
    notes: encomenda.observacao || '',
  }
}

// Encomendas do condomínio do token (portaria/admin) ou da unidade do morador; o servidor decide o escopo
export async function carregarEncomendas(options) {
  const encomendas = await apiGet('/portaria/encomendas', {}, options)
  return (encomendas || []).map((encomenda) => toPackage(encomenda))
}

// A unidade é escolhida por Torre / Bloco + número; em condomínio sem torres, só pelo número
export function findPackageUnit(units, form) {
  const number = String(form.unit || '').trim()
  return units.find((unit) => unit.number === number && (unit.tower || '') === (form.tower || ''))
}

export async function registrarEncomenda(form, units, options) {
  const unit = findPackageUnit(units, form)
  if (!unit) throw new ApiError(400, 'Selecione uma unidade existente nesta Torre / Bloco.')
  const code = String(form.code || '').trim()
  if (!code) throw new ApiError(400, 'Informe o código de identificação da encomenda.')
  const notes = String(form.notes || '').trim()
  return apiPost('/portaria/encomendas/recebimento', { apartamentoId: unit.id, codigoIdentificacao: code, observacao: notes || null }, options)
}

export function registrarRetiradaEncomenda(id, options) {
  return apiPut(`/portaria/encomendas/${id}/retirada`, undefined, options)
}
