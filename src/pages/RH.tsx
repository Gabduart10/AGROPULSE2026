import { useState } from 'react'
import {
  Plus, Search, X, ChevronDown, Users, Clock, FileText,
  AlertTriangle, CheckCircle2, Shield, Send, Eye,
  BarChart2, AlertCircle,
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

function KpiCard({ label, val, sub, warn }: { label: string; val: string | number; sub?: string; warn?: boolean }) {
  return (
    <div className={`border rounded-xl px-4 py-3 ${warn ? 'bg-amber-950/20 border-amber-800/40' : 'bg-card2 border-border'}`}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-xl font-bold font-mono mt-1 ${warn ? 'text-amber-300' : 'text-text-primary'}`}>{val}</p>
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

function Footer({ onClose, onSave, saving, disabled, saveLabel = 'Salvar' }: { onClose: () => void; onSave: () => void; saving: boolean; disabled?: boolean; saveLabel?: string }) {
  return (
    <div className="flex gap-2 pt-4">
      <button onClick={onClose} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2">Cancelar</button>
      <button onClick={onSave} disabled={saving || disabled} className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm disabled:opacity-60">{saving ? 'Aguarde...' : saveLabel}</button>
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
    presente:    'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    ausente:     'bg-red-900/30 text-red-400 border-red-800/40',
    afastado:    'bg-amber-950/50 text-amber-200 border-amber-800/50',
    ferias:      'bg-blue-900/30 text-blue-400 border-blue-800/40',
    folga:       'bg-card2 text-text-muted border-border',
    processada:  'bg-accent/20 text-accent border-accent/30',
    paga:        'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    aberta:      'bg-card2 text-text-muted border-border',
    ativo:       'bg-amber-950/50 text-amber-200 border-amber-800/50',
    encerrado:   'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    valido:      'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    vencendo:    'bg-amber-950/50 text-amber-200 border-amber-800/50',
    vencido:     'bg-red-900/30 text-red-400 border-red-800/40',
    devolvido:   'bg-card2 text-text-muted border-border',
    pendente:    'bg-amber-950/50 text-amber-200 border-amber-800/50',
    enviado:     'bg-blue-900/30 text-blue-400 border-blue-800/40',
    processado:  'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    erro:        'bg-red-900/30 text-red-400 border-red-800/40',
    gerada:      'bg-blue-900/30 text-blue-400 border-blue-800/40',
    normal:      'bg-card2 text-text-muted border-border',
    aprovado:    'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    recusado:    'bg-red-900/30 text-red-400 border-red-800/40',
  }
  const labels: Record<string, string> = {
    presente:'Presente', ausente:'Ausente', afastado:'Afastado', ferias:'Férias', folga:'Folga',
    processada:'Processada', paga:'Paga', aberta:'Aberta',
    ativo:'Ativo', encerrado:'Encerrado',
    valido:'Válido', vencendo:'Vencendo', vencido:'Vencido', devolvido:'Devolvido',
    pendente:'Pendente', enviado:'Enviado', processado:'Processado', erro:'Erro',
    gerada:'Gerada', normal:'Normal', aprovado:'Aprovado', recusado:'Recusado',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${m[status] ?? 'bg-card2 text-text-muted border-border'}`}>{labels[status] ?? status}</span>
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ColaboradorRH {
  id: number; nome: string; cpf: string; cargo: string; nivel: string
  tipo_contrato: string; salario_base: number
  data_admissao: string; data_demissao?: string
  departamento?: string; banco_horas_min: number
  status_ponto: 'presente' | 'ausente' | 'afastado' | 'ferias' | 'folga'
  ativo: boolean
}

interface RegistroPonto {
  id: number; colaborador_id: number; colaborador_nome: string
  data: string; entrada: string; saida_almoco?: string
  retorno_almoco?: string; saida: string
  horas_trabalhadas: number; horas_extras: number
  origem: 'rep' | 'app' | 'manual'
  lat?: string; status: 'normal' | 'pendente' | 'aprovado' | 'recusado'
}

interface ItemFolha {
  id: number; colaborador_id: number; colaborador_nome: string; cargo: string
  tipo_contrato: string; competencia: string
  salario_base: number; horas_extras_valor: number; outros_proventos: number
  total_proventos: number; inss: number; irrf: number
  vale_transporte: number; outros_descontos: number
  total_descontos: number; liquido: number; fgts: number
  status: 'aberta' | 'processada' | 'paga'
}

interface Afastamento {
  id: number; colaborador_nome: string
  tipo: string; data_inicio: string; data_fim: string; dias: number
  cid?: string; observacao?: string; status: 'ativo' | 'encerrado'
}

interface EPI {
  id: number; colaborador_nome: string; cargo: string
  item: string; ca: string
  data_entrega: string; data_vencimento: string
  quantidade: number; status: 'valido' | 'vencendo' | 'vencido' | 'devolvido'
}

interface Treinamento {
  id: number; colaborador_nome: string; titulo: string; nr: string
  data: string; validade: string; carga_horaria: number
  instrutor: string; status: 'valido' | 'vencendo' | 'vencido'
}

interface EventoESocial {
  id: number; tipo: string; colaborador_nome?: string; competencia?: string
  data_envio?: string; protocolo?: string
  status: 'pendente' | 'enviado' | 'processado' | 'erro'; descricao: string
}

interface GuiaFGTS {
  id: number; competencia: string; total_folha: number
  base_fgts: number; valor_fgts: number
  codigo_pagamento?: string; data_vencimento: string; data_pagamento?: string
  status: 'aberta' | 'gerada' | 'paga'
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_COLABORADORES: ColaboradorRH[] = [
  { id:1, nome:'Carlos Eduardo Silva', cpf:'123.456.789-00', cargo:'Vendedor Externo', nivel:'vendedor', tipo_contrato:'clt', salario_base:3200, data_admissao:'2023-03-01', departamento:'Comercial', banco_horas_min:120, status_ponto:'presente', ativo:true },
  { id:2, nome:'Ana Paula Ferreira', cpf:'234.567.890-11', cargo:'Gerente Comercial', nivel:'gerente', tipo_contrato:'clt', salario_base:6500, data_admissao:'2022-01-10', departamento:'Comercial', banco_horas_min:-45, status_ponto:'presente', ativo:true },
  { id:3, nome:'João da Silva', cpf:'345.678.901-22', cargo:'Motorista', nivel:'operacional', tipo_contrato:'clt', salario_base:3800, data_admissao:'2021-06-15', departamento:'Logística', banco_horas_min:240, status_ponto:'presente', ativo:true },
  { id:4, nome:'Maria Santos', cpf:'456.789.012-33', cargo:'Operadora de Colheita', nivel:'operacional', tipo_contrato:'sazonal', salario_base:1800, data_admissao:'2026-02-01', departamento:'Agrícola', banco_horas_min:0, status_ponto:'presente', ativo:true },
  { id:5, nome:'Paulo Rodrigues', cpf:'567.890.123-44', cargo:'Operador Logístico', nivel:'operacional', tipo_contrato:'clt', salario_base:2900, data_admissao:'2022-09-20', departamento:'Logística', banco_horas_min:60, status_ponto:'afastado', ativo:true },
]

const MOCK_PONTO: RegistroPonto[] = [
  { id:1, colaborador_id:1, colaborador_nome:'Carlos Eduardo Silva', data:'2026-04-21', entrada:'08:02', saida_almoco:'12:00', retorno_almoco:'13:00', saida:'17:35', horas_trabalhadas:480, horas_extras:35, origem:'app', lat:'-21.18,-47.82', status:'normal' },
  { id:2, colaborador_id:2, colaborador_nome:'Ana Paula Ferreira', data:'2026-04-21', entrada:'08:00', saida_almoco:'12:15', retorno_almoco:'13:10', saida:'18:05', horas_trabalhadas:480, horas_extras:60, origem:'rep', status:'normal' },
  { id:3, colaborador_id:3, colaborador_nome:'João da Silva', data:'2026-04-21', entrada:'06:00', saida_almoco:'11:00', retorno_almoco:'12:00', saida:'15:00', horas_trabalhadas:480, horas_extras:0, origem:'rep', lat:'-21.20,-47.80', status:'normal' },
  { id:4, colaborador_id:4, colaborador_nome:'Maria Santos', data:'2026-04-21', entrada:'07:00', saida_almoco:'11:30', retorno_almoco:'12:30', saida:'16:00', horas_trabalhadas:480, horas_extras:0, origem:'app', lat:'-21.17,-47.85', status:'normal' },
  { id:5, colaborador_id:1, colaborador_nome:'Carlos Eduardo Silva', data:'2026-04-18', entrada:'08:05', saida_almoco:'12:00', retorno_almoco:'13:00', saida:'17:00', horas_trabalhadas:475, horas_extras:0, origem:'app', status:'normal' },
  { id:6, colaborador_id:2, colaborador_nome:'Ana Paula Ferreira', data:'2026-04-18', entrada:'08:30', saida_almoco:'12:00', retorno_almoco:'13:00', saida:'18:30', horas_trabalhadas:480, horas_extras:90, origem:'rep', status:'aprovado' },
]

const COMPETENCIA_ATUAL = '2026-04'

const MOCK_FOLHA: ItemFolha[] = [
  { id:1, colaborador_id:1, colaborador_nome:'Carlos Eduardo Silva', cargo:'Vendedor Externo', tipo_contrato:'CLT', competencia:COMPETENCIA_ATUAL, salario_base:3200, horas_extras_valor:195.40, outros_proventos:0, total_proventos:3395.40, inss:373.49, irrf:0, vale_transporte:216, outros_descontos:0, total_descontos:589.49, liquido:2805.91, fgts:271.63, status:'processada' },
  { id:2, colaborador_id:2, colaborador_nome:'Ana Paula Ferreira', cargo:'Gerente Comercial', tipo_contrato:'CLT', competencia:COMPETENCIA_ATUAL, salario_base:6500, horas_extras_valor:406.25, outros_proventos:0, total_proventos:6906.25, inss:759.69, irrf:548.71, vale_transporte:0, outros_descontos:0, total_descontos:1308.40, liquido:5597.85, fgts:552.50, status:'processada' },
  { id:3, colaborador_id:3, colaborador_nome:'João da Silva', cargo:'Motorista', tipo_contrato:'CLT', competencia:COMPETENCIA_ATUAL, salario_base:3800, horas_extras_valor:0, outros_proventos:380, total_proventos:4180, inss:459.80, irrf:0, vale_transporte:264, outros_descontos:0, total_descontos:723.80, liquido:3456.20, fgts:334.40, status:'processada' },
  { id:4, colaborador_id:4, colaborador_nome:'Maria Santos', cargo:'Operadora de Colheita', tipo_contrato:'Sazonal', competencia:COMPETENCIA_ATUAL, salario_base:1800, horas_extras_valor:0, outros_proventos:0, total_proventos:1800, inss:180, irrf:0, vale_transporte:0, outros_descontos:0, total_descontos:180, liquido:1620, fgts:144, status:'aberta' },
  { id:5, colaborador_id:5, colaborador_nome:'Paulo Rodrigues', cargo:'Operador Logístico', tipo_contrato:'CLT', competencia:COMPETENCIA_ATUAL, salario_base:2900, horas_extras_valor:0, outros_proventos:2900, total_proventos:5800, inss:638, irrf:85.44, vale_transporte:0, outros_descontos:0, total_descontos:723.44, liquido:5076.56, fgts:232, status:'aberta' },
]

const TIPOS_AFASTAMENTO: Record<string, string> = {
  atestado:'Atestado Médico', licenca_maternidade:'Lic. Maternidade',
  licenca_paternidade:'Lic. Paternidade', afastamento_inss:'Afastamento INSS',
  ferias:'Férias', outros:'Outros',
}

const MOCK_AFASTAMENTOS: Afastamento[] = [
  { id:1, colaborador_nome:'Paulo Rodrigues', tipo:'afastamento_inss', data_inicio:'2026-04-10', data_fim:'2026-05-09', dias:30, cid:'M54.5', observacao:'Lombalgia — INSS desde o 16° dia', status:'ativo' },
  { id:2, colaborador_nome:'Carlos Eduardo Silva', tipo:'atestado', data_inicio:'2026-04-02', data_fim:'2026-04-04', dias:3, cid:'J06', status:'encerrado' },
  { id:3, colaborador_nome:'Maria Santos', tipo:'ferias', data_inicio:'2026-06-01', data_fim:'2026-06-30', dias:30, status:'ativo' },
]

const MOCK_EPI: EPI[] = [
  { id:1, colaborador_nome:'João da Silva', cargo:'Motorista', item:'Bota de Segurança', ca:'12345', data_entrega:'2025-10-01', data_vencimento:'2026-10-01', quantidade:1, status:'valido' },
  { id:2, colaborador_nome:'João da Silva', cargo:'Motorista', item:'Capacete de Segurança', ca:'23456', data_entrega:'2025-10-01', data_vencimento:'2027-10-01', quantidade:1, status:'valido' },
  { id:3, colaborador_nome:'Maria Santos', cargo:'Op. Colheita', item:'Protetor Auricular', ca:'34567', data_entrega:'2026-02-01', data_vencimento:'2026-08-01', quantidade:2, status:'vencendo' },
  { id:4, colaborador_nome:'Maria Santos', cargo:'Op. Colheita', item:'Óculos de Proteção', ca:'45678', data_entrega:'2026-02-01', data_vencimento:'2026-08-01', quantidade:1, status:'valido' },
  { id:5, colaborador_nome:'Maria Santos', cargo:'Op. Colheita', item:'Luvas de Borracha', ca:'56789', data_entrega:'2026-02-01', data_vencimento:'2026-05-01', quantidade:3, status:'vencido' },
  { id:6, colaborador_nome:'Carlos Eduardo Silva', cargo:'Vendedor', item:'Colete Refletivo', ca:'67890', data_entrega:'2025-06-01', data_vencimento:'2026-06-01', quantidade:1, status:'vencendo' },
]

const MOCK_TREINAMENTOS: Treinamento[] = [
  { id:1, colaborador_nome:'Maria Santos', titulo:'NR-31 — Segurança e Saúde no Trabalho Rural', nr:'NR-31', data:'2026-02-10', validade:'2027-02-10', carga_horaria:8, instrutor:'SENAR/SP', status:'valido' },
  { id:2, colaborador_nome:'João da Silva', titulo:'Direção Defensiva — Transporte de Cargas', nr:'NR-11', data:'2025-08-15', validade:'2026-08-15', carga_horaria:16, instrutor:'SEST SENAT', status:'vencendo' },
  { id:3, colaborador_nome:'Carlos Eduardo Silva', titulo:'Brigada de Incêndio', nr:'NR-23', data:'2025-06-01', validade:'2026-06-01', carga_horaria:4, instrutor:'Bombeiros SP', status:'vencendo' },
]

const MOCK_ESOCIAL: EventoESocial[] = [
  { id:1, tipo:'S-2200', colaborador_nome:'Maria Santos', data_envio:'2026-02-01', protocolo:'1.2.202602.0001234', status:'processado', descricao:'Admissão — Contrato Sazonal' },
  { id:2, tipo:'S-1200', competencia:'2026-03', data_envio:'2026-04-07', protocolo:'1.2.202604.0009876', status:'processado', descricao:'Remuneração do trabalhador — Folha Mar/2026' },
  { id:3, tipo:'S-1200', competencia:COMPETENCIA_ATUAL, status:'pendente', descricao:'Remuneração do trabalhador — Folha Abr/2026' },
  { id:4, tipo:'S-2230', colaborador_nome:'Paulo Rodrigues', status:'pendente', descricao:'Afastamento por doença — início 10/04/2026' },
  { id:5, tipo:'S-2299', colaborador_nome:'Antônio Pereira', data_envio:'2026-03-31', protocolo:'1.2.202603.0007654', status:'processado', descricao:'Desligamento — 31/03/2026' },
]

const MOCK_FGTS: GuiaFGTS[] = [
  { id:1, competencia:'2026-02', total_folha:18200, base_fgts:18200, valor_fgts:1456, codigo_pagamento:'150-6', data_vencimento:'2026-03-07', data_pagamento:'2026-03-07', status:'paga' },
  { id:2, competencia:'2026-03', total_folha:18200, base_fgts:18200, valor_fgts:1456, codigo_pagamento:'150-6', data_vencimento:'2026-04-07', data_pagamento:'2026-04-07', status:'paga' },
  { id:3, competencia:COMPETENCIA_ATUAL, total_folha:21275.40, base_fgts:21275.40, valor_fgts:1702.03, data_vencimento:'2026-05-07', status:'aberta' },
]

// ─── Tab Colaboradores ────────────────────────────────────────────────────────

function TabColaboradores() {
  const [rows, setRows] = useState<ColaboradorRH[]>([])
  const [search, setSearch] = useState('')
  const [filterContrato, setFilterContrato] = useState('')

  const filtered = rows.filter(r =>
    (r.nome.toLowerCase().includes(search.toLowerCase()) || r.cargo.toLowerCase().includes(search.toLowerCase())) &&
    (filterContrato ? r.tipo_contrato === filterContrato : true)
  )

  const fmtBH = (min: number) => {
    const abs = Math.abs(min); const h = Math.floor(abs / 60); const m = abs % 60
    return `${min < 0 ? '-' : '+'}${h}h${m > 0 ? m + 'm' : ''}`
  }

  const contratoLabel: Record<string, string> = { clt:'CLT', temporario:'Temporário', sazonal:'Sazoneiro', pj:'PJ', autonomo:'Autônomo' }

  return (
    <div>
      <div className="bg-accent/10 border border-accent/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
        <Users size={15} className="text-accent shrink-0" />
        <p className="text-xs text-text-secondary">O cadastro base de colaboradores está em <span className="text-accent font-medium">Cadastros Gerais → Colaboradores</span>. Aqui você gerencia o lado operacional de RH: ponto, folha, afastamentos e EPI.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Ativos" val={rows.filter(r => r.ativo).length} />
        <KpiCard label="CLT" val={rows.filter(r => r.tipo_contrato === 'clt').length} />
        <KpiCard label="Sazonais / Temp." val={rows.filter(r => ['sazonal','temporario'].includes(r.tipo_contrato)).length} />
        <KpiCard label="Afastados" val={rows.filter(r => r.status_ponto === 'afastado').length} warn={rows.filter(r => r.status_ponto === 'afastado').length > 0} />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Nome ou cargo...">
        <Sel value={filterContrato} onChange={setFilterContrato}>
          <option value="">Todos os vínculos</option>
          <option value="clt">CLT</option>
          <option value="sazonal">Sazoneiro</option>
          <option value="temporario">Temporário</option>
          <option value="pj">PJ</option>
        </Sel>
        <ExportButtons endpoint="/api/rh/colaboradores/" filename="colaboradores_rh" />
      </Bar>

      <Table heads={['Colaborador', 'Cargo / Depto.', 'Vínculo', 'Admissão', 'Salário Base', 'Banco de Horas', 'Ponto Hoje']}>
        {filtered.length === 0 ? <Empty cols={7} /> : filtered.map(r => (
          <Tr key={r.id}>
            <TdMain>{r.nome}<span className="block text-xs text-text-muted font-mono font-normal">{r.cpf}</span></TdMain>
            <Td>{r.cargo}{r.departamento && <span className="block text-xs text-text-muted">{r.departamento}</span>}</Td>
            <td className="px-4 py-3"><span className="text-xs bg-card2 border border-border px-2 py-0.5 rounded">{contratoLabel[r.tipo_contrato] ?? r.tipo_contrato}</span></td>
            <Td mono>{r.data_admissao}</Td>
            <Td mono>R$ {r.salario_base.toLocaleString('pt-BR', { minimumFractionDigits:2 })}</Td>
            <td className="px-4 py-3 font-mono text-sm">
              <span className={r.banco_horas_min >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtBH(r.banco_horas_min)}</span>
            </td>
            <td className="px-4 py-3"><StatusBadge status={r.status_ponto} /></td>
            <td className="w-12" />
          </Tr>
        ))}
      </Table>
    </div>
  )
}

// ─── Tab Ponto Eletrônico ─────────────────────────────────────────────────────

function TabPonto() {
  const [rows, setRows] = useState<RegistroPonto[]>([])
  const [search, setSearch] = useState('')
  const [filterData, setFilterData] = useState('2026-04-21')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))
  const [form, setForm] = useState({ colaborador_id:'1', data:'', entrada:'', saida_almoco:'', retorno_almoco:'', saida:'', justificativa:'' })

  const filtered = rows.filter(r =>
    (r.colaborador_nome.toLowerCase().includes(search.toLowerCase())) &&
    (filterData ? r.data === filterData : true)
  )

  const fmtMin = (min: number) => min > 0 ? `+${Math.floor(min/60)}h${min%60>0?min%60+'m':''}` : '—'
  const origemLabel: Record<string, string> = { rep:'REP', app:'App', manual:'Manual' }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Presentes Hoje" val={0} sub="de 0 ativos" />
        <KpiCard label="Pendentes Aprovação" val={rows.filter(r => r.status === 'pendente').length} warn={rows.filter(r => r.status === 'pendente').length > 0} />
        <KpiCard label="HE no Período" val={`${rows.reduce((s, r) => s + r.horas_extras, 0)}min`} sub="horas extras" />
        <KpiCard label="Registros App" val={rows.filter(r => r.origem === 'app').length} sub="com geolocalização" />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Nome do colaborador...">
        <input type="date" className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" value={filterData} onChange={e => setFilterData(e.target.value)} />
        <ExportButtons endpoint="/api/rh/ponto/" filename="ponto_eletronico" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <BtnNew onClick={() => { setForm({ colaborador_id:'1', data:'', entrada:'', saida_almoco:'', retorno_almoco:'', saida:'', justificativa:'' }); setModal(true) }} label="Ajuste Manual" />
      </Bar>

      <Table heads={['Colaborador', 'Data', 'Entrada', 'Saída Almoço', 'Retorno', 'Saída', 'Jornada', 'H. Extra', 'Origem', 'Status']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={10} /> : filtered.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
            <TdMain>{r.colaborador_nome}</TdMain>
            <Td mono>{r.data}</Td>
            <Td mono>{r.entrada}</Td>
            <Td mono>{r.saida_almoco ?? '—'}</Td>
            <Td mono>{r.retorno_almoco ?? '—'}</Td>
            <Td mono>{r.saida}</Td>
            <Td mono>{Math.floor(r.horas_trabalhadas/60)}h{r.horas_trabalhadas%60>0?r.horas_trabalhadas%60+'m':''}</Td>
            <td className="px-4 py-3 font-mono text-sm">
              <span className={r.horas_extras > 0 ? 'text-accent' : 'text-text-muted'}>{fmtMin(r.horas_extras)}</span>
            </td>
            <td className="px-4 py-3">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${r.origem === 'manual' ? 'bg-yellow-900/30 text-amber-300' : 'bg-card2 text-text-muted border border-border'}`}>
                {r.lat && <span className="mr-1">📍</span>}{origemLabel[r.origem]}
              </span>
            </td>
            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            <td className="w-12" />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Ajuste Manual de Ponto" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-3">
              <p className="text-xs text-amber-300">Ajustes manuais ficam registrados em log de auditoria com identificação do usuário responsável.</p>
            </div>
            <Field label="Colaborador *">
              <Sel value={form.colaborador_id} onChange={v => setForm(f => ({ ...f, colaborador_id: v }))}>
                {[]}
              </Sel>
            </Field>
            <Field label="Data *"><input type="date" className={inp} value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Entrada"><input type="time" className={inp} value={form.entrada} onChange={e => setForm(f => ({ ...f, entrada: e.target.value }))} /></Field>
              <Field label="Saída"><input type="time" className={inp} value={form.saida} onChange={e => setForm(f => ({ ...f, saida: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Saída Almoço"><input type="time" className={inp} value={form.saida_almoco} onChange={e => setForm(f => ({ ...f, saida_almoco: e.target.value }))} /></Field>
              <Field label="Retorno Almoço"><input type="time" className={inp} value={form.retorno_almoco} onChange={e => setForm(f => ({ ...f, retorno_almoco: e.target.value }))} /></Field>
            </div>
            <Field label="Justificativa *"><textarea className={inp + ' min-h-[80px] resize-none'} value={form.justificativa} onChange={e => setForm(f => ({ ...f, justificativa: e.target.value }))} placeholder="Motivo do ajuste manual..." /></Field>
            <Footer onClose={() => setModal(false)} onSave={() => { setSaving(true); setTimeout(() => { setModal(false); setSaving(false) }, 600) }} saving={saving} disabled={!form.data || !form.justificativa} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Folha de Pagamento ───────────────────────────────────────────────────

function TabFolha() {
  const [rows, setRows] = useState<ItemFolha[]>([])
  const [competencia, setCompetencia] = useState(COMPETENCIA_ATUAL)
  const [tipo, setTipo] = useState('mensal')
  const [confirmModal, setConfirmModal] = useState(false)
  const [detailItem, setDetailItem] = useState<ItemFolha | null>(null)
  const [processing, setProcessing] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))

  const filtered = rows.filter(r => r.competencia === competencia)
  const totalProventos = filtered.reduce((s, r) => s + r.total_proventos, 0)
  const totalDescontos = filtered.reduce((s, r) => s + r.total_descontos, 0)
  const totalLiquido = filtered.reduce((s, r) => s + r.liquido, 0)
  const totalFGTS = filtered.reduce((s, r) => s + r.fgts, 0)

  async function processarFolha() {
    setProcessing(true)
    try { await api.post('/api/rh/folha/', { competencia, tipo }) } catch { /* mock */ }
    setRows(r => r.map(x => x.competencia === competencia ? { ...x, status: 'processada' } : x))
    setConfirmModal(false); setProcessing(false)
  }

  const fmtR = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits:2 })}`
  const tipoLabel: Record<string, string> = { mensal:'Folha Mensal', '13_parcela1':'13° — 1ª Parcela', '13_parcela2':'13° — 2ª Parcela', ferias:'Férias', rescisao:'Rescisão' }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="text-sm font-medium text-text-secondary">Competência:</span>
        <input type="month" className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" value={competencia} onChange={e => setCompetencia(e.target.value)} />
        <Sel value={tipo} onChange={setTipo}>
          {Object.entries(tipoLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Sel>
        <div className="flex-1" />
        <ExportButtons endpoint="/api/rh/folha/" filename={`folha_${competencia}`} params={{ competencia, tipo }} selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <button onClick={() => setConfirmModal(true)} className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          Processar Folha
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Total Proventos" val={fmtR(totalProventos)} />
        <KpiCard label="Total Descontos" val={fmtR(totalDescontos)} />
        <KpiCard label="Total Líquido" val={fmtR(totalLiquido)} />
        <KpiCard label="FGTS a Recolher" val={fmtR(totalFGTS)} sub="8% base salarial" />
      </div>

      <Table heads={['Colaborador', 'Vínculo', 'Salário Base', 'H. Extra', 'Total Prov.', 'INSS', 'IRRF', 'VT', 'Total Desc.', 'Líquido', 'FGTS', 'Status']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={12} /> : filtered.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
            <TdMain>{r.colaborador_nome}<span className="block text-xs text-text-muted font-normal">{r.cargo}</span></TdMain>
            <td className="px-4 py-3"><span className="text-xs bg-card2 border border-border px-1.5 py-0.5 rounded">{r.tipo_contrato}</span></td>
            <Td mono>{fmtR(r.salario_base)}</Td>
            <Td mono>{fmtR(r.horas_extras_valor)}</Td>
            <Td mono>{fmtR(r.total_proventos)}</Td>
            <Td mono>({fmtR(r.inss)})</Td>
            <Td mono>{r.irrf > 0 ? `(${fmtR(r.irrf)})` : '—'}</Td>
            <Td mono>{r.vale_transporte > 0 ? `(${fmtR(r.vale_transporte)})` : '—'}</Td>
            <Td mono>({fmtR(r.total_descontos)})</Td>
            <td className="px-4 py-3 font-mono font-semibold text-accent">{fmtR(r.liquido)}</td>
            <Td mono>{fmtR(r.fgts)}</Td>
            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            <td className="px-4 py-3 w-12">
              <button onClick={() => setDetailItem(r)} className="p-1.5 hover:bg-card rounded text-text-muted hover:text-accent"><Eye size={14} /></button>
            </td>
          </Tr>
        ))}
      </Table>

      {detailItem && (
        <Modal title={`Holerite — ${detailItem.colaborador_nome}`} onClose={() => setDetailItem(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm border-b border-border pb-4">
              <div><span className="text-xs text-text-muted">Competência</span><p className="font-medium text-text-primary">{detailItem.competencia}</p></div>
              <div><span className="text-xs text-text-muted">Tipo</span><p className="font-medium text-text-primary">{tipoLabel[tipo]}</p></div>
              <div><span className="text-xs text-text-muted">Cargo</span><p className="font-medium text-text-primary">{detailItem.cargo}</p></div>
              <div><span className="text-xs text-text-muted">Vínculo</span><p className="font-medium text-text-primary">{detailItem.tipo_contrato}</p></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-400 uppercase mb-2">Proventos</p>
              {[['Salário Base', detailItem.salario_base], ['Horas Extras', detailItem.horas_extras_valor], ['Outros Proventos', detailItem.outros_proventos]].filter(([, v]) => (v as number) > 0).map(([k, v]) => (
                <div key={String(k)} className="flex justify-between text-sm py-0.5"><span className="text-text-muted">{k}</span><span className="font-mono text-text-primary">{fmtR(v as number)}</span></div>
              ))}
              <div className="flex justify-between text-sm py-1 border-t border-border mt-1 font-semibold"><span className="text-text-secondary">Total Proventos</span><span className="font-mono text-text-primary">{fmtR(detailItem.total_proventos)}</span></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase mb-2">Descontos</p>
              {[['INSS', detailItem.inss], ['IRRF', detailItem.irrf], ['Vale Transporte', detailItem.vale_transporte], ['Outros', detailItem.outros_descontos]].filter(([, v]) => (v as number) > 0).map(([k, v]) => (
                <div key={String(k)} className="flex justify-between text-sm py-0.5"><span className="text-text-muted">{k}</span><span className="font-mono text-red-400">({fmtR(v as number)})</span></div>
              ))}
              <div className="flex justify-between text-sm py-1 border-t border-border mt-1 font-semibold"><span className="text-text-secondary">Total Descontos</span><span className="font-mono text-red-400">({fmtR(detailItem.total_descontos)})</span></div>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-border pt-3">
              <span className="text-text-primary">Líquido a Receber</span>
              <span className="font-mono text-accent">{fmtR(detailItem.liquido)}</span>
            </div>
            <div className="flex justify-between text-sm text-text-muted border-t border-border pt-2">
              <span>FGTS (não descontado do colaborador)</span>
              <span className="font-mono">{fmtR(detailItem.fgts)}</span>
            </div>
          </div>
        </Modal>
      )}

      {confirmModal && (
        <Modal title="Processar Folha de Pagamento" onClose={() => setConfirmModal(false)}>
          <div className="space-y-4">
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-amber-300 mb-1">Confirmar processamento</p>
              <p className="text-xs text-text-muted">Competência <strong className="text-text-primary">{competencia}</strong> — {tipoLabel[tipo]}. O sistema calculará INSS e IRRF automaticamente pela tabela vigente. Após processar, a folha pode ser fechada e o evento S-1200 será gerado para o eSocial.</p>
            </div>
            <Footer onClose={() => setConfirmModal(false)} onSave={processarFolha} saving={processing} saveLabel="Processar Folha" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Afastamentos ─────────────────────────────────────────────────────────

function TabAfastamentos() {
  const [rows, setRows] = useState<Afastamento[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))
  const [form, setForm] = useState({ colaborador_id:'1', tipo:'atestado', data_inicio:'', data_fim:'', cid:'', observacao:'' })

  const filtered = rows.filter(r => r.colaborador_nome.toLowerCase().includes(search.toLowerCase()) || TIPOS_AFASTAMENTO[r.tipo]?.toLowerCase().includes(search.toLowerCase()))

  const calcDias = (ini: string, fim: string) => {
    if (!ini || !fim) return 0
    return Math.ceil((new Date(fim).getTime() - new Date(ini).getTime()) / 86400000) + 1
  }

  async function save() {
    setSaving(true)
    const colab = undefined
    try { await api.post('/api/rh/afastamentos/', form) } catch { /* mock */ }
    const n: Afastamento = { id: Date.now(), colaborador_nome: colab?.nome ?? '', tipo: form.tipo, data_inicio: form.data_inicio, data_fim: form.data_fim, dias: calcDias(form.data_inicio, form.data_fim), cid: form.cid || undefined, observacao: form.observacao || undefined, status: 'ativo' }
    setRows(r => [n, ...r])
    setModal(false); setSaving(false)
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Ativos Agora" val={rows.filter(r => r.status === 'ativo').length} />
        <KpiCard label="Atestados (mês)" val={rows.filter(r => r.tipo === 'atestado').length} />
        <KpiCard label="Afastamentos INSS" val={rows.filter(r => r.tipo === 'afastamento_inss').length} warn={rows.filter(r => r.tipo === 'afastamento_inss').length > 0} />
        <KpiCard label="Férias Programadas" val={rows.filter(r => r.tipo === 'ferias').length} sub="nos próximos 60 dias" />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Colaborador ou tipo...">
        <ExportButtons endpoint="/api/rh/afastamentos/" filename="afastamentos" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <BtnNew onClick={() => { setForm({ colaborador_id:'1', tipo:'atestado', data_inicio:'', data_fim:'', cid:'', observacao:'' }); setModal(true) }} label="Registrar Afastamento" />
      </Bar>

      <Table heads={['Colaborador', 'Tipo', 'Início', 'Fim', 'Dias', 'CID', 'Observação', 'Status']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={8} /> : filtered.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
            <TdMain>{r.colaborador_nome}</TdMain>
            <Td>{TIPOS_AFASTAMENTO[r.tipo] ?? r.tipo}</Td>
            <Td mono>{r.data_inicio}</Td>
            <Td mono>{r.data_fim}</Td>
            <Td mono>{r.dias}d</Td>
            <Td mono>{r.cid}</Td>
            <Td>{r.observacao}</Td>
            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            <td className="w-12" />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Registrar Afastamento" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Colaborador *">
              <Sel value={form.colaborador_id} onChange={v => setForm(f => ({ ...f, colaborador_id: v }))}>
                {[]}
              </Sel>
            </Field>
            <Field label="Tipo *">
              <Sel value={form.tipo} onChange={v => setForm(f => ({ ...f, tipo: v }))}>
                {Object.entries(TIPOS_AFASTAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Sel>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data Início *"><input type="date" className={inp} value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} /></Field>
              <Field label="Data Fim *"><input type="date" className={inp} value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} /></Field>
            </div>
            {form.data_inicio && form.data_fim && (
              <p className="text-xs text-text-muted">Duração: <span className="text-accent font-medium">{calcDias(form.data_inicio, form.data_fim)} dias</span></p>
            )}
            {form.tipo === 'atestado' || form.tipo === 'afastamento_inss' ? (
              <Field label="CID"><input className={inp} value={form.cid} onChange={e => setForm(f => ({ ...f, cid: e.target.value }))} placeholder="Ex: M54.5" /></Field>
            ) : null}
            <Field label="Observações"><textarea className={inp + ' min-h-[80px] resize-none'} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Detalhes adicionais..." /></Field>
            {form.tipo === 'afastamento_inss' && (
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-3">
                <p className="text-xs text-amber-300">Afastamentos INSS a partir do 16° dia geram automaticamente evento S-2230 no eSocial.</p>
              </div>
            )}
            <Footer onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.data_inicio || !form.data_fim} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab EPI e NR-31 ─────────────────────────────────────────────────────────

function TabEPI() {
  const [epiRows, setEpiRows] = useState<EPI[]>([])
  const [treRows, setTreRows] = useState<Treinamento[]>([])
  const [subTab, setSubTab] = useState<'epi' | 'treinamentos'>('epi')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ colaborador_id:'1', item:'', ca:'', data_entrega:'', data_vencimento:'', quantidade:'1' })
  const [formTre, setFormTre] = useState({ colaborador_id:'1', titulo:'', nr:'NR-31', data:'', validade:'', carga_horaria:'8', instrutor:'' })
  const [modalTre, setModalTre] = useState(false)

  const vencidos = epiRows.filter(r => r.status === 'vencido').length
  const vencendo = epiRows.filter(r => r.status === 'vencendo').length
  const treVencendo = treRows.filter(r => r.status !== 'valido').length

  const filteredEpi = epiRows.filter(r => r.colaborador_nome.toLowerCase().includes(search.toLowerCase()) || r.item.toLowerCase().includes(search.toLowerCase()))
  const filteredTre = treRows.filter(r => r.colaborador_nome.toLowerCase().includes(search.toLowerCase()) || r.titulo.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="EPIs Registrados" val={epiRows.filter(r => r.status !== 'devolvido').length} />
        <KpiCard label="Vencendo (60 dias)" val={vencendo} warn={vencendo > 0} />
        <KpiCard label="Vencidos" val={vencidos} warn={vencidos > 0} sub="renovação urgente" />
        <KpiCard label="Treinamentos Irregulares" val={treVencendo} warn={treVencendo > 0} sub="NRs vencidas/vencendo" />
      </div>

      {(vencidos > 0 || vencendo > 0) && (
        <div className="flex items-start gap-3 bg-red-900/10 border border-red-800/40 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary"><span className="text-red-400 font-medium">Atenção NR-31:</span> {vencidos} EPI{vencidos > 1 ? 's' : ''} vencido{vencidos > 1 ? 's' : ''} e {vencendo} vencendo em breve. Regularize antes da próxima fiscalização do MTE.</p>
        </div>
      )}

      <div className="flex gap-0 border-b border-border mb-4">
        {(['epi', 'treinamentos'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${subTab === t ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
            {t === 'epi' ? 'EPIs Fornecidos' : 'Treinamentos NR'}
          </button>
        ))}
      </div>

      {subTab === 'epi' && (
        <>
          <Bar value={search} onChange={setSearch} placeholder="Colaborador ou item EPI...">
            <ExportButtons endpoint="/api/rh/epi/" filename="controle_epi" />
            <BtnNew onClick={() => { setForm({ colaborador_id:'1', item:'', ca:'', data_entrega:'', data_vencimento:'', quantidade:'1' }); setModal(true) }} label="Registrar EPI" />
          </Bar>
          <Table heads={['Colaborador', 'Cargo', 'Item EPI', 'CA', 'Entrega', 'Vencimento', 'Qtd.', 'Status']}>
            {filteredEpi.length === 0 ? <Empty cols={8} /> : filteredEpi.map(r => (
              <Tr key={r.id}>
                <TdMain>{r.colaborador_nome}</TdMain>
                <Td>{r.cargo}</Td>
                <Td>{r.item}</Td>
                <Td mono>{r.ca}</Td>
                <Td mono>{r.data_entrega}</Td>
                <td className="px-4 py-3 font-mono text-sm">
                  <span className={r.status === 'vencido' ? 'text-red-400' : r.status === 'vencendo' ? 'text-amber-300' : 'text-text-muted'}>{r.data_vencimento}</span>
                </td>
                <Td mono>{r.quantidade}</Td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="w-12" />
              </Tr>
            ))}
          </Table>
        </>
      )}

      {subTab === 'treinamentos' && (
        <>
          <Bar value={search} onChange={setSearch} placeholder="Colaborador ou treinamento...">
            <ExportButtons endpoint="/api/rh/treinamentos/" filename="treinamentos_nr" />
            <BtnNew onClick={() => { setFormTre({ colaborador_id:'1', titulo:'', nr:'NR-31', data:'', validade:'', carga_horaria:'8', instrutor:'' }); setModalTre(true) }} label="Registrar Treinamento" />
          </Bar>
          <Table heads={['Colaborador', 'Treinamento', 'NR', 'Data', 'Validade', 'C/H', 'Instrutor', 'Status']}>
            {filteredTre.length === 0 ? <Empty cols={8} /> : filteredTre.map(r => (
              <Tr key={r.id}>
                <TdMain>{r.colaborador_nome}</TdMain>
                <Td>{r.titulo}</Td>
                <td className="px-4 py-3"><span className="text-xs bg-blue-900/30 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded font-medium">{r.nr}</span></td>
                <Td mono>{r.data}</Td>
                <td className="px-4 py-3 font-mono text-sm"><span className={r.status === 'vencido' ? 'text-red-400' : r.status === 'vencendo' ? 'text-amber-300' : 'text-text-muted'}>{r.validade}</span></td>
                <Td mono>{r.carga_horaria}h</Td>
                <Td>{r.instrutor}</Td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="w-12" />
              </Tr>
            ))}
          </Table>
        </>
      )}

      {modal && (
        <Modal title="Registrar Entrega de EPI" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Colaborador *">
              <Sel value={form.colaborador_id} onChange={v => setForm(f => ({ ...f, colaborador_id: v }))}>
                {[]}
              </Sel>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Item EPI *"><input className={inp} value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} placeholder="Ex: Bota de Segurança" /></Field>
              <Field label="CA (Certificado de Aprovação) *"><input className={inp} value={form.ca} onChange={e => setForm(f => ({ ...f, ca: e.target.value }))} placeholder="12345" /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Qtd."><input type="number" className={inp} value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} /></Field>
              <Field label="Data Entrega *"><input type="date" className={inp} value={form.data_entrega} onChange={e => setForm(f => ({ ...f, data_entrega: e.target.value }))} /></Field>
              <Field label="Vencimento *"><input type="date" className={inp} value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} /></Field>
            </div>
            <Footer onClose={() => setModal(false)} onSave={() => { setSaving(true); setTimeout(() => { setModal(false); setSaving(false) }, 600) }} saving={saving} disabled={!form.item || !form.ca || !form.data_entrega || !form.data_vencimento} />
          </div>
        </Modal>
      )}

      {modalTre && (
        <Modal title="Registrar Treinamento NR" onClose={() => setModalTre(false)}>
          <div className="space-y-4">
            <Field label="Colaborador *">
              <Sel value={formTre.colaborador_id} onChange={v => setFormTre(f => ({ ...f, colaborador_id: v }))}>
                {[]}
              </Sel>
            </Field>
            <Field label="Título do Treinamento *"><input className={inp} value={formTre.titulo} onChange={e => setFormTre(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: NR-31 — Segurança no Trabalho Rural" /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="NR Referência">
                <Sel value={formTre.nr} onChange={v => setFormTre(f => ({ ...f, nr: v }))}>
                  {['NR-31','NR-33','NR-35','NR-11','NR-23','NR-06','NR-12','Outro'].map(n => <option key={n} value={n}>{n}</option>)}
                </Sel>
              </Field>
              <Field label="Data *"><input type="date" className={inp} value={formTre.data} onChange={e => setFormTre(f => ({ ...f, data: e.target.value }))} /></Field>
              <Field label="Validade *"><input type="date" className={inp} value={formTre.validade} onChange={e => setFormTre(f => ({ ...f, validade: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Carga Horária (h)"><input type="number" className={inp} value={formTre.carga_horaria} onChange={e => setFormTre(f => ({ ...f, carga_horaria: e.target.value }))} /></Field>
              <Field label="Instrutor / Entidade"><input className={inp} value={formTre.instrutor} onChange={e => setFormTre(f => ({ ...f, instrutor: e.target.value }))} placeholder="Ex: SENAR/SP" /></Field>
            </div>
            <Footer onClose={() => setModalTre(false)} onSave={() => { setSaving(true); setTimeout(() => { setModalTre(false); setSaving(false) }, 600) }} saving={saving} disabled={!formTre.titulo || !formTre.data || !formTre.validade} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab eSocial e FGTS ───────────────────────────────────────────────────────

function TabESocial() {
  const [eventos, setEventos] = useState<EventoESocial[]>([])
  const [guias, setGuias] = useState<GuiaFGTS[]>([])
  const [subTab, setSubTab] = useState<'esocial' | 'fgts'>('esocial')
  const [sending, setSending] = useState(false)

  const pendentes = eventos.filter(e => e.status === 'pendente').length

  async function enviarPendentes() {
    setSending(true)
    try { await api.post('/api/rh/esocial/enviar/', {}) } catch { /* mock */ }
    setTimeout(() => setSending(false), 1500)
  }

  async function gerarGuia(id: number) {
    try { await api.post(`/api/rh/fgts/gerar/${id}/`, {}) } catch { /* mock */ }
    setGuias(g => g.map(x => x.id === id ? { ...x, status: 'gerada', codigo_pagamento: '150-6' } : x))
  }

  const tipoESocial: Record<string, string> = {
    'S-2200':'Admissão', 'S-2206':'Alt. Contrato', 'S-2230':'Afastamento',
    'S-2299':'Desligamento', 'S-1200':'Remuneração', 'S-1210':'Pgto. Benefício',
  }

  return (
    <div>
      <div className="flex gap-0 border-b border-border mb-4">
        {(['esocial', 'fgts'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${subTab === t ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
            {t === 'esocial' ? 'eSocial' : 'FGTS Digital / GPS'}
          </button>
        ))}
      </div>

      {subTab === 'esocial' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <KpiCard label="Eventos Pendentes" val={pendentes} warn={pendentes > 0} sub="aguardando envio" />
            <KpiCard label="Enviados (mês)" val={eventos.filter(e => e.status === 'enviado').length} />
            <KpiCard label="Processados" val={eventos.filter(e => e.status === 'processado').length} />
            <KpiCard label="Com Erro" val={eventos.filter(e => e.status === 'erro').length} warn={eventos.filter(e => e.status === 'erro').length > 0} />
          </div>

          {pendentes > 0 && (
            <div className="flex items-center justify-between bg-yellow-900/10 border border-yellow-800/40 rounded-xl px-4 py-3 mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="text-amber-300 shrink-0" />
                <p className="text-sm text-amber-300 font-medium">{pendentes} evento{pendentes > 1 ? 's' : ''} pendente{pendentes > 1 ? 's' : ''} para envio ao eSocial</p>
              </div>
              <button onClick={enviarPendentes} disabled={sending} className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60">
                <Send size={14} /> {sending ? 'Enviando...' : 'Enviar Pendentes'}
              </button>
            </div>
          )}

          <Table heads={['Evento', 'Tipo', 'Colaborador / Referência', 'Data Envio', 'Protocolo', 'Status']}>
            {eventos.map(e => (
              <Tr key={e.id}>
                <Td mono>{e.tipo}</Td>
                <Td>{tipoESocial[e.tipo] ?? e.tipo}</Td>
                <TdMain>{e.descricao}<span className="block text-xs text-text-muted font-normal">{e.colaborador_nome ?? e.competencia}</span></TdMain>
                <Td mono>{e.data_envio ?? '—'}</Td>
                <Td mono>{e.protocolo ?? '—'}</Td>
                <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                <td className="w-12" />
              </Tr>
            ))}
          </Table>
        </div>
      )}

      {subTab === 'fgts' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <KpiCard label="Guias Abertas" val={guias.filter(g => g.status === 'aberta').length} warn={guias.filter(g => g.status === 'aberta').length > 0} />
            <KpiCard label="Total FGTS (mês atual)" val={`R$ ${guias.find(g => g.competencia === COMPETENCIA_ATUAL)?.valor_fgts.toLocaleString('pt-BR', { minimumFractionDigits:2 }) ?? '—'}`} />
            <KpiCard label="Pagas no Ano" val={guias.filter(g => g.status === 'paga').length} />
            <KpiCard label="Próximo Vencimento" val={guias.find(g => g.status !== 'paga')?.data_vencimento ?? '—'} />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">{['Competência', 'Base FGTS', 'Alíq.', 'Valor FGTS', 'Cód. Pgto.', 'Vencimento', 'Pagamento', 'Status', ''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {guias.map(g => (
                  <tr key={g.id} className="border-b border-border/50 hover:bg-card2">
                    <td className="px-4 py-3 font-mono text-text-primary">{g.competencia}</td>
                    <td className="px-4 py-3 font-mono text-text-secondary">R$ {g.base_fgts.toLocaleString('pt-BR', { minimumFractionDigits:2 })}</td>
                    <td className="px-4 py-3 font-mono text-text-muted">8%</td>
                    <td className="px-4 py-3 font-mono font-semibold text-text-primary">R$ {g.valor_fgts.toLocaleString('pt-BR', { minimumFractionDigits:2 })}</td>
                    <td className="px-4 py-3 font-mono text-text-muted">{g.codigo_pagamento ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{g.data_vencimento}</td>
                    <td className="px-4 py-3 font-mono text-text-muted">{g.data_pagamento ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={g.status} /></td>
                    <td className="px-4 py-3">
                      {g.status === 'aberta' && (
                        <button onClick={() => gerarGuia(g.id)} className="text-xs text-accent border border-accent/30 px-2 py-1 rounded hover:bg-accent/10 transition-colors whitespace-nowrap">Gerar Guia</button>
                      )}
                      {g.status === 'gerada' && (
                        <button className="text-xs text-emerald-400 border border-emerald-800/40 px-2 py-1 rounded hover:bg-emerald-900/20 transition-colors whitespace-nowrap">Baixar GPS</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab Relatórios ───────────────────────────────────────────────────────────

function TabRelatorios() {
  const [agrupamento, setAgrupamento] = useState('colaborador')
  const [competencia, setCompetencia] = useState(COMPETENCIA_ATUAL)

  const fmtR = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits:2 })}`

  const porColaborador = ([] as typeof MOCK_FOLHA).map(f => ({
    nome: f.colaborador_nome, cargo: f.cargo,
    salario: f.salario_base, fgts: f.fgts,
    encargos_inss: f.inss, total_empresa: f.total_proventos + f.fgts,
    liquido: f.liquido,
  }))

  const porDepto: Record<string, { total: number; fgts: number; count: number }> = {}
  ([]).forEach(c => {
    const folha = undefined
    if (!folha) return
    const d = c.departamento ?? 'Sem depto.'
    if (!porDepto[d]) porDepto[d] = { total: 0, fgts: 0, count: 0 }
    porDepto[d].total += folha.total_proventos
    porDepto[d].fgts += folha.fgts
    porDepto[d].count++
  })

  const totalCusto = ([] as typeof MOCK_FOLHA).reduce((s, f) => s + f.total_proventos + f.fgts, 0)
  const totalLiquido = ([] as typeof MOCK_FOLHA).reduce((s, f) => s + f.liquido, 0)
  const totalFGTS = ([] as typeof MOCK_FOLHA).reduce((s, f) => s + f.fgts, 0)

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="text-sm font-medium text-text-secondary">Competência:</span>
        <input type="month" className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" value={competencia} onChange={e => setCompetencia(e.target.value)} />
        <Sel value={agrupamento} onChange={setAgrupamento}>
          <option value="colaborador">Por Colaborador</option>
          <option value="departamento">Por Departamento</option>
        </Sel>
        <div className="flex-1" />
        <ExportButtons endpoint="/api/rh/relatorio-custo/" filename={`custo_rh_${competencia}`} params={{ competencia, agrupamento }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Custo Total Empresa" val={fmtR(totalCusto)} sub="proventos + FGTS" />
        <KpiCard label="Total Líquido" val={fmtR(totalLiquido)} sub="pago aos colaboradores" />
        <KpiCard label="FGTS Total" val={fmtR(totalFGTS)} />
        <KpiCard label="Custo Médio/Colaborador" val={fmtR(totalCusto / 1)} />
      </div>

      {agrupamento === 'colaborador' && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">{['Colaborador', 'Cargo', 'Salário', 'FGTS Empresa', 'Encargos', 'Custo Total Empresa', 'Líquido Pago'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {porColaborador.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-card2">
                  <td className="px-4 py-3 font-medium text-text-primary">{r.nome}</td>
                  <td className="px-4 py-3 text-text-muted">{r.cargo}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{fmtR(r.salario)}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{fmtR(r.fgts)}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{fmtR(r.encargos_inss)}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmtR(r.total_empresa)}</td>
                  <td className="px-4 py-3 font-mono text-accent">{fmtR(r.liquido)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-card2 font-bold">
                <td colSpan={5} className="px-4 py-3 text-text-secondary text-sm">Total</td>
                <td className="px-4 py-3 font-mono text-text-primary">{fmtR(totalCusto)}</td>
                <td className="px-4 py-3 font-mono text-accent">{fmtR(totalLiquido)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {agrupamento === 'departamento' && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">{['Departamento', 'Colaboradores', 'Total Proventos', 'FGTS', 'Custo Total', 'Custo Médio'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {Object.entries(porDepto).map(([depto, d]) => (
                <tr key={depto} className="border-b border-border/50 hover:bg-card2">
                  <td className="px-4 py-3 font-medium text-text-primary">{depto}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{d.count}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{fmtR(d.total)}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{fmtR(d.fgts)}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmtR(d.total + d.fgts)}</td>
                  <td className="px-4 py-3 font-mono text-accent">{fmtR((d.total + d.fgts) / d.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

const TABS = ['Colaboradores', 'Ponto Eletrônico', 'Folha de Pagamento', 'Afastamentos', 'EPI e NR-31', 'eSocial e FGTS', 'Relatórios']

export default function RH() {
  const [tab, setTab] = useState('Colaboradores')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Users size={20} className="text-accent" /> RH e Folha de Pagamento
        </h1>
        <p className="text-sm text-text-muted mt-1">Colaboradores, ponto, eSocial, FGTS e encargos rurais</p>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Colaboradores'      && <TabColaboradores />}
      {tab === 'Ponto Eletrônico'   && <TabPonto />}
      {tab === 'Folha de Pagamento' && <TabFolha />}
      {tab === 'Afastamentos'       && <TabAfastamentos />}
      {tab === 'EPI e NR-31'        && <TabEPI />}
      {tab === 'eSocial e FGTS'     && <TabESocial />}
      {tab === 'Relatórios'         && <TabRelatorios />}
    </div>
  )
}
