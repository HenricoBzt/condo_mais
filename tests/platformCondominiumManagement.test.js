import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCondominiumEditPayload,
  condominiumEditValues,
  condominiumEditWarnings,
  validateCondominiumEdit,
} from '../src/features/platform/platformCondominiumManagement.js'

const firstId = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'

test('pré-preenche e monta somente nome e CNPJ formatado', () => {
  const values = condominiumEditValues({ nome: 'Residencial Aurora', cnpj: '04252011000110', status: 'ATIVO' })
  assert.deepEqual(values, { condominiumName: 'Residencial Aurora', cnpj: '04.252.011/0001-10' })
  assert.deepEqual(buildCondominiumEditPayload({ condominiumName: '  Novo nome  ', cnpj: '04252011000110', status: 'INATIVO' }), {
    nome: 'Novo nome',
    cnpj: '04.252.011/0001-10',
  })
})

test('valida nome, limite e dígitos verificadores do CNPJ', () => {
  assert.deepEqual(validateCondominiumEdit({ condominiumName: '', cnpj: '' }), {
    condominiumName: 'Informe o nome do condomínio.',
    cnpj: 'Informe o CNPJ do condomínio.',
  })
  assert.equal(validateCondominiumEdit({ condominiumName: 'A'.repeat(256), cnpj: '11.111.111/1111-11' }).condominiumName, 'Use no máximo 255 caracteres.')
  assert.equal(validateCondominiumEdit({ condominiumName: 'Aurora', cnpj: '11.111.111/1111-11' }).cnpj, 'Informe um CNPJ válido.')
  assert.deepEqual(validateCondominiumEdit({ condominiumName: 'Aurora', cnpj: '04.252.011/0001-10' }), {})
})

test('duplicidade local ignora máscara e o próprio condomínio sem bloquear o envio', () => {
  const condominiums = [
    { id: firstId, cnpj: '04.252.011/0001-10' },
    { id: secondId, cnpj: '11222333000181' },
  ]
  assert.deepEqual(condominiumEditWarnings({ cnpj: '04252011000110' }, condominiums, firstId), {})
  const warnings = condominiumEditWarnings({ cnpj: '11.222.333/0001-81' }, condominiums, firstId)
  assert.match(warnings.cnpj, /Você ainda pode enviar a alteração/)
  assert.deepEqual(validateCondominiumEdit({ condominiumName: 'Aurora', cnpj: '11.222.333/0001-81' }), {})
})
