import test from 'node:test'
import assert from 'node:assert/strict'
import { assertPlatformCondominiumDto, assertPlatformCondominiumListDto, filterPlatformCondominiums, normalizePlatformCondominium, platformIndicators } from '../src/features/platform/platformData.js'
import { listarCondominiosPlataforma, buscarCondominioPlataforma, criarCondominioPlataforma } from '../src/services/platformApi.js'
import { setToken } from '../src/services/api.js'

const storage = new Map()
globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) }

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']
const condominium = (overrides = {}) => ({
  id: ids[0],
  nome: 'Águas Claras',
  cnpj: '11.111.111/0001-11',
  status: 'ATIVO',
  configuracaoInicial: 'PENDENTE',
  modelo: null,
  criadoEm: '2026-10-20T10:00:00.123456',
  administradores: [],
  ...overrides,
})
const administrator = (overrides = {}) => ({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  nome: 'Ana',
  cpf: '529.982.247-25',
  email: null,
  status: 'ATIVO',
  primeiroAcessoPendente: true,
  ...overrides,
})
const condominiums = [
  condominium(),
  condominium({ id: ids[1], nome: 'Bosque Azul', cnpj: '22.222.222/0001-22', status: 'INATIVO', configuracaoInicial: 'CONCLUIDA', modelo: 'VERTICAL' }),
  condominium({ id: ids[2], nome: 'Colinas', cnpj: '33.333.333/0001-33', configuracaoInicial: 'CONCLUIDA', modelo: 'HORIZONTAL' }),
]

function fakeFetch(status, body, calls = []) {
  return async (url, init) => {
    calls.push({ url, init })
    return { ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body }
  }
}

test('normaliza somente os campos expostos pelo contrato da plataforma', () => {
  const result = normalizePlatformCondominium({ ...condominiums[0], telefone: 'não deve vazar', administradores: [{ ...administrator(), telefone: '1199' }] })
  assert.equal(result.status, 'ATIVO')
  assert.deepEqual(result.administradores[0], administrator())
  assert.equal('telefone' in result.administradores[0], false)
})

test('aceita o payload completo e os campos anuláveis previstos no contrato', () => {
  assert.doesNotThrow(() => assertPlatformCondominiumDto(condominium({ modelo: null, administradores: [administrator({ email: null })] })))
  assert.doesNotThrow(() => assertPlatformCondominiumDto(condominium({ modelo: 'EDIFICIO', administradores: [administrator({ email: 'ana@exemplo.com' })] })))
  assert.doesNotThrow(() => assertPlatformCondominiumListDto(condominiums))
})

test('rejeita detalhe vazio, item primitivo, item sem id e UUID inválido', () => {
  for (const value of [{}, 'condomínio', condominium({ id: undefined }), condominium({ id: 'uuid-inválido' })]) {
    assert.throws(() => assertPlatformCondominiumDto(value), (error) => error.status === 502)
  }
  assert.throws(() => assertPlatformCondominiumListDto([{}]), (error) => error.status === 502)
})

test('rejeita estados, configuração, data e modelo fora do contrato', () => {
  for (const value of [
    condominium({ status: 'BLOQUEADO' }),
    condominium({ configuracaoInicial: 'PROCESSANDO' }),
    condominium({ criadoEm: '2026-02-31T10:00:00' }),
    condominium({ modelo: 'COMERCIAL' }),
  ]) assert.throws(() => assertPlatformCondominiumDto(value), (error) => error.status === 502)
})

test('rejeita administrador estruturalmente inválido', () => {
  for (const admin of [
    {},
    administrator({ id: 'inválido' }),
    administrator({ nome: ' ' }),
    administrator({ cpf: '52998224725' }),
    administrator({ status: 'BLOQUEADO' }),
    administrator({ primeiroAcessoPendente: 'sim' }),
    administrator({ email: 123 }),
  ]) assert.throws(() => assertPlatformCondominiumDto(condominium({ administradores: [admin] })), (error) => error.status === 502)
})

test('calcula indicadores somente a partir da listagem real', () => {
  assert.deepEqual(platformIndicators(condominiums), { total: 3, active: 2, inactive: 1, pending: 1, completed: 2 })
  assert.deepEqual(platformIndicators([]), { total: 0, active: 0, inactive: 0, pending: 0, completed: 0 })
})

