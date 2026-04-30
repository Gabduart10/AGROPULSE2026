import { useState } from 'react'
import {
  Plus, Search, X, ChevronDown, Wrench, AlertTriangle,
  CheckCircle2, Clock, AlertCircle, Eye, BarChart2,
  Gauge, Package,
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

function BtnNew({ onClick, label = 'Novo' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors whitespace-nowrap">
      <Plus size={16} /> {label}
    </button>
  )
}

function KpiCard({ label, val, sub, warn, ok }: { label: string; val: string | number; sub?: string; warn?: boolean; ok?: boolean }) {
  return (
    <div className={`border rounded-xl px-4 py-3 ${warn ? 'bg-yellow-900/10 border-yellow-800/40' : ok ? 'bg-emerald-900/10 border-emerald-800/40' : 'bg-card2 border-border'}`}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-xl font-bold font-mono mt-1 ${warn ? 'text-amber-300' : ok ? 'text-emerald-400' : 'text-text-primary'}`}>{val}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
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
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Tr({ children, selected, priority }: { children: React.ReactNode; selected?: boolean; priority?: string }) {
  const border = priority === 'critica' ? 'border-l-2 border-l-red-500' : priority === 'alta' ? 'border-l-2 border-l-orange-500' : priority === 'media' ? 'border-l-2 border-l-yellow-500' : ''
  return <tr className={`border-b border-border/50 hover:bg-card2 transition-colors ${selected ? 'bg-accent/5' : ''} ${border}`}>{children}</tr>
}
function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-4 py-3 ${mono ? 'font-mono text-text-secondary' : 'text-text-muted'}`}>{children ?? '—'}</td>
}
function TdMain({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 font-medium text-text-primary">{children}</td>
}
function Empty({ cols }: { cols: number }) {
  return <tr><td colSpan={cols + 2} className="text-center py-10 text-text-muted text-sm">Nenhum registro</td></tr>
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`bg-card border border-border rounded-2xl w-full max-h-[90vh] overflow-y-auto ${wide ? 'max-w-2xl' : 'max-w-xl'}`}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="font-semibold text-text-primary">{title}</h3>
          <button onClick={onClose}><X size={18} className="text-text-muted" /></button>
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

function Footer({ onClose, onSave, saving, disabled, label = 'Salvar' }: { onClose: () => void; onSave: () => void; saving: boolean; disabled?: boolean; label?: string }) {
  return (
    <div className="flex gap-2 pt-4">
      <button onClick={onClose} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2">Cancelar</button>
      <button onClick={onSave} disabled={saving || disabled} className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm disabled:opacity-60">{saving ? 'Salvando...' : label}</button>
    </div>
  )
}

const inp = 'w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors'
const selCss = inp + ' appearance-none'

function Sel({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select className={selCss} value={value} onChange={e => onChange(e.target.value)}>{children}</select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    operacional:      'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    manutencao:       'bg-amber-950/50 text-amber-200 border-amber-800/50',
    parado:           'bg-red-900/30 text-red-400 border-red-800/40',
    sucateado:        'bg-card2 text-text-muted border-border',
    ok:               'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    proximo:          'bg-amber-950/50 text-amber-200 border-amber-800/50',
    vencido:          'bg-red-900/30 text-red-400 border-red-800/40',
    aberta:           'bg-blue-900/30 text-blue-400 border-blue-800/40',
    em_andamento:     'bg-accent/20 text-accent border-accent/30',
    aguardando_peca:  'bg-amber-950/50 text-amber-200 border-amber-800/50',
    concluida:        'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    cancelada:        'bg-card2 text-text-muted border-border',
    aprovado:         'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    reprovado:        'bg-red-900/30 text-red-400 border-red-800/40',
    aprovado_ressalvas:'bg-amber-950/50 text-amber-200 border-amber-800/50',
  }
  const labels: Record<string, string> = {
    operacional:'Operacional', manutencao:'Em Manutenção', parado:'Parado', sucateado:'Sucateado',
    ok:'OK', proximo:'Próximo', vencido:'Vencido',
    aberta:'Aberta', em_andamento:'Em Andamento', aguardando_peca:'Ag. Peça', concluida:'Concluída', cancelada:'Cancelada',
    aprovado:'Aprovado', reprovado:'Reprovado', aprovado_ressalvas:'Com Ressalvas',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${m[status] ?? 'bg-card2 text-text-muted border-border'}`}>{labels[status] ?? status}</span>
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Ativo {
  id: number; nome: string; tipo: string
  fabricante: string; modelo: string; numero_serie: string; ano: number
  valor_aquisicao: number; data_aquisicao: string
  vida_util_anos: number; valor_residual: number; metodo_depreciacao: string
  horimetro_atual: number; km_atual?: number
  ultima_manutencao?: string; proxima_manutencao?: string
  status: 'operacional' | 'manutencao' | 'parado' | 'sucateado'
  localizacao?: string
}

interface PlanoManutencao {
  id: number; ativo_id: number; ativo_nome: string
  descricao: string; tipo_gatilho: 'horas' | 'km' | 'dias'
  intervalo: number; ultima_execucao?: string
  ultimo_valor?: number; proximo_valor?: number
  proxima_execucao?: string
  status: 'ok' | 'proximo' | 'vencido'
}

interface OrdemServico {
  id: number; numero: string; ativo_id: number; ativo_nome: string
  tipo: 'preventiva' | 'corretiva'
  prioridade: 'baixa' | 'media' | 'alta' | 'critica'
  descricao: string; causa_raiz?: string
  responsavel: string; data_abertura: string
  data_previsao?: string; data_conclusao?: string
  horas_trabalhadas?: number
  pecas: { descricao: string; qtd: number; valor_unit: number }[]
  custo_mao_obra: number
  status: 'aberta' | 'em_andamento' | 'aguardando_peca' | 'concluida' | 'cancelada'
}

interface Peca {
  id: number; codigo: string; descricao: string
  fabricante?: string; aplicacao: string
  estoque_atual: number; estoque_minimo: number
  preco_unitario: number; localizacao: string
}

interface Checklist {
  id: number; ativo_id: number; ativo_nome: string
  data: string; operador: string; horimetro: number
  itens: { descricao: string; ok: boolean; obs?: string }[]
  status: 'aprovado' | 'reprovado' | 'aprovado_ressalvas'
  sincronizado: boolean
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_ATIVOS: Ativo[] = [
  { id:1, nome:'Colheitadeira John Deere S680', tipo:'colheitadeira', fabricante:'John Deere', modelo:'S680', numero_serie:'1H0S680XSPL012345', ano:2021, valor_aquisicao:1200000, data_aquisicao:'2021-08-01', vida_util_anos:10, valor_residual:120000, metodo_depreciacao:'linear', horimetro_atual:1840, ultima_manutencao:'2026-02-10', proxima_manutencao:'2026-04-10', status:'operacional', localizacao:'Fazenda Santa Cruz' },
  { id:2, nome:'Trator New Holland T7.260', tipo:'trator', fabricante:'New Holland', modelo:'T7.260', numero_serie:'ZHLT7260EBF001234', ano:2020, valor_aquisicao:450000, data_aquisicao:'2020-03-15', vida_util_anos:12, valor_residual:45000, metodo_depreciacao:'linear', horimetro_atual:3120, km_atual:28400, ultima_manutencao:'2026-03-05', proxima_manutencao:'2026-05-05', status:'operacional', localizacao:'Fazenda Santa Cruz' },
  { id:3, nome:'Plantadeira Stara Hércules 2800', tipo:'plantadeira', fabricante:'Stara', modelo:'Hércules 2800', numero_serie:'STA2800HRC009876', ano:2022, valor_aquisicao:380000, data_aquisicao:'2022-09-20', vida_util_anos:10, valor_residual:38000, metodo_depreciacao:'linear', horimetro_atual:620, ultima_manutencao:'2025-10-01', proxima_manutencao:'2026-09-01', status:'operacional', localizacao:'Fazenda Santa Cruz' },
  { id:4, nome:'Pulverizador Apache 4100', tipo:'pulverizador', fabricante:'Apache', modelo:'4100', numero_serie:'APC4100X2023001', ano:2023, valor_aquisicao:280000, data_aquisicao:'2023-01-10', vida_util_anos:8, valor_residual:28000, metodo_depreciacao:'linear', horimetro_atual:940, ultima_manutencao:'2026-01-20', proxima_manutencao:'2026-04-20', status:'manutencao', localizacao:'Fazenda Santa Cruz' },
  { id:5, nome:'Pivô Central Irrigação — T01', tipo:'irrigacao', fabricante:'Valley', modelo:'8000 Series', numero_serie:'VAL8000SP2019001', ano:2019, valor_aquisicao:180000, data_aquisicao:'2019-11-01', vida_util_anos:20, valor_residual:18000, metodo_depreciacao:'linear', horimetro_atual:6200, ultima_manutencao:'2026-01-10', proxima_manutencao:'2026-07-10', status:'operacional', localizacao:'Sítio Boa Esperança' },
]

const MOCK_PLANOS: PlanoManutencao[] = [
  { id:1, ativo_id:1, ativo_nome:'Colheitadeira JD S680', descricao:'Troca de óleo motor + filtros', tipo_gatilho:'horas', intervalo:250, ultima_execucao:'2026-02-10', ultimo_valor:1600, proximo_valor:1850, status:'proximo' },
  { id:2, ativo_id:1, ativo_nome:'Colheitadeira JD S680', descricao:'Revisão completa — filtros, correia, hidráulico', tipo_gatilho:'horas', intervalo:500, ultima_execucao:'2025-10-15', ultimo_valor:1350, proximo_valor:1850, status:'vencido' },
  { id:3, ativo_id:2, ativo_nome:'Trator NH T7.260', descricao:'Troca de óleo transmissão', tipo_gatilho:'horas', intervalo:400, ultima_execucao:'2025-11-20', ultimo_valor:2800, proximo_valor:3200, status:'proximo' },
  { id:4, ativo_id:2, ativo_nome:'Trator NH T7.260', descricao:'Troca de fluido de freio', tipo_gatilho:'dias', intervalo:365, ultima_execucao:'2025-03-05', proxima_execucao:'2026-03-05', status:'vencido' },
  { id:5, ativo_id:4, ativo_nome:'Pulverizador Apache 4100', descricao:'Limpeza e regulagem dos bicos', tipo_gatilho:'horas', intervalo:100, ultima_execucao:'2026-01-20', ultimo_valor:840, proximo_valor:940, status:'vencido' },
  { id:6, ativo_id:3, ativo_nome:'Plantadeira Stara 2800', descricao:'Lubrificação geral e aperto de parafusos', tipo_gatilho:'dias', intervalo:180, ultima_execucao:'2025-10-01', proxima_execucao:'2026-04-01', status:'vencido' },
  { id:7, ativo_id:5, ativo_nome:'Pivô Central — T01', descricao:'Inspeção elétrica e lubrificação torres', tipo_gatilho:'dias', intervalo:180, ultima_execucao:'2026-01-10', proxima_execucao:'2026-07-10', status:'ok' },
]

const MOCK_OS: OrdemServico[] = [
  { id:1, numero:'OS-2026-018', ativo_id:4, ativo_nome:'Pulverizador Apache 4100', tipo:'corretiva', prioridade:'alta', descricao:'Vazamento hidráulico na mangueira do sistema de pulverização', causa_raiz:'Desgaste da mangueira por abrasão', responsavel:'Carlos Mecânico', data_abertura:'2026-04-19', data_previsao:'2026-04-22', horas_trabalhadas:4, pecas:[{ descricao:'Mangueira hidráulica 1/2"', qtd:2, valor_unit:85 },{ descricao:'Abraçadeira de pressão', qtd:4, valor_unit:12 }], custo_mao_obra:240, status:'em_andamento' },
  { id:2, numero:'OS-2026-017', ativo_id:1, ativo_nome:'Colheitadeira JD S680', tipo:'preventiva', prioridade:'media', descricao:'Troca de óleo motor + filtro de óleo + filtro de ar — 1850h', responsavel:'João Mecânico', data_abertura:'2026-04-18', data_previsao:'2026-04-21', data_conclusao:'2026-04-21', horas_trabalhadas:3, pecas:[{ descricao:'Óleo Motor 15W40 (5L)', qtd:4, valor_unit:65 },{ descricao:'Filtro de Óleo JD AM125424', qtd:1, valor_unit:180 },{ descricao:'Filtro de Ar JD AH130274', qtd:1, valor_unit:220 }], custo_mao_obra:180, status:'concluida' },
  { id:3, numero:'OS-2026-016', ativo_id:2, ativo_nome:'Trator NH T7.260', tipo:'corretiva', prioridade:'critica', descricao:'Pane elétrica — painel de instrumentos inoperante, trator parado em campo', causa_raiz:'Curto-circuito no chicote elétrico', responsavel:'Elétrico Paulo', data_abertura:'2026-04-15', data_previsao:'2026-04-16', data_conclusao:'2026-04-16', horas_trabalhadas:6, pecas:[{ descricao:'Chicote elétrico painel', qtd:1, valor_unit:420 },{ descricao:'Fusíveis kit 30 unid.', qtd:1, valor_unit:35 }], custo_mao_obra:360, status:'concluida' },
  { id:4, numero:'OS-2026-019', ativo_id:3, ativo_nome:'Plantadeira Stara 2800', tipo:'preventiva', prioridade:'baixa', descricao:'Lubrificação geral e aperto de parafusos pré-plantio', responsavel:'Carlos Mecânico', data_abertura:'2026-04-20', data_previsao:'2026-04-25', pecas:[], custo_mao_obra:0, status:'aberta' },
  { id:5, numero:'OS-2026-015', ativo_id:1, ativo_nome:'Colheitadeira JD S680', tipo:'corretiva', prioridade:'alta', descricao:'Correia da plataforma de corte partida durante operação', responsavel:'João Mecânico', data_abertura:'2026-04-10', data_previsao:'2026-04-11', horas_trabalhadas:2, pecas:[{ descricao:'Correia JD H161242', qtd:2, valor_unit:310 }], custo_mao_obra:120, status:'aguardando_peca' },
]

const MOCK_PECAS: Peca[] = [
  { id:1, codigo:'FO-JD-AM125424', descricao:'Filtro de Óleo Motor John Deere AM125424', fabricante:'John Deere', aplicacao:'S680, S690', estoque_atual:3, estoque_minimo:2, preco_unitario:180, localizacao:'Prateleira A-1' },
  { id:2, codigo:'FA-JD-AH130274', descricao:'Filtro de Ar John Deere AH130274', fabricante:'John Deere', aplicacao:'S680, S690', estoque_atual:2, estoque_minimo:2, preco_unitario:220, localizacao:'Prateleira A-2' },
  { id:3, codigo:'OL-MOT-15W40', descricao:'Óleo Motor 15W40 — Galão 5L', fabricante:'Lubrax', aplicacao:'Geral', estoque_atual:12, estoque_minimo:8, preco_unitario:65, localizacao:'Tambor B-1' },
  { id:4, codigo:'CO-JD-H161242', descricao:'Correia Plataforma JD H161242', fabricante:'John Deere', aplicacao:'S680', estoque_atual:0, estoque_minimo:2, preco_unitario:310, localizacao:'—' },
  { id:5, codigo:'MA-HID-12-2M', descricao:'Mangueira Hidráulica 1/2" — 2m', fabricante:'Parker', aplicacao:'Pulverizadores, Tratores', estoque_atual:4, estoque_minimo:3, preco_unitario:85, localizacao:'Prateleira C-3' },
  { id:6, codigo:'FL-JD-RE509672', descricao:'Filtro Combustível JD RE509672', fabricante:'John Deere', aplicacao:'S680, T7.260', estoque_atual:1, estoque_minimo:3, preco_unitario:145, localizacao:'Prateleira A-3' },
]

const MOCK_CHECKLISTS: Checklist[] = [
  { id:1, ativo_id:1, ativo_nome:'Colheitadeira JD S680', data:'2026-04-21', operador:'Carlos Eduardo', horimetro:1840,
    itens:[{ descricao:'Nível de óleo motor', ok:true },{ descricao:'Nível de combustível', ok:true },{ descricao:'Pressão dos pneus', ok:true },{ descricao:'Condição das correias da plataforma', ok:false, obs:'Correia levemente desgastada — monitorar' },{ descricao:'Sistema hidráulico — sem vazamentos', ok:true },{ descricao:'Funcionamento dos freios', ok:true },{ descricao:'Luzes e sinalização', ok:true },{ descricao:'Filtro de ar — indicador OK', ok:true }],
    status:'aprovado_ressalvas', sincronizado:true },
  { id:2, ativo_id:2, ativo_nome:'Trator NH T7.260', data:'2026-04-21', operador:'João da Silva', horimetro:3120,
    itens:[{ descricao:'Nível de óleo motor', ok:true },{ descricao:'Nível de combustível', ok:true },{ descricao:'Pressão dos pneus', ok:true },{ descricao:'Sistema elétrico e painel', ok:true },{ descricao:'Condição dos engate e TDP', ok:true },{ descricao:'Vazamentos em geral', ok:true }],
    status:'aprovado', sincronizado:true },
  { id:3, ativo_id:4, ativo_nome:'Pulverizador Apache 4100', data:'2026-04-20', operador:'Ana Ferreira', horimetro:940,
    itens:[{ descricao:'Nível de óleo motor', ok:true },{ descricao:'Sistema hidráulico — sem vazamentos', ok:false, obs:'VAZAMENTO DETECTADO — barra hidráulica lado direito' },{ descricao:'Bicos — sem entupimento', ok:true },{ descricao:'Tanque principal — sem trincas', ok:true }],
    status:'reprovado', sincronizado:true },
]

// ─── Tab Ativos ───────────────────────────────────────────────────────────────

function TabAtivos() {
  const [rows, setRows] = useState<Ativo[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [detail, setDetail] = useState<Ativo | null>(null)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))
  const [form, setForm] = useState({ nome:'', tipo:'trator', fabricante:'', modelo:'', numero_serie:'', ano:String(new Date().getFullYear()), valor_aquisicao:'', data_aquisicao:'', vida_util_anos:'10', valor_residual:'', metodo_depreciacao:'linear', localizacao:'' })

  const filtered = rows.filter(r =>
    (r.nome.toLowerCase().includes(search.toLowerCase()) || r.numero_serie.toLowerCase().includes(search.toLowerCase())) &&
    (filterStatus ? r.status === filterStatus : true)
  )

  const tiposAtivo: Record<string, string> = { trator:'Trator', colheitadeira:'Colheitadeira', plantadeira:'Plantadeira', pulverizador:'Pulverizador', irrigacao:'Irrigação', caminhao:'Caminhão', implemento:'Implemento', outro:'Outro' }

  async function save() {
    setSaving(true)
    try { await api.post('/api/ativos/', form) } catch { /* mock */ }
    const n: Ativo = { id: Date.now(), ...form, ano: +form.ano, valor_aquisicao: +form.valor_aquisicao, vida_util_anos: +form.vida_util_anos, valor_residual: +form.valor_residual, horimetro_atual: 0, status: 'operacional' }
    setRows(r => [...r, n])
    setModal(false); setSaving(false)
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total de Ativos" val={rows.length} />
        <KpiCard label="Operacionais" val={rows.filter(r => r.status === 'operacional').length} ok />
        <KpiCard label="Em Manutenção" val={rows.filter(r => r.status === 'manutencao').length} warn={rows.filter(r => r.status === 'manutencao').length > 0} />
        <KpiCard label="Valor Total Frota" val={`R$ ${(rows.reduce((s, r) => s + r.valor_aquisicao, 0) / 1000000).toFixed(2)}M`} sub="valor de aquisição" />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Nome ou nº de série...">
        <Sel value={filterStatus} onChange={setFilterStatus}>
          <option value="">Todos</option>
          <option value="operacional">Operacional</option>
          <option value="manutencao">Em Manutenção</option>
          <option value="parado">Parado</option>
        </Sel>
        <ExportButtons endpoint="/api/ativos/" filename="ativos" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <BtnNew onClick={() => setModal(true)} label="Cadastrar Ativo" />
      </Bar>

      <Table heads={['Ativo', 'Fabricante / Modelo', 'Nº Série', 'Ano', 'Horímetro', 'Últ. Manut.', 'Próx. Manut.', 'Local', 'Status']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={9} /> : filtered.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
            <TdMain>{r.nome}</TdMain>
            <Td>{r.fabricante} {r.modelo}</Td>
            <Td mono>{r.numero_serie}</Td>
            <Td mono>{r.ano}</Td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Gauge size={13} className="text-accent" />
                <span className="font-mono text-text-primary text-sm">{r.horimetro_atual.toLocaleString('pt-BR')}h</span>
              </div>
              {r.km_atual && <span className="text-xs text-text-muted font-mono">{r.km_atual.toLocaleString('pt-BR')} km</span>}
            </td>
            <Td mono>{r.ultima_manutencao}</Td>
            <td className="px-4 py-3 font-mono text-sm">
              <span className={r.proxima_manutencao && r.proxima_manutencao < new Date().toISOString().split('T')[0] ? 'text-red-400' : r.proxima_manutencao && r.proxima_manutencao <= new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] ? 'text-amber-300' : 'text-text-muted'}>
                {r.proxima_manutencao ?? '—'}
              </span>
            </td>
            <Td>{r.localizacao}</Td>
            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            <td className="px-4 py-3 w-12">
              <button onClick={() => setDetail(r)} className="p-1.5 hover:bg-card rounded text-text-muted hover:text-accent"><Eye size={14} /></button>
            </td>
          </Tr>
        ))}
      </Table>

      {detail && (
        <Modal title={detail.nome} onClose={() => setDetail(null)} wide>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[['Tipo', tiposAtivo[detail.tipo] ?? detail.tipo], ['Fabricante', detail.fabricante], ['Modelo', detail.modelo], ['Nº de Série', detail.numero_serie], ['Ano', detail.ano], ['Localização', detail.localizacao ?? '—'], ['Horímetro', `${detail.horimetro_atual.toLocaleString('pt-BR')}h`], ['Quilometragem', detail.km_atual ? `${detail.km_atual.toLocaleString('pt-BR')} km` : '—'], ['Última Manutenção', detail.ultima_manutencao ?? '—'], ['Próxima Manutenção', detail.proxima_manutencao ?? '—']].map(([k, v]) => (
                <div key={k}><span className="text-xs text-text-muted">{k}</span><p className="font-medium text-text-primary">{String(v)}</p></div>
              ))}
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-xs font-medium text-text-secondary mb-2">Dados Financeiros</p>
              <div className="grid grid-cols-3 gap-3">
                <div><span className="text-xs text-text-muted">Valor Aquisição</span><p className="font-mono text-text-primary">R$ {detail.valor_aquisicao.toLocaleString('pt-BR')}</p></div>
                <div><span className="text-xs text-text-muted">Data Aquisição</span><p className="font-mono text-text-primary">{detail.data_aquisicao}</p></div>
                <div><span className="text-xs text-text-muted">Vida Útil</span><p className="font-mono text-text-primary">{detail.vida_util_anos} anos</p></div>
                <div><span className="text-xs text-text-muted">Valor Residual</span><p className="font-mono text-text-primary">R$ {detail.valor_residual.toLocaleString('pt-BR')}</p></div>
                <div><span className="text-xs text-text-muted">Depreciação Anual</span><p className="font-mono text-accent">R$ {((detail.valor_aquisicao - detail.valor_residual) / detail.vida_util_anos).toLocaleString('pt-BR')}</p></div>
                <div><span className="text-xs text-text-muted">Método</span><p className="font-mono text-text-primary">{detail.metodo_depreciacao === 'linear' ? 'Linear' : 'Acelerada'}</p></div>
              </div>
            </div>
            <StatusBadge status={detail.status} />
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title="Cadastrar Ativo" onClose={() => setModal(false)} wide>
          <div className="space-y-4">
            <Field label="Nome / Identificação *"><input className={inp} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Colheitadeira JD S680 — Frente 1" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo *">
                <Sel value={form.tipo} onChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  {Object.entries(tiposAtivo).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Sel>
              </Field>
              <Field label="Fabricante *"><input className={inp} value={form.fabricante} onChange={e => setForm(f => ({ ...f, fabricante: e.target.value }))} placeholder="John Deere" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Modelo"><input className={inp} value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} placeholder="S680" /></Field>
              <Field label="Nº de Série"><input className={inp} value={form.numero_serie} onChange={e => setForm(f => ({ ...f, numero_serie: e.target.value }))} placeholder="1H0S680X..." /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Ano"><input type="number" className={inp} value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))} /></Field>
              <Field label="Valor Aquisição (R$) *"><input type="number" className={inp} value={form.valor_aquisicao} onChange={e => setForm(f => ({ ...f, valor_aquisicao: e.target.value }))} placeholder="1200000" /></Field>
              <Field label="Data Aquisição *"><input type="date" className={inp} value={form.data_aquisicao} onChange={e => setForm(f => ({ ...f, data_aquisicao: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Vida Útil (anos)"><input type="number" className={inp} value={form.vida_util_anos} onChange={e => setForm(f => ({ ...f, vida_util_anos: e.target.value }))} /></Field>
              <Field label="Valor Residual (R$)"><input type="number" className={inp} value={form.valor_residual} onChange={e => setForm(f => ({ ...f, valor_residual: e.target.value }))} placeholder="120000" /></Field>
              <Field label="Depreciação">
                <Sel value={form.metodo_depreciacao} onChange={v => setForm(f => ({ ...f, metodo_depreciacao: v }))}>
                  <option value="linear">Linear</option>
                  <option value="acelerada">Acelerada</option>
                </Sel>
              </Field>
            </div>
            <Field label="Localização"><input className={inp} value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))} placeholder="Fazenda / Unidade" /></Field>
            <Footer onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.nome || !form.fabricante || !form.valor_aquisicao || !form.data_aquisicao} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Preventiva ───────────────────────────────────────────────────────────

function TabPreventiva() {
  const [rows, setRows] = useState<PlanoManutencao[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [baixaModal, setBaixaModal] = useState<PlanoManutencao | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ativo_id:'1', descricao:'', tipo_gatilho:'horas', intervalo:'' })
  const [baixaForm, setBaixaForm] = useState({ data:'', valor_atual:'', observacao:'' })

  const vencidos = rows.filter(r => r.status === 'vencido').length
  const proximos = rows.filter(r => r.status === 'proximo').length

  const filtered = rows.filter(r =>
    r.ativo_nome.toLowerCase().includes(search.toLowerCase()) ||
    r.descricao.toLowerCase().includes(search.toLowerCase())
  )

  const gatilhoLabel: Record<string, string> = { horas:'Horas', km:'Quilometragem', dias:'Período (dias)' }

  function registrarBaixa() {
    setSaving(true)
    setTimeout(() => {
      setRows(r => r.map(x => x.id === baixaModal?.id ? { ...x, status: 'ok', ultima_execucao: baixaForm.data, ultimo_valor: +baixaForm.valor_atual, proximo_valor: +baixaForm.valor_atual + (x.intervalo) } : x))
      setBaixaModal(null); setSaving(false)
    }, 600)
  }

  return (
    <div>
      {(vencidos > 0 || proximos > 0) && (
        <div className="flex items-start gap-3 bg-red-900/10 border border-red-800/40 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">{vencidos} manutenção{vencidos > 1 ? 'ções' : ''} vencida{vencidos > 1 ? 's' : ''} e {proximos} próxima{proximos > 1 ? 's' : ''} do vencimento</p>
            <p className="text-xs text-text-muted mt-0.5">Verifique os itens marcados em vermelho e agende as intervenções necessárias.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Planos Cadastrados" val={rows.length} />
        <KpiCard label="Em Dia" val={rows.filter(r => r.status === 'ok').length} ok />
        <KpiCard label="Próximos do Vencimento" val={proximos} warn={proximos > 0} />
        <KpiCard label="Vencidos" val={vencidos} warn={vencidos > 0} sub="intervenção imediata" />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Ativo ou descrição...">
        <BtnNew onClick={() => setModal(true)} label="Novo Plano" />
      </Bar>

      <Table heads={['Ativo', 'Descrição', 'Gatilho', 'Intervalo', 'Última Execução', 'Próxima / Valor', 'Status', '']}>
        {filtered.length === 0 ? <Empty cols={7} /> : filtered.map(r => (
          <Tr key={r.id}>
            <TdMain>{r.ativo_nome}</TdMain>
            <Td>{r.descricao}</Td>
            <Td>{gatilhoLabel[r.tipo_gatilho]}</Td>
            <Td mono>{r.intervalo} {r.tipo_gatilho === 'dias' ? 'dias' : r.tipo_gatilho === 'km' ? 'km' : 'h'}</Td>
            <Td mono>{r.ultima_execucao ?? '—'}</Td>
            <td className="px-4 py-3">
              {r.tipo_gatilho !== 'dias'
                ? <span className={`font-mono text-sm ${r.status === 'vencido' ? 'text-red-400' : r.status === 'proximo' ? 'text-amber-300' : 'text-text-muted'}`}>{r.proximo_valor?.toLocaleString('pt-BR')} {r.tipo_gatilho === 'km' ? 'km' : 'h'}</span>
                : <span className={`font-mono text-sm ${r.status === 'vencido' ? 'text-red-400' : r.status === 'proximo' ? 'text-amber-300' : 'text-text-muted'}`}>{r.proxima_execucao}</span>}
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                {r.status === 'ok' && <CheckCircle2 size={13} className="text-emerald-400" />}
                {r.status === 'proximo' && <Clock size={13} className="text-amber-300" />}
                {r.status === 'vencido' && <AlertCircle size={13} className="text-red-400" />}
                <StatusBadge status={r.status} />
              </div>
            </td>
            <td className="px-4 py-3 w-32">
              <button onClick={() => { setBaixaForm({ data:'', valor_atual:'', observacao:'' }); setBaixaModal(r) }} className="text-xs text-accent border border-accent/30 px-2 py-1 rounded hover:bg-accent/10 whitespace-nowrap">Registrar Execução</button>
            </td>
          </Tr>
        ))}
      </Table>

      {baixaModal && (
        <Modal title={`Registrar Execução — ${baixaModal.descricao}`} onClose={() => setBaixaModal(null)}>
          <div className="space-y-4">
            <div className="bg-card2 border border-border rounded-lg px-4 py-3 text-sm">
              <p className="text-text-secondary">{baixaModal.ativo_nome} · {baixaModal.descricao}</p>
              <p className="text-xs text-text-muted mt-1">Intervalo: {baixaModal.intervalo} {baixaModal.tipo_gatilho === 'dias' ? 'dias' : baixaModal.tipo_gatilho === 'km' ? 'km' : 'horas'}</p>
            </div>
            <Field label="Data de Execução *"><input type="date" className={inp} value={baixaForm.data} onChange={e => setBaixaForm(f => ({ ...f, data: e.target.value }))} /></Field>
            {baixaModal.tipo_gatilho !== 'dias' && (
              <Field label={`${baixaModal.tipo_gatilho === 'km' ? 'Hodômetro' : 'Horímetro'} atual *`}>
                <input type="number" className={inp} value={baixaForm.valor_atual} onChange={e => setBaixaForm(f => ({ ...f, valor_atual: e.target.value }))} placeholder={baixaModal.tipo_gatilho === 'km' ? '28400' : '1840'} />
              </Field>
            )}
            <Field label="Observações"><textarea className={inp + ' min-h-[80px] resize-none'} value={baixaForm.observacao} onChange={e => setBaixaForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Peças trocadas, condições encontradas..." /></Field>
            <Footer onClose={() => setBaixaModal(null)} onSave={registrarBaixa} saving={saving} disabled={!baixaForm.data} label="Confirmar Execução" />
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title="Novo Plano de Manutenção" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Ativo *">
              <Sel value={form.ativo_id} onChange={v => setForm(f => ({ ...f, ativo_id: v }))}>
                {[]}
              </Sel>
            </Field>
            <Field label="Descrição da Manutenção *"><input className={inp} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Troca de óleo motor + filtros" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de Gatilho *">
                <Sel value={form.tipo_gatilho} onChange={v => setForm(f => ({ ...f, tipo_gatilho: v }))}>
                  <option value="horas">Horas de Uso</option>
                  <option value="km">Quilometragem</option>
                  <option value="dias">Período (dias)</option>
                </Sel>
              </Field>
              <Field label={`Intervalo (${form.tipo_gatilho === 'km' ? 'km' : form.tipo_gatilho === 'dias' ? 'dias' : 'horas'}) *`}>
                <input type="number" className={inp} value={form.intervalo} onChange={e => setForm(f => ({ ...f, intervalo: e.target.value }))} placeholder="250" />
              </Field>
            </div>
            <Footer onClose={() => setModal(false)} onSave={() => { setSaving(true); setTimeout(() => { setModal(false); setSaving(false) }, 600) }} saving={saving} disabled={!form.descricao || !form.intervalo} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Ordens de Serviço ────────────────────────────────────────────────────

function TabOrdens() {
  const [rows, setRows] = useState<OrdemServico[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [detail, setDetail] = useState<OrdemServico | null>(null)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))
  const [form, setForm] = useState({ ativo_id:'1', tipo:'corretiva', prioridade:'media', descricao:'', responsavel:'', data_previsao:'' })

  const filtered = rows.filter(r =>
    (r.numero.toLowerCase().includes(search.toLowerCase()) || r.ativo_nome.toLowerCase().includes(search.toLowerCase()) || r.descricao.toLowerCase().includes(search.toLowerCase())) &&
    (filterStatus ? r.status === filterStatus : true)
  )

  const fmtR = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits:2 })}`
  const custoPecas = (os: OrdemServico) => os.pecas.reduce((s, p) => s + p.qtd * p.valor_unit, 0)

  const prioLabel: Record<string, string> = { critica:'Crítica', alta:'Alta', media:'Média', baixa:'Baixa' }
  const prioColor: Record<string, string> = { critica:'text-red-400', alta:'text-orange-400', media:'text-amber-300', baixa:'text-emerald-400' }

  async function save() {
    setSaving(true)
    const ativo = undefined
    try { await api.post('/api/ordens-servico/', form) } catch { /* mock */ }
    const num = `OS-${new Date().getFullYear()}-${String(rows.length + 20).padStart(3, '0')}`
    const n: OrdemServico = { id: Date.now(), numero: num, ativo_id: +form.ativo_id, ativo_nome: ativo?.nome ?? '', tipo: form.tipo as OrdemServico['tipo'], prioridade: form.prioridade as OrdemServico['prioridade'], descricao: form.descricao, responsavel: form.responsavel, data_abertura: new Date().toISOString().split('T')[0], data_previsao: form.data_previsao || undefined, pecas: [], custo_mao_obra: 0, status: 'aberta' }
    setRows(r => [n, ...r])
    setModal(false); setSaving(false)
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Abertas" val={rows.filter(r => r.status === 'aberta').length} />
        <KpiCard label="Em Andamento" val={rows.filter(r => r.status === 'em_andamento').length} />
        <KpiCard label="Ag. Peça" val={rows.filter(r => r.status === 'aguardando_peca').length} warn={rows.filter(r => r.status === 'aguardando_peca').length > 0} />
        <KpiCard label="Concluídas (mês)" val={rows.filter(r => r.status === 'concluida').length} ok />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Nº OS, ativo ou descrição...">
        <Sel value={filterStatus} onChange={setFilterStatus}>
          <option value="">Todos</option>
          <option value="aberta">Aberta</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="aguardando_peca">Ag. Peça</option>
          <option value="concluida">Concluída</option>
        </Sel>
        <ExportButtons endpoint="/api/ordens-servico/" filename="ordens_servico_manutencao" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <BtnNew onClick={() => setModal(true)} label="Abrir O.S." />
      </Bar>

      <Table heads={['Nº OS', 'Ativo', 'Tipo', 'Prioridade', 'Descrição', 'Responsável', 'Abertura', 'Previsão', 'Custo Total', 'Status']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={10} /> : filtered.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)} priority={r.prioridade}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
            <Td mono>{r.numero}</Td>
            <TdMain>{r.ativo_nome}</TdMain>
            <td className="px-4 py-3"><span className={`text-xs font-medium ${r.tipo === 'corretiva' ? 'text-orange-400' : 'text-blue-400'}`}>{r.tipo === 'corretiva' ? 'Corretiva' : 'Preventiva'}</span></td>
            <td className="px-4 py-3"><span className={`text-xs font-semibold ${prioColor[r.prioridade]}`}>{prioLabel[r.prioridade]}</span></td>
            <Td>{r.descricao}</Td>
            <Td>{r.responsavel}</Td>
            <Td mono>{r.data_abertura}</Td>
            <Td mono>{r.data_previsao ?? '—'}</Td>
            <Td mono>{r.status === 'concluida' ? fmtR(custoPecas(r) + r.custo_mao_obra) : '—'}</Td>
            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            <td className="px-4 py-3 w-12">
              <button onClick={() => setDetail(r)} className="p-1.5 hover:bg-card rounded text-text-muted hover:text-accent"><Eye size={14} /></button>
            </td>
          </Tr>
        ))}
      </Table>

      {detail && (
        <Modal title={`${detail.numero} — ${detail.ativo_nome}`} onClose={() => setDetail(null)} wide>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[['Tipo', detail.tipo === 'corretiva' ? 'Corretiva' : 'Preventiva'], ['Prioridade', prioLabel[detail.prioridade]], ['Responsável', detail.responsavel], ['Abertura', detail.data_abertura], ['Previsão', detail.data_previsao ?? '—'], ['Conclusão', detail.data_conclusao ?? '—'], ['Horas Trabalhadas', detail.horas_trabalhadas ? `${detail.horas_trabalhadas}h` : '—']].map(([k, v]) => (
                <div key={k}><span className="text-xs text-text-muted">{k}</span><p className="font-medium text-text-primary">{String(v)}</p></div>
              ))}
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted mb-1">Descrição</p>
              <p className="text-text-primary">{detail.descricao}</p>
              {detail.causa_raiz && <><p className="text-xs text-text-muted mt-2 mb-1">Causa Raiz</p><p className="text-text-primary">{detail.causa_raiz}</p></>}
            </div>
            {detail.pecas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Peças Utilizadas</p>
                <div className="space-y-1">
                  {detail.pecas.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-border/50">
                      <span className="text-text-muted">{p.descricao} × {p.qtd}</span>
                      <span className="font-mono text-text-primary">R$ {(p.qtd * p.valor_unit).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm py-1 font-semibold">
                    <span className="text-text-secondary">Mão de Obra</span>
                    <span className="font-mono text-text-primary">R$ {detail.custo_mao_obra.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1.5 border-t border-border font-bold">
                    <span className="text-text-primary">Custo Total</span>
                    <span className="font-mono text-accent">R$ {(custoPecas(detail) + detail.custo_mao_obra).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title="Abrir Ordem de Serviço" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Ativo *">
              <Sel value={form.ativo_id} onChange={v => setForm(f => ({ ...f, ativo_id: v }))}>
                {[]}
              </Sel>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo *">
                <Sel value={form.tipo} onChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <option value="corretiva">Corretiva</option>
                  <option value="preventiva">Preventiva</option>
                </Sel>
              </Field>
              <Field label="Prioridade *">
                <Sel value={form.prioridade} onChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </Sel>
              </Field>
            </div>
            <Field label="Descrição / Sintoma *"><textarea className={inp + ' min-h-[80px] resize-none'} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o problema ou a manutenção a realizar..." /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Responsável"><input className={inp} value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do mecânico" /></Field>
              <Field label="Previsão de Conclusão"><input type="date" className={inp} value={form.data_previsao} onChange={e => setForm(f => ({ ...f, data_previsao: e.target.value }))} /></Field>
            </div>
            <Footer onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.descricao} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Peças / Sobressalentes ───────────────────────────────────────────────

function TabPecas() {
  const [rows, setRows] = useState<Peca[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ codigo:'', descricao:'', fabricante:'', aplicacao:'', estoque_atual:'', estoque_minimo:'', preco_unitario:'', localizacao:'' })

  const ruptura = rows.filter(r => r.estoque_atual === 0).length
  const critico = rows.filter(r => r.estoque_atual > 0 && r.estoque_atual <= r.estoque_minimo).length

  const filtered = rows.filter(r =>
    r.descricao.toLowerCase().includes(search.toLowerCase()) ||
    r.codigo.toLowerCase().includes(search.toLowerCase()) ||
    r.aplicacao.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {(ruptura > 0 || critico > 0) && (
        <div className="flex items-start gap-3 bg-red-900/10 border border-red-800/40 rounded-xl px-4 py-3 mb-4">
          <Package size={15} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary"><span className="text-red-400 font-medium">{ruptura} peça{ruptura > 1 ? 's' : ''} em ruptura de estoque</span> e {critico} abaixo do mínimo. Verifique os itens em vermelho e faça requisição de compra.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Itens Cadastrados" val={rows.length} />
        <KpiCard label="Estoque OK" val={rows.filter(r => r.estoque_atual > r.estoque_minimo).length} ok />
        <KpiCard label="Abaixo do Mínimo" val={critico} warn={critico > 0} />
        <KpiCard label="Ruptura (zerado)" val={ruptura} warn={ruptura > 0} sub="OS bloqueadas" />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Descrição, código ou aplicação...">
        <ExportButtons endpoint="/api/pecas/" filename="pecas_sobressalentes" />
        <BtnNew onClick={() => setModal(true)} label="Cadastrar Peça" />
      </Bar>

      <Table heads={['Código', 'Descrição', 'Fabricante', 'Aplicação', 'Estoque', 'Mínimo', 'Preço Unit.', 'Localização']}>
        {filtered.length === 0 ? <Empty cols={8} /> : filtered.map(r => (
          <Tr key={r.id}>
            <Td mono>{r.codigo}</Td>
            <TdMain>{r.descricao}</TdMain>
            <Td>{r.fabricante}</Td>
            <Td>{r.aplicacao}</Td>
            <td className="px-4 py-3 font-mono">
              <span className={r.estoque_atual === 0 ? 'text-red-400 font-bold' : r.estoque_atual <= r.estoque_minimo ? 'text-amber-300' : 'text-emerald-400'}>{r.estoque_atual}</span>
            </td>
            <Td mono>{r.estoque_minimo}</Td>
            <Td mono>R$ {r.preco_unitario.toFixed(2)}</Td>
            <Td>{r.localizacao}</Td>
            <td className="w-12" />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Cadastrar Peça / Sobressalente" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Código Interno *"><input className={inp} value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="FO-JD-XXXXXX" /></Field>
              <Field label="Fabricante"><input className={inp} value={form.fabricante} onChange={e => setForm(f => ({ ...f, fabricante: e.target.value }))} placeholder="John Deere" /></Field>
            </div>
            <Field label="Descrição *"><input className={inp} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Filtro de Óleo Motor JD AM125424" /></Field>
            <Field label="Aplicação (máquinas compatíveis)"><input className={inp} value={form.aplicacao} onChange={e => setForm(f => ({ ...f, aplicacao: e.target.value }))} placeholder="S680, S690" /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Estoque Atual"><input type="number" className={inp} value={form.estoque_atual} onChange={e => setForm(f => ({ ...f, estoque_atual: e.target.value }))} placeholder="0" /></Field>
              <Field label="Estoque Mínimo"><input type="number" className={inp} value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} placeholder="2" /></Field>
              <Field label="Preço Unit. (R$)"><input type="number" className={inp} value={form.preco_unitario} onChange={e => setForm(f => ({ ...f, preco_unitario: e.target.value }))} placeholder="180.00" /></Field>
            </div>
            <Field label="Localização no Estoque"><input className={inp} value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))} placeholder="Ex: Prateleira A-1" /></Field>
            <Footer onClose={() => setModal(false)} onSave={() => { setSaving(true); setTimeout(() => { setModal(false); setSaving(false) }, 600) }} saving={saving} disabled={!form.codigo || !form.descricao} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Checklist ────────────────────────────────────────────────────────────

function TabChecklist() {
  const [rows, setRows] = useState<Checklist[]>([])
  const [detail, setDetail] = useState<Checklist | null>(null)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ativo_id:'1', operador:'', horimetro:'' })

  const filtered = rows.filter(r => r.ativo_nome.toLowerCase().includes(search.toLowerCase()) || r.operador.toLowerCase().includes(search.toLowerCase()))
  const reprovados = rows.filter(r => r.status === 'reprovado').length

  return (
    <div>
      {reprovados > 0 && (
        <div className="flex items-start gap-3 bg-red-900/10 border border-red-800/40 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary"><span className="text-red-400 font-medium">{reprovados} checklist reprovado</span> — há ativos com inspeção negativa. Abrir O.S. corretiva imediatamente.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Checklists Hoje" val={rows.filter(r => r.data === '2026-04-21').length} sub="de 0 ativos" />
        <KpiCard label="Aprovados" val={rows.filter(r => r.status === 'aprovado').length} ok />
        <KpiCard label="Com Ressalvas" val={rows.filter(r => r.status === 'aprovado_ressalvas').length} warn />
        <KpiCard label="Reprovados" val={reprovados} warn={reprovados > 0} sub="OS necessária" />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Ativo ou operador...">
        <BtnNew onClick={() => setModal(true)} label="Novo Checklist" />
      </Bar>

      <Table heads={['Data', 'Ativo', 'Operador', 'Horímetro', 'Itens OK', 'Itens Falha', 'Status', 'Sync']}>
        {filtered.length === 0 ? <Empty cols={8} /> : filtered.map(r => (
          <Tr key={r.id}>
            <Td mono>{r.data}</Td>
            <TdMain>{r.ativo_nome}</TdMain>
            <Td>{r.operador}</Td>
            <Td mono>{r.horimetro.toLocaleString('pt-BR')}h</Td>
            <Td mono>{r.itens.filter(i => i.ok).length}</Td>
            <td className="px-4 py-3 font-mono">
              <span className={r.itens.filter(i => !i.ok).length > 0 ? 'text-red-400 font-semibold' : 'text-text-muted'}>{r.itens.filter(i => !i.ok).length}</span>
            </td>
            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            <td className="px-4 py-3">
              {r.sincronizado ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Clock size={14} className="text-amber-300" />}
            </td>
            <td className="px-4 py-3 w-12">
              <button onClick={() => setDetail(r)} className="p-1.5 hover:bg-card rounded text-text-muted hover:text-accent"><Eye size={14} /></button>
            </td>
          </Tr>
        ))}
      </Table>

      {detail && (
        <Modal title={`Checklist — ${detail.ativo_nome}`} onClose={() => setDetail(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-xs text-text-muted">Data</span><p className="font-medium text-text-primary">{detail.data}</p></div>
              <div><span className="text-xs text-text-muted">Operador</span><p className="font-medium text-text-primary">{detail.operador}</p></div>
              <div><span className="text-xs text-text-muted">Horímetro</span><p className="font-mono text-text-primary">{detail.horimetro}h</p></div>
            </div>
            <div className="space-y-1.5">
              {detail.itens.map((item, i) => (
                <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg ${item.ok ? 'bg-emerald-900/10 border border-emerald-800/30' : 'bg-red-900/10 border border-red-800/30'}`}>
                  <div className={`shrink-0 mt-0.5 ${item.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  </div>
                  <div>
                    <p className={`text-sm ${item.ok ? 'text-text-primary' : 'text-red-400 font-medium'}`}>{item.descricao}</p>
                    {item.obs && <p className="text-xs text-text-muted mt-0.5">{item.obs}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2"><StatusBadge status={detail.status} /></div>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title="Novo Checklist de Inspeção" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Ativo *">
              <Sel value={form.ativo_id} onChange={v => setForm(f => ({ ...f, ativo_id: v }))}>
                {[]}
              </Sel>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Operador *"><input className={inp} value={form.operador} onChange={e => setForm(f => ({ ...f, operador: e.target.value }))} placeholder="Nome do operador" /></Field>
              <Field label="Horímetro Atual"><input type="number" className={inp} value={form.horimetro} onChange={e => setForm(f => ({ ...f, horimetro: e.target.value }))} placeholder="1840" /></Field>
            </div>
            <div className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-3">
              <p className="text-xs text-accent">O checklist padrão é gerado automaticamente por tipo de ativo. Preenchimento via app mobile com funcionamento offline.</p>
            </div>
            <Footer onClose={() => setModal(false)} onSave={() => { setSaving(true); setTimeout(() => { setModal(false); setSaving(false) }, 600) }} saving={saving} disabled={!form.operador} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Depreciação ──────────────────────────────────────────────────────────

function TabDepreciacao() {
  const hoje = new Date()

  const calcDeprec = (a: Ativo) => {
    const anoInicio = new Date(a.data_aquisicao)
    const anosPassados = (hoje.getTime() - anoInicio.getTime()) / (365.25 * 86400000)
    const deprecAnual = (a.valor_aquisicao - a.valor_residual) / a.vida_util_anos
    const deprecAcum = Math.min(anosPassados * deprecAnual, a.valor_aquisicao - a.valor_residual)
    const valorContabil = Math.max(a.valor_aquisicao - deprecAcum, a.valor_residual)
    const pct = (deprecAcum / (a.valor_aquisicao - a.valor_residual)) * 100
    return { deprecAnual, deprecMensal: deprecAnual / 12, deprecAcum, valorContabil, pct: Math.min(pct, 100) }
  }

  const totalAquisicao = 0
  const totalContabil = 0
  const totalMensal = 0

  const fmtR = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits:0, maximumFractionDigits:0 })}`

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Valor Total Aquisição" val={fmtR(totalAquisicao)} />
        <KpiCard label="Valor Contábil Atual" val={fmtR(totalContabil)} sub="após depreciações" />
        <KpiCard label="Depreciação Mensal" val={fmtR(totalMensal)} sub="lançar no DRE" />
        <KpiCard label="Ativos Totalmente Dep." val={0} />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Ativo', 'Data Aquis.', 'Valor Aquisição', 'Vida Útil', 'Método', 'Deprec. Anual', 'Deprec. Mensal', 'Acumulada', 'Valor Contábil', '% Depreciado'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[]}
            <tr className="border-t-2 border-border bg-card2 font-bold">
              <td colSpan={2} className="px-4 py-3 text-text-secondary text-sm">Total</td>
              <td className="px-4 py-3 font-mono text-text-primary">{fmtR(totalAquisicao)}</td>
              <td colSpan={3} />
              <td className="px-4 py-3 font-mono text-accent">{fmtR(totalMensal)}</td>
              <td />
              <td className="px-4 py-3 font-mono text-text-primary">{fmtR(totalContabil)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-muted mt-3">A depreciação mensal de <span className="text-accent font-medium">{fmtR(totalMensal)}</span> deve ser lançada mensalmente no DRE como despesa não-caixa via Financeiro → Lançamentos.</p>
    </div>
  )
}

// ─── Tab Relatórios ───────────────────────────────────────────────────────────

function TabRelatorios() {
  const [agrup, setAgrup] = useState('ativo')
  const fmtR = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits:2 })}`

  const custoPorAtivo: any[] = [].filter(r => r.total > 0)

  const totalGeral = custoPorAtivo.reduce((s, r) => s + r.total, 0)
  const totalPrev = custoPorAtivo.reduce((s, r) => s + r.preventiva, 0)
  const totalCorr = custoPorAtivo.reduce((s, r) => s + r.corretiva, 0)
  const ratioPreventivo = totalGeral > 0 ? (totalPrev / totalGeral * 100).toFixed(1) : '0'

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="text-sm font-medium text-text-secondary">Agrupamento:</span>
        <Sel value={agrup} onChange={setAgrup}>
          <option value="ativo">Por Ativo</option>
          <option value="tipo">Por Tipo (Prev. vs Corr.)</option>
        </Sel>
        <div className="flex-1" />
        <ExportButtons endpoint="/api/manutencao/relatorio/" filename="relatorio_manutencao" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Custo Total Manutenção" val={fmtR(totalGeral)} />
        <KpiCard label="Preventiva" val={fmtR(totalPrev)} sub={`${ratioPreventivo}% do total`} ok />
        <KpiCard label="Corretiva" val={fmtR(totalCorr)} warn={totalCorr > totalPrev} sub={`${(100 - +ratioPreventivo).toFixed(1)}% do total`} />
        <KpiCard label="OS Concluídas" val={0} />
      </div>

      {+ratioPreventivo < 60 && (
        <div className="flex items-start gap-3 bg-amber-950/20 border border-amber-800/40 rounded-xl px-4 py-3 mb-5">
          <AlertTriangle size={15} className="text-amber-300 shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary"><span className="text-amber-300 font-medium">Alerta de indicador:</span> Manutenções corretivas representam {(100 - +ratioPreventivo).toFixed(1)}% do custo. O ideal é acima de 60% preventivo. Reforce o plano de manutenção preventiva.</p>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">{['Ativo', 'Preventiva', 'Corretiva', 'Total', 'Intervenções', '% Prev.'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {custoPorAtivo.map((r, i) => {
              const pct = r.total > 0 ? (r.preventiva / r.total * 100).toFixed(1) : '0'
              return (
                <tr key={i} className="border-b border-border/50 hover:bg-card2">
                  <td className="px-4 py-3 font-medium text-text-primary">{r.nome}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">{fmtR(r.preventiva)}</td>
                  <td className="px-4 py-3 font-mono text-orange-400">{fmtR(r.corretiva)}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmtR(r.total)}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{r.intervencoes}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-card2 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-mono text-text-muted">{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-border bg-card2 font-bold">
              <td className="px-4 py-3 text-text-secondary">Total</td>
              <td className="px-4 py-3 font-mono text-emerald-400">{fmtR(totalPrev)}</td>
              <td className="px-4 py-3 font-mono text-orange-400">{fmtR(totalCorr)}</td>
              <td className="px-4 py-3 font-mono text-text-primary">{fmtR(totalGeral)}</td>
              <td className="px-4 py-3 font-mono text-text-secondary">0</td>
              <td className="px-4 py-3 font-mono text-text-muted">{ratioPreventivo}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

const TABS = ['Ativos', 'Preventiva', 'Ordens de Serviço', 'Peças / Sobressalentes', 'Checklist Diário', 'Depreciação', 'Relatórios']

export default function Manutencao() {
  const [tab, setTab] = useState('Ativos')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Wrench size={20} className="text-accent" /> Manutenção e Ativos
        </h1>
        <p className="text-sm text-text-muted mt-1">Máquinas, equipamentos agrícolas e ordens de serviço</p>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Ativos'                  && <TabAtivos />}
      {tab === 'Preventiva'              && <TabPreventiva />}
      {tab === 'Ordens de Serviço'       && <TabOrdens />}
      {tab === 'Peças / Sobressalentes'  && <TabPecas />}
      {tab === 'Checklist Diário'        && <TabChecklist />}
      {tab === 'Depreciação'             && <TabDepreciacao />}
      {tab === 'Relatórios'              && <TabRelatorios />}
    </div>
  )
}
