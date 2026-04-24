import { useState } from 'react'
import {
  Search, X, ChevronDown, AlertTriangle, AlertCircle,
  TrendingUp, TrendingDown, BarChart2, Eye, Download,
  Building2, Package, Users, DollarSign, Target,
  CheckCircle2, Clock, ArrowUp, ArrowDown, Minus,
} from 'lucide-react'
import ExportButtons from '../components/ExportButtons'
import { api } from '../lib/api'

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
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

function Bar({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? 'Buscar...'}
          className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent w-64" />
      </div>
      <div className="flex-1" />
      {children}
    </div>
  )
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent pr-8">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
    </div>
  )
}

function KpiCard({ label, val, sub, delta, warn, ok, icon }: { label: string; val: string | number; sub?: string; delta?: number; warn?: boolean; ok?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`border rounded-xl px-4 py-4 ${warn ? 'bg-amber-950/20 border-amber-800/40' : ok ? 'bg-emerald-900/10 border-emerald-800/40' : 'bg-card2 border-border'}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs text-text-muted">{label}</p>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold font-mono mt-1 ${warn ? 'text-amber-300' : ok ? 'text-emerald-400' : 'text-text-primary'}`}>{val}</p>
      <div className="flex items-center gap-2 mt-1">
        {delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-text-muted'}`}>
            {delta > 0 ? <ArrowUp size={11} /> : delta < 0 ? <ArrowDown size={11} /> : <Minus size={11} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <p className="text-xs text-text-muted">{sub}</p>}
      </div>
    </div>
  )
}

