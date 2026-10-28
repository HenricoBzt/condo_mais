import test from 'node:test'
import assert from 'node:assert/strict'
import { setToken } from '../src/services/api.js'
import { alterarStatusReserva, availabilityFromOccupation, bookableAreas, carregarOcupacao, reservationEffectiveStatus, solicitarReserva, toArea, toReservation } from '../src/services/reservasApi.js'

const storage = new Map()
globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) }
globalThis.window = new EventTarget()

function fakeFetch(body = {}) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
  }
  return { fetchImpl, calls }
}

test('reserva da API vira reserva da tela, com horários HH:mm e status das abas', () => {
  const now = new Date('2026-10-27T12:00:00')
  const reserva = { id: 'r-1', areaId: 'ar-1', areaNome: 'Salão', dataReserva: '2026-11-02', horarioInicio: '18:00:00', horarioFim: '22:30', status: 'AGUARDANDO APROVACAO', moradorNome: 'Carla', apartamentoNumero: '101', torreNome: null, aprovadorNome: null }
  assert.deepEqual(toReservation(reserva, now), {
    id: 'r-1', area: 'Salão', areaId: 'ar-1', resident: 'Carla', tower: '', unit: '101', date: '2026-11-02',
    startTime: '18:00', endTime: '22:30', approvedBy: '', status: 'AGUARDANDO_APROVACAO',
  })
})

test('confirmada que já terminou aparece como Concluída; as demais não mudam', () => {
  const now = new Date('2026-10-27T12:00:00')
  assert.equal(reservationEffectiveStatus('CONFIRMADA', '2026-10-27', '11:59', now), 'CONCLUIDA')
  assert.equal(reservationEffectiveStatus('CONFIRMADA', '2026-10-27', '12:30', now), 'CONFIRMADA')
  assert.equal(reservationEffectiveStatus('CANCELADA', '2020-01-01', '10:00', now), 'CANCELADA')
})

test('só áreas ativas e reserváveis aparecem para reservar', () => {
  const areas = [
    { id: 'a', nome: 'Salão', reservavel: true, exigeAprovacao: true, ativo: true, capacidade: 80 },
    { id: 'b', nome: 'Piscina', reservavel: false, ativo: true },
    { id: 'c', nome: 'Quadra', reservavel: true, ativo: false },
  ].map(toArea)
  assert.deepEqual(bookableAreas(areas).map((area) => area.name), ['Salão'])
  assert.equal(areas[0].requiresApproval, true)
  assert.equal(areas[0].capacity, 80)
})

test('disponibilidade a partir da agenda real da área', () => {
  const occupied = [{ startTime: '18:00', endTime: '22:00' }]
  assert.equal(availabilityFromOccupation(occupied, { startTime: '17:00', endTime: '18:30' }).available, false)
  assert.equal(availabilityFromOccupation(occupied, { startTime: '22:00', endTime: '23:00' }).available, true)
  assert.match(availabilityFromOccupation(occupied, { startTime: '20:00', endTime: '19:00' }).message, /posterior/)
})

test('ocupação, pedido e mudanças de status usam as rotas do backend', async () => {
  setToken('token')
  const { fetchImpl, calls } = fakeFetch([{ horarioInicio: '18:00:00', horarioFim: '22:00:00', status: 'CONFIRMADA' }])
  assert.deepEqual(await carregarOcupacao('ar-1', '2026-11-02', { fetchImpl }), [{ startTime: '18:00', endTime: '22:00', status: 'CONFIRMADA' }])
  assert.match(calls[0].url, /\/interativo\/reservas\/ocupacao\?areaId=ar-1&data=2026-11-02$/)

  await solicitarReserva({ area: 'Salão', date: '2026-11-02', startTime: '10:00', endTime: '12:00' }, [{ id: 'ar-1', name: 'Salão' }], { fetchImpl })
  assert.deepEqual(JSON.parse(calls[1].init.body), { areaId: 'ar-1', dataReserva: '2026-11-02', horarioInicio: '10:00', horarioFim: '12:00' })
  await assert.rejects(solicitarReserva({ area: 'Outra' }, [], { fetchImpl }), (error) => error.status === 400)

  for (const [status, route] of [['CONFIRMADA', 'aprovar'], ['RECUSADA', 'recusar'], ['CANCELADA', 'cancelar']]) {
    await alterarStatusReserva('r-1', status, { fetchImpl })
    assert.equal(calls.at(-1).init.method, 'PUT')
    assert.equal(calls.at(-1).url.endsWith(`/interativo/reservas/r-1/${route}`), true)
  }
  assert.throws(() => alterarStatusReserva('r-1', 'CONCLUIDA', { fetchImpl }), (error) => error.status === 400)
})
