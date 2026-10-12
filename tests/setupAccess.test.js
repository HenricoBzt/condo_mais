import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  SETUP_ACCESS,
  SETUP_CONFIRMATION,
  decideSetupAccess,
  resolveCurrentSetupAccess,
} from '../src/features/setupWizard/setupAccess.js'

const token = (claims) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode(claims)}.`
}

test('sem sessão ou token inválido direciona ao login', () => {
  assert.deepEqual(decideSetupAccess(), { status: SETUP_ACCESS.NO_SESSION, destination: '/' })
  assert.deepEqual(decideSetupAccess({ token: 'invalido' }), { status: SETUP_ACCESS.NO_SESSION, destination: '/' })
})

test('morador e portaria nunca recebem acesso ao Wizard', () => {
  assert.deepEqual(decideSetupAccess({ token: token({ perfil: 'MORADOR' }), confirmation: SETUP_CONFIRMATION.AUTHORIZED_WITHOUT_CONDOMINIUM }), { status: SETUP_ACCESS.DENIED, destination: '/morador' })
  assert.deepEqual(decideSetupAccess({ token: token({ perfil: 'PORTEIRO' }), confirmation: SETUP_CONFIRMATION.AUTHORIZED_WITHOUT_CONDOMINIUM }), { status: SETUP_ACCESS.DENIED, destination: '/portaria' })
})

test('administrador com condomínio confirmado volta ao Dashboard', () => {
  const result = decideSetupAccess({ token: token({ perfil: 'ADMIN', condominio_id: 'condo-1' }) })
  assert.deepEqual(result, { status: SETUP_ACCESS.CONFIGURED, destination: '/admin' })
})

test('ausência de condominio_id nunca é tratada como autorização', () => {
  const result = decideSetupAccess({ token: token({ perfil: 'ADMIN' }) })
  assert.deepEqual(result, { status: SETUP_ACCESS.UNKNOWN, destination: '' })
})

test('somente confirmação explícita libera administrador sem condomínio', () => {
  const result = decideSetupAccess({ token: token({ perfil: 'Administração' }), confirmation: SETUP_CONFIRMATION.AUTHORIZED_WITHOUT_CONDOMINIUM })
  assert.deepEqual(result, { status: SETUP_ACCESS.ALLOWED, destination: '' })
})

test('resolver aceita futuro adaptador normalizado sem definir contrato HTTP', async () => {
  const adminToken = token({ perfil: 'ADMIN' })
  const allowed = await resolveCurrentSetupAccess({ token: adminToken, loadConfirmation: async () => SETUP_CONFIRMATION.AUTHORIZED_WITHOUT_CONDOMINIUM })
  assert.equal(allowed.status, SETUP_ACCESS.ALLOWED)
  const configured = await resolveCurrentSetupAccess({ token: adminToken, loadConfirmation: async () => SETUP_CONFIRMATION.CONDOMINIUM_CONFIGURED })
  assert.deepEqual(configured, { status: SETUP_ACCESS.CONFIGURED, destination: '/admin' })
})

test('falha do futuro adaptador permanece erro e nunca libera o Wizard', async () => {
  const result = await resolveCurrentSetupAccess({ token: token({ perfil: 'ADMIN' }), loadConfirmation: async () => { throw new Error('Servidor indisponível') } })
  assert.equal(result.status, SETUP_ACCESS.ERROR)
  assert.equal(result.message, 'Servidor indisponível')
})

test('rota permanece protegida, fora do menu e usa layout exclusivo', async () => {
  const [app, layout, wizard, experience, setupLayout] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/layouts/DesktopLayout.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/setupWizard/verticalSetup.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/desktop/VerticalSetupWizardExperience.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/layouts/SetupLayout.jsx', import.meta.url), 'utf8'),
  ])
  assert.match(app, /<AdminSetupAccessGate><VerticalSetupWizardPage \/><\/AdminSetupAccessGate>/)
  assert.ok(app.includes('/admin/configuracao-inicial'))
  assert.ok(!layout.includes('/admin/configuracao-inicial'))
  assert.ok(experience.includes("import SetupLayout from '../../layouts/SetupLayout'"))
  assert.ok(!experience.includes('DesktopLayout'))
  assert.ok(setupLayout.includes('Vamos configurar seu condomínio'))
  assert.ok(!setupLayout.includes('Condomínio Parque das Flores'))
  for (const step of ['Dados do condomínio', 'Modelo residencial', 'Torres', 'Prévia das unidades', 'Áreas comuns', 'Resumo']) assert.ok(wizard.includes(step))
})
