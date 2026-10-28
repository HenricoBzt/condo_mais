import { ApiError, apiGet, apiPost, apiPut } from './api.js'
import { findPackageUnit, packageTimeLabel } from './encomendasApi.js'

const hhmm = (value) => String(value || '').slice(0, 5)

// VisitaResponseDTO -> visitante das telas. O status já vem efetivo (EXPIRADO calculado pelo servidor).
export function toVisitor(visita) {
  const startDate = visita.dataInicio || ''
  return {
    id: visita.id,
    name: visita.visitanteNome || '',
    cpf: visita.visitanteCpf || '',
    phone: visita.visitanteTelefone || '',
    tower: visita.torreNome || '',
    unit: visita.apartamentoNumero || '',
    unitId: visita.apartamentoId || '',
    resident: visita.moradorNome || '',
    startDate,
    startTime: hhmm(visita.horaInicio),
    // Entrada imediata não tem fim de período: vale o próprio dia
    endDate: visita.dataFim || startDate,
    endTime: hhmm(visita.horaFim),
    notes: visita.observacao || '',
    status: String(visita.status || '').trim().toUpperCase(),
    source: visita.origem || '',
    entryAt: packageTimeLabel(visita.dataHoraEntrada),
    exitAt: packageTimeLabel(visita.dataHoraSaida),
    doormanIn: visita.porteiroEntradaNome || '',
    doormanOut: visita.porteiroSaidaNome || '',
  }
}

// Portaria/admin recebem as do condomínio; o morador, as da própria unidade
export async function carregarVisitas(options) {
  const visitas = await apiGet('/portaria/visitas', {}, options)
  return (visitas || []).map(toVisitor)
}

// Formulário -> AutorizacaoVisitaDTO. Para o morador, o servidor usa a unidade dele e ignora a escolhida.
export function visitBody(form, { units = [], asResident = false } = {}) {
  const name = String(form.name || '').trim()
  if (!name) throw new ApiError(400, 'Informe o nome do visitante.')
  let apartamentoId = null
  if (!asResident) {
    const unit = findPackageUnit(units, form)
    if (!unit) throw new ApiError(400, 'Selecione uma unidade existente nesta Torre / Bloco.')
    apartamentoId = unit.id
  }
  return {
    cpf: String(form.cpf || '').trim(),
    nome: name,
    telefone: String(form.phone || '').trim() || null,
    apartamentoId,
    moradorId: null,
    dataInicio: form.startDate,
    horaInicio: form.startTime,
    dataFim: form.endDate,
    horaFim: form.endTime,
    observacao: String(form.notes || '').trim() || null,
    autorizado: asResident ? null : Boolean(form.authorized),
  }
}

export function cadastrarVisita(form, lookups, options) {
  return apiPost('/portaria/visitas', visitBody(form, lookups), options)
}

// Ação da tela -> rota: autorizar/recusar (portaria, admin ou morador da unidade), entrada/saída (portaria/admin)
const statusRoutes = { AUTORIZADO: 'autorizar', RECUSADO: 'recusar', ENTROU: 'entrada', SAIU: 'saida' }

export function alterarStatusVisita(id, status, options) {
  const route = statusRoutes[status]
  if (!route) throw new ApiError(400, 'Ação de visita inválida.')
  return apiPut(`/portaria/visitas/${id}/${route}`, undefined, options)
}
