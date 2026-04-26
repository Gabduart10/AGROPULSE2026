import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut } from 'lucide-react'

export default function SuperHostLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 bg-card border-b border-border flex-shrink-0">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('/superhost')}
        >
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-bg font-bold text-sm">A</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">AgroPulse</span>
            <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-600/30 px-2 py-0.5 rounded-full font-medium">
              SuperHost
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <span className="text-xs text-text-muted">{user.nome}</span>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
