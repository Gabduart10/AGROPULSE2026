import { useEffect, useState } from 'react'
import { TrendingUp, Target, AlertTriangle, Clock } from 'lucide-react'
import { api } from '../lib/api'

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
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])

  useEffect(() => {
    api.get('/api/dashboard/')
      .then(({ data }) => {
        setKpi(data)
        setAprovacoes(data.fila_aprovacao ?? [])
        setAlertas(data.alertas ?? [])
      })
      .catch(() => {
        // mock enquanto backend estiver offline
        setKpi({ faturamento_mes: 487320, meta_percentual: 73, inadimplencia: 12450, pedidos_aguardando: 5 })
        setAprovacoes([
          { id: 1, cliente: 'Fazenda São João', valor: 'R$ 18.500', vendedor: 'Carlos', tempo: '2h' },
          { id: 2, cliente: 'Agropecuária Norte', valor: 'R$ 7.200', vendedor: 'Ana', tempo: '5h' },
        ])
        setAlertas([
          { tipo: 'Estoque', mensagem: '3 produtos abaixo do mínimo', nivel: 'warning' },
          { tipo: 'Validade', mensagem: '2 lotes vencem em 7 dias', nivel: 'danger' },
          { tipo: 'Contas', mensagem: '5 títulos vencem hoje', nivel: 'warning' },
        ])
      })
  }, [])

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

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

      {/* Two columns */}
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

        {/* Alertas */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Alertas Ativos</h2>
          {alertas.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">Sem alertas no momento</p>
          ) : (
            <div className="space-y-2">
              {alertas.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${
                    a.nivel === 'danger' ? 'bg-red-900/20 border border-red-900/40' :
                    a.nivel === 'warning' ? 'bg-amber-950/30 border border-amber-800/40' :
                    'bg-card2 border border-border'
                  }`}
                >
                  <AlertTriangle
                    size={14}
                    className={`mt-0.5 flex-shrink-0 ${
                      a.nivel === 'danger' ? 'text-red-400' :
                      a.nivel === 'warning' ? 'text-amber-300' : 'text-text-muted'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-text-secondary">{a.tipo}</p>
                    <p className="text-xs text-text-muted">{a.mensagem}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
