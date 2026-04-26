import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

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

  const MOCK_USER: User = {
    id: 1,
    nome: 'SuperHost',
    email: 'superhost@agropulse.com',
    nivel: 'diretor',
    empresa_id: 1,
    empresa_nome: 'AgroPulse Demo',
    tipo_negocio: 'industria',
    is_superhost: true,
    is_matriz: true,
    is_filial: false,
  }

  useEffect(() => {
    const saved = localStorage.getItem('user_data')
    if (saved) setUser(JSON.parse(saved))
    setLoading(false)
  }, [])

  // DEV: aceita qualquer credencial
  async function login(_email: string, _password: string, _totpCode?: string): Promise<'ok' | 'requires_2fa'> {
    localStorage.setItem('user_data', JSON.stringify(MOCK_USER))
    setUser(MOCK_USER)
    return 'ok'
  }

  async function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_data')
    setUser(null)
    window.location.href = '/login'
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
