import { ApiError, apiGet, apiPost, apiPut } from './api.js'

const hhmm = (value) => String(value || '').slice(0, 5)

// Reserva confirmada cujo horário já passou aparece como CONCLUIDA (o backend não grava esse estado)
export function reservationEffectiveStatus(status, date, endTime, now = new Date()) {
  if (status !== 'CONFIRMADA' || !date || !endTime) return status
  const end = new Date(`${date}T${hhmm(endTime)}:00`)
  return !Number.isNaN(end.getTime()) && end < now ? 'CONCLUIDA' : status
}

// ReservaResponseDTO -> reserva das telas. O status vem com espaço ("AGUARDANDO APROVACAO").
export function toReservation(reserva, now = new Date()) {
  const status = String(reserva.status || '').trim().toUpperCase().replace(/\s+/g, '_')
  return {
    id: reserva.id,
    area: reserva.areaNome || '',
    areaId: reserva.areaId || '',
    resident: reserva.moradorNome || '',
    tower: reserva.torreNome || '',
    unit: reserva.apartamentoNumero || '',
    date: reserva.dataReserva || '',
    startTime: hhmm(reserva.horarioInicio),
    endTime: hhmm(reserva.horarioFim),
    approvedBy: reserva.aprovadorNome || '',
    status: reservationEffectiveStatus(status, reserva.dataReserva, reserva.horarioFim, now),
  }
}

// AreaComumResponseDTO -> área para reservar
export function toArea(area) {
  return {
    id: area.id,
    name: area.nome || '',
    description: area.descricao || '',
    rules: area.regras || '',
    bookable: area.reservavel !== false,
    requiresApproval: Boolean(area.exigeAprovacao),
    active: area.ativo !== false,
    capacity: area.capacidade ?? null,
  }
}

// Admin e portaria recebem todas do condomínio; o morador, as da unidade dele
export async function carregarReservas(options) {
  const reservas = await apiGet('/interativo/reservas', {}, options)
  return (reservas || []).map((reserva) => toReservation(reserva))
}

export async function carregarAreasComuns(options) {
  const areas = await apiGet('/condominios/areas-comuns', {}, options)
  return (areas || []).map(toArea)
}

// Só áreas ativas e reserváveis entram no formulário do morador
export function bookableAreas(areas = []) {
  return areas.filter((area) => area.active && area.bookable)
}

// Horários ocupados de uma área num dia, sem dados de quem reservou
export async function carregarOcupacao(areaId, date, options) {
  const horarios = await apiGet('/interativo/reservas/ocupacao', { areaId, data: date }, options)
  return (horarios || []).map((horario) => ({ startTime: hhmm(horario.horarioInicio), endTime: hhmm(horario.horarioFim), status: horario.status }))
}

export function availabilityFromOccupation(occupied, candidate) {
  if (!candidate.startTime || !candidate.endTime) return { available: false, message: 'Preencha área, data e horários.' }
  if (candidate.startTime >= candidate.endTime) return { available: false, message: 'O horário final deve ser posterior ao inicial.' }
  const conflict = occupied.some((slot) => candidate.startTime < slot.endTime && candidate.endTime > slot.startTime)
  return conflict ? { available: false, message: 'Este horário já está ocupado.' } : { available: true, message: 'Horário disponível.' }
}

export async function solicitarReserva(form, areas, options) {
  const area = areas.find((item) => item.name === form.area)
  if (!area) throw new ApiError(400, 'Selecione uma área comum disponível.')
  return apiPost('/interativo/reservas', { areaId: area.id, dataReserva: form.date, horarioInicio: form.startTime, horarioFim: form.endTime }, options)
}

const statusRoutes = { CANCELADA: 'cancelar', CONFIRMADA: 'aprovar', RECUSADA: 'recusar' }

export function alterarStatusReserva(id, status, options) {
  const route = statusRoutes[status]
  if (!route) throw new ApiError(400, 'Ação de reserva inválida.')
  return apiPut(`/interativo/reservas/${id}/${route}`, undefined, options)
}
