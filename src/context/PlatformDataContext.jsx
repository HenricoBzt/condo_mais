import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { normalizePlatformCondominium, normalizePlatformCondominiums } from '../features/platform/platformData.js'
import { ApiError, apiEnabled, getToken } from '../services/api.js'
import { buscarCondominioPlataforma, criarCondominioPlataforma, listarCondominiosPlataforma } from '../services/platformApi.js'
import { subscribeToSessionChanges } from '../services/sessionEvents.js'

const PlatformDataContext = createContext(null)
const initialList = { status: 'idle', error: '', items: [] }

export function PlatformDataProvider({
  children,
  listLoader = listarCondominiosPlataforma,
  detailLoader = buscarCondominioPlataforma,
  createLoader = criarCondominioPlataforma,
  apiActive = apiEnabled(),
}) {
  const [list, setList] = useState(initialList)
  const [details, setDetails] = useState({})
  const [sessionRevision, setSessionRevision] = useState(0)
  const generation = useRef(0)
  const listRequest = useRef(0)
  const detailRequests = useRef({})
  const createRequest = useRef(0)
  const createPending = useRef(false)
  const providerMounted = useRef(true)
  const listRef = useRef(list)
  const detailsRef = useRef(details)
  listRef.current = list
  detailsRef.current = details

  useEffect(() => {
    providerMounted.current = true
    return () => {
      providerMounted.current = false
      generation.current += 1
      listRequest.current += 1
      detailRequests.current = {}
      createRequest.current += 1
      createPending.current = false
    }
  }, [])

  const clearForSessionChange = useCallback(() => {
    generation.current += 1
    listRequest.current += 1
    detailRequests.current = {}
    createRequest.current += 1
    createPending.current = false
    setList(initialList)
    setDetails({})
    setSessionRevision((current) => current + 1)
  }, [])

  useEffect(() => subscribeToSessionChanges(clearForSessionChange), [clearForSessionChange])

  const loadList = useCallback(async () => {
    const token = getToken()
    const request = ++listRequest.current
    const currentGeneration = generation.current
    setList({ status: 'loading', error: '', items: [] })
    if (!apiActive) {
      setList({ status: 'error', error: 'Não foi possível conectar o painel MASTER à API.', items: [] })
      return
    }
    try {
      const response = await listLoader()
      if (request !== listRequest.current || currentGeneration !== generation.current || token !== getToken()) return
      setList({ status: 'success', error: '', items: normalizePlatformCondominiums(response) })
    } catch (error) {
      if (request !== listRequest.current || currentGeneration !== generation.current || token !== getToken()) return
      setList({ status: 'error', error: error?.message || 'Não foi possível carregar os condomínios.', items: [] })
    }
  }, [apiActive, listLoader])

  useEffect(() => { loadList() }, [loadList, sessionRevision])

  const loadDetail = useCallback(async (id, { force = false } = {}) => {
    const key = String(id || '').trim()
    if (!key) return
    if (!force && detailsRef.current[key]?.status === 'success') return
    const token = getToken()
    const currentGeneration = generation.current
    const request = (detailRequests.current[key] || 0) + 1
    detailRequests.current[key] = request
    setDetails((current) => ({ ...current, [key]: { status: 'loading', error: '', item: null } }))
    if (!apiActive) {
      setDetails((current) => ({ ...current, [key]: { status: 'error', error: 'Não foi possível conectar o painel MASTER à API.', item: null } }))
      return
    }
    try {
      const response = await detailLoader(key)
      if (request !== detailRequests.current[key] || currentGeneration !== generation.current || token !== getToken()) return
      setDetails((current) => ({ ...current, [key]: { status: 'success', error: '', item: normalizePlatformCondominium(response) } }))
    } catch (error) {
      if (request !== detailRequests.current[key] || currentGeneration !== generation.current || token !== getToken()) return
      setDetails((current) => ({ ...current, [key]: { status: 'error', error: error?.message || 'Não foi possível carregar o condomínio.', item: null } }))
    }
  }, [apiActive, detailLoader])

  const createCondominium = useCallback(async (payload) => {
    if (createPending.current) throw new ApiError(409, 'Já existe um cadastro em andamento.')
    if (!apiActive) throw new ApiError(0, 'Não foi possível conectar o painel MASTER à API.')
    const token = getToken()
    const currentGeneration = generation.current
    const request = ++createRequest.current
    createPending.current = true
    try {
      const response = await createLoader(payload)
      if (!providerMounted.current || request !== createRequest.current || currentGeneration !== generation.current || token !== getToken()) {
        throw new ApiError(409, 'A sessão mudou durante o cadastro. Consulte a listagem antes de tentar novamente.')
      }
      const item = normalizePlatformCondominium(response)
      const listWasReady = listRef.current.status === 'success'
      setDetails((current) => ({ ...current, [item.id]: { status: 'success', error: '', item } }))
      if (listWasReady) {
        setList((current) => ({
          status: 'success',
          error: '',
          items: [...current.items.filter((entry) => entry.id !== item.id), item]
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
        }))
      } else {
        void loadList()
      }
      return item
    } catch (error) {
      if (!providerMounted.current || request !== createRequest.current || currentGeneration !== generation.current || token !== getToken()) {
        throw new ApiError(409, 'A sessão mudou durante o cadastro. Consulte a listagem antes de tentar novamente.')
      }
      throw error
    } finally {
      if (request === createRequest.current) createPending.current = false
    }
  }, [apiActive, createLoader, loadList])

  const value = useMemo(() => ({
    condominiums: list.items,
    listStatus: list.status,
    listError: list.error,
    retryList: loadList,
    detailState: (id) => details[id] || { status: 'idle', error: '', item: null },
    loadDetail,
    createCondominium,
  }), [createCondominium, details, list, loadDetail, loadList])

  return <PlatformDataContext.Provider value={value}>{children}</PlatformDataContext.Provider>
}

export function usePlatformData() {
  const value = useContext(PlatformDataContext)
  if (!value) throw new Error('usePlatformData precisa estar dentro de PlatformDataProvider')
  return value
}
