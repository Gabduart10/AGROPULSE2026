import { Bell, LogOut, Building2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: empresa + badge */}
      <div className="flex items-center gap-3">
        <div>
          <p className="text-xs text-text-muted">Empresa</p>
          <p className="text-sm font-semibold text-text-primary">{user?.empresa_nome ?? '—'}</p>
        </div>
        {user?.is_matriz && (
          <span className="flex items-center gap-1 text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full font-medium">
            <Building2 size={11} /> Matriz
          </span>
        )}
        {user?.is_filial && (
          <span className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
            <Building2 size={11} /> Filial
          </span>
        )}
        {user?.is_superhost && (
          <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
            SuperHost
          </span>
        )}
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-3">
        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-card2 text-text-muted hover:text-accent transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
            <span className="text-accent text-xs font-bold">
              {user?.nome?.charAt(0).toUpperCase() ?? 'U'}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-text-primary leading-tight">{user?.nome}</p>
            <p className="text-xs text-text-muted capitalize">{user?.nivel}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors"
          title="Sair"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
