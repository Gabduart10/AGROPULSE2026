import { useEffect, useState } from 'react'
import { X, ChevronDown, AlertTriangle, CheckCircle, TrendingDown, Phone, Mail, MessageSquare, Users, FileWarning, Gavel, RefreshCw, Plus, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'

// ─── shared ──────────────────────────────────────────────────────────────────

const inp = 'w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors'
const sel = inp + ' appearance-none'
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function TabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex flex-wrap border-b border-border mb-6">
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${active === t ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
          {t}
        </button>
      ))}
    </div>
  )
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-card border border-border rounded-2xl max-h-[92vh] overflow-y-auto w-full ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="font-semibold text-text-primary">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Sel({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select className={sel} value={value} onChange={e => onChange(e.target.value)}>{children}</select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
    </div>
  )
}

function ModalFooter({ onClose, onSave, saving, disabled, label }: { onClose: () => void; onSave: () => void; saving: boolean; disabled?: boolean; label?: string }) {
  return (
    <div className="flex gap-2 pt-4">
      <button onClick={onClose} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2 transition-colors">Cancelar</button>
      <button onClick={onSave} disabled={saving || disabled} className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors disabled:opacity-60">
        {saving ? 'Salvando...' : label ?? 'Confirmar'}
      </button>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'orange' | 'purple' }) {
  const cls = {
    green: 'bg-accent/10 text-accent',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-700',
    gray: 'bg-card2 text-text-muted border border-border',
    blue: 'bg-blue-100 text-blue-700',
    orange: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-700',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[color]}`}>{label}</span>
}

function ScoreBadge({ score, classificacao }: { score: number; classificacao: string }) {
  const color =
    classificacao === 'A' ? 'bg-accent/10 text-accent border border-accent/30' :
    classificacao === 'B' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
    classificacao === 'C' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
    classificacao === 'D' ? 'bg-orange-100 text-orange-600 border border-orange-200' :
    'bg-red-100 text-red-600 border border-red-200'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{classificacao} · {score}pts</span>
}

// ─── types ────────────────────────────────────────────────────────────────────

interface PainelAPI {
  total_limite_concedido: number
  saldo_utilizado: number
  saldo_disponivel: number
  vencendo_7_dias: number
  alertas_concentracao: { cliente: string; percentual: number }[]
  pct_concentracao_config: number
}

interface AgingFaixaAPI {
  label: string
  quantidade: number
  total: number
  contas: { id: number; cliente: string; valor: number; vencimento: string; dias_atraso: number }[]
}

interface AgingAPI {
  faixas: Record<string, AgingFaixaAPI>
  total_carteira: number
  total_vencido: number
  indice_inadimplencia: number
  data_referencia: string
}

interface PDDAPI {
  faixas: { faixa: string; label: string; quantidade: number; total_faixa: number; aliquota_pdd: number; pdd: number }[]
  pdd_total: number
  referencia: string
}

interface HistoricoItem { label: string; indice_pct: number; total_vencido: number; pdd_total: number }

interface FichaCredito { id: number; cliente: string; cliente_id: number; limite_solicitado: number; limite_aprovado: number | null; status: string; analista: string | null; criado_em: string; area_plantada_ha: number | null; cultura_principal: string }

interface ItemCobranca {
  cliente_id: number
  cliente: string
  telefone: string
  valor_total_vencido: number
  qtd_titulos: number
  dias_atraso: number
  titulos: { conta_id: number; descricao: string; valor: number; vencimento: string; dias_atraso: number }[]
  ultima_tentativa: string | null
  ultimo_resultado: string | null
  proxima_acao: string
  score: string
}

interface Tentativa { id: number; tipo_contato: string; resultado: string; observacao: string; proxima_acao: string; proxima_acao_data: string | null; criado_em: string }

interface TituloDisputa { id: number; conta_receber: string; cliente: string; valor: number; motivo: string; status: string; criado_em: string }

interface Acordo { id: number; cliente: string; valor_total: number; numero_parcelas: number; status: string; criado_em: string }

interface Parcela { id: number; numero: number; valor: number; data_vencimento: string; data_pagamento: string | null; status: string }

interface ConfigCredito {
  dias_atraso_bloqueio: number
  limite_alcada_gerente: number
  limite_alcada_diretor: number
  pct_concentracao_alerta: number
  peso_historico_pagamento: number
  peso_tempo_relacionamento: number
  peso_volume_compras: number
  peso_dados_cadastrais: number
  pdd_1_30_dias: number
  pdd_31_60_dias: number
  pdd_61_90_dias: number
  pdd_91_180_dias: number
  pdd_acima_180_dias: number
}

interface ScoreCliente { score_total: number; classificacao: string; score_historico_pagamento: number; score_tempo_relacionamento: number; score_volume_compras: number; score_dados_cadastrais: number; calculado_em: string }

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_PAINEL: PainelAPI = {
  total_limite_concedido: 850000,
  saldo_utilizado: 512000,
  saldo_disponivel: 338000,
  vencendo_7_dias: 87400,
  alertas_concentracao: [
    { cliente: 'Fazenda São João Ltda', percentual: 28.5 },
    { cliente: 'Agropecuária Norte S/A', percentual: 21.3 },
  ],
  pct_concentracao_config: 20,
}

const MOCK_AGING: AgingAPI = {
  faixas: {
    a_vencer:       { label: 'A Vencer',      quantidade: 34, total: 215000, contas: [] },
    '1_15_dias':    { label: '1–15 dias',      quantidade: 12, total: 87000,  contas: [] },
    '16_30_dias':   { label: '16–30 dias',     quantidade:  6, total: 55000,  contas: [] },
    '31_60_dias':   { label: '31–60 dias',     quantidade:  9, total: 88500,  contas: [] },
    '61_90_dias':   { label: '61–90 dias',     quantidade:  5, total: 52000,  contas: [] },
    '91_180_dias':  { label: '91–180 dias',    quantidade:  4, total: 64800,  contas: [] },
    acima_180_dias: { label: 'Acima 180 dias', quantidade:  2, total: 49700,  contas: [] },
  },
  total_carteira: 612000,
  total_vencido: 397000,
  indice_inadimplencia: 64.87,
  data_referencia: '24/04/2026',
}

const MOCK_PDD: PDDAPI = {
  faixas: [
    { faixa: '1_30',    label: '1–30 dias',    quantidade: 18, total_faixa: 142000, aliquota_pdd: 0,   pdd: 0 },
    { faixa: '31_60',   label: '31–60 dias',   quantidade:  9, total_faixa:  88500, aliquota_pdd: 10,  pdd: 8850 },
    { faixa: '61_90',   label: '61–90 dias',   quantidade:  5, total_faixa:  52000, aliquota_pdd: 30,  pdd: 15600 },
    { faixa: '91_180',  label: '91–180 dias',  quantidade:  4, total_faixa:  64800, aliquota_pdd: 50,  pdd: 32400 },
    { faixa: 'acima_180', label: 'Acima 180',  quantidade:  2, total_faixa:  49700, aliquota_pdd: 100, pdd: 49700 },
  ],
  pdd_total: 106550,
  referencia: '24/04/2026',
}

const MOCK_HISTORICO: HistoricoItem[] = [
  { label: 'Nov/25', indice_pct: 8.2,  total_vencido: 210000, pdd_total: 24000 },
  { label: 'Dez/25', indice_pct: 9.1,  total_vencido: 245000, pdd_total: 28000 },
  { label: 'Jan/26', indice_pct: 11.4, total_vencido: 298000, pdd_total: 34000 },
  { label: 'Fev/26', indice_pct: 10.8, total_vencido: 285000, pdd_total: 32000 },
  { label: 'Mar/26', indice_pct: 13.2, total_vencido: 341000, pdd_total: 41000 },
  { label: 'Abr/26', indice_pct: 14.7, total_vencido: 397000, pdd_total: 48000 },
]

const MOCK_FICHAS: FichaCredito[] = [
  { id: 1, cliente: 'Fazenda São João Ltda', cliente_id: 1, limite_solicitado: 120000, limite_aprovado: 100000, status: 'aprovado', analista: 'Maria Lima', criado_em: '10/04/2026', area_plantada_ha: 350, cultura_principal: 'Soja' },
  { id: 2, cliente: 'Agropecuária Norte S/A', cliente_id: 2, limite_solicitado: 80000, limite_aprovado: null, status: 'em_analise', analista: 'Carlos Souza', criado_em: '22/04/2026', area_plantada_ha: 200, cultura_principal: 'Milho' },
]

const MOCK_COBRANCA: ItemCobranca[] = [
  { cliente_id: 1, cliente: 'Fazenda São João Ltda', telefone: '(65) 99801-2345', valor_total_vencido: 52400, qtd_titulos: 3, dias_atraso: 67, titulos: [{ conta_id: 1, descricao: 'NF 1042', valor: 28000, vencimento: '15/02/2026', dias_atraso: 67 }, { conta_id: 2, descricao: 'NF 1051', valor: 24400, vencimento: '01/03/2026', dias_atraso: 53 }], ultima_tentativa: '20/04/2026', ultimo_resultado: 'Sem resposta', proxima_acao: 'Ligar novamente', score: 'B' },
  { cliente_id: 2, cliente: 'Rancho Verde Agrícola', telefone: '(65) 98700-0011', valor_total_vencido: 28900, qtd_titulos: 2, dias_atraso: 45, titulos: [{ conta_id: 3, descricao: 'NF 0987', valor: 28900, vencimento: '10/03/2026', dias_atraso: 45 }], ultima_tentativa: '18/04/2026', ultimo_resultado: 'Promessa de pagamento', proxima_acao: 'Aguardar depósito', score: 'C' },
  { cliente_id: 3, cliente: 'Produtores Unidos Ltda', telefone: '(65) 99300-4422', valor_total_vencido: 14200, qtd_titulos: 1, dias_atraso: 12, titulos: [{ conta_id: 4, descricao: 'NF 1089', valor: 14200, vencimento: '12/04/2026', dias_atraso: 12 }], ultima_tentativa: null, ultimo_resultado: null, proxima_acao: '', score: 'A' },
]

const MOCK_TITULOS: TituloDisputa[] = [
  { id: 1, conta_receber: 'NF 1042/2026', cliente: 'Fazenda São João Ltda', valor: 18500, motivo: 'Cliente contesta prazo de entrega dos insumos.', status: 'em_disputa', criado_em: '15/03/2026' },
  { id: 2, conta_receber: 'NF 0987/2026', cliente: 'Rancho Verde Agrícola', valor: 9800, motivo: 'Divergência no preço cobrado vs. pedido original.', status: 'encaminhado_juridico', criado_em: '02/02/2026' },
]

const MOCK_ACORDOS: Acordo[] = [
  { id: 1, cliente: 'Agropecuária Norte S/A', valor_total: 45000, numero_parcelas: 6, status: 'ativo', criado_em: '10/01/2026' },
]

const MOCK_CONFIG: ConfigCredito = {
  dias_atraso_bloqueio: 60,
  limite_alcada_gerente: 10000,
  limite_alcada_diretor: 100000,
  pct_concentracao_alerta: 20,
  peso_historico_pagamento: 40,
  peso_tempo_relacionamento: 20,
  peso_volume_compras: 20,
  peso_dados_cadastrais: 20,
  pdd_1_30_dias: 0,
  pdd_31_60_dias: 10,
  pdd_61_90_dias: 30,
  pdd_91_180_dias: 50,
  pdd_acima_180_dias: 100,
}

// ─── Mini gráfico de barras ───────────────────────────────────────────────────

function MiniBarChart({ dados, campo, label, color }: {
  dados: HistoricoItem[]
  campo: 'indice_pct' | 'total_vencido' | 'pdd_total'
  label: string
  color: string
}) {
  if (!dados.length) return null
  const max = Math.max(...dados.map(d => d[campo]))
  return (
    <div>
      <p className="text-xs text-text-muted mb-2">{label}</p>
      <div className="flex items-end gap-1 h-20">
        {dados.map((d, i) => {
          const h = max > 0 ? Math.max(4, (d[campo] / max) * 80) : 4
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              <div className={`w-full rounded-t ${color}`} style={{ height: h }} />
              <span className="text-[9px] text-text-muted">{d.label}</span>
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-card border border-border rounded px-1.5 py-0.5 text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                {campo === 'indice_pct' ? `${d[campo].toFixed(1)}%` : fmt(d[campo])}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab Painel da Carteira ───────────────────────────────────────────────────

function TabPainel() {
  const [painel, setPainel] = useState<PainelAPI | null>(null)
  const [aging, setAging] = useState<AgingAPI | null>(null)
  const [pdd, setPdd] = useState<PDDAPI | null>(null)
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [p, a, d, h] = await Promise.all([
      api.get('/api/credito/painel/').then(r => r.data).catch(() => MOCK_PAINEL),
      api.get('/api/credito/aging/').then(r => r.data).catch(() => MOCK_AGING),
      api.get('/api/credito/pdd/').then(r => r.data).catch(() => MOCK_PDD),
      api.get('/api/credito/historico-inadimplencia/').then(r => r.data).catch(() => MOCK_HISTORICO),
    ])
    setPainel(p)
    setAging(a)
    setPdd(d)
    setHistorico(Array.isArray(h) ? h : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="text-text-muted text-sm py-10 text-center">Carregando...</div>

  const pct = painel && painel.total_limite_concedido > 0
    ? (painel.saldo_utilizado / painel.total_limite_concedido) * 100
    : 0

  const agingFaixas = aging ? Object.values(aging.faixas) : []
  const totalCarteira = aging?.total_carteira ?? 0

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {painel && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Limite Total',    value: fmt(painel.total_limite_concedido), icon: <Users size={20} />,         color: 'text-blue-400' },
            { label: 'Saldo Utilizado', value: fmt(painel.saldo_utilizado),        icon: <TrendingDown size={20} />,   color: 'text-orange-400' },
            { label: 'Disponível',      value: fmt(painel.saldo_disponivel),       icon: <CheckCircle size={20} />,    color: 'text-accent' },
            { label: 'Vence em 7 dias', value: fmt(painel.vencendo_7_dias),        icon: <AlertTriangle size={20} />,  color: 'text-yellow-400' },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border rounded-xl p-4">
              <div className={`${k.color} mb-2`}>{k.icon}</div>
              <p className="text-xs text-text-muted mb-0.5">{k.label}</p>
              <p className="text-lg font-bold text-text-primary">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Barra de utilização */}
      {painel && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-text-muted">Utilização do Limite</span>
            <span className="font-semibold text-text-primary">{pct.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-card2 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-accent'}`}
              style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          {aging && (
            <div className="flex gap-4 mt-2 text-xs text-text-muted">
              <span>Inadimplência: <strong className={aging.indice_inadimplencia > 10 ? 'text-red-500' : 'text-accent'}>{aging.indice_inadimplencia.toFixed(1)}%</strong></span>
              <span>Ref.: {aging.data_referencia}</span>
            </div>
          )}
        </div>
      )}

      {/* Alertas de concentração */}
      {painel && painel.alertas_concentracao?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-400" /> Alertas de Concentração (&gt;{painel.pct_concentracao_config}%)
          </h3>
          <div className="space-y-2">
            {painel.alertas_concentracao.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">{a.cliente}</span>
                <Badge label={`${a.percentual.toFixed(1)}% da carteira`} color="orange" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aging */}
      {aging && agingFaixas.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Aging da Carteira — 7 Faixas</h3>
            <span className="text-xs text-text-muted">Total: {fmt(totalCarteira)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border">
                  <th className="text-left pb-2">Faixa</th>
                  <th className="text-right pb-2">Títulos</th>
                  <th className="text-right pb-2">Valor</th>
                  <th className="text-right pb-2">% Carteira</th>
                </tr>
              </thead>
              <tbody>
                {agingFaixas.map(f => {
                  const pctCart = totalCarteira > 0 ? (f.total / totalCarteira) * 100 : 0
                  return (
                    <tr key={f.label} className="border-b border-border/40 hover:bg-card2/50">
                      <td className="py-2 text-text-primary">{f.label}</td>
                      <td className="py-2 text-right text-text-secondary">{f.quantidade}</td>
                      <td className="py-2 text-right text-text-primary font-medium">{fmt(f.total)}</td>
                      <td className="py-2 text-right">
                        <span className={`font-semibold ${pctCart > 20 ? 'text-red-500' : pctCart > 10 ? 'text-yellow-500' : 'text-text-muted'}`}>
                          {pctCart.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PDD */}
      {pdd && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Provisão para Devedores Duvidosos (PDD)</h3>
            <span className="text-base font-bold text-red-500">{fmt(pdd.pdd_total)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border">
                  <th className="text-left pb-2">Faixa</th>
                  <th className="text-right pb-2">Valor</th>
                  <th className="text-right pb-2">% PDD</th>
                  <th className="text-right pb-2">Provisão</th>
                </tr>
              </thead>
              <tbody>
                {pdd.faixas.map(f => (
                  <tr key={f.faixa} className="border-b border-border/40 hover:bg-card2/50">
                    <td className="py-2 text-text-primary">{f.label}</td>
                    <td className="py-2 text-right text-text-secondary">{fmt(f.total_faixa)}</td>
                    <td className="py-2 text-right text-text-muted">{f.aliquota_pdd}%</td>
                    <td className="py-2 text-right font-semibold text-red-500">{fmt(f.pdd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Histórico de Inadimplência */}
      {historico.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Histórico Mensal de Inadimplência</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MiniBarChart dados={historico} campo="indice_pct"     label="Índice de Inadimplência (%)" color="bg-red-400" />
            <MiniBarChart dados={historico} campo="total_vencido"  label="Total Vencido (R$)"          color="bg-orange-400" />
            <MiniBarChart dados={historico} campo="pdd_total"      label="PDD Provisionado (R$)"       color="bg-yellow-400" />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-1">Mês</th>
                  <th className="text-right pb-1">Índice</th>
                  <th className="text-right pb-1">Total Vencido</th>
                  <th className="text-right pb-1">PDD</th>
                </tr>
              </thead>
              <tbody>
                {[...historico].reverse().map((h, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-card2/40">
                    <td className="py-1.5 text-text-secondary">{h.label}</td>
                    <td className="py-1.5 text-right font-semibold text-red-500">{h.indice_pct.toFixed(1)}%</td>
                    <td className="py-1.5 text-right text-text-primary">{fmt(h.total_vencido)}</td>
                    <td className="py-1.5 text-right text-text-muted">{fmt(h.pdd_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button onClick={load} className="flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors">
        <RefreshCw size={14} /> Atualizar
      </button>
    </div>
  )
}

// ─── Tab Fichas de Crédito ────────────────────────────────────────────────────

function TabFichas() {
  const [fichas, setFichas] = useState<FichaCredito[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAprovar, setModalAprovar] = useState<FichaCredito | null>(null)
  const [modalRecusar, setModalRecusar] = useState<FichaCredito | null>(null)
  const [novaFicha, setNovaFicha] = useState(false)
  const [saving, setSaving] = useState(false)
  const [limiteAprovado, setLimiteAprovado] = useState('')
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [form, setForm] = useState({ cliente_id: '', limite_solicitado: '', area_plantada_ha: '', cultura_principal: '', renda_estimada_anual: '', endividamento_declarado: '', garantias: '', observacoes: '' })

  const load = async () => {
    setLoading(true)
    const data = await api.get('/api/credito/fichas/').then(r => r.data).catch(() => MOCK_FICHAS)
    setFichas(Array.isArray(data) ? data : data.results ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const statusColor = (s: string) => s === 'aprovado' ? 'green' : s === 'recusado' ? 'red' : s === 'em_revisao' ? 'yellow' : 'blue'
  const statusLabel = (s: string) => ({ em_analise: 'Em Análise', aprovado: 'Aprovado', recusado: 'Recusado', em_revisao: 'Em Revisão' }[s] ?? s)

  const aprovar = async () => {
    if (!modalAprovar || !limiteAprovado) return
    setSaving(true)
    await api.post(`/api/credito/fichas/${modalAprovar.id}/aprovar/`, { limite_aprovado: parseFloat(limiteAprovado) }).catch(() => {})
    setSaving(false); setModalAprovar(null); setLimiteAprovado(''); load()
  }

  const recusar = async () => {
    if (!modalRecusar || !motivoRecusa) return
    setSaving(true)
    await api.post(`/api/credito/fichas/${modalRecusar.id}/recusar/`, { observacoes: motivoRecusa }).catch(() => {})
    setSaving(false); setModalRecusar(null); setMotivoRecusa(''); load()
  }

  const criarFicha = async () => {
    if (!form.cliente_id || !form.limite_solicitado) return
    setSaving(true)
    await api.post('/api/credito/fichas/', { ...form, limite_solicitado: parseFloat(form.limite_solicitado), area_plantada_ha: form.area_plantada_ha || null, renda_estimada_anual: form.renda_estimada_anual || null, endividamento_declarado: form.endividamento_declarado || 0 }).catch(() => {})
    setSaving(false); setNovaFicha(false)
    setForm({ cliente_id: '', limite_solicitado: '', area_plantada_ha: '', cultura_principal: '', renda_estimada_anual: '', endividamento_declarado: '', garantias: '', observacoes: '' })
    load()
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setNovaFicha(true)} className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Nova Ficha
        </button>
      </div>
      {loading ? <div className="text-text-muted text-sm py-10 text-center">Carregando...</div>
        : fichas.length === 0 ? <div className="text-text-muted text-sm py-10 text-center">Nenhuma ficha de análise de crédito.</div>
        : (
          <div className="space-y-3">
            {fichas.map(f => (
              <div key={f.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-primary text-sm">{f.cliente}</p>
                    <p className="text-xs text-text-muted mt-0.5">Analista: {f.analista ?? '—'} · {f.criado_em}</p>
                    {f.cultura_principal && <p className="text-xs text-text-muted">Cultura: {f.cultura_principal}{f.area_plantada_ha ? ` · ${f.area_plantada_ha} ha` : ''}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge label={statusLabel(f.status)} color={statusColor(f.status) as 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange' | 'purple'} />
                    <div className="text-right">
                      <p className="text-xs text-text-muted">Solicitado</p>
                      <p className="text-sm font-semibold text-text-primary">{fmt(f.limite_solicitado)}</p>
                    </div>
                    {f.limite_aprovado != null && (
                      <div className="text-right">
                        <p className="text-xs text-text-muted">Aprovado</p>
                        <p className="text-sm font-semibold text-accent">{fmt(f.limite_aprovado)}</p>
                      </div>
                    )}
                  </div>
                </div>
                {f.status === 'em_analise' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <button onClick={() => { setModalAprovar(f); setLimiteAprovado(String(f.limite_solicitado)) }} className="flex-1 bg-accent/10 text-accent border border-accent/30 text-xs font-semibold py-1.5 rounded-lg hover:bg-accent/20 transition-colors">Aprovar</button>
                    <button onClick={() => setModalRecusar(f)} className="flex-1 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold py-1.5 rounded-lg hover:bg-red-100 transition-colors">Recusar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {modalAprovar && (
        <Modal title={`Aprovar Ficha — ${modalAprovar.cliente}`} onClose={() => setModalAprovar(null)}>
          <div className="space-y-4">
            <Field label="Limite Aprovado (R$)">
              <input className={inp} type="number" step="0.01" value={limiteAprovado} onChange={e => setLimiteAprovado(e.target.value)} />
            </Field>
            <ModalFooter onClose={() => setModalAprovar(null)} onSave={aprovar} saving={saving} label="Aprovar" disabled={!limiteAprovado} />
          </div>
        </Modal>
      )}

      {modalRecusar && (
        <Modal title={`Recusar Ficha — ${modalRecusar.cliente}`} onClose={() => setModalRecusar(null)}>
          <div className="space-y-4">
            <Field label="Motivo da Recusa">
              <textarea className={inp} rows={3} value={motivoRecusa} onChange={e => setMotivoRecusa(e.target.value)} placeholder="Descreva o motivo..." />
            </Field>
            <ModalFooter onClose={() => setModalRecusar(null)} onSave={recusar} saving={saving} label="Recusar" disabled={!motivoRecusa} />
          </div>
        </Modal>
      )}

      {novaFicha && (
        <Modal title="Nova Ficha de Análise de Crédito" onClose={() => setNovaFicha(false)} wide>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="ID do Cliente"><input className={inp} type="number" value={form.cliente_id} onChange={e => setForm(p => ({ ...p, cliente_id: e.target.value }))} placeholder="ID do cliente" /></Field>
            </div>
            <Field label="Limite Solicitado (R$)"><input className={inp} type="number" step="0.01" value={form.limite_solicitado} onChange={e => setForm(p => ({ ...p, limite_solicitado: e.target.value }))} /></Field>
            <Field label="Renda Estimada Anual (R$)"><input className={inp} type="number" step="0.01" value={form.renda_estimada_anual} onChange={e => setForm(p => ({ ...p, renda_estimada_anual: e.target.value }))} /></Field>
            <Field label="Área Plantada (ha)"><input className={inp} type="number" step="0.01" value={form.area_plantada_ha} onChange={e => setForm(p => ({ ...p, area_plantada_ha: e.target.value }))} /></Field>
            <Field label="Cultura Principal"><input className={inp} value={form.cultura_principal} onChange={e => setForm(p => ({ ...p, cultura_principal: e.target.value }))} placeholder="Ex: Soja, Milho..." /></Field>
            <Field label="Endividamento Declarado (R$)"><input className={inp} type="number" step="0.01" value={form.endividamento_declarado} onChange={e => setForm(p => ({ ...p, endividamento_declarado: e.target.value }))} /></Field>
            <div className="col-span-2">
              <Field label="Garantias"><textarea className={inp} rows={2} value={form.garantias} onChange={e => setForm(p => ({ ...p, garantias: e.target.value }))} placeholder="Descreva as garantias..." /></Field>
            </div>
            <div className="col-span-2">
              <Field label="Observações"><textarea className={inp} rows={2} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} /></Field>
            </div>
          </div>
          <div className="mt-4">
            <ModalFooter onClose={() => setNovaFicha(false)} onSave={criarFicha} saving={saving} label="Criar Ficha" disabled={!form.cliente_id || !form.limite_solicitado} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Cobrança Ativa ───────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = { ligacao: 'Ligação', whatsapp: 'WhatsApp', email: 'E-mail', visita: 'Visita', carta: 'Carta' }
const RESULTADO_LABEL: Record<string, string> = { contato_realizado: 'Contato realizado', sem_resposta: 'Sem resposta', promessa_pagamento: 'Promessa de pagamento', pagamento_efetuado: 'Pagamento efetuado', recusou_pagar: 'Recusou pagar', numero_invalido: 'Número inválido' }

function TabCobranca() {
  const [lista, setLista] = useState<ItemCobranca[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ItemCobranca | null>(null)
  const [tentativas, setTentativas] = useState<Tentativa[]>([])
  const [loadingT, setLoadingT] = useState(false)
  const [novoModal, setNovoModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandTitulos, setExpandTitulos] = useState(false)
  const [form, setForm] = useState({ tipo_contato: 'ligacao', resultado: 'contato_realizado', observacao: '', proxima_acao: '', proxima_acao_data: '' })

  const load = async () => {
    setLoading(true)
    const data = await api.get('/api/cobranca/lista/').then(r => r.data).catch(() => MOCK_COBRANCA)
    setLista(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const abrirCliente = async (item: ItemCobranca) => {
    setSelected(item); setExpandTitulos(false); setLoadingT(true)
    const t = await api.get(`/api/cobranca/tentativas/${item.cliente_id}/`).then(r => r.data).catch(() => [])
    setTentativas(Array.isArray(t) ? t : [])
    setLoadingT(false)
  }

  const registrar = async () => {
    if (!selected) return
    setSaving(true)
    await api.post('/api/cobranca/tentativas/', { cliente_id: selected.cliente_id, ...form }).catch(() => {})
    setSaving(false); setNovoModal(false)
    setForm({ tipo_contato: 'ligacao', resultado: 'contato_realizado', observacao: '', proxima_acao: '', proxima_acao_data: '' })
    const t = await api.get(`/api/cobranca/tentativas/${selected.cliente_id}/`).then(r => r.data).catch(() => [])
    setTentativas(Array.isArray(t) ? t : [])
  }

  const iconContato = (tipo: string) => tipo === 'email' ? <Mail size={13} /> : tipo === 'ligacao' ? <Phone size={13} /> : <MessageSquare size={13} />
  const corAtraso = (d: number) => d > 90 ? 'text-red-500' : d > 30 ? 'text-orange-500' : d > 15 ? 'text-yellow-500' : 'text-text-muted'

  return (
    <div className="flex gap-4 min-h-0">
      {/* Lista de clientes */}
      <div className={`space-y-2 overflow-y-auto ${selected ? 'w-1/2' : 'w-full'}`}>
        {loading ? <div className="text-text-muted text-sm py-10 text-center">Carregando...</div>
          : lista.length === 0 ? <div className="text-text-muted text-sm py-10 text-center">Nenhum cliente com títulos vencidos.</div>
          : lista.map(item => (
            <div key={item.cliente_id} onClick={() => abrirCliente(item)}
              className={`bg-card border rounded-xl p-4 cursor-pointer hover:border-accent/40 transition-colors ${selected?.cliente_id === item.cliente_id ? 'border-accent' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary text-sm truncate">{item.cliente}</p>
                  <p className="text-xs text-text-muted mt-0.5">{item.qtd_titulos} título(s) · {item.telefone || 'sem telefone'}</p>
                  {item.ultima_tentativa && <p className="text-xs text-text-muted">Último contato: {item.ultima_tentativa} — {item.ultimo_resultado}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-red-500">{fmt(item.valor_total_vencido)}</p>
                  <p className={`text-xs font-medium ${corAtraso(item.dias_atraso)}`}>{item.dias_atraso}d atraso</p>
                  {item.score !== '—' && <ScoreBadge score={0} classificacao={item.score} />}
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Painel direito */}
      {selected && (
        <div className="flex-1 bg-card border border-border rounded-xl p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-text-primary text-sm">{selected.cliente}</h3>
              <p className="text-xs text-text-muted">{selected.qtd_titulos} título(s) · {fmt(selected.valor_total_vencido)} vencido(s)</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setNovoModal(true)} className="flex items-center gap-1.5 bg-accent text-bg text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-accent/90 transition-colors">
                <Plus size={14} /> Registrar Contato
              </button>
              <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
            </div>
          </div>

          {/* Títulos expandíveis */}
          <button onClick={() => setExpandTitulos(p => !p)} className="flex items-center gap-1 text-xs text-text-muted hover:text-accent mb-3 transition-colors">
            <ChevronRight size={12} className={`transition-transform ${expandTitulos ? 'rotate-90' : ''}`} />
            Ver títulos ({selected.titulos.length})
          </button>
          {expandTitulos && (
            <div className="mb-4 space-y-1.5">
              {selected.titulos.map(t => (
                <div key={t.conta_id} className="flex items-center justify-between text-xs bg-card2 rounded-lg px-3 py-2">
                  <span className="text-text-secondary">{t.descricao}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-text-muted">vence {t.vencimento}</span>
                    <span className="font-semibold text-text-primary">{fmt(t.valor)}</span>
                    <span className={`font-medium ${corAtraso(t.dias_atraso)}`}>{t.dias_atraso}d</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Histórico de tentativas */}
          {loadingT ? <p className="text-text-muted text-sm">Carregando tentativas...</p>
            : tentativas.length === 0 ? <p className="text-text-muted text-sm">Nenhuma tentativa registrada.</p>
            : (
              <div className="space-y-2">
                {tentativas.map(t => (
                  <div key={t.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-text-muted">{iconContato(t.tipo_contato)}</span>
                      <span className="text-xs font-medium text-text-primary">{TIPO_LABEL[t.tipo_contato] ?? t.tipo_contato}</span>
                      <Badge label={RESULTADO_LABEL[t.resultado] ?? t.resultado} color={t.resultado === 'pagamento_efetuado' ? 'green' : t.resultado === 'promessa_pagamento' ? 'yellow' : 'gray'} />
                      <span className="ml-auto text-xs text-text-muted">{t.criado_em}</span>
                    </div>
                    {t.observacao && <p className="text-xs text-text-secondary">{t.observacao}</p>}
                    {t.proxima_acao && <p className="text-xs text-text-muted mt-1">Próxima: {t.proxima_acao}{t.proxima_acao_data ? ` · ${t.proxima_acao_data}` : ''}</p>}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {novoModal && selected && (
        <Modal title={`Registrar Contato — ${selected.cliente}`} onClose={() => setNovoModal(false)}>
          <div className="space-y-4">
            <Field label="Tipo de Contato">
              <Sel value={form.tipo_contato} onChange={v => setForm(p => ({ ...p, tipo_contato: v }))}>
                <option value="ligacao">Ligação Telefônica</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
                <option value="visita">Visita Presencial</option>
                <option value="carta">Carta/Notificação</option>
              </Sel>
            </Field>
            <Field label="Resultado">
              <Sel value={form.resultado} onChange={v => setForm(p => ({ ...p, resultado: v }))}>
                <option value="contato_realizado">Contato Realizado</option>
                <option value="sem_resposta">Sem Resposta</option>
                <option value="promessa_pagamento">Promessa de Pagamento</option>
                <option value="pagamento_efetuado">Pagamento Efetuado</option>
                <option value="recusou_pagar">Recusou Pagar</option>
                <option value="numero_invalido">Número Inválido</option>
              </Sel>
            </Field>
            <Field label="Observação">
              <textarea className={inp} rows={2} value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} placeholder="Detalhes do contato..." />
            </Field>
            <Field label="Próxima Ação">
              <input className={inp} value={form.proxima_acao} onChange={e => setForm(p => ({ ...p, proxima_acao: e.target.value }))} placeholder="Ex: Ligar novamente, enviar boleto..." />
            </Field>
            <Field label="Data da Próxima Ação">
              <input className={inp} type="date" value={form.proxima_acao_data} onChange={e => setForm(p => ({ ...p, proxima_acao_data: e.target.value }))} />
            </Field>
            <ModalFooter onClose={() => setNovoModal(false)} onSave={registrar} saving={saving} label="Registrar" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Títulos em Disputa ───────────────────────────────────────────────────

function TabTitulos() {
  const [titulos, setTitulos] = useState<TituloDisputa[]>([])
  const [loading, setLoading] = useState(true)
  const [modalResolver, setModalResolver] = useState<TituloDisputa | null>(null)
  const [saving, setSaving] = useState(false)
  const [resolverStatus, setResolverStatus] = useState('resolvido_pago')

  const load = async () => {
    setLoading(true)
    const data = await api.get('/api/cobranca/titulos-disputa/').then(r => r.data).catch(() => MOCK_TITULOS)
    setTitulos(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const resolver = async () => {
    if (!modalResolver) return
    setSaving(true)
    await api.post(`/api/cobranca/titulos-disputa/${modalResolver.id}/resolver/`, { status: resolverStatus }).catch(() => {})
    setSaving(false); setModalResolver(null); load()
  }

  const enviarJuridico = async (t: TituloDisputa) => {
    await api.post(`/api/cobranca/titulos-disputa/${t.id}/juridico/`, {}).catch(() => {})
    load()
  }

  const statusColor = (s: string) => s === 'em_disputa' ? 'orange' : s === 'encaminhado_juridico' ? 'purple' : s === 'resolvido_pago' ? 'green' : 'gray'
  const statusLabel = (s: string) => ({ em_disputa: 'Em Disputa', resolvido_pago: 'Resolvido — Pago', resolvido_cancelado: 'Resolvido — Cancelado', encaminhado_juridico: 'Jurídico' }[s] ?? s)

  return (
    <div>
      {loading ? <div className="text-text-muted text-sm py-10 text-center">Carregando...</div>
        : titulos.length === 0 ? <div className="text-text-muted text-sm py-10 text-center">Nenhum título em disputa.</div>
        : (
          <div className="space-y-3">
            {titulos.map(t => (
              <div key={t.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-primary text-sm">{t.cliente}</p>
                    <p className="text-xs text-text-muted mt-0.5">{t.conta_receber} · {t.criado_em}</p>
                    <p className="text-xs text-text-secondary mt-1 max-w-md">{t.motivo}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge label={statusLabel(t.status)} color={statusColor(t.status) as 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'orange' | 'purple'} />
                    <span className="text-sm font-bold text-text-primary">{fmt(t.valor)}</span>
                  </div>
                </div>
                {t.status === 'em_disputa' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <button onClick={() => setModalResolver(t)} className="flex-1 bg-accent/10 text-accent border border-accent/30 text-xs font-semibold py-1.5 rounded-lg hover:bg-accent/20 transition-colors">Resolver</button>
                    <button onClick={() => enviarJuridico(t)} className="flex-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold py-1.5 rounded-lg hover:bg-purple-100 transition-colors flex items-center justify-center gap-1">
                      <Gavel size={12} /> Enviar ao Jurídico
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {modalResolver && (
        <Modal title={`Resolver Disputa — ${modalResolver.cliente}`} onClose={() => setModalResolver(null)}>
          <div className="space-y-4">
            <Field label="Resolução">
              <Sel value={resolverStatus} onChange={setResolverStatus}>
                <option value="resolvido_pago">Resolvido — Pago</option>
                <option value="resolvido_cancelado">Resolvido — Cancelado</option>
              </Sel>
            </Field>
            <ModalFooter onClose={() => setModalResolver(null)} onSave={resolver} saving={saving} label="Confirmar Resolução" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Acordos Judiciais ────────────────────────────────────────────────────

function TabAcordos() {
  const [acordos, setAcordos] = useState<Acordo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Acordo | null>(null)
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [loadingP, setLoadingP] = useState(false)
  const [saving, setSaving] = useState(false)
  const [novoAcordo, setNovoAcordo] = useState(false)
  const [form, setForm] = useState({ cliente_id: '', titulo_disputa_id: '', valor_total: '', numero_parcelas: '1', observacoes: '' })

  const load = async () => {
    setLoading(true)
    const data = await api.get('/api/cobranca/acordos/').then(r => r.data).catch(() => MOCK_ACORDOS)
    setAcordos(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const abrirAcordo = async (a: Acordo) => {
    setSelected(a); setLoadingP(true)
    const p = await api.get(`/api/cobranca/acordos/${a.id}/parcelas/`).then(r => r.data).catch(() => [])
    setParcelas(Array.isArray(p) ? p : [])
    setLoadingP(false)
  }

  const pagarParcela = async (parcela: Parcela) => {
    if (!selected) return
    await api.post(`/api/cobranca/acordos/${selected.id}/parcelas/${parcela.id}/pagar/`, {}).catch(() => {})
    const p = await api.get(`/api/cobranca/acordos/${selected.id}/parcelas/`).then(r => r.data).catch(() => [])
    setParcelas(Array.isArray(p) ? p : [])
  }

  const criarAcordo = async () => {
    if (!form.cliente_id || !form.valor_total) return
    setSaving(true)
    await api.post('/api/cobranca/acordos/', { ...form, valor_total: parseFloat(form.valor_total), numero_parcelas: parseInt(form.numero_parcelas), titulo_disputa_id: form.titulo_disputa_id || null }).catch(() => {})
    setSaving(false); setNovoAcordo(false); load()
  }

  const statusColor = (s: string) => s === 'cumprido' ? 'green' : s === 'inadimplido' ? 'red' : s === 'cancelado' ? 'gray' : 'blue'
  const statusLabel = (s: string) => ({ ativo: 'Ativo', cumprido: 'Cumprido', inadimplido: 'Inadimplido', cancelado: 'Cancelado' }[s] ?? s)
  const parcelaColor = (s: string) => s === 'paga' ? 'green' : s === 'atrasada' ? 'red' : 'gray'

  return (
    <div className="flex gap-4">
      <div className={selected ? 'w-1/2 space-y-3' : 'w-full space-y-3'}>
        <div className="flex justify-end mb-2">
          <button onClick={() => setNovoAcordo(true)} className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
            <Plus size={16} /> Novo Acordo
          </button>
        </div>
        {loading ? <div className="text-text-muted text-sm py-10 text-center">Carregando...</div>
          : acordos.length === 0 ? <div className="text-text-muted text-sm py-10 text-center">Nenhum acordo judicial.</div>
          : acordos.map(a => (
            <div key={a.id} onClick={() => abrirAcordo(a)}
              className={`bg-card border rounded-xl p-4 cursor-pointer hover:border-accent/40 transition-colors ${selected?.id === a.id ? 'border-accent' : 'border-border'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-text-primary text-sm">{a.cliente}</p>
                  <p className="text-xs text-text-muted mt-0.5">{a.numero_parcelas} parcela(s) · {a.criado_em}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={statusLabel(a.status)} color={statusColor(a.status) as 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'orange' | 'purple'} />
                  <span className="text-sm font-bold text-text-primary">{fmt(a.valor_total)}</span>
                </div>
              </div>
            </div>
          ))}
      </div>

      {selected && (
        <div className="flex-1 bg-card border border-border rounded-xl p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-primary text-sm">{selected.cliente} — Parcelas</h3>
            <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
          </div>
          {loadingP ? <p className="text-text-muted text-sm">Carregando...</p>
            : parcelas.length === 0 ? <p className="text-text-muted text-sm">Sem parcelas.</p>
            : (
              <div className="space-y-2">
                {parcelas.map(p => (
                  <div key={p.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                    <div>
                      <span className="text-xs text-text-muted mr-2">#{p.numero}</span>
                      <span className="text-sm font-medium text-text-primary">{fmt(p.valor)}</span>
                      <span className="text-xs text-text-muted ml-2">vence {p.data_vencimento}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge label={p.status} color={parcelaColor(p.status) as 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'orange' | 'purple'} />
                      {p.status === 'pendente' && (
                        <button onClick={() => pagarParcela(p)} className="text-xs bg-accent/10 text-accent border border-accent/30 px-2 py-0.5 rounded-lg hover:bg-accent/20 transition-colors">Pagar</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {novoAcordo && (
        <Modal title="Novo Acordo Judicial" onClose={() => setNovoAcordo(false)}>
          <div className="space-y-4">
            <Field label="ID do Cliente"><input className={inp} type="number" value={form.cliente_id} onChange={e => setForm(p => ({ ...p, cliente_id: e.target.value }))} /></Field>
            <Field label="ID do Título em Disputa (opcional)"><input className={inp} type="number" value={form.titulo_disputa_id} onChange={e => setForm(p => ({ ...p, titulo_disputa_id: e.target.value }))} /></Field>
            <Field label="Valor Total (R$)"><input className={inp} type="number" step="0.01" value={form.valor_total} onChange={e => setForm(p => ({ ...p, valor_total: e.target.value }))} /></Field>
            <Field label="Número de Parcelas"><input className={inp} type="number" min="1" value={form.numero_parcelas} onChange={e => setForm(p => ({ ...p, numero_parcelas: e.target.value }))} /></Field>
            <Field label="Observações"><textarea className={inp} rows={2} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} /></Field>
            <ModalFooter onClose={() => setNovoAcordo(false)} onSave={criarAcordo} saving={saving} label="Criar Acordo" disabled={!form.cliente_id || !form.valor_total} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Score de Crédito ─────────────────────────────────────────────────────

function TabScore() {
  const [clienteId, setClienteId] = useState('')
  const [score, setScore] = useState<ScoreCliente | null>(null)
  const [loading, setLoading] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  const buscar = async () => {
    if (!clienteId) return
    setLoading(true)
    const data = await api.get(`/api/credito/score/${clienteId}/`).then(r => r.data).catch(() => null)
    setScore(data); setLoading(false)
  }

  const recalcular = async () => {
    if (!clienteId) return
    setRecalculating(true)
    const data = await api.post(`/api/credito/score/${clienteId}/recalcular/`, {}).then(r => r.data).catch(() => null)
    if (data) setScore(data)
    setRecalculating(false)
  }

  const barColor = (v: number) => v >= 80 ? 'bg-accent' : v >= 60 ? 'bg-blue-400' : v >= 40 ? 'bg-yellow-400' : 'bg-red-400'

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex gap-2">
        <input className={inp} type="number" placeholder="ID do cliente" value={clienteId}
          onChange={e => setClienteId(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} />
        <button onClick={buscar} disabled={loading || !clienteId}
          className="bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60 whitespace-nowrap">
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {score && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted mb-1">Score Total</p>
              <ScoreBadge score={Number(score.score_total)} classificacao={score.classificacao} />
            </div>
            <button onClick={recalcular} disabled={recalculating}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent border border-border px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
              <RefreshCw size={12} /> {recalculating ? 'Recalculando...' : 'Recalcular'}
            </button>
          </div>
          <p className="text-xs text-text-muted">Calculado em: {score.calculado_em}</p>
          {[
            { label: 'Histórico de Pagamento (40%)', value: Number(score.score_historico_pagamento) },
            { label: 'Tempo de Relacionamento (20%)', value: Number(score.score_tempo_relacionamento) },
            { label: 'Volume de Compras (20%)', value: Number(score.score_volume_compras) },
            { label: 'Dados Cadastrais (20%)', value: Number(score.score_dados_cadastrais) },
          ].map(c => (
            <div key={c.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-secondary">{c.label}</span>
                <span className="font-semibold text-text-primary">{c.value.toFixed(0)}pts</span>
              </div>
              <div className="h-2 bg-card2 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor(c.value)}`} style={{ width: `${Math.min(c.value, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!score && !loading && clienteId && (
        <p className="text-text-muted text-sm">Score não calculado ainda. Clique em "Recalcular" para gerar.</p>
      )}
    </div>
  )
}

// ─── Tab Configurações ────────────────────────────────────────────────────────

function TabConfig() {
  const [config, setConfig] = useState<ConfigCredito | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await api.get('/api/credito/configuracao/').then(r => r.data).catch(() => MOCK_CONFIG)
    setConfig(data); setLoading(false)
  }

  useEffect(() => { load() }, [])

  const salvar = async () => {
    if (!config) return
    setSaving(true)
    await api.post('/api/credito/configuracao/', config).catch(() => {})
    setSaving(false); load()
  }

  const num = (field: keyof ConfigCredito) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfig(p => p ? { ...p, [field]: parseFloat(e.target.value) || 0 } : p)

  if (loading) return <div className="text-text-muted text-sm py-10 text-center">Carregando...</div>
  if (!config) return <div className="text-text-muted text-sm py-10 text-center">Erro ao carregar.</div>

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Bloqueio e Alçadas</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dias de Atraso para Bloqueio (0 = desativado)">
            <input className={inp} type="number" min="0" value={config.dias_atraso_bloqueio} onChange={num('dias_atraso_bloqueio')} />
          </Field>
          <Field label="% Concentração para Alerta">
            <input className={inp} type="number" step="0.01" value={config.pct_concentracao_alerta} onChange={num('pct_concentracao_alerta')} />
          </Field>
          <Field label="Limite de Alçada Gerente (R$)">
            <input className={inp} type="number" step="0.01" value={config.limite_alcada_gerente} onChange={num('limite_alcada_gerente')} />
          </Field>
          <Field label="Limite de Alçada Diretor (R$)">
            <input className={inp} type="number" step="0.01" value={config.limite_alcada_diretor} onChange={num('limite_alcada_diretor')} />
          </Field>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Pesos do Score de Crédito (devem somar 100)</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Histórico de Pagamento (%)"><input className={inp} type="number" value={config.peso_historico_pagamento} onChange={num('peso_historico_pagamento')} /></Field>
          <Field label="Tempo de Relacionamento (%)"><input className={inp} type="number" value={config.peso_tempo_relacionamento} onChange={num('peso_tempo_relacionamento')} /></Field>
          <Field label="Volume de Compras (%)"><input className={inp} type="number" value={config.peso_volume_compras} onChange={num('peso_volume_compras')} /></Field>
          <Field label="Dados Cadastrais (%)"><input className={inp} type="number" value={config.peso_dados_cadastrais} onChange={num('peso_dados_cadastrais')} /></Field>
        </div>
        <p className="text-xs text-text-muted mt-2">
          Total: {config.peso_historico_pagamento + config.peso_tempo_relacionamento + config.peso_volume_compras + config.peso_dados_cadastrais}%
          {config.peso_historico_pagamento + config.peso_tempo_relacionamento + config.peso_volume_compras + config.peso_dados_cadastrais !== 100 && (
            <span className="text-red-500 ml-1">— deve somar 100</span>
          )}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">PDD — Percentuais por Faixa de Atraso</h3>
        <div className="grid grid-cols-2 gap-4">
          {([
            ['pdd_1_30_dias',     '1–30 dias (%)'],
            ['pdd_31_60_dias',    '31–60 dias (%)'],
            ['pdd_61_90_dias',    '61–90 dias (%)'],
            ['pdd_91_180_dias',   '91–180 dias (%)'],
            ['pdd_acima_180_dias','Acima de 180 dias (%)'],
          ] as [keyof ConfigCredito, string][]).map(([field, label]) => (
            <Field key={field} label={label}>
              <input className={inp} type="number" step="0.01" value={config[field] as number} onChange={num(field)} />
            </Field>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 text-xs text-text-muted">
        <p className="font-semibold text-text-secondary mb-1">Comandos Railway (agendar no cron)</p>
        <code className="block text-accent/80 mt-1">0 6 * * * python manage.py registrar_inadimplencia</code>
        <code className="block text-accent/80 mt-1">0 7 * * * python manage.py revisar_limites_credito</code>
      </div>

      <button onClick={salvar} disabled={saving} className="bg-accent text-bg font-semibold px-6 py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors disabled:opacity-60">
        {saving ? 'Salvando...' : 'Salvar Configurações'}
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = ['Painel da Carteira', 'Score de Crédito', 'Fichas de Crédito', 'Cobrança Ativa', 'Títulos em Disputa', 'Acordos Judiciais', 'Configurações']

export default function Cobranca() {
  const [tab, setTab] = useState(TABS[0])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileWarning size={22} className="text-accent" />
        <h1 className="text-xl font-bold text-text-primary">Cobrança e Crédito Rural</h1>
      </div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Painel da Carteira'  && <TabPainel />}
      {tab === 'Score de Crédito'    && <TabScore />}
      {tab === 'Fichas de Crédito'   && <TabFichas />}
      {tab === 'Cobrança Ativa'      && <TabCobranca />}
      {tab === 'Títulos em Disputa'  && <TabTitulos />}
      {tab === 'Acordos Judiciais'   && <TabAcordos />}
      {tab === 'Configurações'       && <TabConfig />}
    </div>
  )
}
