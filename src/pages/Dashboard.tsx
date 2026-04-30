import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Target, AlertTriangle, Clock, Package, Calendar, CreditCard, Users, ArrowRight, X } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface KPI {
  faturamento_mes: number
  meta_percentual: number
  inadimplencia: number
  pedidos_aguardando: number
}

interface Aprovacao {
  id: number
  cliente: string
  valor: string
  vendedor: string
  tempo: string
}

interface Alerta {
  tipo: string
  mensagem: string
  nivel: 'warning' | 'danger' | 'info'
  icone: React.ReactNode
  rota: string
  rotaEstado?: Record<string, string>
  // níveis que podem acessar a rota destino (vazio = todos)
  niveis_permitidos: string[]
}

interface AlertasBackend {
  estoque_baixo?:        Array<{ nome?: string; urgencia?: string }>
  validade_lotes?:       Array<{ produto?: string; status?: string }>
  contas_vencer?:        Array<{ descricao?: string; status?: string }>
  contas_atrasadas?:     Array<{ cliente?: string }>
  clientes_sem_comprar?: Array<{ nome?: string; urgencia?: string }>
  aniversariantes?:      Array<{ nome?: string }>
}

function normalizarAlertas(raw: AlertasBackend): Alerta[] {
  const lista: Alerta[] = []

  const estoque = raw.estoque_baixo ?? []
  if (estoque.length > 0) {
    const critico = estoque.some(e => e.urgencia === 'critico')
    lista.push({
      tipo: 'Estoque Baixo',
      mensagem: `${estoque.length} produto${estoque.length > 1 ? 's' : ''} abaixo do mínimo`,
      nivel: critico ? 'danger' : 'warning',
      icone: <Package size={14} />,
      rota: '/estoque',
      niveis_permitidos: [], // todos os níveis têm acesso ao estoque
    })
  }

  const validade = raw.validade_lotes ?? []
  if (validade.length > 0) {
    const urgente = validade.some(v => v.status === 'vencido' || v.status === 'urgente')
    lista.push({
      tipo: 'Validade de Lotes',
      mensagem: `${validade.length} lote${validade.length > 1 ? 's' : ''} próximo${validade.length > 1 ? 's' : ''} do vencimento`,
      nivel: urgente ? 'danger' : 'warning',
      icone: <AlertTriangle size={14} />,
      rota: '/estoque',
      niveis_permitidos: [],
    })
  }

  const contasPagar = raw.contas_vencer ?? []
  if (contasPagar.length > 0) {
    const vencido = contasPagar.some(c => c.status === 'vencido' || c.status === 'hoje')
    lista.push({
      tipo: 'Contas a Pagar',
      mensagem: `${contasPagar.length} conta${contasPagar.length > 1 ? 's' : ''} vence${contasPagar.length > 1 ? 'm' : ''} em breve`,
      nivel: vencido ? 'danger' : 'warning',
      icone: <CreditCard size={14} />,
      rota: '/financeiro',
      niveis_permitidos: ['administrativo', 'gerente', 'diretor'],
    })
  }

  const atrasados = raw.contas_atrasadas ?? []
  if (atrasados.length > 0) {
    lista.push({
      tipo: 'Recebíveis Atrasados',
      mensagem: `${atrasados.length} título${atrasados.length > 1 ? 's' : ''} em atraso`,
      nivel: 'danger',
      icone: <CreditCard size={14} />,
      rota: '/cobranca',
      niveis_permitidos: ['administrativo', 'gerente', 'diretor'],
    })
  }

  const inativos = raw.clientes_sem_comprar ?? []
  if (inativos.length > 0) {
    const critico = inativos.some(c => c.urgencia === 'critico')
    lista.push({
      tipo: 'Clientes Inativos',
      mensagem: `${inativos.length} cliente${inativos.length > 1 ? 's' : ''} sem comprar há +25 dias`,
      nivel: critico ? 'danger' : 'warning',
      icone: <Users size={14} />,
      rota: '/crm',
      niveis_permitidos: ['vendedor', 'administrativo', 'gerente', 'diretor'],
    })
  }

  const aniversariantes = raw.aniversariantes ?? []
  if (aniversariantes.length > 0) {
    lista.push({
      tipo: 'Aniversariantes',
      mensagem: `${aniversariantes.length} cliente${aniversariantes.length > 1 ? 's' : ''} aniversaria${aniversariantes.length > 1 ? 'm' : ''} hoje`,
      nivel: 'info',
      icone: <Calendar size={14} />,
      rota: '/cadastros',
      rotaEstado: { tab: 'Clientes' },
      niveis_permitidos: ['vendedor', 'administrativo', 'gerente', 'diretor'],
    })
  }

  return lista
}

const MOCK_ALERTAS: AlertasBackend = {
  estoque_baixo:        [{ nome: 'Herbicida X', urgencia: 'critico' }, { nome: 'Adubo Y', urgencia: 'baixo' }, { nome: 'Fertilizante Z', urgencia: 'baixo' }],
  validade_lotes:       [{ produto: 'Defensivo A', status: 'urgente' }, { produto: 'Semente B', status: 'atencao' }],
  contas_vencer:        [{ descricao: 'Fatura Fornecedor', status: 'hoje' }, { descricao: 'Aluguel', status: 'proximo' }],
  contas_atrasadas:     [],
  clientes_sem_comprar: [{ nome: 'Fazenda Silva', urgencia: 'atencao' }],
  aniversariantes:      [{ nome: 'João Alves' }],
}

