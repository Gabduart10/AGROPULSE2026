import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  children: React.ReactNode
  requireSuperHost?: boolean
}

export default function ProtectedRoute({ children, requireSuperHost }: Props) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center text-accent">Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  if (requireSuperHost && !user.is_superhost) return <Navigate to="/" replace />
  return <>{children}</>
}
