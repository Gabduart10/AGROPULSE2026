/// <reference types="vite/client" />
import axios from 'axios'
import type { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'

// O resto do código (const BASE = ...) continua exatamente igual para baixo!
// Atualizamos o fallback para o seu servidor do Railway!
const BASE = import.meta.env.VITE_API_URL ?? 'https://web-production-e97062.up.railway.app'

export const api = axios.create({ baseURL: BASE })

// Tipamos o 'config'
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Aqui ele pega o crachá do usuário logado
  const token = localStorage.getItem('access_token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // SuperHost: injeta empresa_id em toda requisição quando está acessando um cliente
  const empresaId = localStorage.getItem('superhost_empresa_id')
  if (empresaId && config.params) {
    config.params = { ...config.params, empresa_id: empresaId }
  } else if (empresaId) {
    config.params = { empresa_id: empresaId }
  }

  return config
})

// Tipamos o 'r' e o 'err'
api.interceptors.response.use(
  (r: AxiosResponse) => r,
  async (err: AxiosError) => {
    // Criamos um tipo personalizado rápido para aceitar o _retry
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    if (err.response?.status === 401 && original && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE}/api/auth/refresh/`, { refresh })
          localStorage.setItem('access_token', data.access)
          
          if (original.headers) {
            original.headers.Authorization = `Bearer ${data.access}`
          }
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)
