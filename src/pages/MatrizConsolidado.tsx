import { useEffect, useState } from 'react'
import { Building2, TrendingUp, Package, DollarSign, AlertTriangle, CreditCard, ChevronRight, ArrowLeft, Users, ShoppingCart } from 'lucide-react'
import { api } from '../lib/api'

const fmt  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtN = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

// ─── tipos ────────────────────────────────────────────────────────────────────

interface Indicadores {
  faturamento_mes: number
  pedidos_mes: number
  pedidos_abertos: number
  ticket_medio: number
  a_receber: number
  inadimplencia: number
  a_pagar: number
  saldo_liquido: number
  estoque_valor: number
}

interface Unidade extends Indicadores {
  id: number
  nome: string
  cnpj: string
  tipo: string
  is_matriz: boolean
}

interface Consolidado extends Indicadores {
  pedidos_mes: number
}

interface ConsolidadoResp {
  matriz: string
  total_unidades: number
  consolidado: Consolidado
  por_unidade: Unidade[]
}

interface PedidoDetalhe  { id: number; cliente: string; valor_total: number; data_pedido: string }
interface ContaDetalhe   { descricao: string; cliente?: string; fornecedor?: string; valor: number; vencimento: string }

interface FilialDetalhe extends Unidade {
  ultimos_pedidos: PedidoDetalhe[]
  inadimplentes:   ContaDetalhe[]
  contas_vencer:   ContaDetalhe[]
}

// ─── mocks ───────────────────────────────────────────────────────────────────

const MOCK_CONSOLIDADO: ConsolidadoResp = {
  matriz: 'AgroPulse Demo',
  total_unidades: 3,
  consolidado: {
    faturamento_mes: 1248000, pedidos_mes: 84, pedidos_abertos: 18,
    ticket_medio: 14857, a_receber: 320000, inadimplencia: 34500,
    a_pagar: 185000, saldo_liquido: 135000, estoque_valor: 892000,
  },
  por_unidade: [
    { id: 1, nome: 'Matriz — Goiânia',    cnpj: '12.345.678/0001-01', tipo: 'Revenda', is_matriz: true,  faturamento_mes: 487000, pedidos_mes: 33, pedidos_abertos: 8,  ticket_medio: 14757, a_receber: 125000, inadimplencia: 12000, a_pagar: 72000, saldo_liquido: 53000, estoque_valor: 380000 },
    { id: 2, nome: 'Filial — Jataí',      cnpj: '12.345.678/0002-82', tipo: 'Revenda', is_matriz: false, faturamento_mes: 398000, pedidos_mes: 27, pedidos_abertos: 6,  ticket_medio: 14741, a_receber: 102000, inadimplencia:  9500, a_pagar: 60000, saldo_liquido: 42000, estoque_valor: 290000 },
    { id: 3, nome: 'Filial — Rio Verde',  cnpj: '12.345.678/0003-63', tipo: 'Revenda', is_matriz: false, faturamento_mes: 363000, pedidos_mes: 24, pedidos_abertos: 4,  ticket_medio: 15125, a_receber:  93000, inadimplencia: 13000, a_pagar: 53000, saldo_liquido: 40000, estoque_valor: 222000 },
  ],
}

const MOCK_DETALHE: FilialDetalhe | null = null

