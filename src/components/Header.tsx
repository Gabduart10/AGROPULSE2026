import { useEffect, useRef, useState } from 'react'
import { Bell, LogOut, Building2, X, CheckCheck, AlertTriangle, Package, Calendar, CreditCard } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface Notificacao {
  id: number
  tipo: string
  prioridade: 'alta' | 'media' | 'baixa'
  titulo: string
  mensagem: string
  data: string
}

const TIPO_ICON: Record<string, React.ReactNode> = {
  estoque_baixo:       <Package size={14} />,
  validade_lote:       <AlertTriangle size={14} />,
  conta_vencer:        <CreditCard size={14} />,
  boleto_vencer:       <CreditCard size={14} />,
  cliente_inadimplente:<CreditCard size={14} />,
  cliente_sem_comprar: <Calendar size={14} />,
  aniversario:         <Calendar size={14} />,
  pedido_retido:       <AlertTriangle size={14} />,
  pedido_aprovado:     <CheckCheck size={14} />,
  pedido_expirado:     <AlertTriangle size={14} />,
  meta_atingida:       <CheckCheck size={14} />,
}

const PRIORIDADE_COLOR: Record<string, string> = {
  alta:  'text-red-500 bg-red-50 border-red-100',
  media: 'text-amber-600 bg-amber-50 border-amber-100',
  baixa: 'text-blue-500 bg-blue-50 border-blue-100',
}

const MOCK_NOTIFICACOES: Notificacao[] = [
  { id: 1, tipo: 'estoque_baixo',  prioridade: 'alta',  titulo: 'Estoque crítico',         mensagem: 'Herbicida X está abaixo do mínimo (3 un).', data: '24/04/2026 08:00' },
  { id: 2, tipo: 'conta_vencer',   prioridade: 'media', titulo: 'Conta vence em 2 dias',   mensagem: 'Fatura Fornecedor Y — R$ 4.200,00.',         data: '24/04/2026 07:30' },
  { id: 3, tipo: 'pedido_retido',  prioridade: 'alta',  titulo: 'Pedido retido',            mensagem: 'Pedido #1042 aguarda aprovação de gerente.', data: '23/04/2026 17:15' },
  { id: 4, tipo: 'aniversario',    prioridade: 'baixa', titulo: 'Aniversário hoje',         mensagem: 'Cliente João Silva faz aniversário hoje.',  data: '24/04/2026 06:00' },
]

export default function Header() {
  const { user, logout } = useAuth()

  const [notificacoes, setNotificacoes]   = useState<Notificacao[]>([])
  const [aberto, setAberto]               = useState(false)
  const [carregando, setCarregando]       = useState(false)
  const dropdownRef                        = useRef<HTMLDivElement>(null)

  const naoLidas = notificacoes.length

  function buscarNotificacoes() {
    setCarregando(true)
    const token = localStorage.getItem('access_token')
    fetch(`${API}/api/notificacoes/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setNotificacoes(Array.isArray(data) ? data : []))
      .catch(() => setNotificacoes(MOCK_NOTIFICACOES))
      .finally(() => setCarregando(false))
  }

  useEffect(() => {
    buscarNotificacoes()
    const intervalo = setInterval(buscarNotificacoes, 60_000)
    return () => clearInterval(intervalo)
  }, [])

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => document.removeEventListener('mousedown', handleClickFora)
  }, [])

  function marcarLida(id: number) {
    const token = localStorage.getItem('access_token')
    fetch(`${API}/api/notificacoes/${id}/lida/`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {})
    setNotificacoes(prev => prev.filter(n => n.id !== id))
  }

  function marcarTodasLidas() {
    const token = localStorage.getItem('access_token')
    fetch(`${API}/api/notificacoes/marcar-todas-lidas/`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {})
    setNotificacoes([])
  }

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
      {/* Esquerda: empresa + badge */}
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

      {/* Direita: sino + usuário + logout */}
      <div className="flex items-center gap-3">

        {/* Sino */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setAberto(v => !v)}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-card2 text-text-muted hover:text-accent transition-colors"
          >
            <Bell size={18} />
            {naoLidas > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {naoLidas > 99 ? '99+' : naoLidas}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {aberto && (
            <div className="absolute right-0 top-11 w-80 bg-card border border-border rounded-xl shadow-xl z-50 flex flex-col overflow-hidden">
              {/* Cabeçalho */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold text-text-primary">
                  Notificações {naoLidas > 0 && <span className="text-text-muted font-normal">({naoLidas})</span>}
                </span>
                {naoLidas > 0 && (
                  <button
                    onClick={marcarTodasLidas}
                    className="flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <CheckCheck size={12} /> Marcar todas como lidas
                  </button>
                )}
              </div>

              {/* Lista */}
              <div className="overflow-y-auto max-h-[360px]">
                {carregando && notificacoes.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-8">Carregando...</p>
                ) : notificacoes.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-2 text-text-muted">
                    <Bell size={28} strokeWidth={1.2} />
                    <p className="text-xs">Nenhuma notificação</p>
                  </div>
                ) : (
                  notificacoes.map(n => (
                    <div
                      key={n.id}
                      className={`flex gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-card2 transition-colors group`}
                    >
                      {/* Ícone de tipo */}
                      <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border ${PRIORIDADE_COLOR[n.prioridade]}`}>
                        {TIPO_ICON[n.tipo] ?? <Bell size={14} />}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-text-primary leading-tight">{n.titulo}</p>
                        <p className="text-xs text-text-muted mt-0.5 leading-snug">{n.mensagem}</p>
                        <p className="text-[10px] text-text-muted/60 mt-1">{n.data}</p>
                      </div>

                      {/* Botão fechar */}
                      <button
                        onClick={() => marcarLida(n.id)}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all mt-0.5"
                        title="Marcar como lida"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Usuário */}
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
