import { useEffect, useState } from 'react'
import { X, ChevronDown, AlertTriangle, Plus, RefreshCw, TrendingUp, TrendingDown, FileText } from 'lucide-react'
import { api } from '../lib/api'

// ─── shared ──────────────────────────────────────────────────────────────────

const inp = 'w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors'
const sel = inp + ' appearance-none'
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtN = (v: number, d = 3) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

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

function Field({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
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

function Btns({ onClose, onSave, saving, disabled, label }: { onClose: () => void; onSave: () => void; saving: boolean; disabled?: boolean; label?: string }) {
  return (
    <div className="flex gap-2 pt-4 col-span-2">
      <button onClick={onClose} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2 transition-colors">Cancelar</button>
      <button onClick={onSave} disabled={saving || disabled} className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors disabled:opacity-60">
        {saving ? 'Salvando...' : label ?? 'Confirmar'}
      </button>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'orange' }) {
  const cls = { green: 'bg-accent/10 text-accent', red: 'bg-red-100 text-red-600', yellow: 'bg-yellow-100 text-yellow-700', gray: 'bg-card2 text-text-muted border border-border', blue: 'bg-blue-100 text-blue-700', orange: 'bg-orange-100 text-orange-600' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[color]}`}>{label}</span>
}

function AlertaBadge({ dias }: { dias: number }) {
  if (dias < 0)  return <Badge label={`Vencido há ${Math.abs(dias)}d`} color="red" />
  if (dias <= 5)  return <Badge label={`${dias}d ⚠`} color="red" />
  if (dias <= 15) return <Badge label={`${dias}d`} color="orange" />
  if (dias <= 30) return <Badge label={`${dias}d`} color="yellow" />
  return <Badge label={`${dias}d`} color="green" />
}

function BarraProgresso({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 bg-card2 rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-accent' : pct >= 50 ? 'bg-blue-400' : 'bg-orange-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

// ─── Cotação de mercado ───────────────────────────────────────────────────────

function CotacaoMercado({ produto, onPreco }: { produto: string; onPreco: (v: number) => void }) {
  const [fonte, setFonte] = useState('cbot')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const consultar = async () => {
    setLoading(true); setMsg('')
    const r = await api.get('/api/contratos/cotacao-mercado/', { params: { produto, fonte } }).then(r => r.data).catch(() => null)
    if (r?.preco) {
      onPreco(r.preco)
      setMsg(`Cotação obtida via ${fonte.toUpperCase()}: ${fmtN(r.preco, 4)}`)
    } else {
      setMsg(r?.erro ?? 'API de preços não configurada — use cotação manual.')
    }
    setLoading(false)
  }

  return (
    <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-blue-700 mb-2">Cotação de Mercado</p>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <select className={sel + ' text-xs'} value={fonte} onChange={e => setFonte(e.target.value)}>
            <option value="cbot">CBOT (integração)</option>
            <option value="esalq">ESALQ (integração)</option>
            <option value="manual">Manual</option>
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <button onClick={consultar} disabled={loading || fonte === 'manual'} className="bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap transition-colors">
          {loading ? 'Consultando...' : 'Buscar cotação'}
        </button>
      </div>
      {msg && <p className="text-xs mt-1.5 text-blue-600">{msg}</p>}
      {fonte === 'manual' && <p className="text-xs mt-1 text-text-muted">Preencha o preço manualmente no campo acima.</p>}
    </div>
  )
}

// ─── types ────────────────────────────────────────────────────────────────────

interface CPR { id: number; numero: string; emitente: string; produto: string; quantidade_sacas: number; quantidade_entregue: number; quantidade_pendente: number; pct_entregue: number; valor_credito: number; data_emissao: string; data_vencimento: string; dias_para_vencer: number; status: string; local_entrega: string; qualidade_minima: string; garantias: string; preco_mercado_manual: number | null; fonte_preco: string; observacoes: string }
interface Barter { id: number; numero: string; produtor: string; produto_receber: string; safra: string; quantidade_sacas: number; quantidade_entregue: number; quantidade_pendente: number; preco_referencia: number | null; quantidade_equivalente: number | null; valor_insumos: number; data_contrato: string; data_entrega_prevista: string; dias_para_entrega: number; status: string; observacoes: string }
interface Termo { id: number; numero: string; tipo: string; tipo_display: string; contraparte: string; produto: string; safra: string; quantidade: number; quantidade_entregue: number; quantidade_pendente: number; preco_travado: number; valor_total_travado: number; preco_mercado_manual: number | null; exposicao_mercado: number | null; data_contrato: string; data_entrega: string; dias_para_entrega: number; status: string; observacoes: string }
interface Alerta { tipo: string; nivel: string; id: number; numero: string; descricao: string }

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_CPRS: CPR[] = [
  { id: 1, numero: 'CPR-2026-001', emitente: 'Fazenda São João Ltda', produto: 'Soja', quantidade_sacas: 2000, quantidade_entregue: 500, quantidade_pendente: 1500, pct_entregue: 25, valor_credito: 120000, data_emissao: '15/01/2026', data_vencimento: '30/05/2026', dias_para_vencer: 36, status: 'aberta', local_entrega: 'Armazém Central — Sinop/MT', qualidade_minima: 'Umidade ≤ 14%, impureza ≤ 1%', garantias: 'Penhor da safra 2025/2026', preco_mercado_manual: 142.50, fonte_preco: 'manual', observacoes: '' },
  { id: 2, numero: 'CPR-2026-002', emitente: 'Rancho Verde Agrícola', produto: 'Milho', quantidade_sacas: 5000, quantidade_entregue: 5000, quantidade_pendente: 0, pct_entregue: 100, valor_credito: 85000, data_emissao: '10/11/2025', data_vencimento: '28/02/2026', dias_para_vencer: -55, status: 'liquidada_fisica', local_entrega: 'Armazém Leste', qualidade_minima: '', garantias: '', preco_mercado_manual: null, fonte_preco: 'manual', observacoes: '' },
]

const MOCK_BARTERS: Barter[] = [
  { id: 1, numero: 'BAR-2026-001', produtor: 'Agropecuária Norte S/A', produto_receber: 'Soja', safra: '2025/2026', quantidade_sacas: 800, quantidade_entregue: 0, quantidade_pendente: 800, preco_referencia: 145.00, quantidade_equivalente: 551.7, valor_insumos: 79996, data_contrato: '05/02/2026', data_entrega_prevista: '15/06/2026', dias_para_entrega: 52, status: 'ativo', observacoes: '' },
]

const MOCK_TERMOS: Termo[] = [
  { id: 1, numero: 'TRM-2026-001', tipo: 'venda', tipo_display: 'Venda Futura', contraparte: 'Trading Grãos Ltda', produto: 'Soja', safra: '2025/2026', quantidade: 3000, quantidade_entregue: 0, quantidade_pendente: 3000, preco_travado: 148.00, valor_total_travado: 444000, preco_mercado_manual: 143.50, exposicao_mercado: -13500, data_contrato: '10/01/2026', data_entrega: '30/06/2026', dias_para_entrega: 67, status: 'aberto', observacoes: '' },
  { id: 2, numero: 'TRM-2026-002', tipo: 'compra', tipo_display: 'Compra Futura', contraparte: 'Produtor Torres', produto: 'Milho', safra: '2025/2026', quantidade: 2000, quantidade_entregue: 0, quantidade_pendente: 2000, preco_travado: 58.00, valor_total_travado: 116000, preco_mercado_manual: null, exposicao_mercado: null, data_contrato: '20/02/2026', data_entrega: '15/07/2026', dias_para_entrega: 82, status: 'aberto', observacoes: '' },
]

const MOCK_ALERTAS: Alerta[] = [
  { tipo: 'CPR', nivel: 'alerta', id: 1, numero: 'CPR-2026-001', descricao: 'Fazenda São João Ltda — vence em 36d' },
  { tipo: 'Barter', nivel: 'aviso', id: 1, numero: 'BAR-2026-001', descricao: 'Agropecuária Norte S/A — entrega em 52d' },
]

// ─── Status helpers ───────────────────────────────────────────────────────────

const CPR_STATUS: Record<string, { label: string; color: 'green' | 'blue' | 'gray' | 'red' | 'orange' | 'yellow' }> = {
  aberta:               { label: 'Aberta',               color: 'blue' },
  liquidada_fisica:     { label: 'Liquidada Física',     color: 'green' },
  liquidada_financeira: { label: 'Liquidada Financ.',    color: 'green' },
  vencida:              { label: 'Vencida',              color: 'red' },
  cancelada:            { label: 'Cancelada',            color: 'gray' },
}

const BARTER_STATUS: Record<string, { label: string; color: 'green' | 'blue' | 'gray' | 'red' | 'orange' | 'yellow' }> = {
  ativo:     { label: 'Ativo',     color: 'blue' },
  entregue:  { label: 'Entregue', color: 'green' },
  vencido:   { label: 'Vencido',  color: 'red' },
  cancelado: { label: 'Cancelado', color: 'gray' },
}

const TERMO_STATUS: Record<string, { label: string; color: 'green' | 'blue' | 'gray' | 'red' | 'orange' | 'yellow' }> = {
  aberto:    { label: 'Aberto',    color: 'blue' },
  entregue:  { label: 'Entregue', color: 'green' },
  cancelado: { label: 'Cancelado', color: 'gray' },
}

// ─── Tab CPR ──────────────────────────────────────────────────────────────────

function TabCPR() {
  const [rows, setRows] = useState<CPR[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CPR | null>(null)
  const [modalCriar, setModalCriar] = useState(false)
  const [modalEntregar, setModalEntregar] = useState<CPR | null>(null)
  const [modalLiquidar, setModalLiquidar] = useState<CPR | null>(null)
  const [saving, setSaving] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('')

  const [formCriar, setFormCriar] = useState({ numero: '', emitente_id: '', produto_id: '', quantidade_sacas: '', qualidade_minima: '', local_entrega: '', data_emissao: '', data_vencimento: '', valor_credito: '', garantias: '', observacoes: '' })
  const [formEntregar, setFormEntregar] = useState({ data_entrega: '', quantidade: '', nota_fiscal: '', observacoes: '' })
  const [formLiquidar, setFormLiquidar] = useState({ preco_mercado: '', fonte_preco: 'manual' })

  const load = async () => {
    setLoading(true)
    const p: Record<string, string> = {}
    if (filtroStatus) p.status = filtroStatus
    const data = await api.get('/api/contratos/cprs/', { params: p }).then(r => r.data).catch(() => MOCK_CPRS)
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filtroStatus])

  const criar = async () => {
    setSaving(true)
    await api.post('/api/contratos/cprs/', { ...formCriar, quantidade_sacas: parseFloat(formCriar.quantidade_sacas), valor_credito: parseFloat(formCriar.valor_credito) }).catch(() => {})
    setSaving(false); setModalCriar(false); load()
  }

  const entregar = async () => {
    if (!modalEntregar) return
    setSaving(true)
    await api.post(`/api/contratos/cprs/${modalEntregar.id}/entregar/`, { ...formEntregar, quantidade: parseFloat(formEntregar.quantidade) }).catch(() => {})
    setSaving(false); setModalEntregar(null); load()
  }

  const liquidarFin = async () => {
    if (!modalLiquidar) return
    setSaving(true)
    await api.post(`/api/contratos/cprs/${modalLiquidar.id}/liquidar-financeira/`, { preco_mercado: parseFloat(formLiquidar.preco_mercado), fonte_preco: formLiquidar.fonte_preco }).catch(() => {})
    setSaving(false); setModalLiquidar(null); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <select className={sel + ' text-xs pr-7'} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="aberta">Aberta</option>
              <option value="liquidada_fisica">Liquidada Física</option>
              <option value="liquidada_financeira">Liquidada Financeira</option>
              <option value="vencida">Vencida</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>
          <button onClick={load} className="text-text-muted hover:text-accent transition-colors"><RefreshCw size={15} /></button>
        </div>
        <button onClick={() => setModalCriar(true)} className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Nova CPR
        </button>
      </div>

      {loading ? <div className="text-text-muted text-sm py-10 text-center">Carregando...</div>
        : rows.length === 0 ? <div className="text-text-muted text-sm py-10 text-center">Nenhuma CPR encontrada.</div>
        : rows.map(cpr => {
          const st = CPR_STATUS[cpr.status] ?? { label: cpr.status, color: 'gray' as const }
          return (
            <div key={cpr.id} className={`bg-card border rounded-xl p-4 cursor-pointer hover:border-accent/40 transition-colors ${selected?.id === cpr.id ? 'border-accent' : 'border-border'}`}
              onClick={() => setSelected(s => s?.id === cpr.id ? null : cpr)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-text-muted">{cpr.numero}</span>
                    <Badge label={st.label} color={st.color} />
                    <AlertaBadge dias={cpr.dias_para_vencer} />
                  </div>
                  <p className="font-semibold text-text-primary text-sm">{cpr.emitente}</p>
                  <p className="text-xs text-text-muted">{cpr.produto} · emissão {cpr.data_emissao} · vencimento {cpr.data_vencimento}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-text-primary">{fmtN(cpr.quantidade_sacas)} sc</p>
                  <p className="text-xs text-text-muted">{fmt(cpr.valor_credito)}</p>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-text-muted">Entregue: {fmtN(cpr.quantidade_entregue)} sc de {fmtN(cpr.quantidade_sacas)} sc</span>
                  <span className="font-medium text-text-primary">{cpr.pct_entregue}%</span>
                </div>
                <BarraProgresso pct={cpr.pct_entregue} />
              </div>

              {selected?.id === cpr.id && (
                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  {cpr.local_entrega && <p className="text-xs text-text-secondary">Local: {cpr.local_entrega}</p>}
                  {cpr.qualidade_minima && <p className="text-xs text-text-secondary">Qualidade mínima: {cpr.qualidade_minima}</p>}
                  {cpr.garantias && <p className="text-xs text-text-secondary">Garantias: {cpr.garantias}</p>}
                  {cpr.preco_mercado_manual && (
                    <p className="text-xs text-text-secondary">Cotação: {fmtN(cpr.preco_mercado_manual, 4)} / sc ({cpr.fonte_preco})</p>
                  )}
                  {cpr.status === 'aberta' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={e => { e.stopPropagation(); setModalEntregar(cpr) }} className="flex-1 bg-accent/10 text-accent border border-accent/30 text-xs font-semibold py-1.5 rounded-lg hover:bg-accent/20 transition-colors">
                        Registrar Entrega Física
                      </button>
                      <button onClick={e => { e.stopPropagation(); setModalLiquidar(cpr); setFormLiquidar({ preco_mercado: cpr.preco_mercado_manual?.toString() ?? '', fonte_preco: 'manual' }) }} className="flex-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                        Liquidar Financeiramente
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

      {/* Modal criar CPR */}
      {modalCriar && (
        <Modal title="Nova CPR — Cédula de Produto Rural" onClose={() => setModalCriar(false)} wide>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Número da CPR"><input className={inp} value={formCriar.numero} onChange={e => setFormCriar(p => ({ ...p, numero: e.target.value }))} placeholder="Ex: CPR-2026-003" /></Field>
            <Field label="ID do Emitente (Cliente)"><input className={inp} type="number" value={formCriar.emitente_id} onChange={e => setFormCriar(p => ({ ...p, emitente_id: e.target.value }))} /></Field>
            <Field label="ID do Produto"><input className={inp} type="number" value={formCriar.produto_id} onChange={e => setFormCriar(p => ({ ...p, produto_id: e.target.value }))} /></Field>
            <Field label="Quantidade (sacas)"><input className={inp} type="number" step="0.001" value={formCriar.quantidade_sacas} onChange={e => setFormCriar(p => ({ ...p, quantidade_sacas: e.target.value }))} /></Field>
            <Field label="Valor do Crédito (R$)"><input className={inp} type="number" step="0.01" value={formCriar.valor_credito} onChange={e => setFormCriar(p => ({ ...p, valor_credito: e.target.value }))} /></Field>
            <Field label="Local de Entrega"><input className={inp} value={formCriar.local_entrega} onChange={e => setFormCriar(p => ({ ...p, local_entrega: e.target.value }))} /></Field>
            <Field label="Data de Emissão"><input className={inp} type="date" value={formCriar.data_emissao} onChange={e => setFormCriar(p => ({ ...p, data_emissao: e.target.value }))} /></Field>
            <Field label="Data de Vencimento"><input className={inp} type="date" value={formCriar.data_vencimento} onChange={e => setFormCriar(p => ({ ...p, data_vencimento: e.target.value }))} /></Field>
            <Field label="Qualidade Mínima" span2><textarea className={inp} rows={2} value={formCriar.qualidade_minima} onChange={e => setFormCriar(p => ({ ...p, qualidade_minima: e.target.value }))} placeholder="Umidade, impureza, etc." /></Field>
            <Field label="Garantias" span2><textarea className={inp} rows={2} value={formCriar.garantias} onChange={e => setFormCriar(p => ({ ...p, garantias: e.target.value }))} /></Field>
            <Btns onClose={() => setModalCriar(false)} onSave={criar} saving={saving} label="Criar CPR" disabled={!formCriar.numero || !formCriar.emitente_id || !formCriar.quantidade_sacas} />
          </div>
        </Modal>
      )}

      {/* Modal entrega física */}
      {modalEntregar && (
        <Modal title={`Entrega Física — ${modalEntregar.numero}`} onClose={() => setModalEntregar(null)}>
          <div className="space-y-4">
            <p className="text-xs text-text-muted">Pendente: <strong>{fmtN(modalEntregar.quantidade_pendente)} sacas</strong></p>
            <Field label="Data da Entrega"><input className={inp} type="date" value={formEntregar.data_entrega} onChange={e => setFormEntregar(p => ({ ...p, data_entrega: e.target.value }))} /></Field>
            <Field label="Quantidade (sacas)"><input className={inp} type="number" step="0.001" value={formEntregar.quantidade} onChange={e => setFormEntregar(p => ({ ...p, quantidade: e.target.value }))} /></Field>
            <Field label="Nota Fiscal de Entrada"><input className={inp} value={formEntregar.nota_fiscal} onChange={e => setFormEntregar(p => ({ ...p, nota_fiscal: e.target.value }))} placeholder="Número da NF" /></Field>
            <Field label="Observações"><textarea className={inp} rows={2} value={formEntregar.observacoes} onChange={e => setFormEntregar(p => ({ ...p, observacoes: e.target.value }))} /></Field>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModalEntregar(null)} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2">Cancelar</button>
              <button onClick={entregar} disabled={saving || !formEntregar.quantidade || !formEntregar.data_entrega} className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm hover:bg-accent/90 disabled:opacity-60">
                {saving ? 'Salvando...' : 'Registrar Entrega'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal liquidação financeira */}
      {modalLiquidar && (
        <Modal title={`Liquidação Financeira — ${modalLiquidar.numero}`} onClose={() => setModalLiquidar(null)}>
          <div className="space-y-4">
            <p className="text-xs text-text-muted">Sacas pendentes: <strong>{fmtN(modalLiquidar.quantidade_pendente)}</strong> — será liquidado pelo preço de mercado informado.</p>
            <div className="grid grid-cols-2 gap-4">
              <CotacaoMercado produto={modalLiquidar.produto} onPreco={v => setFormLiquidar(p => ({ ...p, preco_mercado: String(v) }))} />
            </div>
            <Field label="Cotação Manual (R$/saca)">
              <input className={inp} type="number" step="0.0001" value={formLiquidar.preco_mercado} onChange={e => setFormLiquidar(p => ({ ...p, preco_mercado: e.target.value }))} placeholder="Ex: 142.5000" />
            </Field>
            <Field label="Fonte">
              <Sel value={formLiquidar.fonte_preco} onChange={v => setFormLiquidar(p => ({ ...p, fonte_preco: v }))}>
                <option value="manual">Manual</option>
                <option value="cbot">CBOT</option>
                <option value="esalq">ESALQ</option>
              </Sel>
            </Field>
            {formLiquidar.preco_mercado && (
              <div className="bg-card2 rounded-lg p-3 text-sm">
                <p className="text-text-muted text-xs">Valor da liquidação:</p>
                <p className="text-lg font-bold text-text-primary">{fmt(modalLiquidar.quantidade_pendente * parseFloat(formLiquidar.preco_mercado))}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModalLiquidar(null)} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2">Cancelar</button>
              <button onClick={liquidarFin} disabled={saving || !formLiquidar.preco_mercado} className="flex-1 bg-blue-600 text-white font-semibold py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Processando...' : 'Liquidar Financeiramente'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Barter ───────────────────────────────────────────────────────────────

function TabBarter() {
  const [rows, setRows] = useState<Barter[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Barter | null>(null)
  const [modalCriar, setModalCriar] = useState(false)
  const [modalEntregar, setModalEntregar] = useState<Barter | null>(null)
  const [saving, setSaving] = useState(false)
  const [formCriar, setFormCriar] = useState({ numero: '', produtor_id: '', produto_receber_id: '', safra: '', quantidade_sacas: '', preco_referencia_manual: '', fonte_preco_referencia: 'manual', data_contrato: '', data_entrega_prevista: '', valor_insumos: '', observacoes: '' })
  const [formEntregar, setFormEntregar] = useState({ data_entrega: '', quantidade: '', preco_entrega_manual: '', fonte_preco: 'manual', nota_fiscal: '', observacoes: '' })

  const load = async () => {
    setLoading(true)
    const data = await api.get('/api/contratos/barter/').then(r => r.data).catch(() => MOCK_BARTERS)
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const criar = async () => {
    setSaving(true)
    await api.post('/api/contratos/barter/', { ...formCriar, quantidade_sacas: parseFloat(formCriar.quantidade_sacas), preco_referencia_manual: formCriar.preco_referencia_manual || null, valor_insumos: parseFloat(formCriar.valor_insumos) || 0 }).catch(() => {})
    setSaving(false); setModalCriar(false); load()
  }

  const entregar = async () => {
    if (!modalEntregar) return
    setSaving(true)
    await api.post(`/api/contratos/barter/${modalEntregar.id}/entregar/`, { ...formEntregar, quantidade: parseFloat(formEntregar.quantidade), preco_entrega_manual: parseFloat(formEntregar.preco_entrega_manual) }).catch(() => {})
    setSaving(false); setModalEntregar(null); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-2">
        <button onClick={() => setModalCriar(true)} className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Novo Contrato Barter
        </button>
      </div>

      {loading ? <div className="text-text-muted text-sm py-10 text-center">Carregando...</div>
        : rows.length === 0 ? <div className="text-text-muted text-sm py-10 text-center">Nenhum contrato barter.</div>
        : rows.map(b => {
          const st = BARTER_STATUS[b.status] ?? { label: b.status, color: 'gray' as const }
          const pct = b.quantidade_sacas > 0 ? (b.quantidade_entregue / b.quantidade_sacas) * 100 : 0
          return (
            <div key={b.id} className={`bg-card border rounded-xl p-4 cursor-pointer hover:border-accent/40 transition-colors ${selected?.id === b.id ? 'border-accent' : 'border-border'}`}
              onClick={() => setSelected(s => s?.id === b.id ? null : b)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-text-muted">{b.numero}</span>
                    <Badge label={st.label} color={st.color} />
                    {b.safra && <span className="text-xs text-text-muted bg-card2 px-2 py-0.5 rounded-full">{b.safra}</span>}
                  </div>
                  <p className="font-semibold text-text-primary text-sm">{b.produtor}</p>
                  <p className="text-xs text-text-muted">Produto a receber: {b.produto_receber} · entrega prevista {b.data_entrega_prevista}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-text-primary">{fmtN(b.quantidade_sacas)} sc</p>
                  <p className="text-xs text-text-muted">{fmt(b.valor_insumos)} em insumos</p>
                  <AlertaBadge dias={b.dias_para_entrega} />
                </div>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-text-muted">Entregue: {fmtN(b.quantidade_entregue)} / {fmtN(b.quantidade_sacas)} sc</span>
                  <span className="font-medium">{pct.toFixed(0)}%</span>
                </div>
                <BarraProgresso pct={pct} />
              </div>

              {selected?.id === b.id && (
                <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                  {b.preco_referencia !== null && (
                    <p className="text-xs text-text-secondary">
                      Preço referência: {fmtN(b.preco_referencia, 4)}/sc
                      {b.quantidade_equivalente && ` · Equivalente: ${fmtN(b.quantidade_equivalente)} sc`}
                    </p>
                  )}
                  {b.status === 'ativo' && (
                    <button onClick={e => { e.stopPropagation(); setModalEntregar(b); setFormEntregar({ data_entrega: '', quantidade: '', preco_entrega_manual: b.preco_referencia?.toString() ?? '', fonte_preco: 'manual', nota_fiscal: '', observacoes: '' }) }}
                      className="mt-2 w-full bg-accent/10 text-accent border border-accent/30 text-xs font-semibold py-1.5 rounded-lg hover:bg-accent/20 transition-colors">
                      Registrar Entrega de Grãos
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

      {modalCriar && (
        <Modal title="Novo Contrato Barter" onClose={() => setModalCriar(false)} wide>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Número"><input className={inp} value={formCriar.numero} onChange={e => setFormCriar(p => ({ ...p, numero: e.target.value }))} placeholder="BAR-2026-003" /></Field>
            <Field label="ID do Produtor"><input className={inp} type="number" value={formCriar.produtor_id} onChange={e => setFormCriar(p => ({ ...p, produtor_id: e.target.value }))} /></Field>
            <Field label="ID do Produto a Receber"><input className={inp} type="number" value={formCriar.produto_receber_id} onChange={e => setFormCriar(p => ({ ...p, produto_receber_id: e.target.value }))} /></Field>
            <Field label="Safra"><input className={inp} value={formCriar.safra} onChange={e => setFormCriar(p => ({ ...p, safra: e.target.value }))} placeholder="2025/2026" /></Field>
            <Field label="Quantidade (sacas)"><input className={inp} type="number" step="0.001" value={formCriar.quantidade_sacas} onChange={e => setFormCriar(p => ({ ...p, quantidade_sacas: e.target.value }))} /></Field>
            <Field label="Valor dos Insumos (R$)"><input className={inp} type="number" step="0.01" value={formCriar.valor_insumos} onChange={e => setFormCriar(p => ({ ...p, valor_insumos: e.target.value }))} /></Field>
            <CotacaoMercado produto={formCriar.produto_receber_id} onPreco={v => setFormCriar(p => ({ ...p, preco_referencia_manual: String(v) }))} />
            <Field label="Preço de Referência (R$/saca)"><input className={inp} type="number" step="0.0001" value={formCriar.preco_referencia_manual} onChange={e => setFormCriar(p => ({ ...p, preco_referencia_manual: e.target.value }))} /></Field>
            <Field label="Fonte do Preço">
              <Sel value={formCriar.fonte_preco_referencia} onChange={v => setFormCriar(p => ({ ...p, fonte_preco_referencia: v }))}>
                <option value="manual">Manual</option>
                <option value="cbot">CBOT</option>
                <option value="esalq">ESALQ</option>
              </Sel>
            </Field>
            <Field label="Data do Contrato"><input className={inp} type="date" value={formCriar.data_contrato} onChange={e => setFormCriar(p => ({ ...p, data_contrato: e.target.value }))} /></Field>
            <Field label="Data de Entrega Prevista"><input className={inp} type="date" value={formCriar.data_entrega_prevista} onChange={e => setFormCriar(p => ({ ...p, data_entrega_prevista: e.target.value }))} /></Field>
            <Field label="Observações" span2><textarea className={inp} rows={2} value={formCriar.observacoes} onChange={e => setFormCriar(p => ({ ...p, observacoes: e.target.value }))} /></Field>
            <Btns onClose={() => setModalCriar(false)} onSave={criar} saving={saving} label="Criar Barter" disabled={!formCriar.numero || !formCriar.produtor_id || !formCriar.quantidade_sacas} />
          </div>
        </Modal>
      )}

      {modalEntregar && (
        <Modal title={`Entrega de Grãos — ${modalEntregar.numero}`} onClose={() => setModalEntregar(null)}>
          <div className="space-y-4">
            <p className="text-xs text-text-muted">Pendente: <strong>{fmtN(modalEntregar.quantidade_pendente)} sacas</strong></p>
            <Field label="Data da Entrega"><input className={inp} type="date" value={formEntregar.data_entrega} onChange={e => setFormEntregar(p => ({ ...p, data_entrega: e.target.value }))} /></Field>
            <Field label="Quantidade (sacas)"><input className={inp} type="number" step="0.001" value={formEntregar.quantidade} onChange={e => setFormEntregar(p => ({ ...p, quantidade: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <CotacaoMercado produto={modalEntregar.produto_receber} onPreco={v => setFormEntregar(p => ({ ...p, preco_entrega_manual: String(v) }))} />
            </div>
            <Field label="Preço na Entrega (R$/saca)">
              <input className={inp} type="number" step="0.0001" value={formEntregar.preco_entrega_manual} onChange={e => setFormEntregar(p => ({ ...p, preco_entrega_manual: e.target.value }))} />
            </Field>
            <Field label="Fonte">
              <Sel value={formEntregar.fonte_preco} onChange={v => setFormEntregar(p => ({ ...p, fonte_preco: v }))}>
                <option value="manual">Manual</option>
                <option value="cbot">CBOT</option>
                <option value="esalq">ESALQ</option>
              </Sel>
            </Field>
            {formEntregar.preco_entrega_manual && modalEntregar.preco_referencia !== null && (
              <div className="bg-card2 rounded-lg p-3 text-xs">
                <p className="text-text-muted">Ajuste financeiro estimado:</p>
                <p className={`text-base font-bold ${(parseFloat(formEntregar.preco_entrega_manual) - modalEntregar.preco_referencia) >= 0 ? 'text-accent' : 'text-red-500'}`}>
                  {fmt((parseFloat(formEntregar.preco_entrega_manual) - modalEntregar.preco_referencia) * parseFloat(formEntregar.quantidade || '0'))}
                </p>
                <p className="text-text-muted mt-0.5">(preço entrega − preço referência) × quantidade</p>
              </div>
            )}
            <Field label="Nota Fiscal de Entrada"><input className={inp} value={formEntregar.nota_fiscal} onChange={e => setFormEntregar(p => ({ ...p, nota_fiscal: e.target.value }))} /></Field>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModalEntregar(null)} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2">Cancelar</button>
              <button onClick={entregar} disabled={saving || !formEntregar.quantidade || !formEntregar.preco_entrega_manual} className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm hover:bg-accent/90 disabled:opacity-60">
                {saving ? 'Registrando...' : 'Registrar Entrega'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Contratos a Termo ────────────────────────────────────────────────────

function TabTermo() {
  const [rows, setRows] = useState<Termo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Termo | null>(null)
  const [modalCriar, setModalCriar] = useState(false)
  const [modalEntregar, setModalEntregar] = useState<Termo | null>(null)
  const [modalPreco, setModalPreco] = useState<Termo | null>(null)
  const [saving, setSaving] = useState(false)
  const [formCriar, setFormCriar] = useState({ numero: '', tipo: 'venda', contraparte_id: '', contraparte_nome: '', produto_id: '', safra: '', quantidade: '', preco_travado: '', data_contrato: '', data_entrega: '', observacoes: '' })
  const [formEntregar, setFormEntregar] = useState({ data_entrega: '', quantidade: '', preco_entrega: '', nota_fiscal: '', observacoes: '' })
  const [formPreco, setFormPreco] = useState({ preco_mercado_manual: '', fonte_preco_mercado: 'manual' })

  const load = async () => {
    setLoading(true)
    const data = await api.get('/api/contratos/termo/').then(r => r.data).catch(() => MOCK_TERMOS)
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const criar = async () => {
    setSaving(true)
    await api.post('/api/contratos/termo/', { ...formCriar, quantidade: parseFloat(formCriar.quantidade), preco_travado: parseFloat(formCriar.preco_travado) }).catch(() => {})
    setSaving(false); setModalCriar(false); load()
  }

  const entregar = async () => {
    if (!modalEntregar) return
    setSaving(true)
    await api.post(`/api/contratos/termo/${modalEntregar.id}/entregar/`, { ...formEntregar, quantidade: parseFloat(formEntregar.quantidade), preco_entrega: parseFloat(formEntregar.preco_entrega) }).catch(() => {})
    setSaving(false); setModalEntregar(null); load()
  }

  const atualizarPreco = async () => {
    if (!modalPreco) return
    setSaving(true)
    await api.post(`/api/contratos/termo/${modalPreco.id}/preco-mercado/`, { preco_mercado_manual: parseFloat(formPreco.preco_mercado_manual), fonte_preco_mercado: formPreco.fonte_preco_mercado }).catch(() => {})
    setSaving(false); setModalPreco(null); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-2">
        <button onClick={() => setModalCriar(true)} className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Novo Contrato a Termo
        </button>
      </div>

      {loading ? <div className="text-text-muted text-sm py-10 text-center">Carregando...</div>
        : rows.length === 0 ? <div className="text-text-muted text-sm py-10 text-center">Nenhum contrato a termo.</div>
        : rows.map(t => {
          const st = TERMO_STATUS[t.status] ?? { label: t.status, color: 'gray' as const }
          const pct = t.quantidade > 0 ? (t.quantidade_entregue / t.quantidade) * 100 : 0
          const exposicao = t.exposicao_mercado
          return (
            <div key={t.id} className={`bg-card border rounded-xl p-4 cursor-pointer hover:border-accent/40 transition-colors ${selected?.id === t.id ? 'border-accent' : 'border-border'}`}
              onClick={() => setSelected(s => s?.id === t.id ? null : t)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono text-xs text-text-muted">{t.numero}</span>
                    <Badge label={st.label} color={st.color} />
                    <Badge label={t.tipo_display} color={t.tipo === 'venda' ? 'blue' : 'orange'} />
                    {t.safra && <span className="text-xs text-text-muted bg-card2 px-2 py-0.5 rounded-full">{t.safra}</span>}
                  </div>
                  <p className="font-semibold text-text-primary text-sm">{t.produto} — {t.contraparte}</p>
                  <p className="text-xs text-text-muted">Entrega: {t.data_entrega} · Preço travado: {fmtN(t.preco_travado, 4)}/sc</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-text-primary">{fmt(t.valor_total_travado)}</p>
                  <p className="text-xs text-text-muted">{fmtN(t.quantidade)} sc × {fmtN(t.preco_travado, 2)}</p>
                  <AlertaBadge dias={t.dias_para_entrega} />
                </div>
              </div>

              {exposicao !== null && (
                <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${exposicao >= 0 ? 'text-accent' : 'text-red-500'}`}>
                  {exposicao >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  Exposição ao mercado: {fmt(Math.abs(exposicao))} {exposicao >= 0 ? '(favorável)' : '(desfavorável)'}
                  {t.preco_mercado_manual && <span className="text-text-muted font-normal">— cotação manual: {fmtN(t.preco_mercado_manual, 2)}/sc</span>}
                </div>
              )}

              <div className="mt-2">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-text-muted">Entregue: {fmtN(t.quantidade_entregue)} / {fmtN(t.quantidade)} sc</span>
                  <span>{pct.toFixed(0)}%</span>
                </div>
                <BarraProgresso pct={pct} />
              </div>

              {selected?.id === t.id && t.status === 'aberto' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <button onClick={e => { e.stopPropagation(); setModalPreco(t); setFormPreco({ preco_mercado_manual: t.preco_mercado_manual?.toString() ?? '', fonte_preco_mercado: 'manual' }) }}
                    className="flex-1 border border-border text-text-muted text-xs font-semibold py-1.5 rounded-lg hover:bg-card2 transition-colors">
                    Atualizar Cotação
                  </button>
                  <button onClick={e => { e.stopPropagation(); setModalEntregar(t); setFormEntregar({ data_entrega: '', quantidade: '', preco_entrega: t.preco_travado.toString(), nota_fiscal: '', observacoes: '' }) }}
                    className="flex-1 bg-accent/10 text-accent border border-accent/30 text-xs font-semibold py-1.5 rounded-lg hover:bg-accent/20 transition-colors">
                    Formalizar Entrega
                  </button>
                </div>
              )}
            </div>
          )
        })}

      {/* Modal criar termo */}
      {modalCriar && (
        <Modal title="Novo Contrato a Termo" onClose={() => setModalCriar(false)} wide>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Número"><input className={inp} value={formCriar.numero} onChange={e => setFormCriar(p => ({ ...p, numero: e.target.value }))} placeholder="TRM-2026-003" /></Field>
            <Field label="Tipo">
              <Sel value={formCriar.tipo} onChange={v => setFormCriar(p => ({ ...p, tipo: v }))}>
                <option value="venda">Venda Futura</option>
                <option value="compra">Compra Futura</option>
              </Sel>
            </Field>
            <Field label="ID da Contraparte (Cliente)"><input className={inp} type="number" value={formCriar.contraparte_id} onChange={e => setFormCriar(p => ({ ...p, contraparte_id: e.target.value }))} /></Field>
            <Field label="Nome da Contraparte (se não cadastrada)"><input className={inp} value={formCriar.contraparte_nome} onChange={e => setFormCriar(p => ({ ...p, contraparte_nome: e.target.value }))} /></Field>
            <Field label="ID do Produto"><input className={inp} type="number" value={formCriar.produto_id} onChange={e => setFormCriar(p => ({ ...p, produto_id: e.target.value }))} /></Field>
            <Field label="Safra"><input className={inp} value={formCriar.safra} onChange={e => setFormCriar(p => ({ ...p, safra: e.target.value }))} placeholder="2025/2026" /></Field>
            <Field label="Quantidade (sacas)"><input className={inp} type="number" step="0.001" value={formCriar.quantidade} onChange={e => setFormCriar(p => ({ ...p, quantidade: e.target.value }))} /></Field>
            <Field label="Preço Travado (R$/saca)"><input className={inp} type="number" step="0.0001" value={formCriar.preco_travado} onChange={e => setFormCriar(p => ({ ...p, preco_travado: e.target.value }))} /></Field>
            <Field label="Data do Contrato"><input className={inp} type="date" value={formCriar.data_contrato} onChange={e => setFormCriar(p => ({ ...p, data_contrato: e.target.value }))} /></Field>
            <Field label="Data de Entrega"><input className={inp} type="date" value={formCriar.data_entrega} onChange={e => setFormCriar(p => ({ ...p, data_entrega: e.target.value }))} /></Field>
            <Field label="Observações" span2><textarea className={inp} rows={2} value={formCriar.observacoes} onChange={e => setFormCriar(p => ({ ...p, observacoes: e.target.value }))} /></Field>
            <Btns onClose={() => setModalCriar(false)} onSave={criar} saving={saving} label="Criar Contrato" disabled={!formCriar.numero || !formCriar.produto_id || !formCriar.quantidade || !formCriar.preco_travado} />
          </div>
        </Modal>
      )}

      {/* Modal atualizar cotação */}
      {modalPreco && (
        <Modal title={`Atualizar Cotação — ${modalPreco.numero}`} onClose={() => setModalPreco(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <CotacaoMercado produto={modalPreco.produto} onPreco={v => setFormPreco(p => ({ ...p, preco_mercado_manual: String(v) }))} />
            </div>
            <Field label="Cotação Manual (R$/saca)">
              <input className={inp} type="number" step="0.0001" value={formPreco.preco_mercado_manual} onChange={e => setFormPreco(p => ({ ...p, preco_mercado_manual: e.target.value }))} />
            </Field>
            <Field label="Fonte">
              <Sel value={formPreco.fonte_preco_mercado} onChange={v => setFormPreco(p => ({ ...p, fonte_preco_mercado: v }))}>
                <option value="manual">Manual</option>
                <option value="cbot">CBOT</option>
                <option value="esalq">ESALQ</option>
              </Sel>
            </Field>
            {formPreco.preco_mercado_manual && (
              <div className={`rounded-lg p-3 text-xs ${((parseFloat(formPreco.preco_mercado_manual) - modalPreco.preco_travado) * (modalPreco.tipo === 'venda' ? 1 : -1)) >= 0 ? 'bg-accent/10' : 'bg-red-50'}`}>
                <p className="text-text-muted">Exposição calculada:</p>
                <p className={`text-base font-bold ${((parseFloat(formPreco.preco_mercado_manual) - modalPreco.preco_travado) * (modalPreco.tipo === 'venda' ? 1 : -1)) >= 0 ? 'text-accent' : 'text-red-500'}`}>
                  {fmt(Math.abs((parseFloat(formPreco.preco_mercado_manual) - modalPreco.preco_travado) * modalPreco.quantidade))}
                </p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModalPreco(null)} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2">Cancelar</button>
              <button onClick={atualizarPreco} disabled={saving || !formPreco.preco_mercado_manual} className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm hover:bg-accent/90 disabled:opacity-60">
                {saving ? 'Salvando...' : 'Atualizar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal formalizar entrega */}
      {modalEntregar && (
        <Modal title={`Formalizar Entrega — ${modalEntregar.numero}`} onClose={() => setModalEntregar(null)}>
          <div className="space-y-4">
            <p className="text-xs text-text-muted">Preço travado: <strong>{fmtN(modalEntregar.preco_travado, 4)}/sc</strong> · Pendente: <strong>{fmtN(modalEntregar.quantidade_pendente)} sc</strong></p>
            <Field label="Data da Entrega"><input className={inp} type="date" value={formEntregar.data_entrega} onChange={e => setFormEntregar(p => ({ ...p, data_entrega: e.target.value }))} /></Field>
            <Field label="Quantidade (sacas)"><input className={inp} type="number" step="0.001" value={formEntregar.quantidade} onChange={e => setFormEntregar(p => ({ ...p, quantidade: e.target.value }))} /></Field>
            <Field label="Preço na Entrega (R$/saca — pode ser diferente do travado)">
              <input className={inp} type="number" step="0.0001" value={formEntregar.preco_entrega} onChange={e => setFormEntregar(p => ({ ...p, preco_entrega: e.target.value }))} />
            </Field>
            {formEntregar.preco_entrega && formEntregar.quantidade && (
              <div className="bg-card2 rounded-lg p-3 text-xs">
                <p className="text-text-muted">Resultado financeiro:</p>
                <p className={`text-base font-bold ${(parseFloat(formEntregar.preco_entrega) - modalEntregar.preco_travado) >= 0 ? 'text-accent' : 'text-red-500'}`}>
                  {fmt((parseFloat(formEntregar.preco_entrega) - modalEntregar.preco_travado) * parseFloat(formEntregar.quantidade))}
                </p>
                <p className="text-text-muted">(preço entrega − preço travado) × quantidade</p>
              </div>
            )}
            <Field label="Nota Fiscal"><input className={inp} value={formEntregar.nota_fiscal} onChange={e => setFormEntregar(p => ({ ...p, nota_fiscal: e.target.value }))} /></Field>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModalEntregar(null)} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2">Cancelar</button>
              <button onClick={entregar} disabled={saving || !formEntregar.quantidade || !formEntregar.preco_entrega} className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm hover:bg-accent/90 disabled:opacity-60">
                {saving ? 'Processando...' : 'Formalizar Entrega'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Alertas ──────────────────────────────────────────────────────────────

function TabAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const data = await api.get('/api/contratos/alertas/').then(r => r.data).catch(() => MOCK_ALERTAS)
    setAlertas(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const nivelColor = (n: string) => n === 'critico' ? 'bg-red-50 border-red-200' : n === 'alerta' ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'
  const nivelIcon = (n: string) => n === 'critico' ? <AlertTriangle size={16} className="text-red-500" /> : <AlertTriangle size={16} className="text-orange-400" />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-text-muted">{alertas.length} alerta(s) ativos</p>
        <button onClick={load} className="text-text-muted hover:text-accent transition-colors"><RefreshCw size={15} /></button>
      </div>
      {loading ? <div className="text-text-muted text-sm py-10 text-center">Carregando...</div>
        : alertas.length === 0 ? <div className="text-accent text-sm py-10 text-center">Nenhum alerta de prazo — todos os contratos estão em dia.</div>
        : alertas.map((a, i) => (
          <div key={i} className={`border rounded-xl p-4 flex items-start gap-3 ${nivelColor(a.nivel)}`}>
            {nivelIcon(a.nivel)}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-primary">{a.tipo}</span>
                <span className="font-mono text-xs text-text-muted">{a.numero}</span>
              </div>
              <p className="text-sm text-text-primary mt-0.5">{a.descricao}</p>
            </div>
          </div>
        ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = ['CPR', 'Barter', 'Contratos a Termo', 'Alertas de Prazo']

export default function Contratos() {
  const [tab, setTab] = useState(TABS[0])
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText size={22} className="text-accent" />
        <h1 className="text-xl font-bold text-text-primary">Contratos Agrícolas</h1>
      </div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'CPR'                && <TabCPR />}
      {tab === 'Barter'             && <TabBarter />}
      {tab === 'Contratos a Termo'  && <TabTermo />}
      {tab === 'Alertas de Prazo'   && <TabAlertas />}
    </div>
  )
}
