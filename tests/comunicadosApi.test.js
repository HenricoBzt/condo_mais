import test from 'node:test'
import assert from 'node:assert/strict'
import { setToken } from '../src/services/api.js'
import { NOTICE_ALL, NOTICE_TOWER, carregarComunicados, excluirComunicado, noticeBody, salvarComunicado, toNotice } from '../src/services/comunicadosApi.js'
import { activeNotices } from '../src/services/serviceUtils.js'
import { confirmationMessage } from '../src/config/uiPresentation.js'

const storage = new Map()
globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) }
globalThis.window = new EventTarget()

function fakeFetch(routes) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    const route = routes.find(([prefix]) => url.includes(prefix))
    if (!route) return { ok: false, status: 404, json: async () => ({}), text: async () => '{}' }
    const [, status, body] = route
    return { ok: status < 400, status, json: async () => body, text: async () => (body === undefined ? '' : JSON.stringify(body)) }
  }
  return { fetchImpl, calls }
}

const geral = { id: 'av-1', titulo: 'Falta de água', conteudo: 'Manutenção da bomba.', prioridade: 'URGENTE', dataValidade: '2026-10-30', ativo: true, criadoEm: '2026-10-27T09:15:00', autorNome: 'Admin', torreId: null, torreNome: null }
const daTorre = { ...geral, id: 'av-2', prioridade: 'NORMAL', dataValidade: null, torreId: 't-a', torreNome: 'Torre A' }
const vencido = { ...geral, id: 'av-3', ativo: false }

test('comunicado da API vira comunicado das telas', () => {
  assert.deepEqual(toNotice(geral), {
    id: 'av-1', title: 'Falta de água', content: 'Manutenção da bomba.', priority: 'URGENTE', destination: NOTICE_ALL,
    tower: '', startDate: '2026-10-27', endDate: '2026-10-30', author: 'Admin', status: 'ATIVO',
  })
  const torre = toNotice(daTorre)
  assert.equal(torre.destination, NOTICE_TOWER)
  assert.equal(torre.tower, 'Torre A')
  assert.equal(torre.endDate, '')
  assert.equal(toNotice(vencido).status, 'ENCERRADO')
})

test('área do morador continua filtrando por torre com os dados da API', () => {
  const notices = [geral, daTorre, vencido].map(toNotice)
  assert.deepEqual(activeNotices(notices, { tower: 'Torre A' }).map((item) => item.id), ['av-1', 'av-2'])
  assert.deepEqual(activeNotices(notices, { tower: 'Torre B' }).map((item) => item.id), ['av-1'])
})

test('formulário vira RegistroAvisoDTO; torre pelo nome, sem data final = sem validade', () => {
  const towers = [{ id: 't-a', name: 'Torre A' }]
  assert.deepEqual(noticeBody({ title: ' Aviso ', content: ' Texto ', priority: 'URGENTE', destination: NOTICE_TOWER, tower: 'Torre A', endDate: '2026-11-01' }, towers),
    { titulo: 'Aviso', conteudo: 'Texto', prioridade: 'URGENTE', dataValidade: '2026-11-01', torreId: 't-a' })
  assert.deepEqual(noticeBody({ title: 'Aviso', content: 'Texto', priority: 'NORMAL', destination: NOTICE_ALL, tower: 'Torre A' }, towers),
    { titulo: 'Aviso', conteudo: 'Texto', prioridade: 'NORMAL', dataValidade: null, torreId: null })
  // Condomínio sem torres: o formulário nem mostra destino, e o comunicado vai para todos
  assert.equal(noticeBody({ title: 'Aviso', content: 'Texto', priority: 'NORMAL' }, []).torreId, null)
  assert.throws(() => noticeBody({ title: 'Aviso', content: 'Texto', destination: NOTICE_TOWER, tower: 'Torre Z' }, towers), (error) => error.status === 400)
  assert.throws(() => noticeBody({ title: ' ', content: 'Texto' }, towers), (error) => error.status === 400)
})

test('listar, publicar, editar e excluir usam /interativo/avisos', async () => {
  setToken('token')
  const { fetchImpl, calls } = fakeFetch([['/interativo/avisos', 200, [geral, daTorre]]])
  const notices = await carregarComunicados({ fetchImpl })
  assert.equal(notices.length, 2)
  assert.equal(calls[0].init.method, 'GET')

  await salvarComunicado({ title: 'A', content: 'B', priority: 'NORMAL', destination: NOTICE_ALL }, undefined, [], { fetchImpl })
  assert.equal(calls[1].init.method, 'POST')
  assert.equal(calls[1].url.endsWith('/interativo/avisos'), true)

  await salvarComunicado({ title: 'A', content: 'B', priority: 'NORMAL', destination: NOTICE_ALL }, 'av-1', [], { fetchImpl })
  assert.equal(calls[2].init.method, 'PUT')
  assert.equal(calls[2].url.endsWith('/interativo/avisos/av-1'), true)

  await excluirComunicado('av-1', { fetchImpl })
  assert.equal(calls[3].init.method, 'DELETE')
})

test('confirmação mostra o título, não o UUID do registro da API', () => {
  const message = confirmationMessage({ id: '3f2a1c9e-1111-4222-8333-444455556666', title: 'Falta de água' }, 'Excluir comunicado', 'EXCLUIDO')
  assert.match(message, /^Excluir comunicado: Falta de água\? O comunicado será excluído/)
  assert.doesNotMatch(message, /3f2a1c9e/)
  assert.match(confirmationMessage({ id: 'AVI-401', title: 'Aviso' }, 'Encerrar', 'ENCERRADO'), /Aviso · AVI-401/)
})
