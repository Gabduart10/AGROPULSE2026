import { useState } from 'react'
import {
  Plus, Search, X, ChevronDown, Leaf, MapPin, BookOpen,
  Tractor, BarChart2, Wifi, WifiOff, CheckCircle2, Clock,
  AlertCircle, Eye, Droplets,
} from 'lucide-react'
import ExportButtons from '../components/ExportButtons'
import { api } from '../lib/api'

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex flex-wrap border-b border-border mb-6 gap-0">
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5 ${
            active === t ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'
          }`}>
          {t.includes('★') ? <>{t.replace(' ★', '')}<span className="text-[9px] bg-emerald-900/30 text-emerald-400 border border-emerald-800/40 px-1 py-0.5 rounded font-semibold ml-0.5">IND</span></> : t}
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    planejado:     { label: 'Planejado',     cls: 'bg-blue-900/30 text-blue-400 border-blue-800/40' },
    em_andamento:  { label: 'Em andamento',  cls: 'bg-accent/20 text-accent border-accent/30' },
    colhido:       { label: 'Colhido',       cls: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40' },
    encerrado:     { label: 'Encerrado',     cls: 'bg-card2 text-text-muted border-border' },
    pendente:      { label: 'Pendente',      cls: 'bg-amber-950/50 text-amber-200 border-amber-800/50' },
    concluida:     { label: 'Concluída',     cls: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40' },
    cancelada:     { label: 'Cancelada',     cls: 'bg-red-900/30 text-red-400 border-red-800/40' },
    defensivo:     { label: 'Defensivo',     cls: 'bg-red-900/30 text-red-400 border-red-800/40' },
    fertilizante:  { label: 'Fertilizante',  cls: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40' },
    semente:       { label: 'Semente',       cls: 'bg-amber-950/50 text-amber-200 border-amber-800/50' },
    outro:         { label: 'Outro',         cls: 'bg-card2 text-text-muted border-border' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-card2 text-text-muted border-border' }
  return <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${s.cls}`}>{s.label}</span>
}

