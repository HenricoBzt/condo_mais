import { formatCnpj, isValidCnpj } from './platformRegistration.js'

const digits = (value = '') => String(value).replace(/\D/g, '')

export function condominiumEditValues(condominium = {}) {
  return {
    condominiumName: String(condominium.nome || ''),
    cnpj: formatCnpj(condominium.cnpj || ''),
  }
}

export function validateCondominiumEdit(values = {}) {
  const errors = {}
  const condominiumName = String(values.condominiumName || '').trim()
  const cnpjDigits = digits(values.cnpj)

  if (!condominiumName) errors.condominiumName = 'Informe o nome do condomínio.'
  else if (condominiumName.length > 255) errors.condominiumName = 'Use no máximo 255 caracteres.'

  if (!cnpjDigits) errors.cnpj = 'Informe o CNPJ do condomínio.'
  else if (!isValidCnpj(cnpjDigits)) errors.cnpj = 'Informe um CNPJ válido.'

  return errors
}

export function condominiumEditWarnings(values = {}, condominiums = [], currentId = '') {
  const cnpjDigits = digits(values.cnpj)
  const duplicated = isValidCnpj(cnpjDigits) && condominiums.some((item) => (
    String(item?.id || '') !== String(currentId || '') && digits(item?.cnpj) === cnpjDigits
  ))
  if (!duplicated) return {}
  return {
    cnpj: 'Já existe outro condomínio com este CNPJ na listagem consultada. Você ainda pode enviar a alteração; o servidor fará a verificação final.',
  }
}

export function buildCondominiumEditPayload(values = {}) {
  return {
    nome: String(values.condominiumName || '').trim(),
    cnpj: formatCnpj(values.cnpj),
  }
}