function Table({ heads, children, selHead }: { heads: string[]; children: React.ReactNode; selHead?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {selHead !== undefined && <th className="w-10 px-3 py-3">{selHead}</th>}
            {heads.map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>)}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Tr({ children, selected, highlight }: { children: React.ReactNode; selected?: boolean; highlight?: string }) {
  const hcls = highlight === 'red' ? 'border-l-2 border-l-red-500' : highlight === 'green' ? 'border-l-2 border-l-emerald-500' : highlight === 'yellow' ? 'border-l-2 border-l-amber-400' : ''
  return <tr className={`border-b border-border/50 hover:bg-card2 transition-colors ${selected ? 'bg-accent/5' : ''} ${hcls}`}>{children}</tr>
}
function Td({ children, mono, right }: { children: React.ReactNode; mono?: boolean; right?: boolean }) {
  return <td className={`px-4 py-3 ${mono ? 'font-mono text-text-secondary' : 'text-text-muted'} ${right ? 'text-right' : ''}`}>{children ?? '—'}</td>
}
function TdMain({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-text-primary font-medium">{children}</td>
}
function TdSel({ id, sel, toggle }: { id: number; sel: Set<number>; toggle: (id: number) => void }) {
  return (
    <td className="px-3 py-3">
      <input type="checkbox" checked={sel.has(id)} onChange={() => toggle(id)} className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />
    </td>
  )
}
function Empty({ label }: { label: string }) {
  return <tr><td colSpan={20} className="px-4 py-10 text-center text-text-muted text-sm">{label}</td></tr>
}

function Badge({ label, color }: { label: string; color: string }) {
  const map: Record<string, string> = {
    green:  'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    red:    'bg-red-900/30 text-red-400 border-red-800/40',
    yellow: 'bg-amber-950/50 text-amber-200 border-amber-800/50',
    blue:   'bg-blue-900/30 text-blue-400 border-blue-800/40',
    purple: 'bg-purple-900/30 text-purple-400 border-purple-800/40',
    gray:   'bg-gray-800/50 text-text-muted border-border',
    orange: 'bg-orange-900/30 text-orange-400 border-orange-800/40',
  }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${map[color] ?? map.gray}`}>{label}</span>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtPct(v: number) { return `${v.toFixed(1)}%` }

function BarH({ pct, color = 'bg-accent' }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-1.5 bg-card2 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
    </div>
  )
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun']
const FAT_SERIE = [820000, 910000, 875000, 1050000, 980000, 1120000]
const MARGEM_SERIE = [18.2, 19.5, 17.8, 21.3, 20.1, 22.4]

const MOCK_FILIAIS = [
  { id: 1, nome: 'Matriz — Sorriso/MT',    cnpj: '12.345.678/0001-00', fat: 1120000, meta_fat: 1000000, margem: 22.4, inadimplencia: 3.2, pedidos: 142, ticket_medio: 7887 },
  { id: 2, nome: 'Filial — Lucas/MT',       cnpj: '12.345.678/0002-00', fat: 680000,  meta_fat: 700000,  margem: 19.1, inadimplencia: 5.8, pedidos: 98,  ticket_medio: 6938 },
  { id: 3, nome: 'Filial — Rondonópolis/MT',cnpj: '12.345.678/0003-00', fat: 430000,  meta_fat: 500000,  margem: 16.7, inadimplencia: 8.4, pedidos: 61,  ticket_medio: 7049 },
]

const MOCK_LOTES = [
  { id: 1, produto: 'Fungicida Priori Xtra 1L', lote: 'LT-2026-0312', fornecedor: 'Syngenta', dt_compra: '2026-03-12', qty_comprada: 500, qty_vendida: 380, custo_lote: 142.50, preco_venda_medio: 189.00, margem_pct: 24.6, receita: 71820, custo_total: 54150, lucro: 17670 },
  { id: 2, produto: 'Fungicida Priori Xtra 1L', lote: 'LT-2026-0401', fornecedor: 'Syngenta', dt_compra: '2026-04-01', qty_comprada: 300, qty_vendida: 120, custo_lote: 151.80, preco_venda_medio: 189.00, margem_pct: 19.7, receita: 22680, custo_total: 18216, lucro: 4464 },
  { id: 3, produto: 'Herbicida Roundup WG', lote: 'LT-2026-0215', fornecedor: 'Bayer', dt_compra: '2026-02-15', qty_comprada: 1000, qty_vendida: 940, custo_lote: 48.20, preco_venda_medio: 68.50, margem_pct: 29.6, receita: 64390, custo_total: 45308, lucro: 19082 },
  { id: 4, produto: 'Herbicida Roundup WG', lote: 'LT-2026-0318', fornecedor: 'Bayer', dt_compra: '2026-03-18', qty_comprada: 800, qty_vendida: 200, custo_lote: 52.40, preco_venda_medio: 68.50, margem_pct: 23.5, receita: 13700, custo_total: 10480, lucro: 3220 },
  { id: 5, produto: 'Semente Soja Intacta 40kg', lote: 'LT-2026-0110', fornecedor: 'Brasmax', dt_compra: '2026-01-10', qty_comprada: 200, qty_vendida: 200, custo_lote: 320.00, preco_venda_medio: 420.00, margem_pct: 23.8, receita: 84000, custo_total: 64000, lucro: 20000 },
  { id: 6, produto: 'Adubo NPK 04-14-08 sc', lote: 'LT-2026-0305', fornecedor: 'Mosaic', dt_compra: '2026-03-05', qty_comprada: 600, qty_vendida: 550, custo_lote: 88.00, preco_venda_medio: 105.00, margem_pct: 16.2, receita: 57750, custo_total: 48400, lucro: 9350 },
  { id: 7, produto: 'Adubo NPK 04-14-08 sc', lote: 'LT-2026-0410', fornecedor: 'Mosaic', dt_compra: '2026-04-10', qty_comprada: 400, qty_vendida: 80, custo_lote: 94.50, preco_venda_medio: 105.00, margem_pct: 10.0, receita: 8400, custo_total: 7560, lucro: 840 },
]

const MOCK_DRE_ITENS = [
  { grupo: 'RECEITA BRUTA',        unidade1: 1120000, unidade2: 680000, consolidado: 1800000, eh_grupo: true },
  { grupo: '(-) Devoluções',       unidade1: -18400,  unidade2: -9200,  consolidado: -27600,  eh_grupo: false },
  { grupo: '(-) Impostos s/ vendas',unidade1:-134400, unidade2: -81600, consolidado:-216000,  eh_grupo: false },
  { grupo: 'RECEITA LÍQUIDA',      unidade1: 967200,  unidade2: 589200, consolidado:1556400,  eh_grupo: true },
  { grupo: '(-) CMV',              unidade1: -750180, unidade2:-476952, consolidado:-1227132, eh_grupo: false },
  { grupo: 'LUCRO BRUTO',          unidade1: 217020,  unidade2: 112248, consolidado: 329268,  eh_grupo: true },
  { grupo: '(-) Despesas comerciais',unidade1:-52000, unidade2: -34000, consolidado: -86000,  eh_grupo: false },
  { grupo: '(-) Despesas administrativas',unidade1:-38000,unidade2:-28000,consolidado:-66000, eh_grupo: false },
  { grupo: '(-) Fretes e logística',unidade1:-15000,  unidade2: -10000, consolidado: -25000,  eh_grupo: false },
  { grupo: 'EBITDA',               unidade1: 112020,  unidade2:  40248, consolidado: 152268,  eh_grupo: true },
  { grupo: '(-) Depreciação/Amort.',unidade1: -8400,  unidade2:  -4200, consolidado: -12600,  eh_grupo: false },
  { grupo: '(-) Result. financeiro',unidade1: -6200,  unidade2:  -3800, consolidado: -10000,  eh_grupo: false },
  { grupo: 'LUCRO LÍQUIDO',        unidade1:  97420,  unidade2:  32248, consolidado: 129668,  eh_grupo: true },
]

interface ProdutoRent { id: number; produto: string; categoria: string; receita: number; custo: number; margem_pct: number; pedidos: number; clientes: number; curva: 'A' | 'B' | 'C' }
const MOCK_PRODUTOS_RENT: ProdutoRent[] = [
  { id:1, produto:'Herbicida Roundup WG',    categoria:'Herbicida',   receita:78090,  custo:55788,  margem_pct:28.6, pedidos:94, clientes:42, curva:'A' },
  { id:2, produto:'Semente Soja Intacta 40kg',categoria:'Semente',    receita:84000,  custo:64000,  margem_pct:23.8, pedidos:38, clientes:21, curva:'A' },
  { id:3, produto:'Fungicida Priori Xtra 1L', categoria:'Fungicida',  receita:94500,  custo:72366,  margem_pct:23.4, pedidos:112,clientes:55, curva:'A' },
  { id:4, produto:'Adubo NPK 04-14-08 sc',    categoria:'Fertilizante',receita:66150, custo:55960,  margem_pct:15.4, pedidos:67, clientes:30, curva:'B' },
  { id:5, produto:'Inseticida Connect 1L',    categoria:'Inseticida',  receita:38400,  custo:27648,  margem_pct:28.0, pedidos:48, clientes:19, curva:'B' },
  { id:6, produto:'Calcário Dolomítico t',    categoria:'Corretivo',   receita:22000,  custo:17600,  margem_pct:20.0, pedidos:31, clientes:14, curva:'C' },
]

interface ClienteRent { id: number; cliente: string; regiao: string; receita: number; margem_pct: number; pedidos: number; ticket_medio: number; inadimplencia: number }
const MOCK_CLIENTES_RENT: ClienteRent[] = [
  { id:1, cliente:'Fazenda São Lucas Ltda',   regiao:'Lucas/MT',    receita:285000, margem_pct:24.2, pedidos:18, ticket_medio:15833, inadimplencia:0 },
  { id:2, cliente:'João Carlos Mendonça',     regiao:'Sorriso/MT',  receita:148000, margem_pct:21.8, pedidos:12, ticket_medio:12333, inadimplencia:0 },
  { id:3, cliente:'Agropecuária Cerrado',     regiao:'Rondonópolis',receita:97000,  margem_pct:18.5, pedidos:8,  ticket_medio:12125, inadimplencia:2.4 },
  { id:4, cliente:'Cooperativa Agronorte',    regiao:'Sorriso/MT',  receita:220000, margem_pct:15.2, pedidos:22, ticket_medio:10000, inadimplencia:5.8 },
  { id:5, cliente:'Pedro Alves Neto',         regiao:'Primavera/MT',receita:65000,  margem_pct:22.1, pedidos:7,  ticket_medio:9286,  inadimplencia:0 },
]

interface Inadimplente { id: number; cliente: string; unidade: string; valor_total: number; faixa_1_30: number; faixa_31_60: number; faixa_61_90: number; faixa_91_mais: number; dias_maior: number; status: 'critico' | 'atencao' | 'normal' }
const MOCK_INAD: Inadimplente[] = [
  { id:1, cliente:'Cooperativa Agronorte',   unidade:'Sorriso/MT',  valor_total:42800,  faixa_1_30:12000, faixa_31_60:18000, faixa_61_90:8400, faixa_91_mais:4400,  dias_maior:98,  status:'critico' },
  { id:2, cliente:'Distribuidora Campo',     unidade:'Lucas/MT',    valor_total:18500,  faixa_1_30:6200,  faixa_31_60:8500,  faixa_61_90:3800, faixa_91_mais:0,     dias_maior:58,  status:'atencao' },
  { id:3, cliente:'João da Silva',           unidade:'Sorriso/MT',  valor_total:4200,   faixa_1_30:4200,  faixa_31_60:0,     faixa_61_90:0,    faixa_91_mais:0,     dias_maior:12,  status:'normal' },
  { id:4, cliente:'Agropecuária Cerrado',    unidade:'Rondonópolis',valor_total:28400,  faixa_1_30:8000,  faixa_31_60:0,     faixa_61_90:12000,faixa_91_mais:8400,  dias_maior:104, status:'critico' },
  { id:5, cliente:'Fazenda Santa Cruz',      unidade:'Sorriso/MT',  valor_total:9250,   faixa_1_30:9250,  faixa_31_60:0,     faixa_61_90:0,    faixa_91_mais:0,     dias_maior:14,  status:'normal' },
]

interface Vendedor { id: number; nome: string; pedidos: number; meta_pedidos: number; faturamento: number; meta_fat: number; ticket_medio: number; conversao_pct: number; visitas: number; comissao: number }
const MOCK_VENDEDORES: Vendedor[] = [
  { id:1, nome:'Ana Lima',     pedidos:58, meta_pedidos:50, faturamento:720000, meta_fat:650000, ticket_medio:12414, conversao_pct:67, visitas:87, comissao:21600 },
  { id:2, nome:'Carlos Souza', pedidos:41, meta_pedidos:50, faturamento:480000, meta_fat:650000, ticket_medio:11707, conversao_pct:52, visitas:79, comissao:14400 },
  { id:3, nome:'Marcos Ramos', pedidos:43, meta_pedidos:40, faturamento:400000, meta_fat:400000, ticket_medio:9302,  conversao_pct:61, visitas:70, comissao:12000 },
]

interface Alerta { id: number; tipo: 'margem' | 'meta' | 'inadimplencia' | 'estoque'; nivel: 'critico' | 'atencao'; descricao: string; valor?: string; unidade: string; data: string; ativo: boolean }
const MOCK_ALERTAS: Alerta[] = [
  { id:1, tipo:'inadimplencia', nivel:'critico', descricao:'Inadimplência acima de 8% na filial Rondonópolis', valor:'8.4%',       unidade:'Rondonópolis/MT', data:'2026-04-20', ativo:true },
  { id:2, tipo:'margem',        nivel:'critico', descricao:'Lote LT-2026-0410 (Adubo NPK) com margem 10% — abaixo do mínimo 15%', valor:'10.0%', unidade:'Matriz',          data:'2026-04-19', ativo:true },
  { id:3, tipo:'meta',          nivel:'atencao', descricao:'Filial Lucas/MT 97% da meta de faturamento — risco de não bater', valor:'97%', unidade:'Lucas/MT',          data:'2026-04-18', ativo:true },
  { id:4, tipo:'meta',          nivel:'atencao', descricao:'Vendedor Carlos Souza com 63% da meta de pedidos',                 valor:'63%', unidade:'Matriz',          data:'2026-04-18', ativo:true },
  { id:5, tipo:'inadimplencia', nivel:'critico', descricao:'Cooperativa Agronorte com 98 dias em atraso',                     valor:'R$ 42.800', unidade:'Sorriso/MT',  data:'2026-04-17', ativo:false },
  { id:6, tipo:'margem',        nivel:'atencao', descricao:'Lote LT-2026-0401 (Priori Xtra) com margem 19.7% — mínimo 20%',  valor:'19.7%',     unidade:'Matriz',      data:'2026-04-15', ativo:false },
]

// ─── Tab: Dashboard Gerencial ─────────────────────────────────────────────────

function TabDashboard() {
  const [periodo, setPeriodo] = useState('mes')

  const totalFat = MOCK_FILIAIS.reduce((a, f) => a + f.fat, 0)
  const totalMeta = MOCK_FILIAIS.reduce((a, f) => a + f.meta_fat, 0)
  const margemMedia = MOCK_FILIAIS.reduce((a, f) => a + f.margem * f.fat, 0) / totalFat
  const inadMedia = MOCK_FILIAIS.reduce((a, f) => a + f.inadimplencia * f.fat, 0) / totalFat

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-text-muted">Dados consolidados do grupo · Abril/2026</p>
        <div className="flex items-center gap-2">
          <Sel value={periodo} onChange={setPeriodo} options={[{ value: 'mes', label: 'Este mês' }, { value: 'trimestre', label: 'Trimestre' }, { value: 'ano', label: 'Ano' }]} />
          <ExportButtons selectedIds={[]} />
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Faturamento" val={fmtBRL(totalFat)} delta={12.1} sub={`meta: ${fmtBRL(totalMeta)}`} ok={totalFat >= totalMeta} icon={<DollarSign size={15} />} />
        <KpiCard label="Margem líquida" val={fmtPct(margemMedia)} delta={1.3} ok={margemMedia >= 20} icon={<TrendingUp size={15} />} />
        <KpiCard label="Inadimplência" val={fmtPct(inadMedia)} delta={-0.4} warn={inadMedia > 5} ok={inadMedia <= 3} icon={<AlertCircle size={15} />} />
        <KpiCard label="Pedidos no mês" val={MOCK_FILIAIS.reduce((a, f) => a + f.pedidos, 0)} sub="todas as unidades" icon={<Package size={15} />} />
      </div>

      {/* Evolução mensal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Faturamento Mensal (R$)</h3>
          <div className="flex items-end gap-2 h-32">
            {FAT_SERIE.map((v, i) => {
              const max = Math.max(...FAT_SERIE)
              const h = Math.round((v / max) * 100)
              const isLast = i === FAT_SERIE.length - 1
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-mono text-text-muted">{(v / 1000).toFixed(0)}k</span>
                  <div className={`w-full rounded-t-sm ${isLast ? 'bg-accent' : 'bg-accent/40'}`} style={{ height: `${h}%` }} />
                  <span className="text-xs text-text-muted">{MESES[i]}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Margem Bruta (%) por Mês</h3>
          <div className="flex items-end gap-2 h-32">
            {MARGEM_SERIE.map((v, i) => {
              const max = Math.max(...MARGEM_SERIE)
              const h = Math.round((v / max) * 100)
              const isLast = i === MARGEM_SERIE.length - 1
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-mono text-text-muted">{v.toFixed(1)}%</span>
                  <div className={`w-full rounded-t-sm ${isLast ? 'bg-emerald-500' : 'bg-emerald-500/40'}`} style={{ height: `${h}%` }} />
                  <span className="text-xs text-text-muted">{MESES[i]}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Ranking de filiais */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Ranking de Unidades</h3>
        <div className="space-y-4">
          {[...MOCK_FILIAIS].sort((a, b) => b.fat - a.fat).map((f, i) => {
            const pctMeta = f.fat / f.meta_fat * 100
            return (
              <div key={f.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
                <span className="text-lg font-bold font-mono text-text-muted w-6">{i + 1}</span>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-text-primary">{f.nome}</span>
                    <span className="text-sm font-mono font-bold text-text-primary">{fmtBRL(f.fat)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarH pct={pctMeta} color={pctMeta >= 100 ? 'bg-emerald-500' : pctMeta >= 90 ? 'bg-accent' : 'bg-amber-500'} />
                    <span className="text-xs font-mono text-text-muted w-10 text-right">{pctMeta.toFixed(0)}%</span>
                  </div>
                  <div className="flex gap-4 mt-1">
                    <span className="text-xs text-text-muted">Margem: <span className={`font-medium ${f.margem >= 20 ? 'text-emerald-400' : f.margem >= 15 ? 'text-text-primary' : 'text-amber-300'}`}>{fmtPct(f.margem)}</span></span>
                    <span className="text-xs text-text-muted">Inad.: <span className={`font-medium ${f.inadimplencia > 5 ? 'text-red-400' : 'text-text-primary'}`}>{fmtPct(f.inadimplencia)}</span></span>
                    <span className="text-xs text-text-muted">Ticket médio: <span className="font-medium text-text-primary">{fmtBRL(f.ticket_medio)}</span></span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Alertas ativos */}
      {MOCK_ALERTAS.filter(a => a.ativo).length > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-300" />
            <p className="text-sm font-semibold text-amber-300">{MOCK_ALERTAS.filter(a => a.ativo).length} alerta{MOCK_ALERTAS.filter(a => a.ativo).length > 1 ? 's' : ''} ativo{MOCK_ALERTAS.filter(a => a.ativo).length > 1 ? 's' : ''}</p>
          </div>
          <div className="space-y-2">
            {MOCK_ALERTAS.filter(a => a.ativo).map(a => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${a.nivel === 'critico' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <span className="text-text-secondary">{a.descricao}</span>
                {a.valor && <span className="font-mono text-text-primary ml-auto shrink-0">{a.valor}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: DRE ─────────────────────────────────────────────────────────────────

function TabDRE() {
  const [mes, setMes] = useState('4')
  const [ano, setAno] = useState('2026')
  const [visao, setVisao] = useState('consolidado')

  const isGrupo = (item: typeof MOCK_DRE_ITENS[0]) => item.eh_grupo
  const cor = (v: number) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-text-muted'

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Sel value={mes} onChange={setMes} options={[1,2,3,4,5,6,7,8,9,10,11,12].map(m => ({ value: String(m), label: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m-1] }))} />
        <Sel value={ano} onChange={setAno} options={[2025,2026].map(a => ({ value: String(a), label: String(a) }))} />
        <Sel value={visao} onChange={setVisao} options={[{ value:'consolidado', label:'Consolidado do grupo' }, { value:'unidade', label:'Por unidade' }, { value:'cnpj', label:'Por CNPJ' }]} />
        <div className="flex-1" />
        <ExportButtons selectedIds={[]} />
      </div>

      {visao === 'consolidado' && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Conta</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Consolidado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">% Rec. Líquida</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_DRE_ITENS.map((r, i) => (
                <tr key={i} className={`border-b border-border/50 ${isGrupo(r) ? 'bg-card2' : ''}`}>
                  <td className={`px-4 py-3 ${isGrupo(r) ? 'font-bold text-text-primary' : 'text-text-muted pl-8'}`}>{r.grupo}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${cor(r.consolidado)}`}>{fmtBRL(r.consolidado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-text-muted">
                    {r.grupo !== 'RECEITA BRUTA' && r.grupo !== '(-) Devoluções' && r.grupo !== '(-) Impostos s/ vendas'
                      ? fmtPct(r.consolidado / MOCK_DRE_ITENS.find(x => x.grupo === 'RECEITA LÍQUIDA')!.consolidado * 100)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visao === 'unidade' && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Conta</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Matriz — Sorriso</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Filial — Lucas</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Consolidado</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_DRE_ITENS.map((r, i) => (
                <tr key={i} className={`border-b border-border/50 ${isGrupo(r) ? 'bg-card2' : ''}`}>
                  <td className={`px-4 py-3 ${isGrupo(r) ? 'font-bold text-text-primary' : 'text-text-muted pl-8'}`}>{r.grupo}</td>
                  <td className={`px-4 py-3 text-right font-mono ${isGrupo(r) ? 'font-bold ' + cor(r.unidade1) : 'text-text-muted'}`}>{fmtBRL(r.unidade1)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${isGrupo(r) ? 'font-bold ' + cor(r.unidade2) : 'text-text-muted'}`}>{fmtBRL(r.unidade2)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${cor(r.consolidado)}`}>{fmtBRL(r.consolidado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visao === 'cnpj' && (
        <div className="space-y-4">
          {MOCK_FILIAIS.map(f => (
            <div key={f.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <Building2 size={16} className="text-accent" />
                <div>
                  <p className="font-semibold text-text-primary text-sm">{f.nome}</p>
                  <p className="text-xs text-text-muted font-mono">{f.cnpj}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-text-muted">Receita líquida</p>
                  <p className="font-bold font-mono text-emerald-400">{fmtBRL(f.fat * 0.86)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="bg-card2 border border-border rounded-lg px-3 py-2">
                  <p className="text-xs text-text-muted">Lucro Bruto</p>
                  <p className="font-mono font-bold text-emerald-400">{fmtBRL(f.fat * f.margem / 100)}</p>
                </div>
                <div className="bg-card2 border border-border rounded-lg px-3 py-2">
                  <p className="text-xs text-text-muted">Margem</p>
                  <p className={`font-mono font-bold ${f.margem >= 20 ? 'text-emerald-400' : 'text-amber-300'}`}>{fmtPct(f.margem)}</p>
                </div>
                <div className="bg-card2 border border-border rounded-lg px-3 py-2">
                  <p className="text-xs text-text-muted">Pedidos</p>
                  <p className="font-mono font-bold text-text-primary">{f.pedidos}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Margem por Lote ─────────────────────────────────────────────────────

function TabMargemLote() {
  const [q, setQ] = useState('')
  const [filtroProduto, setFiltroProduto] = useState('todos')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [detalhe, setDetalhe] = useState<typeof MOCK_LOTES[0] | null>(null)

  const produtos = [...new Set(MOCK_LOTES.map(l => l.produto))]
  const visible = MOCK_LOTES.filter(l => {
    if (filtroProduto !== 'todos' && l.produto !== filtroProduto) return false
    const s = q.toLowerCase()
    return !s || l.produto.toLowerCase().includes(s) || l.lote.toLowerCase().includes(s) || l.fornecedor.toLowerCase().includes(s)
  })

  const toggleSel = (id: number) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(sel.size === visible.length ? new Set() : new Set(visible.map(r => r.id)))

  const margemMin = 15
  const margemAlerta = 20

  return (
    <div>
      <div className="bg-blue-900/10 border border-blue-800/40 rounded-xl p-4 mb-5 text-sm text-blue-300">
        <strong>Rastreabilidade por lote:</strong> A margem é calculada com o custo real de aquisição de cada lote individualmente — variações entre lotes do mesmo produto são visíveis e não diluídas pelo custo médio. Lotes com margem abaixo de {margemMin}% geram alerta automático.
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Lotes ativos" val={MOCK_LOTES.length} />
        <KpiCard label="Abaixo de 15%" val={MOCK_LOTES.filter(l => l.margem_pct < margemMin).length} warn />
        <KpiCard label="Margem média ponderada" val={fmtPct(MOCK_LOTES.reduce((a,l)=>a+l.margem_pct*l.receita,0)/MOCK_LOTES.reduce((a,l)=>a+l.receita,0))} ok />
        <KpiCard label="Lucro total apurado" val={fmtBRL(MOCK_LOTES.reduce((a,l)=>a+l.lucro,0))} ok />
      </div>

      <Bar value={q} onChange={setQ} placeholder="Buscar produto, lote, fornecedor...">
        <select value={filtroProduto} onChange={e => setFiltroProduto(e.target.value)}
          className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="todos">Todos os produtos</option>
          {produtos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <ExportButtons selectedIds={[...sel]} />
      </Bar>

      <Table heads={['Produto', 'Lote', 'Fornecedor', 'Data Compra', 'Qtd Comprada', 'Qtd Vendida', 'Custo/Un', 'Preço Médio/Un', 'Receita', 'Custo Total', 'Lucro', 'Margem %']}
        selHead={<input type="checkbox" checked={sel.size === visible.length && visible.length > 0} onChange={toggleAll} className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />}>
        {visible.length === 0 ? <Empty label="Nenhum lote encontrado." /> : visible.map(r => {
          const alerta = r.margem_pct < margemMin ? 'red' : r.margem_pct < margemAlerta ? 'yellow' : undefined
          return (
            <Tr key={r.id} selected={sel.has(r.id)} highlight={alerta}>
              <TdSel id={r.id} sel={sel} toggle={toggleSel} />
              <TdMain>{r.produto}</TdMain>
              <td className="px-4 py-3"><span className="text-xs font-mono bg-card2 border border-border px-2 py-0.5 rounded text-text-secondary">{r.lote}</span></td>
              <Td>{r.fornecedor}</Td>
              <Td mono>{new Date(r.dt_compra + 'T12:00:00').toLocaleDateString('pt-BR')}</Td>
              <Td mono>{r.qty_comprada.toLocaleString('pt-BR')}</Td>
              <Td mono>{r.qty_vendida.toLocaleString('pt-BR')}</Td>
              <Td mono>{fmtBRL(r.custo_lote)}</Td>
              <Td mono>{fmtBRL(r.preco_venda_medio)}</Td>
              <Td mono>{fmtBRL(r.receita)}</Td>
              <Td mono>{fmtBRL(r.custo_total)}</Td>
              <td className="px-4 py-3 font-mono font-bold text-emerald-400">{fmtBRL(r.lucro)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <BarH pct={r.margem_pct / 40 * 100} color={r.margem_pct < margemMin ? 'bg-red-500' : r.margem_pct < margemAlerta ? 'bg-amber-400' : 'bg-emerald-500'} />
                  <span className={`font-mono font-bold text-sm w-12 text-right ${r.margem_pct < margemMin ? 'text-red-400' : r.margem_pct < margemAlerta ? 'text-amber-300' : 'text-emerald-400'}`}>{fmtPct(r.margem_pct)}</span>
                  {r.margem_pct < margemMin && <AlertTriangle size={13} className="text-red-400 shrink-0" />}
                </div>
              </td>
              <td className="px-4 py-3">
                <button onClick={() => setDetalhe(r)} className="text-text-muted hover:text-accent transition-colors"><Eye size={14} /></button>
              </td>
            </Tr>
          )
        })}
      </Table>

      {/* Aviso lotes mesmos produtos com margens diferentes */}
      {(() => {
        const grupos = produtos.filter(p => {
          const lotesDoProd = MOCK_LOTES.filter(l => l.produto === p)
          if (lotesDoProd.length < 2) return false
          const margens = lotesDoProd.map(l => l.margem_pct)
          return Math.max(...margens) - Math.min(...margens) > 5
        })
        if (grupos.length === 0) return null
        return (
          <div className="mt-4 bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-amber-300" />
              <p className="text-sm font-semibold text-amber-300">Variação de custo entre lotes detectada</p>
            </div>
            <p className="text-xs text-text-secondary">Os seguintes produtos têm lotes com variação de margem {'>'} 5pp, indicando diferença de custo de aquisição: <strong className="text-text-primary">{grupos.join(', ')}</strong>. Verifique se os preços de venda estão atualizados para os lotes mais recentes.</p>
          </div>
        )
      })()}

      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-text-primary">Detalhe do Lote</h2>
              <button onClick={() => setDetalhe(null)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-text-muted">Produto</p><p className="text-text-primary font-medium">{detalhe.produto}</p></div>
                <div><p className="text-xs text-text-muted">Lote</p><p className="font-mono text-text-primary">{detalhe.lote}</p></div>
                <div><p className="text-xs text-text-muted">Fornecedor</p><p className="text-text-primary">{detalhe.fornecedor}</p></div>
                <div><p className="text-xs text-text-muted">Data de compra</p><p className="font-mono text-text-primary">{new Date(detalhe.dt_compra+'T12:00:00').toLocaleDateString('pt-BR')}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card2 border border-border rounded-xl p-3 text-center">
                  <p className="text-xs text-text-muted">Qtd comprada</p>
                  <p className="text-lg font-mono font-bold text-text-primary">{detalhe.qty_comprada}</p>
                </div>
                <div className="bg-card2 border border-border rounded-xl p-3 text-center">
                  <p className="text-xs text-text-muted">Qtd vendida</p>
                  <p className="text-lg font-mono font-bold text-text-primary">{detalhe.qty_vendida}</p>
                </div>
                <div className="bg-card2 border border-border rounded-xl p-3 text-center">
                  <p className="text-xs text-text-muted">Estoque restante</p>
                  <p className="text-lg font-mono font-bold text-text-primary">{detalhe.qty_comprada - detalhe.qty_vendida}</p>
                </div>
              </div>
              <div className="bg-card2 border border-border rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">Custo unitário (lote)</span><span className="font-mono text-text-primary">{fmtBRL(detalhe.custo_lote)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Preço médio de venda</span><span className="font-mono text-text-primary">{fmtBRL(detalhe.preco_venda_medio)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Receita total</span><span className="font-mono text-text-primary">{fmtBRL(detalhe.receita)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Custo total</span><span className="font-mono text-red-400">{fmtBRL(detalhe.custo_total)}</span></div>
                <div className="flex justify-between border-t border-border pt-2"><span className="font-semibold text-text-primary">Lucro do lote</span><span className="font-mono font-bold text-emerald-400">{fmtBRL(detalhe.lucro)}</span></div>
                <div className="flex justify-between">
                  <span className="font-semibold text-text-primary">Margem</span>
                  <span className={`font-mono font-bold text-lg ${detalhe.margem_pct < margemMin ? 'text-red-400' : detalhe.margem_pct < margemAlerta ? 'text-amber-300' : 'text-emerald-400'}`}>{fmtPct(detalhe.margem_pct)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Rentabilidade ───────────────────────────────────────────────────────

function TabRentabilidade() {
  const [visao, setVisao] = useState('produto')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [q, setQ] = useState('')

  const curvaColor = (c: string) => c === 'A' ? 'green' : c === 'B' ? 'blue' : 'gray'

  const visibleP = MOCK_PRODUTOS_RENT.filter(r => !q || r.produto.toLowerCase().includes(q.toLowerCase()) || r.categoria.toLowerCase().includes(q.toLowerCase()))
  const visibleC = MOCK_CLIENTES_RENT.filter(r => !q || r.cliente.toLowerCase().includes(q.toLowerCase()) || r.regiao.toLowerCase().includes(q.toLowerCase()))

  const toggleSelP = (id: number) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAllP = () => setSel(sel.size === visibleP.length ? new Set() : new Set(visibleP.map(r => r.id)))
  const toggleAllC = () => setSel(sel.size === visibleC.length ? new Set() : new Set(visibleC.map(r => r.id)))

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['produto', 'cliente', 'regiao'] as const).map(v => (
            <button key={v} onClick={() => { setVisao(v); setSel(new Set()); setQ('') }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${visao === v ? 'bg-accent text-bg' : 'text-text-muted hover:text-text-primary'}`}>
              {v === 'produto' ? 'Por Produto' : v === 'cliente' ? 'Por Cliente' : 'Por Região'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <ExportButtons selectedIds={[...sel]} />
      </div>

      {visao === 'produto' && (
        <>
          <Bar value={q} onChange={setQ} placeholder="Buscar produto, categoria..."><span /></Bar>
          <Table heads={['Produto', 'Categoria', 'Receita', 'Custo', 'Margem %', 'Pedidos', 'Clientes', 'Curva ABC']}
            selHead={<input type="checkbox" checked={sel.size === visibleP.length && visibleP.length > 0} onChange={toggleAllP} className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />}>
            {visibleP.map(r => (
              <Tr key={r.id} selected={sel.has(r.id)}>
                <TdSel id={r.id} sel={sel} toggle={toggleSelP} />
                <TdMain>{r.produto}</TdMain>
                <Td>{r.categoria}</Td>
                <Td mono>{fmtBRL(r.receita)}</Td>
                <Td mono>{fmtBRL(r.custo)}</Td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BarH pct={r.margem_pct / 40 * 100} color={r.margem_pct >= 20 ? 'bg-emerald-500' : r.margem_pct >= 15 ? 'bg-accent' : 'bg-amber-400'} />
                    <span className={`font-mono text-sm font-bold w-12 text-right ${r.margem_pct >= 20 ? 'text-emerald-400' : r.margem_pct >= 15 ? 'text-text-primary' : 'text-amber-300'}`}>{fmtPct(r.margem_pct)}</span>
                  </div>
                </td>
                <Td mono>{r.pedidos}</Td>
                <Td mono>{r.clientes}</Td>
                <td className="px-4 py-3"><Badge label={`Curva ${r.curva}`} color={curvaColor(r.curva)} /></td>
                <td className="w-4" />
              </Tr>
            ))}
          </Table>
        </>
      )}

      {visao === 'cliente' && (
        <>
          <Bar value={q} onChange={setQ} placeholder="Buscar cliente, região..."><span /></Bar>
          <Table heads={['Cliente', 'Região', 'Receita', 'Margem %', 'Pedidos', 'Ticket Médio', 'Inadimplência']}
            selHead={<input type="checkbox" checked={sel.size === visibleC.length && visibleC.length > 0} onChange={toggleAllC} className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />}>
            {visibleC.map(r => (
              <Tr key={r.id} selected={sel.has(r.id)}>
                <TdSel id={r.id} sel={sel} toggle={id => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n) }} />
                <TdMain>{r.cliente}</TdMain>
                <Td>{r.regiao}</Td>
                <Td mono>{fmtBRL(r.receita)}</Td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BarH pct={r.margem_pct / 35 * 100} color={r.margem_pct >= 20 ? 'bg-emerald-500' : 'bg-accent'} />
                    <span className="font-mono text-sm text-text-primary w-12 text-right">{fmtPct(r.margem_pct)}</span>
                  </div>
                </td>
                <Td mono>{r.pedidos}</Td>
                <Td mono>{fmtBRL(r.ticket_medio)}</Td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-sm ${r.inadimplencia > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{r.inadimplencia > 0 ? fmtPct(r.inadimplencia) : 'Adimplente'}</span>
                </td>
                <td className="w-4" />
              </Tr>
            ))}
          </Table>
        </>
      )}

      {visao === 'regiao' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { regiao: 'Sorriso/MT',    fat: 1120000, margem: 22.4, clientes: 38, pedidos: 142 },
            { regiao: 'Lucas/MT',      fat: 680000,  margem: 19.1, clientes: 24, pedidos: 98 },
            { regiao: 'Rondonópolis',  fat: 430000,  margem: 16.7, clientes: 15, pedidos: 61 },
          ].map(r => (
            <div key={r.regiao} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={16} className="text-accent" />
                <span className="font-semibold text-text-primary">{r.regiao}</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-text-muted">Faturamento</span><span className="font-mono font-bold text-text-primary">{fmtBRL(r.fat)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Margem</span><span className={`font-mono font-bold ${r.margem >= 20 ? 'text-emerald-400' : 'text-amber-300'}`}>{fmtPct(r.margem)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Clientes ativos</span><span className="font-mono text-text-primary">{r.clientes}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Pedidos</span><span className="font-mono text-text-primary">{r.pedidos}</span></div>
                <BarH pct={r.fat / 1120000 * 100} color="bg-accent" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Inadimplência ───────────────────────────────────────────────────────

function TabInadimplencia() {
  const [q, setQ] = useState('')
  const [filtroUnidade, setFiltroUnidade] = useState('todos')
  const [sel, setSel] = useState<Set<number>>(new Set())

  const visible = MOCK_INAD.filter(r => {
    if (filtroUnidade !== 'todos' && r.unidade !== filtroUnidade) return false
    const s = q.toLowerCase()
    return !s || r.cliente.toLowerCase().includes(s)
  })

  const toggleSel = (id: number) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(sel.size === visible.length ? new Set() : new Set(visible.map(r => r.id)))

  const total = MOCK_INAD.reduce((a, r) => a + r.valor_total, 0)
  const criticos = MOCK_INAD.filter(r => r.status === 'critico').reduce((a, r) => a + r.valor_total, 0)

  const unidades = [...new Set(MOCK_INAD.map(r => r.unidade))]

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total inadimplente" val={fmtBRL(total)} warn />
        <KpiCard label="Situação crítica (>60d)" val={fmtBRL(criticos)} warn />
        <KpiCard label="Clientes em atraso" val={MOCK_INAD.length} warn />
        <KpiCard label="% sobre faturamento" val={fmtPct(total / 2230000 * 100)} warn={total / 2230000 > 0.05} />
      </div>

      {/* Aging consolidado */}
      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Aging de Recebíveis — Consolidado</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '1–30 dias', val: MOCK_INAD.reduce((a,r)=>a+r.faixa_1_30,0), color: 'bg-amber-400' },
            { label: '31–60 dias', val: MOCK_INAD.reduce((a,r)=>a+r.faixa_31_60,0), color: 'bg-orange-500' },
            { label: '61–90 dias', val: MOCK_INAD.reduce((a,r)=>a+r.faixa_61_90,0), color: 'bg-red-500' },
            { label: '> 90 dias', val: MOCK_INAD.reduce((a,r)=>a+r.faixa_91_mais,0), color: 'bg-red-700' },
          ].map(f => (
            <div key={f.label} className="text-center">
              <p className="text-xs text-text-muted mb-2">{f.label}</p>
              <div className="h-16 bg-card2 rounded-lg flex items-end overflow-hidden">
                <div className={`w-full ${f.color} rounded-lg transition-all`} style={{ height: `${total > 0 ? f.val / total * 100 : 0}%` }} />
              </div>
              <p className="text-sm font-mono font-bold text-text-primary mt-2">{fmtBRL(f.val)}</p>
            </div>
          ))}
        </div>
      </div>

      <Bar value={q} onChange={setQ} placeholder="Buscar cliente...">
        <select value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)}
          className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="todos">Todas as unidades</option>
          {unidades.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <ExportButtons selectedIds={[...sel]} />
      </Bar>

      <Table heads={['Cliente', 'Unidade', 'Total em atraso', '1–30d', '31–60d', '61–90d', '>90d', 'Maior atraso', 'Situação']}
        selHead={<input type="checkbox" checked={sel.size === visible.length && visible.length > 0} onChange={toggleAll} className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />}>
        {visible.length === 0 ? <Empty label="Nenhum cliente inadimplente encontrado." /> : visible.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)} highlight={r.status === 'critico' ? 'red' : r.status === 'atencao' ? 'yellow' : undefined}>
            <TdSel id={r.id} sel={sel} toggle={toggleSel} />
            <TdMain>{r.cliente}</TdMain>
            <Td>{r.unidade}</Td>
            <td className="px-4 py-3 font-mono font-bold text-red-400">{fmtBRL(r.valor_total)}</td>
            <Td mono>{r.faixa_1_30 > 0 ? fmtBRL(r.faixa_1_30) : '—'}</Td>
            <Td mono>{r.faixa_31_60 > 0 ? fmtBRL(r.faixa_31_60) : '—'}</Td>
            <Td mono>{r.faixa_61_90 > 0 ? fmtBRL(r.faixa_61_90) : '—'}</Td>
            <Td mono>{r.faixa_91_mais > 0 ? fmtBRL(r.faixa_91_mais) : '—'}</Td>
            <td className="px-4 py-3 font-mono text-sm">
              <span className={r.dias_maior > 60 ? 'text-red-400 font-bold' : r.dias_maior > 30 ? 'text-amber-300' : 'text-text-muted'}>{r.dias_maior}d</span>
            </td>
            <td className="px-4 py-3">
              <Badge label={r.status === 'critico' ? 'Crítico' : r.status === 'atencao' ? 'Atenção' : 'Normal'}
                color={r.status === 'critico' ? 'red' : r.status === 'atencao' ? 'yellow' : 'gray'} />
            </td>
            <td className="w-4" />
          </Tr>
        ))}
      </Table>
    </div>
  )
}

// ─── Tab: Equipe de Vendas ────────────────────────────────────────────────────

function TabEquipe() {
  const [sel, setSel] = useState<Set<number>>(new Set())

  const toggleSel = (id: number) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(sel.size === MOCK_VENDEDORES.length ? new Set() : new Set(MOCK_VENDEDORES.map(r => r.id)))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Faturamento total" val={fmtBRL(MOCK_VENDEDORES.reduce((a,v)=>a+v.faturamento,0))} ok />
        <KpiCard label="Pedidos totais" val={MOCK_VENDEDORES.reduce((a,v)=>a+v.pedidos,0)} />
        <KpiCard label="Ticket médio geral" val={fmtBRL(MOCK_VENDEDORES.reduce((a,v)=>a+v.faturamento,0)/MOCK_VENDEDORES.reduce((a,v)=>a+v.pedidos,0))} />
        <KpiCard label="Comissões a pagar" val={fmtBRL(MOCK_VENDEDORES.reduce((a,v)=>a+v.comissao,0))} />
      </div>

      {/* Cards por vendedor */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {MOCK_VENDEDORES.map(v => {
          const pctFat = v.faturamento / v.meta_fat * 100
          const pctPed = v.pedidos / v.meta_pedidos * 100
          return (
            <div key={v.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-accent text-sm font-bold">{v.nome.split(' ').map(n=>n[0]).join('')}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-text-primary text-sm">{v.nome}</p>
                  <p className="text-xs text-text-muted">Vendedor / Consultor</p>
                </div>
                <Badge label={`${v.conversao_pct}% conv.`} color={v.conversao_pct >= 60 ? 'green' : 'yellow'} />
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-muted">Faturamento</span>
                    <span className="font-mono text-text-primary">{fmtBRL(v.faturamento)} <span className="text-text-muted">/ {fmtBRL(v.meta_fat)}</span></span>
                  </div>
                  <BarH pct={pctFat} color={pctFat >= 100 ? 'bg-emerald-500' : pctFat >= 80 ? 'bg-accent' : 'bg-amber-400'} />
                  <p className={`text-xs text-right mt-0.5 font-mono ${pctFat >= 100 ? 'text-emerald-400' : pctFat < 80 ? 'text-amber-300' : 'text-text-muted'}`}>{pctFat.toFixed(0)}% da meta</p>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-muted">Pedidos</span>
                    <span className="font-mono text-text-primary">{v.pedidos} <span className="text-text-muted">/ {v.meta_pedidos}</span></span>
                  </div>
                  <BarH pct={pctPed} color={pctPed >= 100 ? 'bg-emerald-500' : pctPed >= 80 ? 'bg-accent' : 'bg-amber-400'} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border text-center text-xs">
                <div><p className="text-text-muted">Visitas</p><p className="font-mono font-bold text-text-primary">{v.visitas}</p></div>
                <div><p className="text-text-muted">Ticket médio</p><p className="font-mono font-bold text-text-primary text-xs">{fmtBRL(v.ticket_medio)}</p></div>
                <div><p className="text-text-muted">Comissão</p><p className="font-mono font-bold text-emerald-400">{fmtBRL(v.comissao)}</p></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabela comparativa */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Comparativo de Desempenho</h3>
          <ExportButtons selectedIds={[...sel]} />
        </div>
        <Table heads={['Vendedor', 'Pedidos', 'Meta Ped.', '% Meta', 'Faturamento', 'Meta Fat.', '% Meta', 'Ticket Médio', 'Conversão', 'Visitas', 'Comissão']}
          selHead={<input type="checkbox" checked={sel.size === MOCK_VENDEDORES.length} onChange={toggleAll} className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />}>
          {MOCK_VENDEDORES.map(v => {
            const pctFat = v.faturamento / v.meta_fat * 100
            const pctPed = v.pedidos / v.meta_pedidos * 100
            return (
              <Tr key={v.id} selected={sel.has(v.id)}>
                <TdSel id={v.id} sel={sel} toggle={toggleSel} />
                <TdMain>{v.nome}</TdMain>
                <Td mono>{v.pedidos}</Td>
                <Td mono>{v.meta_pedidos}</Td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-sm font-bold ${pctPed >= 100 ? 'text-emerald-400' : pctPed < 80 ? 'text-amber-300' : 'text-text-primary'}`}>{pctPed.toFixed(0)}%</span>
                </td>
                <Td mono>{fmtBRL(v.faturamento)}</Td>
                <Td mono>{fmtBRL(v.meta_fat)}</Td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-sm font-bold ${pctFat >= 100 ? 'text-emerald-400' : pctFat < 80 ? 'text-amber-300' : 'text-text-primary'}`}>{pctFat.toFixed(0)}%</span>
                </td>
                <Td mono>{fmtBRL(v.ticket_medio)}</Td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-sm ${v.conversao_pct >= 60 ? 'text-emerald-400' : 'text-amber-300'}`}>{v.conversao_pct}%</span>
                </td>
                <Td mono>{v.visitas}</Td>
                <td className="px-4 py-3 font-mono font-bold text-emerald-400">{fmtBRL(v.comissao)}</td>
                <td className="w-4" />
              </Tr>
            )
          })}
        </Table>
      </div>
    </div>
  )
}

// ─── Tab: Alertas ─────────────────────────────────────────────────────────────

function TabAlertas() {
  const [filtro, setFiltro] = useState('todos')
  const [mostrarInativos, setMostrarInativos] = useState(false)

  const tipoIcon: Record<string, React.ReactNode> = {
    margem:        <TrendingDown size={15} />,
    meta:          <Target size={15} />,
    inadimplencia: <AlertCircle size={15} />,
    estoque:       <Package size={15} />,
  }
  const tipoLabel: Record<string, string> = {
    margem: 'Margem', meta: 'Meta', inadimplencia: 'Inadimplência', estoque: 'Estoque',
  }

  const visible = MOCK_ALERTAS.filter(a => {
    if (!mostrarInativos && !a.ativo) return false
    if (filtro !== 'todos' && a.tipo !== filtro) return false
    return true
  })

  const ativos = MOCK_ALERTAS.filter(a => a.ativo)

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Alertas ativos" val={ativos.length} warn={ativos.length > 0} />
        <KpiCard label="Críticos" val={ativos.filter(a=>a.nivel==='critico').length} warn />
        <KpiCard label="Atenção" val={ativos.filter(a=>a.nivel==='atencao').length} />
        <KpiCard label="Resolvidos" val={MOCK_ALERTAS.filter(a=>!a.ativo).length} ok />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="todos">Todos os tipos</option>
          <option value="margem">Margem</option>
          <option value="meta">Meta</option>
          <option value="inadimplencia">Inadimplência</option>
          <option value="estoque">Estoque</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
          <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)} className="w-4 h-4 accent-[var(--color-accent)]" />
          Mostrar resolvidos
        </label>
        <div className="flex-1" />
        <ExportButtons selectedIds={[]} />
      </div>

      <div className="space-y-3">
        {visible.length === 0 && (
          <div className="bg-card border border-border rounded-xl px-4 py-10 text-center text-text-muted text-sm">Nenhum alerta encontrado.</div>
        )}
        {visible.map(a => (
          <div key={a.id} className={`border rounded-xl p-4 flex items-start gap-4 ${!a.ativo ? 'opacity-50' : a.nivel === 'critico' ? 'bg-red-900/10 border-red-800/40' : 'bg-amber-950/20 border-amber-800/40'}`}>
            <div className={`mt-0.5 shrink-0 ${a.nivel === 'critico' ? 'text-red-400' : 'text-amber-300'}`}>
              {tipoIcon[a.tipo]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge label={tipoLabel[a.tipo]} color={a.tipo === 'inadimplencia' ? 'red' : a.tipo === 'margem' ? 'orange' : a.tipo === 'meta' ? 'yellow' : 'blue'} />
                <Badge label={a.nivel === 'critico' ? 'Crítico' : 'Atenção'} color={a.nivel === 'critico' ? 'red' : 'yellow'} />
                {!a.ativo && <Badge label="Resolvido" color="green" />}
              </div>
              <p className="text-sm text-text-primary">{a.descricao}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-text-muted">{a.unidade}</span>
                <span className="text-xs text-text-muted font-mono">{new Date(a.data+'T12:00:00').toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
            {a.valor && (
              <div className="shrink-0 text-right">
                <p className="text-xs text-text-muted">Valor</p>
                <p className={`font-mono font-bold ${a.nivel === 'critico' ? 'text-red-400' : 'text-amber-300'}`}>{a.valor}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 bg-blue-900/10 border border-blue-800/40 rounded-xl p-4 text-sm text-blue-300">
        <strong>Alertas automáticos:</strong> São gerados pelo sistema quando: margem de lote {'<'} 15%, inadimplência por unidade {'>'} 5%, faturamento {'<'} 80% da meta, ou vendedor {'<'} 70% da meta de pedidos. Configure os limiares em <strong>Configurações → Parâmetros de BI</strong>.
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = ['Dashboard', 'DRE', 'Margem por Lote', 'Rentabilidade', 'Inadimplência', 'Equipe de Vendas', 'Alertas']

export default function BI() {
  const [tab, setTab] = useState('Dashboard')

  return (
    <div className="p-6 max-w-screen-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">BI e Relatórios</h1>
        <p className="text-sm text-text-muted mt-1">Dashboards, DRE em três níveis e análise de margem por lote com rastreabilidade individual.</p>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Dashboard'       && <TabDashboard />}
      {tab === 'DRE'             && <TabDRE />}
      {tab === 'Margem por Lote' && <TabMargemLote />}
      {tab === 'Rentabilidade'   && <TabRentabilidade />}
      {tab === 'Inadimplência'   && <TabInadimplencia />}
      {tab === 'Equipe de Vendas' && <TabEquipe />}
      {tab === 'Alertas'         && <TabAlertas />}
    </div>
  )
}
