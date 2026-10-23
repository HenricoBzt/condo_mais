import test from 'node:test'
import assert from 'node:assert/strict'
import { getToken, setToken } from '../src/services/api.js'
import { cpfComplete, formatCpf, login, logout, primeiroAcesso, profilePath } from '../src/services/authApi.js'

// sessionStorage mínimo para o Node.
const storage = new Map()
globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) }

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const fakeJwt = (claims) => `${base64url({ alg: 'HS256' })}.${base64url(claims)}.assinatura`

function respond(status, body) {
  const calls = []
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: status < 400, status, json: async () => body, text: async () => (body === undefined ? '' : JSON.stringify(body)) } }
  return { fetchImpl, calls }
}

test('máscara de CPF é progressiva e ignora o que não é dígito', () => {
  assert.equal(formatCpf('15729185430'), '157.291.854-30')
  assert.equal(formatCpf('157.291.854-30'), '157.291.854-30')
  assert.equal(formatCpf('157abc291'), '157.291')
  assert.equal(formatCpf('1572918'), '157.291.8')
  assert.equal(formatCpf('1572918543'), '157.291.854-3')
  assert.equal(formatCpf('157291854301234'), '157.291.854-30')
  assert.equal(formatCpf(''), '')
  assert.ok(cpfComplete('157.291.854-30'))
  assert.ok(!cpfComplete('157.291.854-3'))
})

test('perfil do backend (texto livre) abre a área correspondente', () => {
  for (const [perfil, path] of [['MASTER', '/plataforma'], ['ADMIN', '/admin'], ['Administrador', '/admin'], ['Administração', '/admin'], ['Portaria', '/portaria'], ['PORTEIRO', '/portaria'], [' morador ', '/morador']]) {
    assert.equal(profilePath(perfil), path, perfil)
  }
  for (const perfil of ['', 'SINDICO', undefined]) assert.equal(profilePath(perfil), '')
})

test('login do MASTER guarda a sessão e direciona para a plataforma', async () => {
  logout()
  const token = fakeJwt({ sub: '529.982.247-25', perfil: 'MASTER' })
  const { fetchImpl } = respond(200, { token })
  assert.deepEqual(await login('52998224725', 'segredo', { fetchImpl }), { path: '/plataforma' })
  assert.equal(getToken(), token)
})

test('login envia CPF formatado, guarda o token e devolve a rota do perfil', async () => {
  logout()
  const token = fakeJwt({ sub: '157.291.854-30', perfil: 'ADMIN', condominio_id: 'c-1' })
  const { fetchImpl, calls } = respond(200, { token })
  assert.deepEqual(await login('15729185430', 'segredo', { fetchImpl }), { path: '/admin' })
  assert.match(calls[0].url, /\/auth\/login$/)
  assert.equal(calls[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].init.body), { cpf: '157.291.854-30', senha: 'segredo' })
  assert.equal(getToken(), token)
})

test('credenciais erradas viram "CPF ou senha inválidos." e não guardam token', async () => {
  logout()
  const { fetchImpl } = respond(401, { status: 401, mensagem: 'CPF ou senha inválidos.' })
  await assert.rejects(login('157.291.854-30', 'errada', { fetchImpl }), (error) => error.status === 401 && error.message === 'CPF ou senha inválidos.')
  assert.equal(getToken(), '')
})

test('perfil sem área no front recusa a entrada e não guarda token', async () => {
  logout()
  const { fetchImpl } = respond(200, { token: fakeJwt({ perfil: 'SINDICO', condominio_id: 'c-1' }) })
  await assert.rejects(login('157.291.854-30', 'senha', { fetchImpl }), (error) => error.status === 403 && /perfil ainda não tem acesso/.test(error.message))
  assert.equal(getToken(), '')
})

test('logout apaga o token da sessão', () => {
  setToken('qualquer')
  logout()
  assert.equal(getToken(), '')
})

// Rotas falsas: cada caminho responde com [status, corpo em texto]
function routes(table) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    const [status, text] = Object.entries(table).find(([path]) => url.endsWith(path))[1]
    return { ok: status < 400, status, text: async () => text, json: async () => JSON.parse(text) }
  }
  return { fetchImpl, calls }
}

test('primeiro acesso cria a senha (resposta em texto puro) e já entra no sistema', async () => {
  logout()
  const token = fakeJwt({ perfil: 'MORADOR', condominio_id: 'c-1' })
  const { fetchImpl, calls } = routes({ '/auth/primeiro-acesso': [200, 'Senha criada com sucesso. Você já pode realizar o login.'], '/auth/login': [200, JSON.stringify({ token })] })
  assert.deepEqual(await primeiroAcesso('52998224725', 'senha-forte', { fetchImpl }), { path: '/morador' })
  assert.deepEqual(JSON.parse(calls[0].init.body), { cpf: '529.982.247-25', novaSenha: 'senha-forte' })
  assert.deepEqual(JSON.parse(calls[1].init.body), { cpf: '529.982.247-25', senha: 'senha-forte' })
  assert.equal(getToken(), token)
})

test('primeiro acesso recusado não revela o motivo e não chama o login', async () => {
  logout()
  const { fetchImpl, calls } = routes({ '/auth/primeiro-acesso': [403, 'Primeiro acesso indisponível para este CPF.'] })
  await assert.rejects(primeiroAcesso('529.982.247-25', 'senha-forte', { fetchImpl }), (error) => error.status === 403 && /cadastro pendente de ativação/.test(error.message))
  assert.equal(calls.length, 1)
  assert.equal(getToken(), '')
})
