import { formatCpf } from '../../services/authApi.js'

const digits = (value = '') => String(value).replace(/\D/g, '')

export function formatCnpj(value = '') {
  return digits(value).slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\/\d{4})(\d)/, '$1-$2')
}

function validCheckDigits(value, length, calculate) {
  const normalized = digits(value)
  if (normalized.length !== length || /^(\d)\1+$/.test(normalized)) return false
  return calculate(normalized.slice(0, length - 2)) === normalized
}

export function isValidCpf(value = '') {
  return validCheckDigits(value, 11, (base) => {
    let current = base
    for (let position = 9; position <= 10; position += 1) {
      let sum = 0
      for (let index = 0; index < position; index += 1) sum += Number(current[index]) * (position + 1 - index)
      current += String((sum * 10) % 11 % 10)
    }
    return current
  })
}

export function isValidCnpj(value = '') {
  return validCheckDigits(value, 14, (base) => {
    const digit = (current, weights) => {
      const sum = weights.reduce((total, weight, index) => total + Number(current[index]) * weight, 0)
      const remainder = sum % 11
      return remainder < 2 ? 0 : 11 - remainder
    }
    const first = digit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    const secondBase = `${base}${first}`
    const second = digit(secondBase, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    return `${secondBase}${second}`
  })
}

export const initialPlatformRegistration = Object.freeze({
  condominiumName: '',
  cnpj: '',
  administratorName: '',
  cpf: '',
  email: '',
  phone: '',
})

export function validatePlatformRegistration(values, condominiums = []) {
  const errors = {}
  const condominiumName = String(values.condominiumName || '').trim()
  const administratorName = String(values.administratorName || '').trim()
  const email = String(values.email || '').trim()
  const phone = String(values.phone || '').trim()
  const cnpjDigits = digits(values.cnpj)

  if (!condominiumName) errors.condominiumName = 'Informe o nome do condomínio.'
  else if (condominiumName.length > 255) errors.condominiumName = 'Use no máximo 255 caracteres.'

  if (!cnpjDigits) errors.cnpj = 'Informe o CNPJ do condomínio.'
  else if (!isValidCnpj(cnpjDigits)) errors.cnpj = 'Informe um CNPJ válido.'

  if (!administratorName) errors.administratorName = 'Informe o nome do primeiro administrador.'
  else if (administratorName.length > 255) errors.administratorName = 'Use no máximo 255 caracteres.'

  if (!digits(values.cpf)) errors.cpf = 'Informe o CPF do primeiro administrador.'
  else if (!isValidCpf(values.cpf)) errors.cpf = 'Informe um CPF válido.'

  if (email.length > 255) errors.email = 'Use no máximo 255 caracteres.'
  else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Informe um e-mail válido.'

  if (phone.length > 20) errors.phone = 'Use no máximo 20 caracteres.'
  return errors
}

export function platformRegistrationWarnings(values, condominiums = []) {
  const cnpjDigits = digits(values.cnpj)
  if (isValidCnpj(cnpjDigits) && condominiums.some((item) => digits(item?.cnpj) === cnpjDigits)) {
    return { cnpj: 'Já existe um condomínio com este CNPJ na listagem consultada. Você ainda pode enviar o cadastro; o servidor fará a verificação final.' }
  }
  return {}
}

export function buildPlatformRegistrationPayload(values) {
  const optional = (value) => String(value || '').trim() || null
  return {
    condominio: {
      nome: String(values.condominiumName || '').trim(),
      cnpj: formatCnpj(values.cnpj),
    },
    admin: {
      nome: String(values.administratorName || '').trim(),
      cpf: formatCpf(values.cpf),
      email: optional(values.email),
      telefone: optional(values.phone),
    },
  }
}