function KpiCard({ label, value, icon, sub }: { label: string; value: string; icon: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <span className="text-accent">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary font-mono">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { user }                    = useAuth()
  const navigate                    = useNavigate()
  const [kpi, setKpi]               = useState<KPI | null>(null)
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([])
  const [alertas, setAlertas]       = useState<Alerta[]>([])
  const [fechados, setFechados]     = useState<Set<number>>(new Set())

  const nivel = user?.nivel ?? ''

  useEffect(() => {
    api.get('/api/dashboard/')
      .then(({ data }) => {
        setKpi(data)
        setAprovacoes(data.fila_aprovacao ?? [])
        const rawAlertas: AlertasBackend = data.alertas ?? {}
        setAlertas(
          Array.isArray(rawAlertas) ? rawAlertas : normalizarAlertas(rawAlertas)
        )
      })
      .catch(() => {
        setKpi(null)
        setAprovacoes([])
        setAlertas([])
      })
  }, [])

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  const alertasVisiveis = alertas.filter((_, i) => !fechados.has(i))
  const totalAlertas    = alertasVisiveis.length
  const criticos        = alertasVisiveis.filter(a => a.nivel === 'danger').length

  function podeNavegar(alerta: Alerta): boolean {
    if (alerta.niveis_permitidos.length === 0) return true
    return alerta.niveis_permitidos.includes(nivel)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted">Visão geral do seu negócio</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Faturamento do Mês"
          value={kpi ? fmt(kpi.faturamento_mes) : '—'}
          icon={<TrendingUp size={18} />}
          sub="acumulado no período"
        />
        <KpiCard
          label="Meta Atingida"
          value={kpi ? `${kpi.meta_percentual}%` : '—'}
          icon={<Target size={18} />}
          sub="sobre a meta mensal"
        />
        <KpiCard
          label="Inadimplência"
          value={kpi ? fmt(kpi.inadimplencia) : '—'}
          icon={<AlertTriangle size={18} />}
          sub="títulos em atraso"
        />
        <KpiCard
          label="Pedidos Aguardando"
          value={kpi ? String(kpi.pedidos_aguardando) : '—'}
          icon={<Clock size={18} />}
          sub="aguardando aprovação"
        />
      </div>

      {/* Duas colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Fila de aprovações */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Fila de Aprovações</h2>
          {aprovacoes.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">Nenhum pedido aguardando</p>
          ) : (
            <div className="space-y-2">
              {aprovacoes.map((a) => (
                <div key={a.id} className="flex items-center justify-between bg-card2 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{a.cliente}</p>
                    <p className="text-xs text-text-muted">{a.vendedor} · há {a.tempo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-semibold text-accent">{a.valor}</p>
                    <div className="flex gap-1 mt-1">
                      <button className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded hover:bg-accent/30 transition-colors">Aprovar</button>
                      <button className="text-xs bg-red-900/20 text-red-400 px-2 py-0.5 rounded hover:bg-red-900/30 transition-colors">Recusar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas Ativos */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Alertas Ativos</h2>
            {totalAlertas > 0 && (
              <div className="flex items-center gap-2">
                {criticos > 0 && (
                  <span className="text-[10px] font-semibold bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full">
                    {criticos} crítico{criticos > 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-[10px] text-text-muted">{totalAlertas} total</span>
              </div>
            )}
          </div>

          {alertasVisiveis.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">Sem alertas no momento</p>
          ) : (
            <div className="space-y-2">
              {alertas.map((a, i) => {
                if (fechados.has(i)) return null
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${
                      a.nivel === 'danger'  ? 'bg-red-900/20 border-red-900/40' :
                      a.nivel === 'warning' ? 'bg-amber-950/30 border-amber-800/40' :
                      'bg-card2 border-border'
                    }`}
                  >
                    {/* Ícone */}
                    <span className={`flex-shrink-0 ${
                      a.nivel === 'danger'  ? 'text-red-400' :
                      a.nivel === 'warning' ? 'text-amber-300' :
                      'text-blue-400'
                    }`}>
                      {a.icone}
                    </span>

                    {/* Texto */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-text-secondary">{a.tipo}</p>
                      <p className="text-xs text-text-muted">{a.mensagem}</p>
                    </div>

                    {/* Botão Ver — só aparece se o nível tem permissão */}
                    {podeNavegar(a) && (
                      <button
                        onClick={() => navigate(a.rota, { state: a.rotaEstado })}
                        className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                          a.nivel === 'danger'
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : a.nivel === 'warning'
                            ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                            : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                        }`}
                      >
                        Ver <ArrowRight size={11} />
                      </button>
                    )}

                    {/* Fechar */}
                    <button
                      onClick={() => setFechados(prev => new Set(prev).add(i))}
                      className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
