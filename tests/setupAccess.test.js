import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SETUP_ACCESS, decideSetupAccess, resolveCurrentSetupAccess } from '../src/features/setupWizard/setupAccess.js'

const token = (claims) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode(claims)}.`
}

const adminToken = token({ perfil: 'ADMIN', condominio_id: 'condo-1' })

test('sem sessão ou token inválido direciona ao login', () => {
  assert.deepEqual(decideSetupAccess(), { status: SETUP_ACCESS.NO_SESSION, destination: '/' })
  assert.deepEqual(decideSetupAccess({ token: 'invalido' }), { status: SETUP_ACCESS.NO_SESSION, destination: '/' })
})

test('somente ADMIN pendente recebe acesso ao Wizard', () => {
  assert.deepEqual(decideSetupAccess({ token: adminToken, user: { perfil: 'ADMIN', configuracaoInicial: 'PENDENTE' } }), { status: SETUP_ACCESS.ALLOWED, destination: '' })
  assert.deepEqual(decideSetupAccess({ token: adminToken, user: { perfil: 'ADMIN', configuracaoInicial: 'CONCLUIDA' } }), { status: SETUP_ACCESS.CONFIGURED, destination: '/admin' })
})

test('estado ausente ou desconhecido nunca libera o Wizard', () => {
  assert.deepEqual(decideSetupAccess({ token: adminToken, user: { perfil: 'ADMIN' } }), { status: SETUP_ACCESS.UNKNOWN, destination: '' })
  assert.deepEqual(decideSetupAccess({ token: adminToken, user: { perfil: 'ADMIN', configuracaoInicial: 'PROCESSANDO' } }), { status: SETUP_ACCESS.UNKNOWN, destination: '' })
})

test('morador, portaria e MASTER nunca recebem acesso ao Wizard', () => {
  for (const [perfil, destination] of [['MORADOR', '/morador'], ['PORTEIRO', '/portaria'], ['MASTER', '/plataforma']]) {
    const result = decideSetupAccess({ token: token({ perfil }), user: { perfil, configuracaoInicial: null } })
    assert.deepEqual(result, { status: SETUP_ACCESS.DENIED, destination })
  }
})

test('resolver usa o usuário confirmado por /usuarios/me', async () => {
  const pending = await resolveCurrentSetupAccess({ token: adminToken, loadCurrentUser: async () => ({ perfil: 'ADMIN', configuracaoInicial: 'PENDENTE' }) })
  assert.equal(pending.status, SETUP_ACCESS.ALLOWED)
  const configured = await resolveCurrentSetupAccess({ token: adminToken, loadCurrentUser: async () => ({ perfil: 'ADMIN', configuracaoInicial: 'CONCLUIDA' }) })
  assert.deepEqual(configured, { status: SETUP_ACCESS.CONFIGURED, destination: '/admin' })
})

test('falha de /usuarios/me permanece erro e nunca libera o Wizard', async () => {
  const result = await resolveCurrentSetupAccess({ token: adminToken, loadCurrentUser: async () => { throw new Error('Servidor indisponível') } })
  assert.equal(result.status, SETUP_ACCESS.ERROR)
  assert.equal(result.message, 'Servidor indisponível')
})

test('rotas permanecem protegidas, Wizard fora do menu e layout exclusivo', async () => {
  const [app, layout, wizard, experience, setupLayout, styles, gate] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/layouts/DesktopLayout.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/setupWizard/verticalSetup.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/desktop/VerticalSetupWizardExperience.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/layouts/SetupLayout.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/SessionAccessGate.jsx', import.meta.url), 'utf8'),
  ])
  assert.match(app, /<AdminSetupAccessGate><VerticalSetupWizardPage \/><\/AdminSetupAccessGate>/)
  assert.ok(app.includes('SESSION_AREA.ADMIN'))
  assert.ok(app.includes('SESSION_AREA.PLATFORM'))
  assert.ok(app.includes('/admin/configuracao-inicial'))
  assert.ok(app.includes('/plataforma'))
  assert.ok(!layout.includes('/admin/configuracao-inicial'))
  assert.ok(experience.includes("import SetupLayout from '../../layouts/SetupLayout'"))
  assert.ok(!experience.includes('DesktopLayout'))
  assert.ok(setupLayout.includes('Vamos configurar seu condomínio'))
  assert.ok(!setupLayout.includes('Condomínio Parque das Flores'))
  assert.ok(gate.includes('apiEnabled()'))
  assert.match(styles, /\.setup-area-option:focus-within/)
  for (const step of ['Dados do condomínio', 'Modelo residencial', 'Torres', 'Prévia das unidades', 'Áreas comuns', 'Resumo']) assert.ok(wizard.includes(step))
})