// ─── sub-componentes ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, cor }: { label: string; value: string; sub?: string; icon: React.ReactNode; cor?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <span className={cor ?? 'text-accent'}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary font-mono">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-card2'
      }`}
    >
      {children}
    </button>
  )
}

// ─── painel de detalhe de uma unidade ────────────────────────────────────────

function PainelFilial({ filialId, onVoltar }: { filialId: number; onVoltar: () => void }) {
  const [dados, setDados] = useState<FilialDetalhe | null>(null)
  const [aba, setAba]     = useState<'vendas' | 'financeiro'>('vendas')

  useEffect(() => {
    api.get(`/api/matriz/filial/${filialId}/detalhe/`)
      .then(r => setDados(r.data))
      .catch(() => setDados(null))
  }, [filialId])

  if (!dados) return <div className="text-center py-20 text-text-muted text-sm">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onVoltar} className="flex items-center gap-1 text-sm text-text-muted hover:text-accent transition-colors">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div>
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Building2 size={18} className="text-accent" /> {dados.nome}
            {dados.is_matriz && <span className="text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full">Matriz</span>}
          </h2>
          <p className="text-xs text-text-muted">{dados.cnpj} · {dados.tipo}</p>
        </div>
      </div>

      {/* KPIs da unidade */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Faturamento do Mês" value={fmt(dados.faturamento_mes)} icon={<TrendingUp size={16} />} />
        <KpiCard label="Pedidos Abertos"    value={fmtN(dados.pedidos_abertos)} icon={<ShoppingCart size={16} />} />
        <KpiCard label="A Receber"          value={fmt(dados.a_receber)}        icon={<DollarSign size={16} />} />
        <KpiCard label="Inadimplência"      value={fmt(dados.inadimplencia)}    icon={<AlertTriangle size={16} />} cor="text-red-400" />
      </div>

      {/* Abas de detalhe */}
      <div className="flex gap-2">
        <TabBtn active={aba === 'vendas'}     onClick={() => setAba('vendas')}>Últimas Vendas</TabBtn>
        <TabBtn active={aba === 'financeiro'} onClick={() => setAba('financeiro')}>Financeiro</TabBtn>
      </div>

      {aba === 'vendas' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-sm font-semibold text-text-primary">Últimos pedidos faturados</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Nº', 'Cliente', 'Valor', 'Data'].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.ultimos_pedidos.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-text-muted text-sm">Nenhum pedido</td></tr>
              ) : dados.ultimos_pedidos.map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-card2">
                  <td className="px-4 py-2 font-mono text-text-muted text-xs">#{p.id}</td>
                  <td className="px-4 py-2 text-text-primary">{p.cliente}</td>
                  <td className="px-4 py-2 font-mono text-accent">{fmt(p.valor_total)}</td>
                  <td className="px-4 py-2 text-text-muted text-xs">{p.data_pedido}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === 'financeiro' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Inadimplentes */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Recebíveis em atraso</p>
              <span className="text-xs text-red-400 font-semibold">{fmt(dados.inadimplencia)}</span>
            </div>
            <div className="divide-y divide-border/50">
              {dados.inadimplentes.length === 0 ? (
                <p className="text-center py-6 text-sm text-text-muted">Nenhum título em atraso</p>
              ) : dados.inadimplentes.map((c, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-text-primary">{c.descricao}</p>
                    <p className="text-xs text-text-muted">{c.cliente} · venceu {c.vencimento}</p>
                  </div>
                  <span className="text-xs font-mono text-red-400">{fmt(c.valor)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contas a pagar próximas */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Contas a pagar (7 dias)</p>
              <span className="text-xs text-amber-400 font-semibold">{fmt(dados.a_pagar)}</span>
            </div>
            <div className="divide-y divide-border/50">
              {dados.contas_vencer.length === 0 ? (
                <p className="text-center py-6 text-sm text-text-muted">Nenhuma conta próxima</p>
              ) : dados.contas_vencer.map((c, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-text-primary">{c.descricao}</p>
                    <p className="text-xs text-text-muted">{c.fornecedor} · vence {c.vencimento}</p>
                  </div>
                  <span className="text-xs font-mono text-amber-400">{fmt(c.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function MatrizConsolidado() {
  const [resp, setResp]           = useState<ConsolidadoResp | null>(null)
  const [loading, setLoading]     = useState(true)
  const [aba, setAba]             = useState<'geral' | 'vendas' | 'financeiro'>('geral')
  const [filialSel, setFilialSel] = useState<number | null>(null)

  useEffect(() => {
    api.get('/api/matriz/consolidado/')
      .then(r => setResp(r.data))
      .catch(() => setResp(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-text-muted">Carregando...</div>

  const c   = resp!.consolidado
  const uns = resp!.por_unidade

  // Drill-down: mostrar detalhe de uma unidade
  if (filialSel !== null) {
    return <PainelFilial filialId={filialSel} onVoltar={() => setFilialSel(null)} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Building2 size={20} className="text-accent" /> Visão Consolidada
        </h1>
        <p className="text-sm text-text-muted">{resp!.matriz} · {resp!.total_unidades} unidade{resp!.total_unidades !== 1 ? 's' : ''}</p>
      </div>

      {/* Abas */}
      <div className="flex gap-2">
        <TabBtn active={aba === 'geral'}      onClick={() => setAba('geral')}>Visão Geral</TabBtn>
        <TabBtn active={aba === 'vendas'}     onClick={() => setAba('vendas')}>Vendas</TabBtn>
        <TabBtn active={aba === 'financeiro'} onClick={() => setAba('financeiro')}>Financeiro</TabBtn>
      </div>

      {/* ── ABA GERAL ── */}
      {aba === 'geral' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Faturamento do Mês"  value={fmt(c.faturamento_mes)}  icon={<TrendingUp size={18} />} />
            <KpiCard label="Pedidos Abertos"      value={fmtN(c.pedidos_abertos)} icon={<ShoppingCart size={18} />} />
            <KpiCard label="Inadimplência Total"  value={fmt(c.inadimplencia)}    icon={<AlertTriangle size={18} />} cor="text-red-400" />
            <KpiCard label="Estoque Total (custo)"value={fmt(c.estoque_valor)}    icon={<Package size={18} />} />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Desempenho por Unidade</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Unidade', 'Faturamento Mês', 'Pedidos Abertos', 'A Receber', 'Inadimplência', 'Estoque', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uns.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{u.nome}</p>
                      <p className="text-xs text-text-muted">{u.tipo}{u.is_matriz ? ' · Matriz' : ''}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-accent">{fmt(u.faturamento_mes)}</td>
                    <td className="px-4 py-3 text-center text-text-muted">{fmtN(u.pedidos_abertos)}</td>
                    <td className="px-4 py-3 font-mono text-text-primary">{fmt(u.a_receber)}</td>
                    <td className="px-4 py-3 font-mono text-red-400">{fmt(u.inadimplencia)}</td>
                    <td className="px-4 py-3 font-mono text-text-muted">{fmt(u.estoque_valor)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setFilialSel(u.id)}
                        className="flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        Detalhar <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-card2 border-t border-border">
                  <td className="px-4 py-3 text-xs font-semibold text-text-muted uppercase">Total</td>
                  <td className="px-4 py-3 font-mono font-bold text-accent">{fmt(c.faturamento_mes)}</td>
                  <td className="px-4 py-3 text-center font-bold text-text-primary">{fmtN(c.pedidos_abertos)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-text-primary">{fmt(c.a_receber)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-red-400">{fmt(c.inadimplencia)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-text-muted">{fmt(c.estoque_valor)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* ── ABA VENDAS ── */}
      {aba === 'vendas' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Faturamento do Mês" value={fmt(c.faturamento_mes)}  icon={<TrendingUp size={18} />} />
            <KpiCard label="Pedidos Faturados"  value={fmtN(c.pedidos_mes)}     icon={<ShoppingCart size={18} />} />
            <KpiCard label="Ticket Médio"        value={fmt(c.ticket_medio)}     icon={<Users size={18} />} />
            <KpiCard label="Pedidos em Aberto"  value={fmtN(c.pedidos_abertos)} icon={<Package size={18} />} />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Vendas por Unidade</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Unidade', 'Faturamento', 'Pedidos', 'Ticket Médio', 'Em Aberto', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uns.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-card2">
                    <td className="px-4 py-3 font-medium text-text-primary">{u.nome}</td>
                    <td className="px-4 py-3 font-mono text-accent">{fmt(u.faturamento_mes)}</td>
                    <td className="px-4 py-3 text-center text-text-muted">{fmtN(u.pedidos_mes)}</td>
                    <td className="px-4 py-3 font-mono text-text-primary">{fmt(u.ticket_medio)}</td>
                    <td className="px-4 py-3 text-center text-text-muted">{fmtN(u.pedidos_abertos)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setFilialSel(u.id)} className="flex items-center gap-1 text-xs text-accent hover:underline">
                        Detalhar <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ABA FINANCEIRO ── */}
      {aba === 'financeiro' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="A Receber"      value={fmt(c.a_receber)}     icon={<DollarSign size={18} />} />
            <KpiCard label="Inadimplência"  value={fmt(c.inadimplencia)} icon={<AlertTriangle size={18} />} cor="text-red-400" />
            <KpiCard label="A Pagar"        value={fmt(c.a_pagar)}       icon={<CreditCard size={18} />} cor="text-amber-400" />
            <KpiCard label="Saldo Líquido"  value={fmt(c.saldo_liquido)} icon={<TrendingUp size={18} />} cor={c.saldo_liquido >= 0 ? 'text-green-400' : 'text-red-400'} />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Financeiro por Unidade</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Unidade', 'A Receber', 'Inadimplência', 'A Pagar', 'Saldo Líquido', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uns.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-card2">
                    <td className="px-4 py-3 font-medium text-text-primary">{u.nome}</td>
                    <td className="px-4 py-3 font-mono text-text-primary">{fmt(u.a_receber)}</td>
                    <td className="px-4 py-3 font-mono text-red-400">{fmt(u.inadimplencia)}</td>
                    <td className="px-4 py-3 font-mono text-amber-400">{fmt(u.a_pagar)}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${u.saldo_liquido >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(u.saldo_liquido)}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setFilialSel(u.id)} className="flex items-center gap-1 text-xs text-accent hover:underline">
                        Detalhar <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-card2 border-t border-border">
                  <td className="px-4 py-3 text-xs font-semibold text-text-muted uppercase">Total</td>
                  <td className="px-4 py-3 font-mono font-bold text-text-primary">{fmt(c.a_receber)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-red-400">{fmt(c.inadimplencia)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-amber-400">{fmt(c.a_pagar)}</td>
                  <td className={`px-4 py-3 font-mono font-bold ${c.saldo_liquido >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(c.saldo_liquido)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