test('busca por nome ou CNPJ e combina filtros locais', () => {
  assert.deepEqual(filterPlatformCondominiums(condominiums, { query: 'aguas' }).map((item) => item.id), [ids[0]])
  assert.deepEqual(filterPlatformCondominiums(condominiums, { query: '22.222' }).map((item) => item.id), [ids[1]])
  assert.deepEqual(filterPlatformCondominiums(condominiums, { operationalStatus: 'ATIVO', setupStatus: 'CONCLUIDA' }).map((item) => item.id), [ids[2]])
})

test('serviço consulta apenas os endpoints GET confirmados', async () => {
  setToken('token-master')
  const listCalls = []
  assert.deepEqual(await listarCondominiosPlataforma({ fetchImpl: fakeFetch(200, condominiums, listCalls) }), condominiums)
  assert.equal(listCalls[0].init.method, 'GET')
  assert.match(listCalls[0].url, /\/plataforma\/condominios$/)
  assert.equal(listCalls[0].init.headers.Authorization, 'Bearer token-master')

  const detailCalls = []
  assert.equal((await buscarCondominioPlataforma(ids[0], { fetchImpl: fakeFetch(200, condominiums[0], detailCalls) })).id, ids[0])
  assert.match(detailCalls[0].url, new RegExp(`/plataforma/condominios/${ids[0]}$`))
})

test('serviço rejeita respostas incompatíveis e detalhe sem identificador', async () => {
  await assert.rejects(listarCondominiosPlataforma({ fetchImpl: fakeFetch(200, {}) }), (error) => error.status === 502)
  await assert.rejects(buscarCondominioPlataforma('', { fetchImpl: fakeFetch(200, {}) }), (error) => error.status === 400)
  await assert.rejects(buscarCondominioPlataforma(ids[0], { fetchImpl: fakeFetch(200, []) }), (error) => error.status === 502)
  await assert.rejects(buscarCondominioPlataforma(ids[0], { fetchImpl: fakeFetch(200, {}) }), (error) => error.status === 502)
  await assert.rejects(listarCondominiosPlataforma({ fetchImpl: fakeFetch(200, [condominium(), {}]) }), (error) => error.status === 502)
  await assert.rejects(listarCondominiosPlataforma({ fetchImpl: fakeFetch(200, [7]) }), (error) => error.status === 502)
})

test('cadastro usa somente POST autorizado, payload exato e exige resposta 201 válida', async () => {
  setToken('token-master')
  const payload = { condominio: { nome: 'Novo', cnpj: '04.252.011/0001-10' }, admin: { nome: 'Maria', cpf: '529.982.247-25', email: null, telefone: null } }
  const calls = []
  const created = condominium({ administradores: [administrator()] })
  assert.deepEqual(await criarCondominioPlataforma(payload, { fetchImpl: fakeFetch(201, created, calls) }), created)
  assert.equal(calls[0].init.method, 'POST')
  assert.match(calls[0].url, /\/plataforma\/condominios$/)
  assert.equal(calls[0].init.headers.Authorization, 'Bearer token-master')
  assert.deepEqual(JSON.parse(calls[0].init.body), payload)

  await assert.rejects(criarCondominioPlataforma(payload, { fetchImpl: fakeFetch(200, created) }), (error) => error.status === 502 && /status inesperado/.test(error.message))
  await assert.rejects(criarCondominioPlataforma(payload, { fetchImpl: fakeFetch(201, {}) }), (error) => error.status === 502)
})

test('cadastro preserva erros 400, 401, 403, 409, 500 e falha de rede', async () => {
  const payload = { condominio: { nome: 'Novo', cnpj: '04.252.011/0001-10' }, admin: { nome: 'Maria', cpf: '529.982.247-25', email: null, telefone: null } }
  for (const status of [400, 401, 403, 409, 500]) {
    setToken('token-master')
    await assert.rejects(criarCondominioPlataforma(payload, { fetchImpl: fakeFetch(status, { mensagem: `erro-${status}` }) }), (error) => error.status === status)
  }
  setToken('token-master')
  await assert.rejects(criarCondominioPlataforma(payload, { fetchImpl: async () => { throw new Error('offline') } }), (error) => error.status === 0)
})
