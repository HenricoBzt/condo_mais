import test from 'node:test'
import assert from 'node:assert/strict'
import { setToken } from '../src/services/api.js'
import { alterarStatusVisita, visitBody, toVisitor } from '../src/services/visitasApi.js'
import { visitorEffectiveStatus } from '../src/services/visitantesService.js'

const storage = new Map()
globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) }
globalThis.window = new EventTarget()

const base = {
  id: 'v-1', status: 'AUTORIZADO', origem: 'MORADOR', visitanteNome: 'Mariana', visitanteCpf: '529.982.247-25', visitanteTelefone: '81 9999',
  apartamentoId: 'a-101', apartamentoNumero: '101', torreNome: 'Torre A', moradorNome: 'Carla',
  dataInicio: '2026-10-27', horaInicio: '14:30:00', dataFim: '2026-10-27', horaFim: '22:00:00', observacao: 'Aniversário',
  dataHoraEntrada: null, dataHoraSaida: null, porteiroEntradaNome: null, porteiroSaidaNome: null,
}

test('visita da API vira visitante das telas', () => {
  const visitor = toVisitor(base)
  assert.deepEqual({ ...visitor, entryAt: undefined, exitAt: undefined }, {
    id: 'v-1', name: 'Mariana', cpf: '529.982.247-25', phone: '81 9999', tower: 'Torre A', unit: '101', unitId: 'a-101', resident: 'Carla',
    startDate: '2026-10-27', startTime: '14:30', endDate: '2026-10-27', endTime: '22:00', notes: 'Aniversário', status: 'AUTORIZADO',
    source: 'MORADOR', entryAt: undefined, exitAt: undefined, doormanIn: '', doormanOut: '',
  })
  // O cálculo de expiração do front concorda com o período convertido
  assert.equal(visitorEffectiveStatus(visitor, new Date('2026-10-28T00:00:00')), 'EXPIRADO')
  // Entrada imediata (sem fim de período) vale para o próprio dia
  const walkIn = toVisitor({ ...base, status: 'ENTROU', dataFim: null, horaFim: null })
  assert.equal(walkIn.endDate, '2026-10-27')
  assert.equal(walkIn.endTime, '')
})

test('formulário da portaria leva a unidade e a autorização prévia; o do morador, não', () => {
  const units = [{ id: 'a-101', tower: 'Torre A', number: '101' }]
  const form = { name: ' Pedro ', cpf: '111.444.777-35', phone: '', tower: 'Torre A', unit: '101', startDate: '2026-11-01', startTime: '10:00', endDate: '2026-11-01', endTime: '12:00', notes: '', authorized: true }
  assert.deepEqual(visitBody(form, { units }), {
    cpf: '111.444.777-35', nome: 'Pedro', telefone: null, apartamentoId: 'a-101', moradorId: null,
    dataInicio: '2026-11-01', horaInicio: '10:00', dataFim: '2026-11-01', horaFim: '12:00', observacao: null, autorizado: true,
  })
  const resident = visitBody({ ...form, tower: undefined, unit: undefined }, { asResident: true })
  assert.equal(resident.apartamentoId, null)
  assert.equal(resident.autorizado, null)
  assert.throws(() => visitBody({ ...form, unit: '999' }, { units }), (error) => error.status === 400)
  assert.throws(() => visitBody({ ...form, name: ' ' }, { units }), (error) => error.status === 400)
})

test('cada ação da tela usa a rota do backend', async () => {
  setToken('token')
  const calls = []
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' } }
  for (const [status, route] of [['AUTORIZADO', 'autorizar'], ['RECUSADO', 'recusar'], ['ENTROU', 'entrada'], ['SAIU', 'saida']]) {
    await alterarStatusVisita('v-1', status, { fetchImpl })
    assert.equal(calls.at(-1).init.method, 'PUT')
    assert.equal(calls.at(-1).url.endsWith(`/portaria/visitas/v-1/${route}`), true)
  }
  assert.throws(() => alterarStatusVisita('v-1', 'EXPIRADO', { fetchImpl }), (error) => error.status === 400)
})
