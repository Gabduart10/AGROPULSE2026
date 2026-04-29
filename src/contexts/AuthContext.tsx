import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface User {
  id: number
  nome: string
  email: string
  nivel: string
  empresa_id: number | null
  empresa_nome: string | null
  tipo_negocio: 'revenda' | 'industria' | null
  is_superhost: boolean
  is_matriz?: boolean
  is_filial?: boolean
}

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string, totpCode?: string) => Promise<'ok' | 'requires_2fa'>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('user_data')
    if (saved) {
      setUser(JSON.parse(saved))
    }
    setLoading(false)
  }, [])

  async function login(email: string, password: string, totpCode?: string): Promise<'ok' | 'requires_2fa'> {
    const payload: Record<string, string> = { username: email, password }
    if (totpCode) payload.totp_code = totpCode

    const { data } = await axios.post(`${BASE}/api/auth/login/`, payload)

    if (data.requires_2fa) {
      return 'requires_2fa'
    }

    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)

    const u = data.usuario
    const userData: User = {
      id: u.id,
      nome: u.nome,
      email: u.email,
      nivel: u.nivel,
      empresa_id: u.empresa_id ?? null,
      empresa_nome: u.empresa_nome ?? null,
      tipo_negocio: u.tipo_negocio ?? null,
      is_superhost: u.nivel === 'superhost' || !!u.is_superhost,
      is_matriz: u.is_matriz ?? false,
      is_filial: u.is_filial ?? false,
    }

    localStorage.setItem('user_data', JSON.stringify(userData))
    setUser(userData)
    return 'ok'
  }

  async function logout() {
    try {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        const token = localStorage.getItem('access_token')
        await axios.post(
          `${BASE}/api/auth/logout/`,
          { refresh },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      }
    } catch {
      // logout local mesmo se o servidor falhar
    } finally {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user_data')
      localStorage.removeItem('superhost_empresa_id')
      setUser(null)
      window.location.href = '/login'
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
