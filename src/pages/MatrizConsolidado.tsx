import { useEffect, useState } from 'react'
import { Building2, TrendingUp, Package, DollarSign, AlertTriangle } from 'lucide-react'
import { api } from '../lib/api'

interface Filial {
  id: number
  nome: string
  cnpj: string
  tipo: string
  faturamento_mes?: number
  pedidos_abertos?: number
  inadimplencia?: number
}

interface Consolidado {
  faturamento_total: number
  pedidos_abertos: number
  inadimplencia_total: number
  estoque_valor_total: number
  filiais: Filial[]
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function KpiCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <span className="text-accent">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary font-mono">{value}</p>
    </div>
  )
}

export default function MatrizConsolidado() {
  const [data, setData] = useState<Consolidado | null>(null)
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/matriz/consolidado/').catch(() => null),
      api.get('/api/matriz/filiais/').catch(() => null),
    ]).then(([consRes, filRes]) => {
      if (consRes) setData(consRes.data)
      if (filRes) setFiliais(filRes.data.filiais ?? [])
      if (!consRes && !filRes) {
        // mock
        setData({ faturamento_total: 1248000, pedidos_abertos: 18, inadimplencia_total: 34500, estoque_valor_total: 892000, filiais: [] })
        setFiliais([
          { id: 1, nome: 'Unidade Ribeirão Preto', cnpj: '12.345.678/0001-01', tipo: 'Revenda', faturamento_mes: 487000, pedidos_abertos: 8, inadimplencia: 12000 },
          { id: 2, nome: 'Unidade Uberlândia', cnpj: '12.345.678/0002-82', tipo: 'Revenda', faturamento_mes: 398000, pedidos_abertos: 6, inadimplencia: 9500 },
          { id: 3, nome: 'Unidade Barretos', cnpj: '12.345.678/0003-63', tipo: 'Revenda', faturamento_mes: 363000, pedidos_abertos: 4, inadimplencia: 13000 },
        ])
      }
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-text-muted">Carregando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Building2 size={20} className="text-accent" /> Visão Consolidada — Matriz
        </h1>
        <p className="text-sm text-text-muted">Agregado de todas as unidades em tempo real</p>
      </div>

      {/* KPIs consolidados */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Faturamento Total"    value={fmt(data?.faturamento_total ?? 0)}    icon={<TrendingUp size={18} />} />
        <KpiCard label="Pedidos em Aberto"    value={String(data?.pedidos_abertos ?? 0)}    icon={<Package size={18} />} />
        <KpiCard label="Inadimplência Total"  value={fmt(data?.inadimplencia_total ?? 0)}   icon={<AlertTriangle size={18} />} />
        <KpiCard label="Valor em Estoque"     value={fmt(data?.estoque_valor_total ?? 0)}   icon={<DollarSign size={18} />} />
      </div>

      {/* Tabela de filiais */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Desempenho por Unidade</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Unidade', 'CNPJ', 'Tipo', 'Faturamento Mês', 'Pedidos Abertos', 'Inadimplência'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filiais.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-text-muted text-sm">Nenhuma filial cadastrada</td></tr>
            ) : filiais.map(f => (
              <tr key={f.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                <td className="px-4 py-3 font-medium text-text-primary">{f.nome}</td>
                <td className="px-4 py-3 font-mono text-text-muted text-xs">{f.cnpj}</td>
                <td className="px-4 py-3 text-text-muted">{f.tipo}</td>
                <td className="px-4 py-3 font-mono text-text-primary">{fmt(f.faturamento_mes ?? 0)}</td>
                <td className="px-4 py-3 text-center text-text-muted">{f.pedidos_abertos ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-red-500">{fmt(f.inadimplencia ?? 0)}</td>
              </tr>
            ))}
          </tbody>
          {filiais.length > 0 && (
            <tfoot>
              <tr className="bg-card2 border-t border-border">
                <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-text-muted uppercase">Total</td>
                <td className="px-4 py-3 font-mono font-bold text-accent">{fmt(filiais.reduce((s, f) => s + (f.faturamento_mes ?? 0), 0))}</td>
                <td className="px-4 py-3 text-center font-bold text-text-primary">{filiais.reduce((s, f) => s + (f.pedidos_abertos ?? 0), 0)}</td>
                <td className="px-4 py-3 font-mono font-bold text-red-500">{fmt(filiais.reduce((s, f) => s + (f.inadimplencia ?? 0), 0))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
