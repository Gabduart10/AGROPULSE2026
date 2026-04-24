import { useState } from 'react'
import {
  Plus, Search, X, ChevronDown, Truck, MapPin, FileText,
  Fuel, AlertTriangle, CheckCircle2, Clock, Navigation,
  Package, Eye, BarChart2,
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
    <div className={`border rounded-xl px-4 py-3 ${warn ? 'bg-yellow-900/10 border-yellow-800/40' : 'bg-card2 border-border'}`}>
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

function Footer({ onClose, onSave, saving, disabled }: { onClose: () => void; onSave: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <div className="flex gap-2 pt-4">
      <button onClick={onClose} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2">Cancelar</button>
      <button onClick={onSave} disabled={saving || disabled} className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button>
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
    disponivel:    'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    em_rota:       'bg-accent/20 text-accent border-accent/30',
    manutencao:    'bg-amber-950/50 text-amber-200 border-amber-800/50',
    inativo:       'bg-card2 text-text-muted border-border',
    programado:    'bg-blue-900/30 text-blue-400 border-blue-800/40',
    concluido:     'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    cancelado:     'bg-red-900/30 text-red-400 border-red-800/40',
    pendente:      'bg-card2 text-text-muted border-border',
    entregue:      'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    ocorrencia:    'bg-red-900/30 text-red-400 border-red-800/40',
    devolvido:     'bg-amber-950/50 text-amber-200 border-amber-800/50',
    autorizado:    'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    rascunho:      'bg-card2 text-text-muted border-border',
    aberta:        'bg-red-900/30 text-red-400 border-red-800/40',
    resolvida:     'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
  }
  const labels: Record<string, string> = {
    disponivel:'Disponível', em_rota:'Em Rota', manutencao:'Manutenção', inativo:'Inativo',
    programado:'Programado', concluido:'Concluído', cancelado:'Cancelado',
    pendente:'Pendente', entregue:'Entregue', ocorrencia:'Ocorrência', devolvido:'Devolvido',
    autorizado:'Autorizado', rascunho:'Rascunho', aberta:'Aberta', resolvida:'Resolvida',
  }
  const cls = m[status] ?? 'bg-card2 text-text-muted border-border'
  return <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${cls}`}>{labels[status] ?? status}</span>
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Veiculo {
  id: number; tipo: string; placa: string; marca: string; modelo: string; ano: number
  descricao: string; capacidade_kg: number; capacidade_m3?: number
  vencimento_crlv: string; vencimento_tacografo?: string
  motorista_nome?: string; motorista_cnh?: string; motorista_categoria?: string
  status: 'disponivel' | 'em_rota' | 'manutencao' | 'inativo'
  km_atual: number; ultima_posicao?: string; ultima_posicao_hora?: string
}

interface Carga {
  id: number; numero: string
  veiculo_placa: string; veiculo_descricao: string
  motorista: string; data_saida: string; hora_saida: string
  regiao: string; qtd_paradas: number; distancia_km: number
  peso_kg: number; status: 'programado' | 'em_rota' | 'concluido' | 'cancelado'
  paradas: { ordem: number; cliente: string; cidade: string; uf: string; km_parcial: number }[]
}

interface Romaneio {
  id: number; numero: string; carga_numero: string
  cliente: string; endereco: string; cidade: string; uf: string
  peso_kg: number; volumes: number; codigo_rastreamento: string
  status: 'pendente' | 'em_rota' | 'entregue' | 'ocorrencia' | 'devolvido'
  data_prevista: string; data_entrega?: string; hora_entrega?: string
  assinatura: boolean; foto: boolean
}

interface DocTransporte {
  id: number; tipo: 'cte' | 'mdfe'; numero: string; serie: string
  chave?: string; status: 'rascunho' | 'autorizado' | 'cancelado'
  tomador: string; uf_ini: string; uf_fim: string
  valor: number; peso_kg: number; data_emissao: string; carga_numero?: string
}

interface Transportadora {
  id: number; nome: string; cnpj: string; rntrc: string
  telefone: string; email: string
  fretes: { regiao: string; valor_kg: number; minimo: number; prazo: number }[]
}

interface Abastecimento {
  id: number; veiculo_placa: string; veiculo_descricao: string
  data: string; km_hodometro: number; litros: number
  preco_litro: number; valor_total: number
  combustivel: 'diesel' | 'gasolina' | 'etanol'
  posto: string; motorista: string
}

interface Ocorrencia {
  id: number; romaneio_numero: string; cliente: string; cidade: string
  data: string; hora: string; tipo: string
  descricao: string; status: 'aberta' | 'resolvida'
  tem_foto: boolean; tem_geolocalizacao: boolean
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const HOJE = new Date().toISOString().split('T')[0]

const MOCK_FROTA: Veiculo[] = [
  { id:1, tipo:'caminhao', placa:'ABC-1234', marca:'Volvo', modelo:'FH 460', ano:2022, descricao:'Caminhão Baú Principal', capacidade_kg:23000, capacidade_m3:90, vencimento_crlv:'2026-12-31', vencimento_tacografo:'2026-08-15', motorista_nome:'João da Silva', motorista_cnh:'12345678901', motorista_categoria:'E', status:'em_rota', km_atual:142500, ultima_posicao:'-21.18,-47.82 (Ribeirao Preto-SP)', ultima_posicao_hora:'2026-04-21 09:45' },
  { id:2, tipo:'caminhao', placa:'DEF-4567', marca:'Mercedes', modelo:'Atego 2430', ano:2021, descricao:'Caminhão Graneleiro', capacidade_kg:19000, vencimento_crlv:'2026-10-30', vencimento_tacografo:'2026-03-10', motorista_nome:'Carlos Mendes', motorista_cnh:'98765432109', motorista_categoria:'D', status:'disponivel', km_atual:98300, ultima_posicao:'-21.20,-47.80 (Ribeirão Preto-SP)', ultima_posicao_hora:'2026-04-20 17:30' },
  { id:3, tipo:'van', placa:'GHI-9012', marca:'Mercedes', modelo:'Sprinter 415', ano:2023, descricao:'VUC Distribuição Urbana', capacidade_kg:3000, capacidade_m3:14, vencimento_crlv:'2027-04-30', motorista_nome:'Paulo Rodrigues', motorista_cnh:'45678912300', motorista_categoria:'B', status:'disponivel', km_atual:34800 },
  { id:4, tipo:'pickup', placa:'JKL-3456', marca:'Toyota', modelo:'Hilux CD', ano:2023, descricao:'Pickup Representante', capacidade_kg:1000, vencimento_crlv:'2027-01-15', motorista_nome:'Ana Ferreira', motorista_cnh:'32165498700', motorista_categoria:'B', status:'manutencao', km_atual:61200 },
]

const MOCK_CARGAS: Carga[] = [
  { id:1, numero:'CRG-2026-042', veiculo_placa:'ABC-1234', veiculo_descricao:'Caminhão Baú Principal', motorista:'João da Silva', data_saida:'2026-04-21', hora_saida:'06:00', regiao:'SP Interior — Norte', qtd_paradas:4, distancia_km:320, peso_kg:8400, status:'em_rota',
    paradas:[{ ordem:1, cliente:'Fazenda Santa Cruz', cidade:'Ribeirão Preto', uf:'SP', km_parcial:80 },{ ordem:2, cliente:'Agropecuária Bordon', cidade:'Barretos', uf:'SP', km_parcial:60 },{ ordem:3, cliente:'João da Silva', cidade:'Colômbia', uf:'SP', km_parcial:45 },{ ordem:4, cliente:'Cooperativa Agronorte', cidade:'Bebedouro', uf:'SP', km_parcial:135 }]},
  { id:2, numero:'CRG-2026-043', veiculo_placa:'DEF-4567', veiculo_descricao:'Caminhão Graneleiro', motorista:'Carlos Mendes', data_saida:'2026-04-22', hora_saida:'07:30', regiao:'MG — Triângulo Mineiro', qtd_paradas:3, distancia_km:410, peso_kg:15200, status:'programado',
    paradas:[{ ordem:1, cliente:'Fazenda Boa Vista', cidade:'Uberlândia', uf:'MG', km_parcial:140 },{ ordem:2, cliente:'Fazenda São João', cidade:'Uberaba', uf:'MG', km_parcial:95 },{ ordem:3, cliente:'Cooperativa Central MG', cidade:'Frutal', uf:'MG', km_parcial:175 }]},
  { id:3, numero:'CRG-2026-041', veiculo_placa:'GHI-9012', veiculo_descricao:'VUC Distribuição Urbana', motorista:'Paulo Rodrigues', data_saida:'2026-04-20', hora_saida:'08:00', regiao:'Ribeirão Preto — Área Urbana', qtd_paradas:6, distancia_km:85, peso_kg:1800, status:'concluido',
    paradas:[{ ordem:1, cliente:'Balcão Centro', cidade:'Ribeirão Preto', uf:'SP', km_parcial:12 },{ ordem:2, cliente:'Balcão Norte', cidade:'Ribeirão Preto', uf:'SP', km_parcial:8 },{ ordem:3, cliente:'Cliente Express', cidade:'Ribeirão Preto', uf:'SP', km_parcial:5 },{ ordem:4, cliente:'Loja Agro Sul', cidade:'Ribeirão Preto', uf:'SP', km_parcial:18 },{ ordem:5, cliente:'Posto Avançado', cidade:'Sertãozinho', uf:'SP', km_parcial:22 },{ ordem:6, cliente:'Distribuidora Leste', cidade:'Brodowski', uf:'SP', km_parcial:20 }]},
]

const MOCK_ROMANEIOS: Romaneio[] = [
  { id:1, numero:'RMN-001-042', carga_numero:'CRG-2026-042', cliente:'Fazenda Santa Cruz', endereco:'Rod. SP-333 km 12', cidade:'Ribeirão Preto', uf:'SP', peso_kg:2100, volumes:8, codigo_rastreamento:'AGRO042001SP', status:'entregue', data_prevista:'2026-04-21', data_entrega:'2026-04-21', hora_entrega:'10:30', assinatura:true, foto:true },
  { id:2, numero:'RMN-002-042', carga_numero:'CRG-2026-042', cliente:'Agropecuária Bordon', endereco:'Av. Industrial 800', cidade:'Barretos', uf:'SP', peso_kg:1800, volumes:6, codigo_rastreamento:'AGRO042002SP', status:'em_rota', data_prevista:'2026-04-21', assinatura:false, foto:false },
  { id:3, numero:'RMN-003-042', carga_numero:'CRG-2026-042', cliente:'João da Silva', endereco:'Fazenda Boa Esperança s/n', cidade:'Colômbia', uf:'SP', peso_kg:1500, volumes:5, codigo_rastreamento:'AGRO042003SP', status:'pendente', data_prevista:'2026-04-21', assinatura:false, foto:false },
  { id:4, numero:'RMN-004-042', carga_numero:'CRG-2026-042', cliente:'Cooperativa Agronorte', endereco:'Rua Cooperativa 100', cidade:'Bebedouro', uf:'SP', peso_kg:3000, volumes:12, codigo_rastreamento:'AGRO042004SP', status:'pendente', data_prevista:'2026-04-21', assinatura:false, foto:false },
  { id:5, numero:'RMN-001-041', carga_numero:'CRG-2026-041', cliente:'Balcão Centro', endereco:'Rua XV de Novembro 200', cidade:'Ribeirão Preto', uf:'SP', peso_kg:320, volumes:4, codigo_rastreamento:'AGRO041001SP', status:'entregue', data_prevista:'2026-04-20', data_entrega:'2026-04-20', hora_entrega:'09:15', assinatura:true, foto:true },
  { id:6, numero:'RMN-002-041', carga_numero:'CRG-2026-041', cliente:'Balcão Norte', endereco:'Av. Norte 1500', cidade:'Ribeirão Preto', uf:'SP', peso_kg:280, volumes:3, codigo_rastreamento:'AGRO041002SP', status:'ocorrencia', data_prevista:'2026-04-20', assinatura:false, foto:true },
]

const MOCK_DOCS: DocTransporte[] = [
  { id:1, tipo:'cte', numero:'000001', serie:'1', chave:'35260412345678000100570010000000011234567890', status:'autorizado', tomador:'Fazenda Santa Cruz', uf_ini:'SP', uf_fim:'SP', valor:450.00, peso_kg:2100, data_emissao:'2026-04-21', carga_numero:'CRG-2026-042' },
  { id:2, tipo:'cte', numero:'000002', serie:'1', chave:'35260412345678000100570010000000021234567891', status:'autorizado', tomador:'Agropecuária Bordon', uf_ini:'SP', uf_fim:'SP', valor:380.00, peso_kg:1800, data_emissao:'2026-04-21', carga_numero:'CRG-2026-042' },
  { id:3, tipo:'mdfe', numero:'000001', serie:'1', chave:'35260412345678000100580010000000011234567892', status:'autorizado', tomador:'(Vários — CRG-2026-042)', uf_ini:'SP', uf_fim:'SP', valor:1680.00, peso_kg:8400, data_emissao:'2026-04-21', carga_numero:'CRG-2026-042' },
  { id:4, tipo:'cte', numero:'000003', serie:'1', status:'rascunho', tomador:'Cooperativa Agronorte', uf_ini:'SP', uf_fim:'SP', valor:620.00, peso_kg:3000, data_emissao:'2026-04-21', carga_numero:'CRG-2026-042' },
]

const MOCK_TRANSPORTADORAS: Transportadora[] = [
  { id:1, nome:'Expresso Rural Transportes', cnpj:'12.345.678/0001-99', rntrc:'00123456', telefone:'(16) 3333-1111', email:'cte@expressorrural.com.br', fretes:[{ regiao:'SP Interior', valor_kg:0.12, minimo:180, prazo:1 },{ regiao:'MG Triângulo', valor_kg:0.18, minimo:250, prazo:2 },{ regiao:'GO / MS', valor_kg:0.22, minimo:350, prazo:3 }]},
  { id:2, nome:'Logística Agro Centro-Oeste', cnpj:'98.765.432/0001-11', rntrc:'00987654', telefone:'(67) 9999-2222', email:'frete@agrocentrooeste.com', fretes:[{ regiao:'MS Dourados', valor_kg:0.25, minimo:400, prazo:2 },{ regiao:'GO Sul', valor_kg:0.20, minimo:320, prazo:2 },{ regiao:'MT Sul', valor_kg:0.30, minimo:500, prazo:3 }]},
]

const MOCK_ABASTECIMENTOS: Abastecimento[] = [
  { id:1, veiculo_placa:'ABC-1234', veiculo_descricao:'Caminhão Baú Principal', data:'2026-04-21', km_hodometro:142200, litros:180, preco_litro:6.49, valor_total:1168.20, combustivel:'diesel', posto:'Posto Ipiranga BR-050', motorista:'João da Silva' },
  { id:2, veiculo_placa:'DEF-4567', veiculo_descricao:'Caminhão Graneleiro', data:'2026-04-19', km_hodometro:97900, litros:210, preco_litro:6.45, valor_total:1354.50, combustivel:'diesel', posto:'Posto Shell SP-330', motorista:'Carlos Mendes' },
  { id:3, veiculo_placa:'GHI-9012', veiculo_descricao:'VUC Distribuição Urbana', data:'2026-04-18', km_hodometro:34500, litros:65, preco_litro:6.52, valor_total:423.80, combustivel:'diesel', posto:'Posto BR Ribeirão Preto', motorista:'Paulo Rodrigues' },
  { id:4, veiculo_placa:'ABC-1234', veiculo_descricao:'Caminhão Baú Principal', data:'2026-04-14', km_hodometro:141800, litros:195, preco_litro:6.48, valor_total:1263.60, combustivel:'diesel', posto:'Posto Total MG-262', motorista:'João da Silva' },
]

const MOCK_OCORRENCIAS: Ocorrencia[] = [
  { id:1, romaneio_numero:'RMN-002-041', cliente:'Balcão Norte', cidade:'Ribeirão Preto', data:'2026-04-20', hora:'11:20', tipo:'endereco_nao_encontrado', descricao:'Endereço constante no romaneio não localizado. Tentativa de contato com o cliente não obteve resposta. Carga retornou ao depósito.', status:'aberta', tem_foto:true, tem_geolocalizacao:true },
]

// ─── Tab Frota ────────────────────────────────────────────────────────────────

function TabFrota() {
  const [rows, setRows] = useState<Veiculo[]>(MOCK_FROTA)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [detail, setDetail] = useState<Veiculo | null>(null)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ tipo:'caminhao', placa:'', marca:'', modelo:'', ano:String(new Date().getFullYear()), descricao:'', capacidade_kg:'', capacidade_m3:'', vencimento_crlv:'', vencimento_tacografo:'', motorista_nome:'', motorista_cnh:'', motorista_categoria:'B' })

  const hoje = new Date().toISOString().split('T')[0]
  const vencendo = rows.filter(r => r.vencimento_crlv <= new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]).length

  const filtered = rows.filter(r =>
    (r.placa.toLowerCase().includes(search.toLowerCase()) || r.descricao.toLowerCase().includes(search.toLowerCase()) || (r.motorista_nome ?? '').toLowerCase().includes(search.toLowerCase())) &&
    (filterStatus ? r.status === filterStatus : true)
  )

  async function save() {
    setSaving(true)
    try { await api.post('/api/veiculos/', form) } catch { /* mock */ }
    const n: Veiculo = { id: Date.now(), tipo: form.tipo, placa: form.placa, marca: form.marca, modelo: form.modelo, ano: +form.ano, descricao: form.descricao, capacidade_kg: +form.capacidade_kg, vencimento_crlv: form.vencimento_crlv, vencimento_tacografo: form.vencimento_tacografo || undefined, motorista_nome: form.motorista_nome || undefined, motorista_cnh: form.motorista_cnh || undefined, motorista_categoria: form.motorista_categoria, status: 'disponivel', km_atual: 0 }
    setRows(r => [...r, n])
    setModal(false); setSaving(false)
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total de Veículos" val={rows.length} />
        <KpiCard label="Disponíveis" val={rows.filter(r => r.status === 'disponivel').length} />
        <KpiCard label="Em Rota Agora" val={rows.filter(r => r.status === 'em_rota').length} />
        <KpiCard label="Doc. Vencendo em 60 dias" val={vencendo} warn={vencendo > 0} sub={vencendo > 0 ? 'verificar CRLV/tacógrafo' : 'tudo em dia'} />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Placa, descrição ou motorista...">
        <Sel value={filterStatus} onChange={setFilterStatus}>
          <option value="">Todos os status</option>
          <option value="disponivel">Disponível</option>
          <option value="em_rota">Em Rota</option>
          <option value="manutencao">Manutenção</option>
          <option value="inativo">Inativo</option>
        </Sel>
        <BtnNew onClick={() => { setForm({ tipo:'caminhao', placa:'', marca:'', modelo:'', ano:String(new Date().getFullYear()), descricao:'', capacidade_kg:'', capacidade_m3:'', vencimento_crlv:'', vencimento_tacografo:'', motorista_nome:'', motorista_cnh:'', motorista_categoria:'B' }); setModal(true) }} label="Cadastrar Veículo" />
      </Bar>

      <Table heads={['Placa', 'Descrição', 'Motorista', 'Capacidade', 'KM Atual', 'CRLV', 'Posição Atual', 'Status']}>
        {filtered.length === 0 ? <Empty cols={8} /> : filtered.map(r => (
          <Tr key={r.id}>
            <Td mono>{r.placa}</Td>
            <TdMain>{r.descricao}<span className="block text-xs text-text-muted font-normal">{r.marca} {r.modelo} {r.ano}</span></TdMain>
            <Td>{r.motorista_nome}<span className="block text-xs text-text-muted">CNH {r.motorista_categoria} — {r.motorista_cnh?.slice(0,6)}***</span></Td>
            <Td mono>{r.capacidade_kg.toLocaleString('pt-BR')} kg{r.capacidade_m3 ? ` / ${r.capacidade_m3} m³` : ''}</Td>
            <Td mono>{r.km_atual.toLocaleString('pt-BR')} km</Td>
            <td className="px-4 py-3">
              <span className={`text-xs font-mono ${r.vencimento_crlv < hoje ? 'text-red-400' : r.vencimento_crlv <= new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0] ? 'text-amber-300' : 'text-text-muted'}`}>
                {r.vencimento_crlv}
              </span>
            </td>
            <td className="px-4 py-3">
              {r.ultima_posicao
                ? <span className="flex items-center gap-1 text-xs text-accent"><Navigation size={11} />{r.ultima_posicao}</span>
                : <span className="text-xs text-text-muted">—</span>}
            </td>
            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            <td className="px-4 py-3 w-12">
              <button onClick={() => setDetail(r)} className="p-1.5 hover:bg-card rounded text-text-muted hover:text-accent transition-colors"><Eye size={14} /></button>
            </td>
          </Tr>
        ))}
      </Table>

      {detail && (
        <Modal title={`${detail.placa} — ${detail.descricao}`} onClose={() => setDetail(null)} wide>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[['Tipo', detail.tipo], ['Placa', detail.placa], ['Marca / Modelo', `${detail.marca} ${detail.modelo}`], ['Ano', detail.ano], ['Capacidade', `${detail.capacidade_kg.toLocaleString('pt-BR')} kg${detail.capacidade_m3 ? ` / ${detail.capacidade_m3} m³` : ''}`], ['KM Atual', `${detail.km_atual.toLocaleString('pt-BR')} km`], ['Venc. CRLV', detail.vencimento_crlv], ['Venc. Tacógrafo', detail.vencimento_tacografo ?? '—']].map(([k, v]) => (
                <div key={k}><span className="text-text-muted text-xs">{k}</span><p className="text-text-primary font-medium">{String(v)}</p></div>
              ))}
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-xs font-medium text-text-secondary mb-2">Motorista Habilitado</p>
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-xs text-text-muted">Nome</span><p className="text-text-primary font-medium">{detail.motorista_nome ?? '—'}</p></div>
                <div><span className="text-xs text-text-muted">CNH</span><p className="font-mono text-text-primary">{detail.motorista_cnh ?? '—'}</p></div>
                <div><span className="text-xs text-text-muted">Categoria</span><p className="text-text-primary font-medium">{detail.motorista_categoria ?? '—'}</p></div>
              </div>
            </div>
            {detail.ultima_posicao && (
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 flex items-center gap-2">
                <Navigation size={14} className="text-accent shrink-0" />
                <div>
                  <p className="text-xs text-text-secondary">Última posição GPS — {detail.ultima_posicao_hora}</p>
                  <p className="text-sm text-text-primary font-medium">{detail.ultima_posicao}</p>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title="Cadastrar Veículo" onClose={() => setModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo *">
                <Sel value={form.tipo} onChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <option value="caminhao">Caminhão</option><option value="van">Van / VUC</option>
                  <option value="pickup">Pickup</option><option value="trator">Trator</option><option value="outro">Outro</option>
                </Sel>
              </Field>
              <Field label="Placa *"><input className={inp} value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))} placeholder="ABC-1D23" /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Marca"><input className={inp} value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} placeholder="Volvo" /></Field>
              <Field label="Modelo"><input className={inp} value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} placeholder="FH 460" /></Field>
              <Field label="Ano"><input type="number" className={inp} value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))} /></Field>
            </div>
            <Field label="Descrição *"><input className={inp} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Caminhão Baú Principal" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Capacidade (kg) *"><input type="number" className={inp} value={form.capacidade_kg} onChange={e => setForm(f => ({ ...f, capacidade_kg: e.target.value }))} placeholder="23000" /></Field>
              <Field label="Capacidade (m³)"><input type="number" className={inp} value={form.capacidade_m3} onChange={e => setForm(f => ({ ...f, capacidade_m3: e.target.value }))} placeholder="90" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Venc. CRLV *"><input type="date" className={inp} value={form.vencimento_crlv} onChange={e => setForm(f => ({ ...f, vencimento_crlv: e.target.value }))} /></Field>
              <Field label="Venc. Tacógrafo"><input type="date" className={inp} value={form.vencimento_tacografo} onChange={e => setForm(f => ({ ...f, vencimento_tacografo: e.target.value }))} /></Field>
            </div>
            <p className="text-xs font-semibold text-text-secondary pt-2">Motorista Principal</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Nome"><input className={inp} value={form.motorista_nome} onChange={e => setForm(f => ({ ...f, motorista_nome: e.target.value }))} placeholder="João Silva" /></Field>
              <Field label="CNH"><input className={inp} value={form.motorista_cnh} onChange={e => setForm(f => ({ ...f, motorista_cnh: e.target.value }))} placeholder="00000000000" /></Field>
              <Field label="Categoria">
                <Sel value={form.motorista_categoria} onChange={v => setForm(f => ({ ...f, motorista_categoria: v }))}>
                  {['A','B','AB','C','D','E'].map(c => <option key={c} value={c}>{c}</option>)}
                </Sel>
              </Field>
            </div>
            <Footer onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.placa || !form.descricao || !form.capacidade_kg || !form.vencimento_crlv} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Programação de Cargas ────────────────────────────────────────────────

function TabProgramacao() {
  const [rows] = useState<Carga[]>(MOCK_CARGAS)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [detail, setDetail] = useState<Carga | null>(null)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))
  const [form, setForm] = useState({ veiculo_id:'1', data_saida:'', hora_saida:'07:00', regiao:'', peso_kg:'' })

  const filtered = rows.filter(r =>
    (r.numero.toLowerCase().includes(search.toLowerCase()) || r.veiculo_placa.toLowerCase().includes(search.toLowerCase()) || r.motorista.toLowerCase().includes(search.toLowerCase())) &&
    (filterStatus ? r.status === filterStatus : true)
  )

  function save() {
    setSaving(true)
    setTimeout(() => { setModal(false); setSaving(false) }, 800)
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Programadas Hoje" val={rows.filter(r => r.data_saida === HOJE).length} />
        <KpiCard label="Em Rota Agora" val={rows.filter(r => r.status === 'em_rota').length} />
        <KpiCard label="Concluídas" val={rows.filter(r => r.status === 'concluido').length} sub="últimos 7 dias" />
        <KpiCard label="Peso em Rota (kg)" val={rows.filter(r => r.status === 'em_rota').reduce((s, r) => s + r.peso_kg, 0).toLocaleString('pt-BR')} />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Nº carga, placa ou motorista...">
        <Sel value={filterStatus} onChange={setFilterStatus}>
          <option value="">Todos os status</option>
          <option value="programado">Programado</option>
          <option value="em_rota">Em Rota</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </Sel>
        <ExportButtons endpoint="/api/cargas/" filename="programacao_cargas" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <BtnNew onClick={() => setModal(true)} label="Programar Carga" />
      </Bar>

      <Table heads={['Nº Carga', 'Veículo', 'Motorista', 'Saída', 'Região / Rota', 'Paradas', 'Distância', 'Peso (kg)', 'Status']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={9} /> : filtered.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
            <Td mono>{r.numero}</Td>
            <TdMain>{r.veiculo_descricao}<span className="block text-xs text-text-muted font-normal">{r.veiculo_placa}</span></TdMain>
            <Td>{r.motorista}</Td>
            <Td mono>{r.data_saida} {r.hora_saida}</Td>
            <Td>{r.regiao}</Td>
            <Td mono>{r.qtd_paradas}</Td>
            <Td mono>{r.distancia_km} km</Td>
            <Td mono>{r.peso_kg.toLocaleString('pt-BR')}</Td>
            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            <td className="px-4 py-3 w-12">
              <button onClick={() => setDetail(r)} className="p-1.5 hover:bg-card rounded text-text-muted hover:text-accent transition-colors"><Eye size={14} /></button>
            </td>
          </Tr>
        ))}
      </Table>

      {/* Route detail */}
      {detail && (
        <Modal title={`Rota — ${detail.numero}`} onClose={() => setDetail(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-xs text-text-muted">Veículo</span><p className="font-medium text-text-primary">{detail.veiculo_placa}</p></div>
              <div><span className="text-xs text-text-muted">Motorista</span><p className="font-medium text-text-primary">{detail.motorista}</p></div>
              <div><span className="text-xs text-text-muted">Saída</span><p className="font-mono text-text-primary">{detail.data_saida} {detail.hora_saida}</p></div>
              <div><span className="text-xs text-text-muted">Peso Total</span><p className="font-mono text-text-primary">{detail.peso_kg.toLocaleString('pt-BR')} kg</p></div>
              <div><span className="text-xs text-text-muted">Distância</span><p className="font-mono text-text-primary">{detail.distancia_km} km</p></div>
              <div><span className="text-xs text-text-muted">Status</span><p><StatusBadge status={detail.status} /></p></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Sequência de Paradas</p>
              <div className="space-y-0">
                <div className="flex items-center gap-3 pb-3">
                  <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shrink-0"><span className="text-xs font-bold text-bg">✦</span></div>
                  <p className="text-sm font-medium text-text-primary">Base / Ponto de Origem</p>
                </div>
                {detail.paradas.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 pb-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-0.5 h-3 bg-border" />
                      <div className="w-6 h-6 rounded-full bg-card2 border border-border flex items-center justify-center"><span className="text-xs font-bold text-text-secondary">{p.ordem}</span></div>
                    </div>
                    <div className="flex-1 pt-2">
                      <p className="text-sm font-medium text-text-primary">{p.cliente}</p>
                      <p className="text-xs text-text-muted">{p.cidade} — {p.uf} · +{p.km_parcial} km</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title="Programar Nova Carga" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Veículo *">
              <Sel value={form.veiculo_id} onChange={v => setForm(f => ({ ...f, veiculo_id: v }))}>
                {MOCK_FROTA.filter(v => v.status === 'disponivel').map(v => <option key={v.id} value={v.id}>{v.placa} — {v.descricao}</option>)}
              </Sel>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data de Saída *"><input type="date" className={inp} value={form.data_saida} onChange={e => setForm(f => ({ ...f, data_saida: e.target.value }))} /></Field>
              <Field label="Hora de Saída"><input type="time" className={inp} value={form.hora_saida} onChange={e => setForm(f => ({ ...f, hora_saida: e.target.value }))} /></Field>
            </div>
            <Field label="Região / Descrição da Rota *"><input className={inp} value={form.regiao} onChange={e => setForm(f => ({ ...f, regiao: e.target.value }))} placeholder="Ex: SP Interior — Norte" /></Field>
            <Field label="Peso Total Estimado (kg)"><input type="number" className={inp} value={form.peso_kg} onChange={e => setForm(f => ({ ...f, peso_kg: e.target.value }))} placeholder="8400" /></Field>
            <div className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-3">
              <p className="text-xs text-accent">Os pedidos e paradas podem ser adicionados após a criação da carga, na tela de romaneios.</p>
            </div>
            <Footer onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.data_saida || !form.regiao} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Romaneios ────────────────────────────────────────────────────────────

function TabRomaneios() {
  const [rows] = useState<Romaneio[]>(MOCK_ROMANEIOS)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [ocorrencia, setOcorrencia] = useState<Romaneio | null>(null)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))
  const [ocForm, setOcForm] = useState({ tipo:'endereco_nao_encontrado', descricao:'' })

  const filtered = rows.filter(r =>
    (r.codigo_rastreamento.toLowerCase().includes(search.toLowerCase()) || r.cliente.toLowerCase().includes(search.toLowerCase()) || r.numero.toLowerCase().includes(search.toLowerCase())) &&
    (filterStatus ? r.status === filterStatus : true)
  )

  const stepFor = (status: string) => ({ pendente:0, em_rota:1, entregue:2, ocorrencia:2, devolvido:2 }[status] ?? 0)
  const stepLabel = ['Programado', 'Em Rota', 'Entregue']

  const tiposOc: Record<string, string> = { endereco_nao_encontrado:'Endereço não encontrado', cliente_ausente:'Cliente ausente', recusa:'Recusa de recebimento', avaria:'Mercadoria avariada', extravio:'Extravio / Perda', outro:'Outro' }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Em Rota" val={rows.filter(r => r.status === 'em_rota').length} />
        <KpiCard label="Entregues Hoje" val={rows.filter(r => r.status === 'entregue' && r.data_entrega === HOJE).length} />
        <KpiCard label="Pendentes" val={rows.filter(r => r.status === 'pendente').length} />
        <KpiCard label="Ocorrências" val={rows.filter(r => r.status === 'ocorrencia').length} warn={rows.filter(r => r.status === 'ocorrencia').length > 0} />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Código rastreamento, cliente ou nº romaneio...">
        <Sel value={filterStatus} onChange={setFilterStatus}>
          <option value="">Todos</option>
          <option value="pendente">Pendente</option>
          <option value="em_rota">Em Rota</option>
          <option value="entregue">Entregue</option>
          <option value="ocorrencia">Ocorrência</option>
          <option value="devolvido">Devolvido</option>
        </Sel>
        <ExportButtons endpoint="/api/romaneios/" filename="romaneios" selectedIds={sel.size > 0 ? [...sel] : undefined} />
      </Bar>

      <Table heads={['Nº Romaneio', 'Carga', 'Cliente', 'Cidade/UF', 'Peso', 'Volumes', 'Rastreamento', 'Progresso', 'Entrega', 'Docs']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={10} /> : filtered.map(r => {
          const step = stepFor(r.status)
          return (
            <Tr key={r.id} selected={sel.has(r.id)}>
              <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
              <Td mono>{r.numero}</Td>
              <Td mono>{r.carga_numero}</Td>
              <TdMain>{r.cliente}</TdMain>
              <Td>{r.cidade}/{r.uf}</Td>
              <Td mono>{r.peso_kg.toLocaleString('pt-BR')} kg</Td>
              <Td mono>{r.volumes} vol.</Td>
              <Td mono>{r.codigo_rastreamento}</Td>
              <td className="px-4 py-3 min-w-[160px]">
                {r.status === 'ocorrencia'
                  ? <span className="flex items-center gap-1 text-xs text-red-400"><AlertTriangle size={12} /> Ocorrência</span>
                  : r.status === 'devolvido'
                    ? <span className="text-xs text-amber-300">Devolvido</span>
                    : (
                      <div className="flex items-center gap-1">
                        {stepLabel.map((l, i) => (
                          <div key={l} className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${i <= step ? 'bg-accent' : 'bg-border'}`} />
                            <span className={`text-[10px] ${i <= step ? 'text-accent' : 'text-text-muted'} ${i === 2 ? '' : 'mr-0.5'}`}>{l}</span>
                            {i < 2 && <div className={`w-4 h-0.5 ${i < step ? 'bg-accent' : 'bg-border'}`} />}
                          </div>
                        ))}
                      </div>
                    )}
              </td>
              <Td mono>{r.data_entrega ? `${r.data_entrega} ${r.hora_entrega}` : '—'}</Td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  {r.assinatura && <span title="Assinatura digital" className="text-xs text-emerald-400">✎</span>}
                  {r.foto && <span title="Foto de entrega" className="text-xs text-accent">📷</span>}
                  {r.status === 'ocorrencia' && <button onClick={() => setOcorrencia(r)} className="text-xs text-red-400 hover:underline">Ver</button>}
                </div>
              </td>
              <td className="w-12" />
            </Tr>
          )
        })}
      </Table>

      {ocorrencia && (
        <Modal title={`Registrar Ocorrência — ${ocorrencia.numero}`} onClose={() => setOcorrencia(null)}>
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3 text-sm">
              <p className="text-red-400 font-medium">{ocorrencia.cliente} — {ocorrencia.cidade}/{ocorrencia.uf}</p>
              <p className="text-text-muted text-xs mt-0.5">Rastreamento: {ocorrencia.codigo_rastreamento}</p>
            </div>
            <Field label="Tipo de Ocorrência *">
              <Sel value={ocForm.tipo} onChange={v => setOcForm(f => ({ ...f, tipo: v }))}>
                {Object.entries(tiposOc).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Sel>
            </Field>
            <Field label="Descrição *"><textarea className={inp + ' min-h-[100px] resize-none'} value={ocForm.descricao} onChange={e => setOcForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva a ocorrência com detalhes..." /></Field>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2 border border-border rounded-lg py-2 text-sm text-text-muted hover:text-accent hover:border-accent transition-colors">📷 Anexar Foto</button>
              <button className="flex items-center justify-center gap-2 border border-border rounded-lg py-2 text-sm text-text-muted hover:text-accent hover:border-accent transition-colors"><MapPin size={14} /> Capturar Localização</button>
            </div>
            <Footer onClose={() => setOcorrencia(null)} onSave={() => { setSaving(true); setTimeout(() => { setOcorrencia(null); setSaving(false) }, 600) }} saving={saving} disabled={!ocForm.descricao} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab CT-e / MDF-e ─────────────────────────────────────────────────────────

function TabDocs() {
  const [rows] = useState<DocTransporte[]>(MOCK_DOCS)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [modal, setModal] = useState<'cte' | 'mdfe' | null>(null)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))
  const [form, setForm] = useState({ tomador:'', uf_ini:'SP', uf_fim:'SP', valor:'', peso_kg:'', carga_numero:'', natureza:'Prestação de Serviço de Transporte' })

  const filtered = rows.filter(r =>
    (r.numero.toLowerCase().includes(search.toLowerCase()) || r.tomador.toLowerCase().includes(search.toLowerCase())) &&
    (filterTipo ? r.tipo === filterTipo : true)
  )

  const UFS = ['AC','AL','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="CT-e Emitidos" val={rows.filter(r => r.tipo === 'cte' && r.status === 'autorizado').length} />
        <KpiCard label="MDF-e Emitidos" val={rows.filter(r => r.tipo === 'mdfe' && r.status === 'autorizado').length} />
        <KpiCard label="Rascunhos" val={rows.filter(r => r.status === 'rascunho').length} warn={rows.filter(r => r.status === 'rascunho').length > 0} sub="aguardando emissão" />
        <KpiCard label="Valor Total" val={`R$ ${rows.filter(r => r.status === 'autorizado').reduce((s, r) => s + r.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits:2 })}`} />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Nº documento ou tomador...">
        <Sel value={filterTipo} onChange={setFilterTipo}>
          <option value="">CT-e e MDF-e</option>
          <option value="cte">Somente CT-e</option>
          <option value="mdfe">Somente MDF-e</option>
        </Sel>
        <ExportButtons endpoint="/api/docs-transporte/" filename="documentos_transporte" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <button onClick={() => { setForm({ tomador:'', uf_ini:'SP', uf_fim:'SP', valor:'', peso_kg:'', carga_numero:'', natureza:'Prestação de Serviço de Transporte' }); setModal('cte') }} className="flex items-center gap-2 border border-border text-text-muted text-sm px-4 py-2 rounded-lg hover:text-accent hover:border-accent transition-colors whitespace-nowrap"><Plus size={15} /> Emitir CT-e</button>
        <button onClick={() => { setForm({ tomador:'', uf_ini:'SP', uf_fim:'SP', valor:'', peso_kg:'', carga_numero:'', natureza:'Prestação de Serviço de Transporte' }); setModal('mdfe') }} className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors whitespace-nowrap"><Plus size={15} /> Emitir MDF-e</button>
      </Bar>

      <Table heads={['Tipo', 'Nº / Série', 'Tomador / Remetente', 'UF Ini → Fim', 'Valor', 'Peso', 'Emissão', 'Carga', 'Status']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={9} /> : filtered.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
            <td className="px-4 py-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${r.tipo === 'cte' ? 'bg-blue-900/30 text-blue-400' : 'bg-purple-900/30 text-purple-400'}`}>{r.tipo.toUpperCase()}</span>
            </td>
            <Td mono>{r.numero}/{r.serie}</Td>
            <TdMain>{r.tomador}</TdMain>
            <Td mono>{r.uf_ini} → {r.uf_fim}</Td>
            <Td mono>R$ {r.valor.toLocaleString('pt-BR', { minimumFractionDigits:2 })}</Td>
            <Td mono>{r.peso_kg.toLocaleString('pt-BR')} kg</Td>
            <Td mono>{r.data_emissao}</Td>
            <Td mono>{r.carga_numero}</Td>
            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            <td className="w-12" />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title={modal === 'cte' ? 'Emitir CT-e' : 'Emitir MDF-e'} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <Field label={modal === 'cte' ? 'Tomador do Serviço *' : 'Carga Vinculada *'}>
              {modal === 'cte'
                ? <input className={inp} value={form.tomador} onChange={e => setForm(f => ({ ...f, tomador: e.target.value }))} placeholder="Razão social ou nome do destinatário" />
                : <Sel value={form.carga_numero} onChange={v => setForm(f => ({ ...f, carga_numero: v }))}><option value="">Selecionar carga...</option>{MOCK_CARGAS.map(c => <option key={c.id} value={c.numero}>{c.numero} — {c.regiao}</option>)}</Sel>}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="UF Início *">
                <Sel value={form.uf_ini} onChange={v => setForm(f => ({ ...f, uf_ini: v }))}>
                  {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                </Sel>
              </Field>
              <Field label="UF Fim *">
                <Sel value={form.uf_fim} onChange={v => setForm(f => ({ ...f, uf_fim: v }))}>
                  {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                </Sel>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Valor da Prestação (R$) *"><input type="number" className={inp} value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="450.00" /></Field>
              <Field label="Peso Total (kg) *"><input type="number" className={inp} value={form.peso_kg} onChange={e => setForm(f => ({ ...f, peso_kg: e.target.value }))} placeholder="2100" /></Field>
            </div>
            <Field label="Natureza da Operação"><input className={inp} value={form.natureza} onChange={e => setForm(f => ({ ...f, natureza: e.target.value }))} /></Field>
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-3">
              <p className="text-xs text-amber-300">A emissão de {modal.toUpperCase()} requer configuração de certificado digital A1/A3 e RNTRC da transportadora. Consulte a seção Fiscal para configurar.</p>
            </div>
            <Footer onClose={() => setModal(null)} onSave={() => { setSaving(true); setTimeout(() => { setModal(null); setSaving(false) }, 800) }} saving={saving} disabled={!form.valor || !form.peso_kg} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Transportadoras ──────────────────────────────────────────────────────

function TabTransportadoras() {
  const [rows] = useState<Transportadora[]>(MOCK_TRANSPORTADORAS)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<Transportadora | null>(null)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome:'', cnpj:'', rntrc:'', telefone:'', email:'' })

  const filtered = rows.filter(r => r.nome.toLowerCase().includes(search.toLowerCase()) || r.cnpj.includes(search))

  return (
    <div>
      <Bar value={search} onChange={setSearch} placeholder="Nome ou CNPJ...">
        <BtnNew onClick={() => { setForm({ nome:'', cnpj:'', rntrc:'', telefone:'', email:'' }); setModal(true) }} label="Nova Transportadora" />
      </Bar>

      <Table heads={['Razão Social', 'CNPJ', 'RNTRC', 'Telefone', 'E-mail', 'Regiões na Tabela']}>
        {filtered.length === 0 ? <Empty cols={6} /> : filtered.map(r => (
          <Tr key={r.id}>
            <TdMain>{r.nome}</TdMain>
            <Td mono>{r.cnpj}</Td>
            <Td mono>{r.rntrc}</Td>
            <Td>{r.telefone}</Td>
            <Td>{r.email}</Td>
            <Td>{r.fretes.length} regiões</Td>
            <td className="px-4 py-3 w-12">
              <button onClick={() => setDetail(r)} className="p-1.5 hover:bg-card rounded text-text-muted hover:text-accent transition-colors"><Eye size={14} /></button>
            </td>
          </Tr>
        ))}
      </Table>

      {detail && (
        <Modal title={detail.nome} onClose={() => setDetail(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[['CNPJ', detail.cnpj], ['RNTRC', detail.rntrc], ['Telefone', detail.telefone], ['E-mail', detail.email]].map(([k, v]) => (
                <div key={k}><span className="text-xs text-text-muted">{k}</span><p className="font-medium text-text-primary">{v}</p></div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Tabela de Fretes</p>
              <div className="bg-card2 border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">{['Região', 'R$/kg', 'Frete Mínimo', 'Prazo'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-text-muted">{h}</th>)}</tr></thead>
                  <tbody>{detail.fretes.map((f, i) => <tr key={i} className="border-b border-border/50"><td className="px-4 py-2 text-text-primary">{f.regiao}</td><td className="px-4 py-2 font-mono text-text-secondary">R$ {f.valor_kg.toFixed(2)}</td><td className="px-4 py-2 font-mono text-text-secondary">R$ {f.minimo.toFixed(2)}</td><td className="px-4 py-2 text-text-muted">{f.prazo} dia{f.prazo > 1 ? 's' : ''}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title="Nova Transportadora" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Razão Social *"><input className={inp} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Expresso Rural Transportes Ltda" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CNPJ *"><input className={inp} value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" /></Field>
              <Field label="RNTRC *"><input className={inp} value={form.rntrc} onChange={e => setForm(f => ({ ...f, rntrc: e.target.value }))} placeholder="00000000" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Telefone"><input className={inp} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></Field>
              <Field label="E-mail"><input type="email" className={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
            </div>
            <Footer onClose={() => setModal(false)} onSave={() => { setSaving(true); setTimeout(() => { setModal(false); setSaving(false) }, 600) }} saving={saving} disabled={!form.nome || !form.cnpj || !form.rntrc} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Abastecimento ────────────────────────────────────────────────────────

function TabAbastecimento() {
  const [rows, setRows] = useState<Abastecimento[]>(MOCK_ABASTECIMENTOS)
  const [search, setSearch] = useState('')
  const [filterVeiculo, setFilterVeiculo] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const toggleSel = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: number[]) => setSel(s => s.size === ids.length ? new Set() : new Set(ids))
  const [form, setForm] = useState({ veiculo_id:'1', data:'', km_hodometro:'', litros:'', preco_litro:'', combustivel:'diesel', posto:'', motorista:'' })

  const filtered = rows.filter(r =>
    (r.veiculo_placa.includes(search) || r.posto.toLowerCase().includes(search.toLowerCase()) || r.motorista.toLowerCase().includes(search.toLowerCase())) &&
    (filterVeiculo ? r.veiculo_placa === filterVeiculo : true)
  )

  const totalLitros = rows.reduce((s, r) => s + r.litros, 0)
  const totalCusto = rows.reduce((s, r) => s + r.valor_total, 0)
  const kmTotal = rows.length >= 2 ? rows.reduce((max, r) => Math.max(max, r.km_hodometro), 0) - rows.reduce((min, r) => Math.min(min, r.km_hodometro), Infinity) : 0
  const consumoMedio = kmTotal > 0 ? (kmTotal / totalLitros).toFixed(1) : '—'

  async function save() {
    setSaving(true)
    const v = MOCK_FROTA.find(x => x.id === +form.veiculo_id)
    try { await api.post('/api/abastecimentos/', form) } catch { /* mock */ }
    const litros = +form.litros; const preco = +form.preco_litro
    const n: Abastecimento = { id: Date.now(), veiculo_placa: v?.placa ?? '', veiculo_descricao: v?.descricao ?? '', data: form.data, km_hodometro: +form.km_hodometro, litros, preco_litro: preco, valor_total: +(litros * preco).toFixed(2), combustivel: form.combustivel as Abastecimento['combustivel'], posto: form.posto, motorista: form.motorista }
    setRows(r => [n, ...r])
    setModal(false); setSaving(false)
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Litros (período)" val={totalLitros.toLocaleString('pt-BR')} sub="últimos registros" />
        <KpiCard label="Custo Total" val={`R$ ${totalCusto.toLocaleString('pt-BR', { minimumFractionDigits:2 })}`} />
        <KpiCard label="Consumo Médio" val={consumoMedio !== '—' ? `${consumoMedio} km/L` : '—'} sub="frota geral" />
        <KpiCard label="Abastecimentos" val={rows.length} />
      </div>

      <Bar value={search} onChange={setSearch} placeholder="Placa, posto ou motorista...">
        <Sel value={filterVeiculo} onChange={setFilterVeiculo}>
          <option value="">Todos os veículos</option>
          {MOCK_FROTA.map(v => <option key={v.id} value={v.placa}>{v.placa} — {v.descricao}</option>)}
        </Sel>
        <ExportButtons endpoint="/api/abastecimentos/" filename="abastecimentos" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <BtnNew onClick={() => { setForm({ veiculo_id:'1', data:'', km_hodometro:'', litros:'', preco_litro:'', combustivel:'diesel', posto:'', motorista:'' }); setModal(true) }} label="Registrar Abastecimento" />
      </Bar>

      <Table heads={['Data', 'Veículo', 'KM Hodômetro', 'Litros', 'R$/L', 'Total', 'Combustível', 'Posto', 'Motorista']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.size === filtered.length && filtered.length > 0} onChange={() => toggleAll(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={9} /> : filtered.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
            <Td mono>{r.data}</Td>
            <TdMain>{r.veiculo_descricao}<span className="block text-xs text-text-muted font-normal font-mono">{r.veiculo_placa}</span></TdMain>
            <Td mono>{r.km_hodometro.toLocaleString('pt-BR')}</Td>
            <Td mono>{r.litros}</Td>
            <Td mono>R$ {r.preco_litro.toFixed(2)}</Td>
            <Td mono>R$ {r.valor_total.toLocaleString('pt-BR', { minimumFractionDigits:2 })}</Td>
            <Td>{r.combustivel.charAt(0).toUpperCase() + r.combustivel.slice(1)}</Td>
            <Td>{r.posto}</Td>
            <Td>{r.motorista}</Td>
            <td className="w-12" />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Registrar Abastecimento" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Veículo *">
              <Sel value={form.veiculo_id} onChange={v => setForm(f => ({ ...f, veiculo_id: v }))}>
                {MOCK_FROTA.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.descricao}</option>)}
              </Sel>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data *"><input type="date" className={inp} value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></Field>
              <Field label="Hodômetro (km) *"><input type="number" className={inp} value={form.km_hodometro} onChange={e => setForm(f => ({ ...f, km_hodometro: e.target.value }))} placeholder="142500" /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Litros *"><input type="number" className={inp} value={form.litros} onChange={e => setForm(f => ({ ...f, litros: e.target.value }))} placeholder="180" /></Field>
              <Field label="Preço/L (R$) *"><input type="number" className={inp} value={form.preco_litro} onChange={e => setForm(f => ({ ...f, preco_litro: e.target.value }))} placeholder="6.49" /></Field>
              <Field label="Combustível">
                <Sel value={form.combustivel} onChange={v => setForm(f => ({ ...f, combustivel: v }))}>
                  <option value="diesel">Diesel</option><option value="gasolina">Gasolina</option><option value="etanol">Etanol</option>
                </Sel>
              </Field>
            </div>
            {form.litros && form.preco_litro && <p className="text-xs text-text-muted text-right">Total: <span className="text-accent font-mono">R$ {(+form.litros * +form.preco_litro).toFixed(2)}</span></p>}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Posto"><input className={inp} value={form.posto} onChange={e => setForm(f => ({ ...f, posto: e.target.value }))} placeholder="Nome do posto" /></Field>
              <Field label="Motorista"><input className={inp} value={form.motorista} onChange={e => setForm(f => ({ ...f, motorista: e.target.value }))} placeholder="Nome do motorista" /></Field>
            </div>
            <Footer onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.data || !form.km_hodometro || !form.litros || !form.preco_litro} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Relatórios ───────────────────────────────────────────────────────────

function TabRelatorios() {
  const [periodo, setPeriodo] = useState('mes')

  const custoPorEntrega = [
    { rota:'SP Interior — Norte', entregas:4, distancia:320, combustivel:1168.20, pedagio:85.00, motorista:320.00, total:1573.20 },
    { rota:'MG — Triângulo Mineiro', entregas:3, distancia:410, combustivel:1354.50, pedagio:120.00, motorista:380.00, total:1854.50 },
    { rota:'Ribeirão Preto — Urbano', entregas:6, distancia:85, combustivel:423.80, pedagio:0, motorista:180.00, total:603.80 },
  ]
  const totalLogistico = custoPorEntrega.reduce((s, r) => s + r.total, 0)
  const totalEntregas = custoPorEntrega.reduce((s, r) => s + r.entregas, 0)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm font-medium text-text-secondary">Período:</span>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {[['semana','Semana'],['mes','Mês'],['trimestre','Trimestre']].map(([v, l]) => (
            <button key={v} onClick={() => setPeriodo(v)} className={`px-4 py-1.5 text-xs font-medium transition-colors ${periodo === v ? 'bg-accent text-bg' : 'text-text-muted hover:bg-card2'}`}>{l}</button>
          ))}
        </div>
        <div className="flex-1" />
        <ExportButtons endpoint="/api/logistica/relatorio/" filename="relatorio_logistico" params={{ periodo }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Custo Logístico Total" val={`R$ ${totalLogistico.toLocaleString('pt-BR', { minimumFractionDigits:2 })}`} />
        <KpiCard label="Custo por Entrega" val={`R$ ${(totalLogistico / totalEntregas).toFixed(2)}`} sub="média" />
        <KpiCard label="Custo por km" val={`R$ ${(totalLogistico / custoPorEntrega.reduce((s, r) => s + r.distancia, 0)).toFixed(2)}`} />
        <KpiCard label="Entregas Realizadas" val={totalEntregas} sub="no período" />
      </div>

      <p className="text-sm font-semibold text-text-primary mb-3">Custo por Rota</p>
      <div className="bg-card border border-border rounded-xl overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">{['Rota', 'Entregas', 'Distância', 'Combustível', 'Pedágio', 'Motorista', 'Total', 'Custo/Entrega'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {custoPorEntrega.map((r, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-card2">
                <td className="px-4 py-3 font-medium text-text-primary">{r.rota}</td>
                <td className="px-4 py-3 font-mono text-text-secondary">{r.entregas}</td>
                <td className="px-4 py-3 font-mono text-text-secondary">{r.distancia} km</td>
                <td className="px-4 py-3 font-mono text-text-secondary">R$ {r.combustivel.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono text-text-secondary">R$ {r.pedagio.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono text-text-secondary">R$ {r.motorista.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono font-semibold text-text-primary">R$ {r.total.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono text-accent">R$ {(r.total / r.entregas).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm font-semibold text-text-primary mb-3">Consumo de Combustível por Veículo</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MOCK_FROTA.slice(0, 3).map(v => {
          const abs = MOCK_ABASTECIMENTOS.filter(a => a.veiculo_placa === v.placa)
          const litros = abs.reduce((s, a) => s + a.litros, 0)
          const custo = abs.reduce((s, a) => s + a.valor_total, 0)
          return (
            <div key={v.id} className="bg-card2 border border-border rounded-xl p-4">
              <p className="text-sm font-medium text-text-primary">{v.descricao}</p>
              <p className="text-xs text-text-muted mb-3">{v.placa}</p>
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-text-muted">Litros</p><p className="font-mono font-bold text-text-primary">{litros.toLocaleString('pt-BR')}</p></div>
                <div><p className="text-xs text-text-muted">Custo</p><p className="font-mono font-bold text-text-primary">R$ {custo.toFixed(2)}</p></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

const TABS = ['Frota', 'Programação', 'Romaneios', 'CT-e / MDF-e', 'Transportadoras', 'Abastecimento', 'Relatórios']

export default function Logistica() {
  const [tab, setTab] = useState('Frota')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Truck size={20} className="text-accent" /> Logística e Transporte
        </h1>
        <p className="text-sm text-text-muted mt-1">Frota, expedição, roteirização e rastreamento</p>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Frota'           && <TabFrota />}
      {tab === 'Programação'     && <TabProgramacao />}
      {tab === 'Romaneios'       && <TabRomaneios />}
      {tab === 'CT-e / MDF-e'   && <TabDocs />}
      {tab === 'Transportadoras' && <TabTransportadoras />}
      {tab === 'Abastecimento'   && <TabAbastecimento />}
      {tab === 'Relatórios'      && <TabRelatorios />}
    </div>
  )
}
