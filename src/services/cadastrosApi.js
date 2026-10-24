import { ApiError, apiDelete, apiGet, apiPost, apiPut, condominioIdFromToken } from './api.js'
import { carregarSessaoAtual } from './sessionApi.js'

function condominioId() {
  const id = condominioIdFromToken()
  if (!id) throw new ApiError(401, 'Sessão inválida ou expirada. Entre novamente.')
  return id
}

// ApartamentoResponseDTO -> unidade das telas. owners/residents vêm dos moradores vinculados.
export function toUnit(apartamento, towerNames = {}) {
  return {
    id: apartamento.id,
    number: apartamento.numero || '',
    tower: apartamento.torreId ? towerNames[apartamento.torreId] || '' : '',
    towerId: apartamento.torreId || '',
    status: (apartamento.status || '').toUpperCase(),
    owners: [],
    residents: [],
  }
}

// UsuarioResponseDTO (perfil MORADOR) -> morador das telas
export function toResident(usuario) {
  return {
    id: usuario.id,
    name: usuario.nome || '',
    cpf: usuario.cpf || '',
    email: usuario.email || '',
    phone: usuario.telefone || '',
    tower: usuario.torreNome || '',
    unit: usuario.apartamentoNumero || '',
    unitId: usuario.apartamentoId || '',
    relation: usuario.vinculo || '',
    isOwner: usuario.vinculo === 'PROPRIETARIO',
    status: usuario.status || 'ATIVO',
    pendingFirstAccess: Boolean(usuario.primeiroAcessoPendente),
  }
}

// Preenche proprietários/moradores de cada unidade a partir dos moradores ativos
export function linkResidents(units, residents) {
  return units.map((unit) => {
    const linked = residents.filter((resident) => resident.unitId === unit.id && resident.status === 'ATIVO')
    return { ...unit, owners: linked.filter((resident) => resident.isOwner).map((resident) => resident.name), residents: linked.map((resident) => resident.name) }
  })
}

// Torres, unidades e moradores do condomínio do token. Moradores só vêm para ADMIN (403 para os demais;
// 404 em backend sem /usuarios).
export async function carregarCadastros(options) {
  const id = condominioId()
  const [torres, apartamentos, usuarios] = await Promise.all([
    apiGet('/condominios/torres', { condominioId: id }, options),
    apiGet('/condominios/apartamentos', { condominioId: id }, options),
    apiGet('/usuarios', {}, options).catch((error) => { if ([403, 404].includes(error.status)) return []; throw error }),
  ])
  const towers = torres.map((torre) => ({ id: torre.id, name: torre.nome })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const towerNames = Object.fromEntries(towers.map((tower) => [tower.id, tower.name]))
  const residents = usuarios.filter((usuario) => usuario.perfil === 'MORADOR').map(toResident)
  const units = linkResidents(apartamentos.map((apartamento) => toUnit(apartamento, towerNames)), residents)
  return { towers, units, residents }
}

// Usuário logado (GET /usuarios/me, qualquer perfil): monta a área do morador com os dados reais
export async function carregarUsuarioLogado(options) {
  const usuario = await carregarSessaoAtual(options)
  return {
    currentResident: toResident(usuario),
    condominiumName: usuario.condominioNome || '',
    profile: usuario.perfil || '',
    setupState: usuario.configuracaoInicial || '',
    condominiumModel: usuario.modeloCondominio || '',
  }
}

export async function criarTorre(nome, options) {
  if (!nome?.trim()) throw new ApiError(400, 'Informe o nome da torre.')
  return apiPost('/condominios/torres', { nome: nome.trim(), condominioId: condominioId() }, options)
}

export async function salvarUnidade(form, editingId, towers, options) {
  const tower = towers.find((item) => item.name === form.tower)
  if (!tower) throw new ApiError(400, 'Selecione uma Torre / Bloco existente.')
  const body = { numero: form.number.trim(), status: form.status, torreId: tower.id, condominioId: condominioId() }
  return editingId ? apiPut(`/condominios/apartamentos/${editingId}`, body, options) : apiPost('/condominios/apartamentos', body, options)
}

export function excluirUnidade(id, options) { return apiDelete(`/condominios/apartamentos/${id}`, options) }

export async function salvarMorador(form, editingId, units, options) {
  const unit = units.find((item) => item.tower === form.tower && item.number === String(form.unit).trim())
  if (!unit) throw new ApiError(400, 'Selecione uma unidade existente nesta Torre / Bloco.')
  const body = { nome: form.name, cpf: form.cpf, email: form.email, telefone: form.phone, perfil: 'MORADOR', apartamentoId: unit.id, vinculo: form.relation }
  return editingId ? apiPut(`/usuarios/${editingId}`, body, options) : apiPost('/usuarios', body, options)
}

export function alterarStatusMorador(id, status, options) {
  return apiPut(`/usuarios/${id}/${status === 'INATIVO' ? 'desativar' : 'ativar'}`, undefined, options)
}
