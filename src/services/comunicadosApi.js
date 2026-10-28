import { ApiError, apiDelete, apiGet, apiPost, apiPut } from './api.js'

export const NOTICE_ALL = 'Todo condomínio'
export const NOTICE_TOWER = 'Torre/Bloco específico'

// AvisoResponseDTO -> comunicado das telas. Publicado na hora (startDate = dia da criação);
// dataValidade nula = sem data final; vencido aparece como ENCERRADO.
export function toNotice(aviso) {
  return {
    id: aviso.id,
    title: aviso.titulo || '',
    content: aviso.conteudo || '',
    priority: String(aviso.prioridade || 'NORMAL').toUpperCase(),
    destination: aviso.torreId ? NOTICE_TOWER : NOTICE_ALL,
    tower: aviso.torreNome || '',
    startDate: String(aviso.criadoEm || '').slice(0, 10),
    endDate: aviso.dataValidade || '',
    author: aviso.autorNome || '',
    status: aviso.ativo === false ? 'ENCERRADO' : 'ATIVO',
  }
}

// Comunicados que o token pode ver: portaria/admin, todos (inclusive vencidos); morador, só os ativos dele
export async function carregarComunicados(options) {
  const avisos = await apiGet('/interativo/avisos', {}, options)
  return (avisos || []).map(toNotice)
}

// Formulário -> RegistroAvisoDTO. A torre é escolhida pelo nome entre as do condomínio.
export function noticeBody(form, towers = []) {
  const title = String(form.title || '').trim()
  const content = String(form.content || '').trim()
  if (!title || !content) throw new ApiError(400, 'Preencha o título e o conteúdo do comunicado.')
  let torreId = null
  if (form.destination === NOTICE_TOWER) {
    const tower = towers.find((item) => item.name === form.tower)
    if (!tower) throw new ApiError(400, 'Selecione uma Torre / Bloco existente.')
    torreId = tower.id
  }
  return { titulo: title, conteudo: content, prioridade: form.priority || 'NORMAL', dataValidade: form.endDate || null, torreId }
}

export function salvarComunicado(form, editingId, towers, options) {
  const body = noticeBody(form, towers)
  return editingId ? apiPut(`/interativo/avisos/${editingId}`, body, options) : apiPost('/interativo/avisos', body, options)
}

export function excluirComunicado(id, options) {
  return apiDelete(`/interativo/avisos/${id}`, options)
}
