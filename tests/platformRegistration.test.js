import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPlatformRegistrationPayload, formatCnpj, isValidCnpj, isValidCpf, platformRegistrationWarnings, validatePlatformRegistration } from '../src/features/platform/platformRegistration.js'

const valid = {
  condominiumName: '  Residencial Aurora  ',
  cnpj: '04.252.011/0001-10',
  administratorName: '  Maria Souza  ',
  cpf: '529.982.247-25',
  email: '  maria@exemplo.com  ',
  phone: '  +55 11 99999-9999  ',
}

test('máscara de CNPJ é progressiva, limita 14 dígitos e aceita entrada pontuada', () => {
  assert.equal(formatCnpj('0'), '0')
  assert.equal(formatCnpj('04252011'), '04.252.011')
  assert.equal(formatCnpj('04.252.011/0001-10'), '04.252.011/0001-10')
  assert.equal(formatCnpj('04252011000110999'), '04.252.011/0001-10')
})

test('valida dígitos verificadores de CPF e CNPJ e rejeita sequências repetidas', () => {
  assert.equal(isValidCnpj('04.252.011/0001-10'), true)
  assert.equal(isValidCnpj('04.252.011/0001-11'), false)
  assert.equal(isValidCnpj('00.000.000/0000-00'), false)
  assert.equal(isValidCpf('529.982.247-25'), true)
  assert.equal(isValidCpf('529.982.247-24'), false)
  assert.equal(isValidCpf('111.111.111-11'), false)
})

test('valida obrigatórios, limites e opcionais sem bloquear possível duplicidade local', () => {
  const required = validatePlatformRegistration({}, [])
  assert.deepEqual(Object.keys(required).sort(), ['administratorName', 'cnpj', 'condominiumName', 'cpf'])

  assert.deepEqual(validatePlatformRegistration({ ...valid, email: '', phone: '' }), {})
  assert.match(validatePlatformRegistration({ ...valid, email: 'invalido' }).email, /e-mail válido/)
  assert.match(validatePlatformRegistration({ ...valid, phone: '1'.repeat(21) }).phone, /20/)
  assert.match(validatePlatformRegistration({ ...valid, condominiumName: 'x'.repeat(256) }).condominiumName, /255/)
  assert.match(validatePlatformRegistration({ ...valid, administratorName: 'x'.repeat(256) }).administratorName, /255/)
  assert.match(validatePlatformRegistration({ ...valid, email: `${'x'.repeat(246)}@teste.com` }).email, /255/)
  assert.deepEqual(validatePlatformRegistration(valid, [{ cnpj: '04252011000110' }]), {})
  assert.match(platformRegistrationWarnings(valid, [{ cnpj: '04252011000110' }]).cnpj, /servidor fará a verificação final/)
  assert.deepEqual(platformRegistrationWarnings({ ...valid, cnpj: '04.252.011/0001-11' }, [{ cnpj: '04.252.011/0001-11' }]), {})
})

test('monta o payload exato com documentos formatados, trim e opcionais nulos', () => {
  assert.deepEqual(buildPlatformRegistrationPayload({ ...valid, cnpj: '04252011000110', cpf: '52998224725', email: ' ', phone: '' }), {
    condominio: { nome: 'Residencial Aurora', cnpj: '04.252.011/0001-10' },
    admin: { nome: 'Maria Souza', cpf: '529.982.247-25', email: null, telefone: null },
  })
  assert.deepEqual(buildPlatformRegistrationPayload(valid).admin, {
    nome: 'Maria Souza', cpf: '529.982.247-25', email: 'maria@exemplo.com', telefone: '+55 11 99999-9999',
  })
})
