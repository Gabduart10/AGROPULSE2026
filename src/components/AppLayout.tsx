import { Outlet, useNavigate } from 'react-router-dom'
import { Shield, X } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'

function BannerSuperHost() {
  const navigate  = useNavigate()
  const empresaId = localStorage.getItem('superhost_empresa_id')
  const nome      = localStorage.getItem('superhost_empresa_nome') ?? 'cliente'

  if (!empresaId) return null

  function sair() {
    localStorage.removeItem('superhost_empresa_id')
    localStorage.removeItem('superhost_empresa_nome')
    navigate('/superhost')
  }

  return (
    <div className="flex items-center justify-between bg-purple-600 text-white px-6 py-2 text-xs font-medium flex-shrink-0">
      <div className="flex items-center gap-2">
        <Shield size={13} />
        <span>Modo SuperHost — visualizando ambiente de <strong>{nome}</strong></span>
      </div>
      <button
        onClick={sair}
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded transition-colors"
      >
        <X size={12} /> Sair do ambiente
      </button>
    </div>
  )
}

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <BannerSuperHost />
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-bg">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