function KpiCard({ label, val, sub }: { label: string; val: string | number; sub?: string }) {
  return (
    <div className="bg-card2 border border-border rounded-xl px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-xl font-bold text-text-primary font-mono mt-1">{val}</p>
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

function Tr({ children, selected }: { children: React.ReactNode; selected?: boolean }) {
  return <tr className={`border-b border-border/50 hover:bg-card2 transition-colors ${selected ? 'bg-accent/5' : ''}`}>{children}</tr>
}
function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-4 py-3 ${mono ? 'font-mono text-text-secondary' : 'text-text-muted'}`}>{children ?? '—'}</td>
}
function TdMain({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 font-medium text-text-primary">{children}</td>
}
function Empty({ cols }: { cols: number }) {
  return <tr><td colSpan={cols + 2} className="text-center py-10 text-text-muted text-sm">Nenhum registro encontrado</td></tr>
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`bg-card border border-border rounded-2xl w-full max-h-[90vh] overflow-y-auto ${wide ? 'max-w-2xl' : 'max-w-xl'}`}>
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

function ModalFooter({ onClose, onSave, saving, disabled }: { onClose: () => void; onSave: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <div className="flex gap-2 pt-4">
      <button onClick={onClose} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2 transition-colors">Cancelar</button>
      <button onClick={onSave} disabled={saving || disabled} className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors disabled:opacity-60">
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
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

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Safra {
  id: number; nome: string; cultura: string; variedade?: string
  fazenda_id: number; fazenda_nome: string
  area_ha: number; talhoes_nomes?: string
  data_plantio_prevista: string; data_colheita_prevista: string
  data_plantio_real?: string; data_colheita_real?: string
  produtividade_prevista: number; produtividade_realizada?: number
  status: 'planejado' | 'em_andamento' | 'colhido' | 'encerrado'
}

interface Talhao {
  id: number; nome: string; gleba?: string
  fazenda_id: number; fazenda_nome: string
  area_ha: number; cultura_atual?: string
  coordenadas?: string; georeferenciado: boolean; ativo: boolean
}

interface Aplicacao {
  id: number; data: string
  fazenda_nome: string; talhao_nome: string; safra_nome: string
  tipo: 'defensivo' | 'fertilizante' | 'semente' | 'outro'
  produto: string; numero_lote: string
  dose_ha: number; unidade: string; area_ha: number
  equipamento: string; operador: string
  temperatura?: number; umidade?: number; vento_kmh?: number
}

interface DiarioCampo {
  id: number; data: string; hora: string
  fazenda_nome: string; talhao_nome?: string; safra_nome?: string
  tipo_atividade: string; operador: string
  descricao: string; fotos: number; sincronizado: boolean
}

interface OrdemServico {
  id: number; numero: string; tipo: string
  safra_nome: string; talhao_nome: string; fazenda_nome: string
  area_ha: number; data_prevista: string; data_realizada?: string
  responsavel: string; status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
}

interface ItemCusteio {
  id: number; safra_id: number
  categoria: 'insumos' | 'mao_de_obra' | 'servicos' | 'maquinario' | 'outros'
  descricao: string; valor: number; data: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_FAZENDAS = [
  { id: 1, nome: 'Fazenda Santa Cruz' },
  { id: 2, nome: 'Sítio Boa Esperança' },
]

const MOCK_TALHOES: Talhao[] = [
  { id:1, nome:'Talhão 01 — Gleba Norte', gleba:'Norte', fazenda_id:1, fazenda_nome:'Fazenda Santa Cruz', area_ha:320, cultura_atual:'Soja RR1', coordenadas:'-21.18,-47.82', georeferenciado:true, ativo:true },
  { id:2, nome:'Talhão 02 — Gleba Sul',   gleba:'Sul',   fazenda_id:1, fazenda_nome:'Fazenda Santa Cruz', area_ha:280, cultura_atual:'Milho Híbrido', coordenadas:'-21.19,-47.83', georeferenciado:true, ativo:true },
  { id:3, nome:'Talhão 03 — Brejo',        gleba:'Brejo', fazenda_id:1, fazenda_nome:'Fazenda Santa Cruz', area_ha:150, cultura_atual:'Soja RR1', georeferenciado:false, ativo:true },
  { id:4, nome:'Talhão 01 — Área Principal',               fazenda_id:2, fazenda_nome:'Sítio Boa Esperança', area_ha:200, cultura_atual:'Soja RR1', georeferenciado:true, ativo:true },
  { id:5, nome:'Talhão 02 — Várzea',                       fazenda_id:2, fazenda_nome:'Sítio Boa Esperança', area_ha:120, cultura_atual:'Cana-de-açúcar', georeferenciado:false, ativo:true },
]

const MOCK_SAFRAS: Safra[] = [
  { id:1, nome:'Soja 2025/26', cultura:'Soja', variedade:'RR1 Intacta', fazenda_id:1, fazenda_nome:'Fazenda Santa Cruz', area_ha:470, talhoes_nomes:'T01, T03', data_plantio_prevista:'2025-10-15', data_colheita_prevista:'2026-03-20', data_plantio_real:'2025-10-18', produtividade_prevista:58, status:'em_andamento' },
  { id:2, nome:'Milho 2ª Safra 2026', cultura:'Milho', variedade:'Híbrido 30A37PW', fazenda_id:1, fazenda_nome:'Fazenda Santa Cruz', area_ha:280, talhoes_nomes:'T02', data_plantio_prevista:'2026-01-20', data_colheita_prevista:'2026-06-15', produtividade_prevista:110, status:'planejado' },
  { id:3, nome:'Cana 2025', cultura:'Cana-de-açúcar', fazenda_id:2, fazenda_nome:'Sítio Boa Esperança', area_ha:120, talhoes_nomes:'T02', data_plantio_prevista:'2025-04-01', data_colheita_prevista:'2026-05-30', data_plantio_real:'2025-04-05', produtividade_prevista:85, status:'em_andamento' },
  { id:4, nome:'Soja 2024/25', cultura:'Soja', variedade:'Ativa 55i', fazenda_id:1, fazenda_nome:'Fazenda Santa Cruz', area_ha:750, talhoes_nomes:'T01, T02, T03', data_plantio_prevista:'2024-10-10', data_colheita_prevista:'2025-03-25', data_plantio_real:'2024-10-12', data_colheita_real:'2025-03-28', produtividade_prevista:60, produtividade_realizada:55.3, status:'encerrado' },
]

const MOCK_APLICACOES: Aplicacao[] = [
  { id:1, data:'2025-11-10', fazenda_nome:'Fazenda Santa Cruz', talhao_nome:'T01 — Gleba Norte', safra_nome:'Soja 2025/26', tipo:'defensivo', produto:'Roundup Original 480 SL', numero_lote:'LOT-2025-4872', dose_ha:2.5, unidade:'L/ha', area_ha:320, equipamento:'Pulverizador Automotriz Apache', operador:'Carlos Eduardo', temperatura:26, umidade:62, vento_kmh:12 },
  { id:2, data:'2025-10-20', fazenda_nome:'Fazenda Santa Cruz', talhao_nome:'T01 — Gleba Norte', safra_nome:'Soja 2025/26', tipo:'fertilizante', produto:'MAP 11-52-00', numero_lote:'YARA-2025-112', dose_ha:200, unidade:'kg/ha', area_ha:320, equipamento:'Plantadeira Stara Hercules', operador:'Paulo Mendes', temperatura:24, umidade:70, vento_kmh:8 },
  { id:3, data:'2025-10-19', fazenda_nome:'Fazenda Santa Cruz', talhao_nome:'T03 — Brejo', safra_nome:'Soja 2025/26', tipo:'semente', produto:'Soja RR1 Intacta — Lote 25A', numero_lote:'SEM-25-0091', dose_ha:55, unidade:'kg/ha', area_ha:150, equipamento:'Plantadeira John Deere 2115', operador:'Carlos Eduardo', temperatura:22, umidade:75, vento_kmh:5 },
  { id:4, data:'2025-11-28', fazenda_nome:'Fazenda Santa Cruz', talhao_nome:'T02 — Gleba Sul', safra_nome:'Soja 2025/26', tipo:'defensivo', produto:'Priori Xtra', numero_lote:'SYN-2025-8800', dose_ha:0.3, unidade:'L/ha', area_ha:280, equipamento:'Pulverizador Autopropelido', operador:'Ana Ferreira', temperatura:28, umidade:58, vento_kmh:15 },
  { id:5, data:'2025-12-05', fazenda_nome:'Sítio Boa Esperança', talhao_nome:'T01 — Área Principal', safra_nome:'Cana 2025', tipo:'fertilizante', produto:'Ureia 45%', numero_lote:'URE-2025-0034', dose_ha:150, unidade:'kg/ha', area_ha:200, equipamento:'Distribuidor de Sólidos', operador:'José Rodrigues', temperatura:30, umidade:55, vento_kmh:10 },
  { id:6, data:'2025-12-12', fazenda_nome:'Fazenda Santa Cruz', talhao_nome:'T01 — Gleba Norte', safra_nome:'Soja 2025/26', tipo:'defensivo', produto:'Engeo Pleno S', numero_lote:'SYN-2025-9910', dose_ha:0.2, unidade:'L/ha', area_ha:320, equipamento:'Pulverizador Automotriz Apache', operador:'Carlos Eduardo', temperatura:27, umidade:60, vento_kmh:11 },
]

const TIPOS_ATIVIDADE: Record<string, string> = {
  visita_tecnica:   'Visita Técnica',
  recomendacao:     'Recomendação',
  plantio:          'Plantio',
  tratos_culturais: 'Tratos Culturais',
  aplicacao:        'Aplicação',
  irrigacao:        'Irrigação',
  colheita:         'Colheita',
  avaliacao:        'Avaliação de Lavoura',
}

const MOCK_DIARIO: DiarioCampo[] = [
  { id:1, data:'2025-11-05', hora:'08:30', fazenda_nome:'Fazenda Santa Cruz', talhao_nome:'T01 — Gleba Norte', safra_nome:'Soja 2025/26', tipo_atividade:'avaliacao', operador:'Eng. Ricardo Alves', descricao:'Avaliação de estande pós-emergência. Média de 12 plantas/metro linear. Desenvolvimento uniforme. Sem sintomas de doenças ou pragas relevantes.', fotos:4, sincronizado:true },
  { id:2, data:'2025-11-12', hora:'09:00', fazenda_nome:'Fazenda Santa Cruz', talhao_nome:'T01 — Gleba Norte', safra_nome:'Soja 2025/26', tipo_atividade:'visita_tecnica', operador:'Eng. Ricardo Alves', descricao:'Visita técnica de acompanhamento. Identificado início de ferrugem asiática no canto nordeste do talhão. Recomendada aplicação preventiva de Priori Xtra.', fotos:6, sincronizado:true },
  { id:3, data:'2025-11-12', hora:'11:45', fazenda_nome:'Fazenda Santa Cruz', talhao_nome:'T01 — Gleba Norte', safra_nome:'Soja 2025/26', tipo_atividade:'recomendacao', operador:'Eng. Ricardo Alves', descricao:'RECOMENDAÇÃO: Aplicação de fungicida Priori Xtra 0,3 L/ha em área total do talhão. Urgência: alta. Janela ideal: próximos 5 dias com vento < 15 km/h.', fotos:2, sincronizado:true },
  { id:4, data:'2025-12-01', hora:'07:15', fazenda_nome:'Sítio Boa Esperança', talhao_nome:'T02 — Várzea', safra_nome:'Cana 2025', tipo_atividade:'tratos_culturais', operador:'José Rodrigues', descricao:'Cultivo mecânico entrelinhas. Solo bem preparado. Perfilhamento uniforme. Nenhuma infestação de plantas daninhas relevante.', fotos:3, sincronizado:false },
  { id:5, data:'2025-12-08', hora:'14:00', fazenda_nome:'Fazenda Santa Cruz', talhao_nome:'T02 — Gleba Sul', safra_nome:'Milho 2ª Safra 2026', tipo_atividade:'avaliacao', operador:'Eng. Patrícia Lima', descricao:'Vistoria pré-plantio. Solo em condições ideais de umidade. Análise de solo recente indica pH 6,2 e K 180 mg/dm³. Planejamento de adubação de base confirmado.', fotos:1, sincronizado:true },
  { id:6, data:'2025-12-15', hora:'06:00', fazenda_nome:'Fazenda Santa Cruz', talhao_nome:'T01 — Gleba Norte', safra_nome:'Soja 2025/26', tipo_atividade:'aplicacao', operador:'Carlos Eduardo', descricao:'Aplicação de Engeo Pleno S para controle de Helicoverpa. Condições climáticas favoráveis. Aplicação concluída sem intercorrências.', fotos:0, sincronizado:false },
]

const MOCK_ORDENS: OrdemServico[] = [
  { id:1, numero:'OS-2025-001', tipo:'plantio', safra_nome:'Soja 2025/26', talhao_nome:'T01 — Gleba Norte', fazenda_nome:'Fazenda Santa Cruz', area_ha:320, data_prevista:'2025-10-15', data_realizada:'2025-10-18', responsavel:'Carlos Eduardo', status:'concluida' },
  { id:2, numero:'OS-2025-002', tipo:'plantio', safra_nome:'Soja 2025/26', talhao_nome:'T03 — Brejo', fazenda_nome:'Fazenda Santa Cruz', area_ha:150, data_prevista:'2025-10-17', data_realizada:'2025-10-19', responsavel:'Paulo Mendes', status:'concluida' },
  { id:3, numero:'OS-2025-003', tipo:'aplicacao', safra_nome:'Soja 2025/26', talhao_nome:'T01 — Gleba Norte', fazenda_nome:'Fazenda Santa Cruz', area_ha:320, data_prevista:'2025-11-30', data_realizada:'2025-11-28', responsavel:'Ana Ferreira', status:'concluida' },
  { id:4, numero:'OS-2025-004', tipo:'tratos_culturais', safra_nome:'Soja 2025/26', talhao_nome:'T02 — Gleba Sul', fazenda_nome:'Fazenda Santa Cruz', area_ha:280, data_prevista:'2025-12-20', responsavel:'Carlos Eduardo', status:'pendente' },
  { id:5, numero:'OS-2026-001', tipo:'plantio', safra_nome:'Milho 2ª Safra 2026', talhao_nome:'T02 — Gleba Sul', fazenda_nome:'Fazenda Santa Cruz', area_ha:280, data_prevista:'2026-01-20', responsavel:'Paulo Mendes', status:'pendente' },
]

const MOCK_CUSTEIO: ItemCusteio[] = [
  { id:1, safra_id:1, categoria:'insumos',     descricao:'Sementes Soja RR1 Intacta',    valor:34680, data:'2025-10-01' },
  { id:2, safra_id:1, categoria:'insumos',     descricao:'Herbicida Roundup Original',   valor:8500,  data:'2025-10-05' },
  { id:3, safra_id:1, categoria:'insumos',     descricao:'Fungicida Priori Xtra',        valor:12300, data:'2025-11-10' },
  { id:4, safra_id:1, categoria:'insumos',     descricao:'Fertilizante MAP',             valor:28000, data:'2025-10-18' },
  { id:5, safra_id:1, categoria:'mao_de_obra', descricao:'Operadores plantio',           valor:6500,  data:'2025-10-18' },
  { id:6, safra_id:1, categoria:'maquinario',  descricao:'Hora-máquina plantadeira',     valor:9200,  data:'2025-10-18' },
  { id:7, safra_id:1, categoria:'servicos',    descricao:'Pulverização aérea',           valor:7200,  data:'2025-11-28' },
  { id:8, safra_id:1, categoria:'mao_de_obra', descricao:'Monitoramento e visitas técnicas', valor:4800, data:'2025-11-05' },
  // Safra 4 (encerrada) for comparison
  { id:9,  safra_id:4, categoria:'insumos',     descricao:'Sementes Soja Ativa 55i',  valor:68000, data:'2024-10-01' },
  { id:10, safra_id:4, categoria:'insumos',     descricao:'Defensivos (total)',       valor:45000, data:'2024-11-01' },
  { id:11, safra_id:4, categoria:'insumos',     descricao:'Fertilizantes (total)',    valor:62000, data:'2024-10-10' },
  { id:12, safra_id:4, categoria:'mao_de_obra', descricao:'Mão de obra total',       valor:18000, data:'2024-10-15' },
  { id:13, safra_id:4, categoria:'maquinario',  descricao:'Hora-máquina total',      valor:24000, data:'2024-10-15' },
  { id:14, safra_id:4, categoria:'servicos',    descricao:'Serviços terceirizados',  valor:12000, data:'2025-01-01' },
]

// ─── Tab Safras ────────────────────────────────────────────────────────────────

function TabSafras() {
  const [rows, setRows] = useState<Safra[]>(MOCK_SAFRAS)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))
  const [form, setForm] = useState({ nome:'', cultura:'soja', variedade:'', fazenda_id:'1', area_ha:'', data_plantio_prevista:'', data_colheita_prevista:'', produtividade_prevista:'', status:'planejado' })

  const filtered = rows.filter(r =>
    (r.nome.toLowerCase().includes(search.toLowerCase()) || r.fazenda_nome.toLowerCase().includes(search.toLowerCase())) &&
    (filterStatus ? r.status === filterStatus : true)
  )

  const totalArea = rows.filter(r => r.status === 'em_andamento').reduce((s, r) => s + r.area_ha, 0)
  const mediaProvPrev = rows.filter(r => r.status === 'em_andamento').length
    ? (rows.filter(r => r.status === 'em_andamento').reduce((s, r) => s + r.produtividade_prevista, 0) / rows.filter(r => r.status === 'em_andamento').length).toFixed(1)
    : '—'

  async function save() {
    setSaving(true)
    try { await api.post('/api/safras/', form) } catch { /* mock */ }
    const newRow: Safra = { id: Date.now(), nome: form.nome, cultura: form.cultura, variedade: form.variedade, fazenda_id: +form.fazenda_id, fazenda_nome: MOCK_FAZENDAS.find(f => f.id === +form.fazenda_id)?.nome ?? '', area_ha: +form.area_ha, data_plantio_prevista: form.data_plantio_prevista, data_colheita_prevista: form.data_colheita_prevista, produtividade_prevista: +form.produtividade_prevista, status: form.status as Safra['status'] }
    setRows(r => [...r, newRow])
    setModal(false)
    setSaving(false)
  }

  const culturas = ['soja', 'milho', 'cana-de-açúcar', 'algodão', 'feijão', 'sorgo', 'trigo', 'arroz', 'café', 'outro']

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Safras em Andamento" val={rows.filter(r => r.status === 'em_andamento').length} />
        <KpiCard label="Área Total Ativa (ha)" val={totalArea.toLocaleString('pt-BR')} />
        <KpiCard label="Prod. Média Prevista" val={mediaProvPrev !== '—' ? `${mediaProvPrev} sc/ha` : '—'} />
        <KpiCard label="Safras Encerradas" val={rows.filter(r => r.status === 'encerrado').length} sub="histórico" />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Buscar por safra ou fazenda...">
        <Sel value={filterStatus} onChange={setFilterStatus}>
          <option value="">Todos os status</option>
          <option value="planejado">Planejado</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="colhido">Colhido</option>
          <option value="encerrado">Encerrado</option>
        </Sel>
        <ExportButtons endpoint="/api/safras/" filename="safras" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <BtnNew onClick={() => { setForm({ nome:'', cultura:'soja', variedade:'', fazenda_id:'1', area_ha:'', data_plantio_prevista:'', data_colheita_prevista:'', produtividade_prevista:'', status:'planejado' }); setModal(true) }} label="Nova Safra" />
      </Bar>

      <Table heads={['Nome / Cultura', 'Fazenda', 'Talhões', 'Área (ha)', 'Plantio', 'Colheita', 'Prev. (sc/ha)', 'Real (sc/ha)', 'Status']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={9} /> : filtered.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
            <TdMain>
              {r.nome}
              {r.variedade && <span className="block text-xs text-text-muted font-normal">{r.variedade}</span>}
            </TdMain>
            <Td>{r.fazenda_nome}</Td>
            <Td>{r.talhoes_nomes}</Td>
            <Td mono>{r.area_ha.toLocaleString('pt-BR')}</Td>
            <Td>{r.data_plantio_real ?? r.data_plantio_prevista}{r.data_plantio_real && <span className="ml-1 text-xs text-accent">✓</span>}</Td>
            <Td>{r.data_colheita_real ?? r.data_colheita_prevista}{r.data_colheita_real && <span className="ml-1 text-xs text-accent">✓</span>}</Td>
            <Td mono>{r.produtividade_prevista}</Td>
            <Td mono>{r.produtividade_realizada ?? '—'}</Td>
            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            <td className="px-4 py-3 w-12" />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Nova Safra" onClose={() => setModal(false)} wide>
          <div className="space-y-4">
            <Field label="Nome da Safra *"><input className={inp} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Soja 2026/27" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cultura *">
                <Sel value={form.cultura} onChange={v => setForm(f => ({ ...f, cultura: v }))}>
                  {culturas.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </Sel>
              </Field>
              <Field label="Variedade / Híbrido"><input className={inp} value={form.variedade} onChange={e => setForm(f => ({ ...f, variedade: e.target.value }))} placeholder="Ex: RR1 Intacta" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fazenda *">
                <Sel value={form.fazenda_id} onChange={v => setForm(f => ({ ...f, fazenda_id: v }))}>
                  {MOCK_FAZENDAS.map(faz => <option key={faz.id} value={faz.id}>{faz.nome}</option>)}
                </Sel>
              </Field>
              <Field label="Área Total (ha) *"><input type="number" className={inp} value={form.area_ha} onChange={e => setForm(f => ({ ...f, area_ha: e.target.value }))} placeholder="470" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Plantio Previsto *"><input type="date" className={inp} value={form.data_plantio_prevista} onChange={e => setForm(f => ({ ...f, data_plantio_prevista: e.target.value }))} /></Field>
              <Field label="Colheita Prevista *"><input type="date" className={inp} value={form.data_colheita_prevista} onChange={e => setForm(f => ({ ...f, data_colheita_prevista: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Produtividade Prevista (sc/ha)"><input type="number" className={inp} value={form.produtividade_prevista} onChange={e => setForm(f => ({ ...f, produtividade_prevista: e.target.value }))} placeholder="58" /></Field>
              <Field label="Status">
                <Sel value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}>
                  <option value="planejado">Planejado</option>
                  <option value="em_andamento">Em Andamento</option>
                </Sel>
              </Field>
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.nome || !form.area_ha || !form.data_plantio_prevista} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Talhões ──────────────────────────────────────────────────────────────

function TabTalhoes() {
  const [rows, setRows] = useState<Talhao[]>(MOCK_TALHOES)
  const [search, setSearch] = useState('')
  const [filterFazenda, setFilterFazenda] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome:'', gleba:'', fazenda_id:'1', area_ha:'', cultura_atual:'', coordenadas:'' })

  const filtered = rows.filter(r =>
    (r.nome.toLowerCase().includes(search.toLowerCase()) || r.fazenda_nome.toLowerCase().includes(search.toLowerCase())) &&
    (filterFazenda ? String(r.fazenda_id) === filterFazenda : true)
  )
  const totalArea = rows.reduce((s, r) => s + r.area_ha, 0)

  async function save() {
    setSaving(true)
    try { await api.post('/api/talhoes/', form) } catch { /* mock */ }
    const newRow: Talhao = { id: Date.now(), nome: form.nome, gleba: form.gleba, fazenda_id: +form.fazenda_id, fazenda_nome: MOCK_FAZENDAS.find(f => f.id === +form.fazenda_id)?.nome ?? '', area_ha: +form.area_ha, cultura_atual: form.cultura_atual, coordenadas: form.coordenadas, georeferenciado: !!form.coordenadas, ativo: true }
    setRows(r => [...r, newRow])
    setModal(false)
    setSaving(false)
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total de Talhões" val={rows.length} />
        <KpiCard label="Área Total (ha)" val={totalArea.toLocaleString('pt-BR')} />
        <KpiCard label="Georeferenciados" val={rows.filter(r => r.georeferenciado).length} sub={`de ${rows.length} talhões`} />
        <KpiCard label="Ativos" val={rows.filter(r => r.ativo).length} />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Buscar talhão ou fazenda...">
        <Sel value={filterFazenda} onChange={setFilterFazenda}>
          <option value="">Todas as fazendas</option>
          {MOCK_FAZENDAS.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </Sel>
        <BtnNew onClick={() => { setForm({ nome:'', gleba:'', fazenda_id:'1', area_ha:'', cultura_atual:'', coordenadas:'' }); setModal(true) }} label="Novo Talhão" />
      </Bar>

      <Table heads={['Fazenda', 'Talhão', 'Gleba', 'Área (ha)', 'Cultura Atual', 'Georreferenciado']}>
        {filtered.length === 0 ? <Empty cols={6} /> : filtered.map(r => (
          <Tr key={r.id}>
            <Td>{r.fazenda_nome}</Td>
            <TdMain>{r.nome}</TdMain>
            <Td>{r.gleba}</Td>
            <Td mono>{r.area_ha.toLocaleString('pt-BR')}</Td>
            <Td>{r.cultura_atual}</Td>
            <td className="px-4 py-3">
              {r.georeferenciado
                ? <span className="flex items-center gap-1 text-xs text-emerald-400"><MapPin size={13} /> Sim</span>
                : <span className="text-xs text-text-muted">Não</span>}
            </td>
            <td className="w-12" />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Novo Talhão" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Fazenda *">
              <Sel value={form.fazenda_id} onChange={v => setForm(f => ({ ...f, fazenda_id: v }))}>
                {MOCK_FAZENDAS.map(faz => <option key={faz.id} value={faz.id}>{faz.nome}</option>)}
              </Sel>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome do Talhão *"><input className={inp} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Talhão 04 — Cerrado" /></Field>
              <Field label="Gleba"><input className={inp} value={form.gleba} onChange={e => setForm(f => ({ ...f, gleba: e.target.value }))} placeholder="Ex: Norte, Sul, Brejo" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Área (ha) *"><input type="number" className={inp} value={form.area_ha} onChange={e => setForm(f => ({ ...f, area_ha: e.target.value }))} placeholder="180" /></Field>
              <Field label="Cultura Atual"><input className={inp} value={form.cultura_atual} onChange={e => setForm(f => ({ ...f, cultura_atual: e.target.value }))} placeholder="Ex: Soja RR1" /></Field>
            </div>
            <Field label="Coordenadas GPS (lat, lon)"><input className={inp} value={form.coordenadas} onChange={e => setForm(f => ({ ...f, coordenadas: e.target.value }))} placeholder="-21.1767, -47.8208" /></Field>
            <div className="bg-card2 border border-border rounded-lg px-4 py-3">
              <p className="text-xs text-text-muted">Para importar shapefile ou KML com limites precisos do talhão, utilize o botão de upload após o cadastro.</p>
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.nome || !form.area_ha} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Aplicações ───────────────────────────────────────────────────────────

function TabAplicacoes() {
  const [rows, setRows] = useState<Aplicacao[]>(MOCK_APLICACOES)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterSafra, setFilterSafra] = useState('')
  const [modal, setModal] = useState(false)
  const [detail, setDetail] = useState<Aplicacao | null>(null)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))
  const [form, setForm] = useState({ data: '', fazenda_id: '1', talhao_id: '', safra_id: '', tipo: 'defensivo', produto: '', numero_lote: '', dose_ha: '', unidade: 'L/ha', area_ha: '', equipamento: '', operador: '', temperatura: '', umidade: '', vento_kmh: '' })

  const talhoesFazenda = MOCK_TALHOES.filter(t => t.fazenda_id === +form.fazenda_id)

  const filtered = rows.filter(r =>
    (r.produto.toLowerCase().includes(search.toLowerCase()) || r.talhao_nome.toLowerCase().includes(search.toLowerCase()) || r.numero_lote.toLowerCase().includes(search.toLowerCase())) &&
    (filterTipo ? r.tipo === filterTipo : true) &&
    (filterSafra ? r.safra_nome === filterSafra : true)
  )

  const areaTotal = rows.reduce((s, r) => s + r.area_ha, 0)

  async function save() {
    setSaving(true)
    const fazenda = MOCK_FAZENDAS.find(f => f.id === +form.fazenda_id)
    const talhao = MOCK_TALHOES.find(t => t.id === +form.talhao_id)
    const safra = MOCK_SAFRAS.find(s => s.id === +form.safra_id)
    try { await api.post('/api/aplicacoes/', form) } catch { /* mock */ }
    const newRow: Aplicacao = { id: Date.now(), data: form.data, fazenda_nome: fazenda?.nome ?? '', talhao_nome: talhao?.nome ?? '', safra_nome: safra?.nome ?? '', tipo: form.tipo as Aplicacao['tipo'], produto: form.produto, numero_lote: form.numero_lote, dose_ha: +form.dose_ha, unidade: form.unidade, area_ha: +form.area_ha, equipamento: form.equipamento, operador: form.operador, temperatura: form.temperatura ? +form.temperatura : undefined, umidade: form.umidade ? +form.umidade : undefined, vento_kmh: form.vento_kmh ? +form.vento_kmh : undefined }
    setRows(r => [newRow, ...r])
    setModal(false)
    setSaving(false)
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total de Aplicações" val={rows.length} />
        <KpiCard label="Área Total Coberta (ha)" val={areaTotal.toLocaleString('pt-BR')} />
        <KpiCard label="Defensivos" val={rows.filter(r => r.tipo === 'defensivo').length} sub="aplicações" />
        <KpiCard label="Fertilizantes" val={rows.filter(r => r.tipo === 'fertilizante').length} sub="aplicações" />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Produto, talhão ou lote...">
        <Sel value={filterTipo} onChange={setFilterTipo}>
          <option value="">Todos os tipos</option>
          <option value="defensivo">Defensivo</option>
          <option value="fertilizante">Fertilizante</option>
          <option value="semente">Semente</option>
          <option value="outro">Outro</option>
        </Sel>
        <Sel value={filterSafra} onChange={setFilterSafra}>
          <option value="">Todas as safras</option>
          {MOCK_SAFRAS.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
        </Sel>
        <ExportButtons endpoint="/api/aplicacoes/" filename="aplicacoes" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <BtnNew onClick={() => { setForm({ data:'', fazenda_id:'1', talhao_id:'', safra_id:'', tipo:'defensivo', produto:'', numero_lote:'', dose_ha:'', unidade:'L/ha', area_ha:'', equipamento:'', operador:'', temperatura:'', umidade:'', vento_kmh:'' }); setModal(true) }} label="Registrar Aplicação" />
      </Bar>

      <Table heads={['Data', 'Fazenda / Talhão', 'Safra', 'Tipo', 'Produto', 'Nº Lote', 'Dose', 'Área (ha)', 'Operador']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={9} /> : filtered.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
            <Td mono>{r.data}</Td>
            <TdMain>{r.talhao_nome}<span className="block text-xs text-text-muted font-normal">{r.fazenda_nome}</span></TdMain>
            <Td>{r.safra_nome}</Td>
            <td className="px-4 py-3"><StatusBadge status={r.tipo} /></td>
            <TdMain>{r.produto}</TdMain>
            <Td mono>{r.numero_lote}</Td>
            <Td mono>{r.dose_ha} {r.unidade}</Td>
            <Td mono>{r.area_ha}</Td>
            <Td>{r.operador}</Td>
            <td className="px-4 py-3 w-12">
              <button onClick={() => setDetail(r)} className="p-1.5 hover:bg-card rounded text-text-muted hover:text-accent transition-colors"><Eye size={14} /></button>
            </td>
          </Tr>
        ))}
      </Table>

      {/* Detail modal */}
      {detail && (
        <Modal title={`Aplicação — ${detail.produto}`} onClose={() => setDetail(null)}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                ['Data', detail.data], ['Fazenda', detail.fazenda_nome], ['Talhão', detail.talhao_nome],
                ['Safra', detail.safra_nome], ['Tipo', detail.tipo], ['Produto', detail.produto],
                ['Número do Lote', detail.numero_lote], ['Dose', `${detail.dose_ha} ${detail.unidade}`],
                ['Área Aplicada', `${detail.area_ha} ha`], ['Equipamento', detail.equipamento],
                ['Operador', detail.operador],
              ].map(([k, v]) => (
                <div key={k}><span className="text-text-muted text-xs">{k}</span><p className="text-text-primary font-medium">{v}</p></div>
              ))}
            </div>
            {(detail.temperatura || detail.umidade || detail.vento_kmh) && (
              <div className="border border-border rounded-lg p-3 mt-2">
                <p className="text-xs font-medium text-text-secondary mb-2">Condições Climáticas</p>
                <div className="flex gap-4 text-sm">
                  {detail.temperatura && <span className="text-text-muted"><span className="text-text-primary font-medium">{detail.temperatura}°C</span> Temperatura</span>}
                  {detail.umidade && <span className="text-text-muted"><span className="text-text-primary font-medium">{detail.umidade}%</span> Umidade</span>}
                  {detail.vento_kmh && <span className="text-text-muted"><span className="text-text-primary font-medium">{detail.vento_kmh} km/h</span> Vento</span>}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* New application modal */}
      {modal && (
        <Modal title="Registrar Aplicação" onClose={() => setModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data *"><input type="date" className={inp} value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></Field>
              <Field label="Tipo *">
                <Sel value={form.tipo} onChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <option value="defensivo">Defensivo</option>
                  <option value="fertilizante">Fertilizante</option>
                  <option value="semente">Semente</option>
                  <option value="outro">Outro</option>
                </Sel>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fazenda *">
                <Sel value={form.fazenda_id} onChange={v => setForm(f => ({ ...f, fazenda_id: v, talhao_id: '' }))}>
                  {MOCK_FAZENDAS.map(faz => <option key={faz.id} value={faz.id}>{faz.nome}</option>)}
                </Sel>
              </Field>
              <Field label="Talhão *">
                <Sel value={form.talhao_id} onChange={v => setForm(f => ({ ...f, talhao_id: v }))}>
                  <option value="">Selecionar...</option>
                  {talhoesFazenda.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </Sel>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Safra *">
                <Sel value={form.safra_id} onChange={v => setForm(f => ({ ...f, safra_id: v }))}>
                  <option value="">Selecionar...</option>
                  {MOCK_SAFRAS.filter(s => s.fazenda_id === +form.fazenda_id).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </Sel>
              </Field>
              <Field label="Área Aplicada (ha) *"><input type="number" className={inp} value={form.area_ha} onChange={e => setForm(f => ({ ...f, area_ha: e.target.value }))} placeholder="320" /></Field>
            </div>
            <Field label="Produto (nome comercial) *"><input className={inp} value={form.produto} onChange={e => setForm(f => ({ ...f, produto: e.target.value }))} placeholder="Ex: Roundup Original 480 SL" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Número do Lote *"><input className={inp} value={form.numero_lote} onChange={e => setForm(f => ({ ...f, numero_lote: e.target.value }))} placeholder="LOT-2025-XXXX" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Dose *"><input type="number" className={inp} value={form.dose_ha} onChange={e => setForm(f => ({ ...f, dose_ha: e.target.value }))} placeholder="2.5" /></Field>
                <Field label="Unidade">
                  <Sel value={form.unidade} onChange={v => setForm(f => ({ ...f, unidade: v }))}>
                    {['L/ha','ml/ha','kg/ha','g/ha','sc/ha'].map(u => <option key={u} value={u}>{u}</option>)}
                  </Sel>
                </Field>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Equipamento"><input className={inp} value={form.equipamento} onChange={e => setForm(f => ({ ...f, equipamento: e.target.value }))} placeholder="Ex: Pulverizador Apache" /></Field>
              <Field label="Operador"><input className={inp} value={form.operador} onChange={e => setForm(f => ({ ...f, operador: e.target.value }))} placeholder="Nome do operador" /></Field>
            </div>
            <p className="text-xs font-medium text-text-secondary">Condições Climáticas no Momento</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Temperatura (°C)"><input type="number" className={inp} value={form.temperatura} onChange={e => setForm(f => ({ ...f, temperatura: e.target.value }))} placeholder="26" /></Field>
              <Field label="Umidade (%)"><input type="number" className={inp} value={form.umidade} onChange={e => setForm(f => ({ ...f, umidade: e.target.value }))} placeholder="62" /></Field>
              <Field label="Vento (km/h)"><input type="number" className={inp} value={form.vento_kmh} onChange={e => setForm(f => ({ ...f, vento_kmh: e.target.value }))} placeholder="12" /></Field>
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.data || !form.produto || !form.numero_lote || !form.area_ha || !form.talhao_id} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Diário de Campo ──────────────────────────────────────────────────────

function TabDiario() {
  const [rows, setRows] = useState<DiarioCampo[]>(MOCK_DIARIO)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterFazenda, setFilterFazenda] = useState('')
  const [modal, setModal] = useState(false)
  const [detail, setDetail] = useState<DiarioCampo | null>(null)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))
  const [form, setForm] = useState({ data:'', hora:'', fazenda_id:'1', talhao_id:'', safra_id:'', tipo_atividade:'visita_tecnica', operador:'', descricao:'' })

  const talhoesFazenda = MOCK_TALHOES.filter(t => t.fazenda_id === +form.fazenda_id)
  const pendentes = rows.filter(r => !r.sincronizado).length

  const filtered = rows.filter(r =>
    (r.descricao.toLowerCase().includes(search.toLowerCase()) || r.operador.toLowerCase().includes(search.toLowerCase())) &&
    (filterTipo ? r.tipo_atividade === filterTipo : true) &&
    (filterFazenda ? r.fazenda_nome === filterFazenda : true)
  )

  async function save() {
    setSaving(true)
    const fazenda = MOCK_FAZENDAS.find(f => f.id === +form.fazenda_id)
    const talhao = MOCK_TALHOES.find(t => t.id === +form.talhao_id)
    const safra = MOCK_SAFRAS.find(s => s.id === +form.safra_id)
    try { await api.post('/api/diario-campo/', form) } catch { /* mock */ }
    const newRow: DiarioCampo = { id: Date.now(), data: form.data, hora: form.hora, fazenda_nome: fazenda?.nome ?? '', talhao_nome: talhao?.nome, safra_nome: safra?.nome, tipo_atividade: form.tipo_atividade, operador: form.operador, descricao: form.descricao, fotos: 0, sincronizado: navigator.onLine }
    setRows(r => [newRow, ...r])
    setModal(false)
    setSaving(false)
  }

  const tipoColors: Record<string, string> = {
    visita_tecnica: 'bg-blue-900/30 text-blue-400 border-blue-800/40',
    recomendacao:   'bg-accent/20 text-accent border-accent/30',
    aplicacao:      'bg-red-900/30 text-red-400 border-red-800/40',
    avaliacao:      'bg-purple-900/30 text-purple-400 border-purple-800/40',
    plantio:        'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    colheita:       'bg-amber-950/50 text-amber-200 border-amber-800/50',
  }

  return (
    <div>
      {pendentes > 0 && (
        <div className="flex items-center gap-3 bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3 mb-4">
          <WifiOff size={16} className="text-amber-300 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">{pendentes} registro{pendentes > 1 ? 's' : ''} aguardando sincronização</p>
            <p className="text-xs text-text-muted">Registros criados offline serão sincronizados quando a conexão for reestabelecida.</p>
          </div>
          <button className="text-xs text-amber-300 border border-amber-800/40 px-3 py-1 rounded-lg hover:bg-amber-950/40 transition-colors flex items-center gap-1"><Wifi size={12} /> Sincronizar</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total de Registros" val={rows.length} />
        <KpiCard label="Visitas Técnicas" val={rows.filter(r => r.tipo_atividade === 'visita_tecnica').length} />
        <KpiCard label="Recomendações" val={rows.filter(r => r.tipo_atividade === 'recomendacao').length} />
        <KpiCard label="Pendentes Sync" val={pendentes} sub={pendentes > 0 ? 'offline' : 'tudo sincronizado'} />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Buscar descrição ou operador...">
        <Sel value={filterTipo} onChange={setFilterTipo}>
          <option value="">Todas as atividades</option>
          {Object.entries(TIPOS_ATIVIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Sel>
        <Sel value={filterFazenda} onChange={setFilterFazenda}>
          <option value="">Todas as fazendas</option>
          {MOCK_FAZENDAS.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
        </Sel>
        <ExportButtons endpoint="/api/diario-campo/" filename="diario_campo" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <BtnNew onClick={() => { setForm({ data:'', hora:'', fazenda_id:'1', talhao_id:'', safra_id:'', tipo_atividade:'visita_tecnica', operador:'', descricao:'' }); setModal(true) }} label="Novo Registro" />
      </Bar>

      <Table heads={['Data / Hora', 'Fazenda / Talhão', 'Safra', 'Atividade', 'Operador', 'Fotos', 'Sync']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={7} /> : filtered.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
            <Td mono>{r.data} {r.hora}</Td>
            <TdMain>{r.talhao_nome ?? r.fazenda_nome}<span className="block text-xs text-text-muted font-normal">{r.talhao_nome ? r.fazenda_nome : ''}</span></TdMain>
            <Td>{r.safra_nome}</Td>
            <td className="px-4 py-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${tipoColors[r.tipo_atividade] ?? 'bg-card2 text-text-muted border-border'}`}>
                {TIPOS_ATIVIDADE[r.tipo_atividade] ?? r.tipo_atividade}
              </span>
            </td>
            <Td>{r.operador}</Td>
            <Td mono>{r.fotos > 0 ? `${r.fotos} fotos` : '—'}</Td>
            <td className="px-4 py-3">
              {r.sincronizado
                ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={12} /> Sync</span>
                : <span className="flex items-center gap-1 text-xs text-amber-300"><Clock size={12} /> Pendente</span>}
            </td>
            <td className="px-4 py-3 w-12">
              <button onClick={() => setDetail(r)} className="p-1.5 hover:bg-card rounded text-text-muted hover:text-accent transition-colors"><Eye size={14} /></button>
            </td>
          </Tr>
        ))}
      </Table>

      {detail && (
        <Modal title="Registro de Campo" onClose={() => setDetail(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[['Data / Hora', `${detail.data} ${detail.hora}`], ['Fazenda', detail.fazenda_nome], ['Talhão', detail.talhao_nome ?? '—'], ['Safra', detail.safra_nome ?? '—'], ['Atividade', TIPOS_ATIVIDADE[detail.tipo_atividade] ?? detail.tipo_atividade], ['Operador', detail.operador]].map(([k, v]) => (
                <div key={k}><span className="text-text-muted text-xs">{k}</span><p className="text-text-primary font-medium">{v}</p></div>
              ))}
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-xs text-text-secondary mb-1">Descrição</p>
              <p className="text-sm text-text-primary whitespace-pre-line">{detail.descricao}</p>
            </div>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{detail.fotos} foto{detail.fotos !== 1 ? 's' : ''} anexada{detail.fotos !== 1 ? 's' : ''}</span>
              {detail.sincronizado
                ? <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 size={11} /> Sincronizado</span>
                : <span className="flex items-center gap-1 text-amber-300"><Clock size={11} /> Pendente sincronização</span>}
            </div>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title="Novo Registro de Campo" onClose={() => setModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data *"><input type="date" className={inp} value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></Field>
              <Field label="Hora"><input type="time" className={inp} value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fazenda *">
                <Sel value={form.fazenda_id} onChange={v => setForm(f => ({ ...f, fazenda_id: v, talhao_id: '' }))}>
                  {MOCK_FAZENDAS.map(faz => <option key={faz.id} value={faz.id}>{faz.nome}</option>)}
                </Sel>
              </Field>
              <Field label="Talhão">
                <Sel value={form.talhao_id} onChange={v => setForm(f => ({ ...f, talhao_id: v }))}>
                  <option value="">— Toda a fazenda —</option>
                  {talhoesFazenda.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </Sel>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de Atividade *">
                <Sel value={form.tipo_atividade} onChange={v => setForm(f => ({ ...f, tipo_atividade: v }))}>
                  {Object.entries(TIPOS_ATIVIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Sel>
              </Field>
              <Field label="Safra (opcional)">
                <Sel value={form.safra_id} onChange={v => setForm(f => ({ ...f, safra_id: v }))}>
                  <option value="">— Nenhuma —</option>
                  {MOCK_SAFRAS.filter(s => s.fazenda_id === +form.fazenda_id).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </Sel>
              </Field>
            </div>
            <Field label="Técnico / Operador *"><input className={inp} value={form.operador} onChange={e => setForm(f => ({ ...f, operador: e.target.value }))} placeholder="Nome do responsável" /></Field>
            <Field label="Descrição / Observações *"><textarea className={inp + ' min-h-[100px] resize-none'} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva as atividades realizadas, observações técnicas, recomendações..." /></Field>
            <div className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-3">
              <p className="text-xs text-accent">Registros criados sem conexão à internet serão salvos localmente e sincronizados automaticamente quando a conexão for reestabelecida.</p>
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.data || !form.operador || !form.descricao} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Ordens de Serviço (Indústria) ────────────────────────────────────────

function TabOrdens() {
  const [rows, setRows] = useState<OrdemServico[]>(MOCK_ORDENS)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))
  const [form, setForm] = useState({ tipo:'plantio', safra_id:'1', talhao_id:'', fazenda_id:'1', area_ha:'', data_prevista:'', responsavel:'', observacao:'' })

  const talhoesFazenda = MOCK_TALHOES.filter(t => t.fazenda_id === +form.fazenda_id)

  const filtered = rows.filter(r =>
    (r.numero.toLowerCase().includes(search.toLowerCase()) || r.responsavel.toLowerCase().includes(search.toLowerCase()) || r.talhao_nome.toLowerCase().includes(search.toLowerCase())) &&
    (filterStatus ? r.status === filterStatus : true)
  )

  const atrasadas = rows.filter(r => r.status === 'pendente' && r.data_prevista < new Date().toISOString().split('T')[0]).length

  const tiposOS: Record<string, string> = { plantio:'Plantio', tratos_culturais:'Tratos Culturais', irrigacao:'Irrigação', aplicacao:'Aplicação', colheita:'Colheita', outro:'Outro' }

  async function save() {
    setSaving(true)
    const fazenda = MOCK_FAZENDAS.find(f => f.id === +form.fazenda_id)
    const talhao = MOCK_TALHOES.find(t => t.id === +form.talhao_id)
    const safra = MOCK_SAFRAS.find(s => s.id === +form.safra_id)
    try { await api.post('/api/ordens-servico-agricola/', form) } catch { /* mock */ }
    const numero = `OS-${new Date().getFullYear()}-${String(rows.length + 1).padStart(3, '0')}`
    const newRow: OrdemServico = { id: Date.now(), numero, tipo: form.tipo, safra_nome: safra?.nome ?? '', talhao_nome: talhao?.nome ?? '', fazenda_nome: fazenda?.nome ?? '', area_ha: +form.area_ha, data_prevista: form.data_prevista, responsavel: form.responsavel, status: 'pendente' }
    setRows(r => [newRow, ...r])
    setModal(false)
    setSaving(false)
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Pendentes" val={rows.filter(r => r.status === 'pendente').length} />
        <KpiCard label="Em Andamento" val={rows.filter(r => r.status === 'em_andamento').length} />
        <KpiCard label="Concluídas" val={rows.filter(r => r.status === 'concluida').length} />
        <KpiCard label="Atrasadas" val={atrasadas} sub={atrasadas > 0 ? 'data prevista vencida' : 'nenhuma'} />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Nº OS, talhão ou responsável...">
        <Sel value={filterStatus} onChange={setFilterStatus}>
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </Sel>
        <ExportButtons endpoint="/api/ordens-servico-agricola/" filename="ordens_servico" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <BtnNew onClick={() => { setForm({ tipo:'plantio', safra_id:'1', talhao_id:'', fazenda_id:'1', area_ha:'', data_prevista:'', responsavel:'', observacao:'' }); setModal(true) }} label="Nova O.S." />
      </Bar>

      <Table heads={['Nº OS', 'Tipo', 'Safra', 'Talhão', 'Área (ha)', 'Data Prevista', 'Realizada', 'Responsável', 'Status']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={9} /> : filtered.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
            <Td mono>{r.numero}</Td>
            <TdMain>{tiposOS[r.tipo] ?? r.tipo}</TdMain>
            <Td>{r.safra_nome}</Td>
            <Td>{r.talhao_nome}<span className="block text-xs text-text-muted">{r.fazenda_nome}</span></Td>
            <Td mono>{r.area_ha}</Td>
            <Td mono>{r.data_prevista}</Td>
            <Td mono>{r.data_realizada ?? '—'}</Td>
            <Td>{r.responsavel}</Td>
            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            <td className="w-12" />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Nova Ordem de Serviço" onClose={() => setModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de Serviço *">
                <Sel value={form.tipo} onChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  {Object.entries(tiposOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Sel>
              </Field>
              <Field label="Data Prevista *"><input type="date" className={inp} value={form.data_prevista} onChange={e => setForm(f => ({ ...f, data_prevista: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fazenda *">
                <Sel value={form.fazenda_id} onChange={v => setForm(f => ({ ...f, fazenda_id: v, talhao_id: '' }))}>
                  {MOCK_FAZENDAS.map(faz => <option key={faz.id} value={faz.id}>{faz.nome}</option>)}
                </Sel>
              </Field>
              <Field label="Talhão *">
                <Sel value={form.talhao_id} onChange={v => setForm(f => ({ ...f, talhao_id: v }))}>
                  <option value="">Selecionar...</option>
                  {talhoesFazenda.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </Sel>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Safra *">
                <Sel value={form.safra_id} onChange={v => setForm(f => ({ ...f, safra_id: v }))}>
                  {MOCK_SAFRAS.filter(s => s.fazenda_id === +form.fazenda_id).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </Sel>
              </Field>
              <Field label="Área (ha)"><input type="number" className={inp} value={form.area_ha} onChange={e => setForm(f => ({ ...f, area_ha: e.target.value }))} placeholder="320" /></Field>
            </div>
            <Field label="Responsável *"><input className={inp} value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsável" /></Field>
            <Field label="Observações"><textarea className={inp + ' min-h-[80px] resize-none'} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Detalhes, equipamentos necessários, instruções..." /></Field>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.tipo || !form.data_prevista || !form.responsavel || !form.talhao_id} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Custeio e Resultado (Indústria) ─────────────────────────────────────

const CAT_LABELS: Record<string, string> = { insumos:'Insumos', mao_de_obra:'Mão de Obra', servicos:'Serviços', maquinario:'Maquinário', outros:'Outros' }
const CAT_COLORS: Record<string, string> = { insumos:'bg-accent', mao_de_obra:'bg-blue-500', servicos:'bg-emerald-500', maquinario:'bg-yellow-500', outros:'bg-red-500' }

function TabCusteio() {
  const [safraId, setSafraId] = useState<number>(1)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<ItemCusteio[]>(MOCK_CUSTEIO)
  const [form, setForm] = useState({ categoria:'insumos', descricao:'', valor:'', data:'' })

  const safra = MOCK_SAFRAS.find(s => s.id === safraId)
  const safraItems = items.filter(i => i.safra_id === safraId)
  const totalCusto = safraItems.reduce((s, i) => s + i.valor, 0)
  const custoPorHa = safra ? totalCusto / safra.area_ha : 0

  const PRECO_SOJA = 120 // R$/sc (mock)
  const receitaPrevista = safra ? safra.produtividade_prevista * safra.area_ha * PRECO_SOJA : 0
  const receitaRealizada = safra?.produtividade_realizada ? safra.produtividade_realizada * safra.area_ha * PRECO_SOJA : null
  const margem = receitaRealizada ? receitaRealizada - totalCusto : receitaPrevista - totalCusto

  const catTotais = ['insumos','mao_de_obra','servicos','maquinario','outros'].map(cat => ({
    cat, label: CAT_LABELS[cat], total: safraItems.filter(i => i.categoria === cat).reduce((s, i) => s + i.valor, 0),
    pct: totalCusto > 0 ? (safraItems.filter(i => i.categoria === cat).reduce((s, i) => s + i.valor, 0) / totalCusto) * 100 : 0,
  }))

  async function save() {
    setSaving(true)
    try { await api.post('/api/custeio/', { ...form, safra_id: safraId }) } catch { /* mock */ }
    const newItem: ItemCusteio = { id: Date.now(), safra_id: safraId, categoria: form.categoria as ItemCusteio['categoria'], descricao: form.descricao, valor: +form.valor, data: form.data }
    setItems(i => [...i, newItem])
    setModal(false)
    setSaving(false)
  }

  return (
    <div>
      {/* Safra selector */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm font-medium text-text-secondary whitespace-nowrap">Safra em análise:</span>
        <div className="relative w-72">
          <select className={selCss} value={safraId} onChange={e => setSafraId(+e.target.value)}>
            {MOCK_SAFRAS.map(s => <option key={s.id} value={s.id}>{s.nome} — {s.fazenda_nome}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        {safra && <span className="text-xs text-text-muted">{safra.area_ha.toLocaleString('pt-BR')} ha · {safra.cultura}</span>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Custo Total" val={`R$ ${totalCusto.toLocaleString('pt-BR', { minimumFractionDigits:0 })}`} />
        <KpiCard label="Custo por Hectare" val={`R$ ${custoPorHa.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`} />
        <KpiCard label={receitaRealizada ? 'Receita Realizada' : 'Receita Prevista'} val={`R$ ${(receitaRealizada ?? receitaPrevista).toLocaleString('pt-BR', { minimumFractionDigits:0 })}`} sub={receitaRealizada ? undefined : 'projeção'} />
        <KpiCard label="Margem Líquida" val={`R$ ${margem.toLocaleString('pt-BR', { minimumFractionDigits:0 })}`} sub={margem >= 0 ? 'positivo' : 'negativo'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Breakdown */}
        <div className="lg:col-span-1 bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold text-text-primary mb-4">Composição do Custo</p>
          <div className="space-y-3">
            {catTotais.filter(c => c.total > 0).map(c => (
              <div key={c.cat}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-secondary">{c.label}</span>
                  <span className="text-xs font-mono text-text-primary">{c.pct.toFixed(1)}%</span>
                </div>
                <div className="bg-card2 rounded-full h-2">
                  <div className={`${CAT_COLORS[c.cat]} h-2 rounded-full transition-all`} style={{ width: `${c.pct}%` }} />
                </div>
                <p className="text-xs text-text-muted mt-0.5">R$ {c.total.toLocaleString('pt-BR')}</p>
              </div>
            ))}
            {safraItems.length === 0 && <p className="text-sm text-text-muted text-center py-4">Sem lançamentos</p>}
          </div>
        </div>

        {/* Planned vs Actual — only for encerrado */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold text-text-primary mb-4">
            {safra?.status === 'encerrado' ? 'Planejado vs Realizado' : 'Previsão de Resultado'}
          </p>
          {safra ? (
            <div className="space-y-3">
              {[
                { label: 'Produtividade (sc/ha)', prev: safra.produtividade_prevista, real: safra.produtividade_realizada, unit:'sc/ha' },
                { label: 'Receita Bruta (R$)', prev: receitaPrevista, real: receitaRealizada ?? undefined, unit:'R$', money:true },
                { label: 'Custo Total (R$)', prev: totalCusto, real: totalCusto, unit:'R$', money:true },
                { label: 'Margem Líquida (R$)', prev: receitaPrevista - totalCusto, real: receitaRealizada ? receitaRealizada - totalCusto : undefined, unit:'R$', money:true },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3 text-sm">
                  <span className="text-text-muted w-44 shrink-0">{row.label}</span>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="bg-card2 rounded-lg px-3 py-1.5 text-center">
                      <p className="text-xs text-text-muted">Previsto</p>
                      <p className="font-mono text-text-primary text-xs">{row.money ? `R$ ${row.prev.toLocaleString('pt-BR', { maximumFractionDigits:0 })}` : `${row.prev} ${row.unit}`}</p>
                    </div>
                    <div className={`rounded-lg px-3 py-1.5 text-center ${row.real !== undefined ? 'bg-accent/10 border border-accent/20' : 'bg-card2'}`}>
                      <p className="text-xs text-text-muted">Realizado</p>
                      <p className="font-mono text-text-primary text-xs">{row.real !== undefined ? (row.money ? `R$ ${row.real.toLocaleString('pt-BR', { maximumFractionDigits:0 })}` : `${row.real} ${row.unit}`) : '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-text-muted">Selecione uma safra</p>}
        </div>
      </div>

      {/* Lançamentos */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-text-primary">Lançamentos de Custo</p>
        <BtnNew onClick={() => { setForm({ categoria:'insumos', descricao:'', valor:'', data:'' }); setModal(true) }} label="Adicionar Lançamento" />
      </div>

      <Table heads={['Data', 'Categoria', 'Descrição', 'Valor Total', 'Custo/ha']}>
        {safraItems.length === 0 ? <Empty cols={5} /> : safraItems.map(item => (
          <Tr key={item.id}>
            <Td mono>{item.data}</Td>
            <td className="px-4 py-3">
              <span className={`text-xs px-2 py-0.5 rounded font-medium text-white ${CAT_COLORS[item.categoria]}`}>{CAT_LABELS[item.categoria]}</span>
            </td>
            <TdMain>{item.descricao}</TdMain>
            <Td mono>R$ {item.valor.toLocaleString('pt-BR')}</Td>
            <Td mono>R$ {(safra ? item.valor / safra.area_ha : 0).toFixed(2)}</Td>
            <td className="w-12" />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Adicionar Lançamento de Custo" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Categoria *">
                <Sel value={form.categoria} onChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Sel>
              </Field>
              <Field label="Data *"><input type="date" className={inp} value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></Field>
            </div>
            <Field label="Descrição *"><input className={inp} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Herbicida Roundup" /></Field>
            <Field label="Valor Total (R$) *"><input type="number" className={inp} value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="8500.00" /></Field>
            {form.valor && safra && (
              <p className="text-xs text-text-muted text-right">≈ R$ {(+form.valor / safra.area_ha).toFixed(2)}/ha sobre {safra.area_ha} ha</p>
            )}
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.descricao || !form.valor || !form.data} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

const TABS = ['Safras', 'Talhões', 'Aplicações', 'Diário de Campo', 'Ordens de Serviço ★', 'Custeio e Resultado ★']

export default function Safras() {
  const [tab, setTab] = useState('Safras')

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Leaf size={20} className="text-accent" /> Gestão de Safras
          </h1>
          <p className="text-sm text-text-muted mt-1">Planejamento, custeio, rastreabilidade e diário de campo</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-1.5">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">IND</span>
          <span className="text-xs text-text-muted">= módulo exclusivo indústria</span>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'Safras'                  && <TabSafras />}
      {tab === 'Talhões'                 && <TabTalhoes />}
      {tab === 'Aplicações'              && <TabAplicacoes />}
      {tab === 'Diário de Campo'         && <TabDiario />}
      {tab === 'Ordens de Serviço ★'    && <TabOrdens />}
      {tab === 'Custeio e Resultado ★'  && <TabCusteio />}
    </div>
  )
}
