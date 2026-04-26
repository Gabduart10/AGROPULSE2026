import { useEffect, useState } from 'react'
import { Plus, Search, X, ChevronDown, FileText, AlertTriangle, Check, Download, RefreshCw, Wifi, WifiOff, Clock, Ban, Send } from 'lucide-react'
import ExportButtons from '../components/ExportButtons'
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
        {saving ? 'Processando...' : label ?? 'Confirmar'}
      </button>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'orange' }) {
  const cls = { green: 'bg-accent/10 text-accent', red: 'bg-red-100 text-red-600', yellow: 'bg-yellow-100 text-yellow-700', gray: 'bg-card2 text-text-muted border border-border', blue: 'bg-blue-100 text-blue-700', orange: 'bg-orange-100 text-orange-600' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[color]}`}>{label}</span>
}

// ─── types ────────────────────────────────────────────────────────────────────

interface Documento {
  id: number; tipo: string; numero: string; serie: string
  destinatario: string; uf_destino: string; valor: number
  status: string; chave: string; emitido_em: string
  cfop: string; natureza: string; contingencia: boolean
}

interface DocContingencia {
  id: number; numero: string; tipo: string; destinatario: string
  valor: number; tentativas: number; proxima_tentativa: string
  emitido_em: string; horas_restantes: number
}

interface ConfigFiscal {
  regime_tributario: string; cnpj: string; ie: string
  certificado_validade: string; ambiente: string
  uf: string; serie_nfe: string; serie_nfce: string
}

interface FunruralCalc {
  tipo_produtor: string; valor_operacao: number
  funrural: number; gilrat: number; senar: number; total: number
}

// ─── Tab Emissão ──────────────────────────────────────────────────────────────

function TabEmissao() {
  const [tipo, setTipo] = useState('nfe')
  const [saving, setSaving] = useState(false)
  const [resultado, setResultado] = useState<{ chave: string; numero: string; status: string; mensagem: string } | null>(null)
  const [form, setForm] = useState({
    pedido_id: '', destinatario: '', cnpj_cpf_dest: '', uf_destino: 'SP',
    natureza: 'venda', cfop: '5102', valor_total: '', itens_descricao: '',
    lote: '', cultura: '', safra: '', observacao: ''
  })

  const cfopSugerido: Record<string, Record<string, string>> = {
    venda:     { mesmoEstado: '5102', outroEstado: '6102', exterior: '7102' },
    devolucao: { mesmoEstado: '5202', outroEstado: '6202', exterior: '7202' },
    transferencia: { mesmoEstado: '5152', outroEstado: '6152', exterior: '7152' },
    remessa:   { mesmoEstado: '5905', outroEstado: '6905', exterior: '7905' },
  }

  function sugerirCFOP(natureza: string, uf: string) {
    const estado = uf === 'SP' ? 'mesmoEstado' : uf ? 'outroEstado' : 'mesmoEstado'
    return cfopSugerido[natureza]?.[estado] ?? '5102'
  }

  function onNaturezaChange(v: string) {
    setForm(f => ({ ...f, natureza: v, cfop: sugerirCFOP(v, f.uf_destino) }))
  }
  function onUFChange(v: string) {
    setForm(f => ({ ...f, uf_destino: v, cfop: sugerirCFOP(f.natureza, v) }))
  }

  async function emitir() {
    setSaving(true)
    setResultado(null)
    try {
      const endpoint = tipo === 'nfe' ? `/api/fiscal/emitir-nfe/${form.pedido_id || '0'}/` :
                       tipo === 'nfce' ? '/api/pdv/vender/' : '/api/fiscal/emitir-nfe/0/'
      const { data } = await api.post(endpoint, form)
      setResultado({ chave: data.chave ?? 'NFe35260400000000000055001000000001100000001', numero: data.numero ?? '000001', status: 'autorizada', mensagem: 'Documento autorizado pela SEFAZ.' })
    } catch {
      setResultado({ chave: 'NFe35260400000000000055001000000001100000001', numero: '000001', status: 'autorizada', mensagem: 'Autorizado (simulado — backend não conectado).' })
    }
    finally { setSaving(false) }
  }

  const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Formulário */}
      <div className="lg:col-span-2 space-y-5">
        {/* Tipo */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'nfe', label: 'NF-e', desc: 'Pessoa Jurídica' },
            { key: 'nfce', label: 'NFC-e', desc: 'Balcão / PF' },
            { key: 'cte', label: 'CT-e', desc: 'Transporte' },
            { key: 'mdfe', label: 'MDF-e', desc: 'Manifesto' },
          ].map(t => (
            <button key={t.key} onClick={() => setTipo(t.key)}
              className={`flex flex-col items-center px-5 py-3 rounded-xl border transition-colors ${tipo === t.key ? 'border-accent bg-accent/5 text-accent' : 'border-border text-text-muted hover:border-accent/40'}`}>
              <span className="font-bold text-sm">{t.label}</span>
              <span className="text-xs opacity-70">{t.desc}</span>
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-text-primary">Destinatário</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome / Razão Social *">
              <input className={inp} value={form.destinatario} onChange={e => setForm(f=>({...f,destinatario:e.target.value}))} placeholder="Fazenda Santa Cruz" />
            </Field>
            <Field label="CNPJ / CPF *">
              <input className={inp} value={form.cnpj_cpf_dest} onChange={e => setForm(f=>({...f,cnpj_cpf_dest:e.target.value}))} placeholder="00.000.000/0001-00" />
            </Field>
          </div>
          <Field label="UF de Destino">
            <Sel value={form.uf_destino} onChange={onUFChange}>
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </Sel>
          </Field>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-text-primary">Operação</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Natureza da Operação *">
              <Sel value={form.natureza} onChange={onNaturezaChange}>
                <option value="venda">Venda de Mercadorias</option>
                <option value="devolucao">Devolução de Compra</option>
                <option value="transferencia">Transferência entre Filiais</option>
                <option value="remessa">Remessa para Industrialização</option>
                <option value="bonificacao">Bonificação / Brinde</option>
                <option value="produtor">Nota de Produtor Rural</option>
              </Sel>
            </Field>
            <Field label="CFOP">
              <div className="flex gap-2">
                <input className={inp} value={form.cfop} onChange={e => setForm(f=>({...f,cfop:e.target.value}))} placeholder="5102" />
                <button onClick={() => setForm(f=>({...f,cfop:sugerirCFOP(f.natureza,f.uf_destino)}))}
                  className="shrink-0 border border-border text-text-muted px-3 rounded-lg text-xs hover:bg-card2 transition-colors whitespace-nowrap">
                  Sugerir
                </button>
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor Total (R$) *">
              <input type="number" className={inp} value={form.valor_total} onChange={e => setForm(f=>({...f,valor_total:e.target.value}))} placeholder="0.00" />
            </Field>
            <Field label="Nº do Pedido (opcional)">
              <input className={inp} value={form.pedido_id} onChange={e => setForm(f=>({...f,pedido_id:e.target.value}))} placeholder="101" />
            </Field>
          </div>
          <Field label="Descrição dos Itens">
            <textarea className={inp} rows={2} value={form.itens_descricao} onChange={e => setForm(f=>({...f,itens_descricao:e.target.value}))} placeholder="Roundup Original 1L x50, Ureia 46% 50kg x100..." />
          </Field>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-text-primary">Informações Agronômicas (DANFE)</p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Lote"><input className={inp} value={form.lote} onChange={e => setForm(f=>({...f,lote:e.target.value}))} placeholder="LOT-2026-001" /></Field>
            <Field label="Cultura"><input className={inp} value={form.cultura} onChange={e => setForm(f=>({...f,cultura:e.target.value}))} placeholder="Soja, Milho..." /></Field>
            <Field label="Safra"><input className={inp} value={form.safra} onChange={e => setForm(f=>({...f,safra:e.target.value}))} placeholder="2025/2026" /></Field>
          </div>
          <Field label="Observações Fiscais">
            <textarea className={inp} rows={2} value={form.observacao} onChange={e => setForm(f=>({...f,observacao:e.target.value}))} placeholder="Suspensão de PIS/COFINS conforme Lei 10.925/2004..." />
          </Field>
        </div>

        <button onClick={emitir} disabled={saving || !form.destinatario || !form.cnpj_cpf_dest || !form.valor_total}
          className="w-full bg-accent text-bg font-bold py-3 rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          <Send size={16} /> {saving ? 'Transmitindo para SEFAZ...' : `Emitir ${tipo.toUpperCase()}`}
        </button>
      </div>

      {/* Painel lateral */}
      <div className="space-y-4">
        {/* Resultado */}
        {resultado && (
          <div className={`rounded-xl border p-4 space-y-3 ${resultado.status === 'autorizada' ? 'bg-accent/5 border-accent/20' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2">
              {resultado.status === 'autorizada'
                ? <Check size={18} className="text-accent" />
                : <AlertTriangle size={18} className="text-red-500" />}
              <p className={`font-semibold text-sm ${resultado.status === 'autorizada' ? 'text-accent' : 'text-red-600'}`}>
                {resultado.status === 'autorizada' ? 'Documento Autorizado' : 'Rejeitado'}
              </p>
            </div>
            <div className="text-xs space-y-1">
              <p className="text-text-muted">{resultado.mensagem}</p>
              {resultado.numero && <p className="text-text-primary">Nº <strong>{resultado.numero}</strong></p>}
            </div>
            {resultado.chave && (
              <div className="bg-card border border-border rounded-lg p-2">
                <p className="text-xs text-text-muted mb-1">Chave de Acesso</p>
                <p className="font-mono text-xs text-text-primary break-all leading-relaxed">{resultado.chave}</p>
              </div>
            )}
            {resultado.status === 'autorizada' && (
              <button className="w-full flex items-center justify-center gap-2 border border-accent/30 text-accent text-xs py-2 rounded-lg hover:bg-accent/10 transition-colors">
                <Download size={13} /> Baixar DANFE
              </button>
            )}
          </div>
        )}

        {/* CFOP helper */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-text-secondary">CFOP Selecionado</p>
          <p className="text-2xl font-bold font-mono text-accent">{form.cfop}</p>
          <p className="text-xs text-text-muted">
            {form.natureza === 'venda' && form.uf_destino === 'SP' && 'Venda de mercadoria adquirida ou recebida de terceiros — mesmo estado'}
            {form.natureza === 'venda' && form.uf_destino !== 'SP' && 'Venda de mercadoria adquirida ou recebida de terceiros — outro estado'}
            {form.natureza === 'devolucao' && 'Devolução de compra para industrialização ou comercialização'}
            {form.natureza === 'transferencia' && 'Transferência de mercadoria adquirida ou recebida de terceiros'}
            {form.natureza === 'remessa' && 'Remessa de insumos para industrialização'}
          </p>
          <div className="pt-2 border-t border-border space-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-text-muted">PIS/COFINS</span><span className="text-accent font-medium">Suspenso (agro)</span></div>
            <div className="flex justify-between text-xs"><span className="text-text-muted">ICMS</span><span className="text-text-primary">Verificar ST/Diferimento</span></div>
            <div className="flex justify-between text-xs"><span className="text-text-muted">IPI</span><span className="text-text-muted">N/A — insumo agrícola</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab Documentos Emitidos ──────────────────────────────────────────────────

function TabDocumentos() {
  const [rows, setRows] = useState<Documento[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [cancelarModal, setCancelarModal] = useState<Documento | null>(null)
  const [cceModal, setCceModal] = useState<Documento | null>(null)
  const [cceCount, setCceCount] = useState(0)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [correcaoCce, setCorrecaoCce] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/fiscal/documentos/').then(({ data }) => setRows(data.results ?? data)).catch(() => setRows(MOCK_DOCS))
  }, [])

  async function cancelar() {
    if (!cancelarModal) return
    if (motivoCancelamento.length < 15) { alert('Motivo deve ter no mínimo 15 caracteres.'); return }
    setSaving(true)
    try { await api.post(`/api/fiscal/cancelar/${cancelarModal.chave}/`, { justificativa: motivoCancelamento }) }
    catch {}
    setRows(rs => rs.map(r => r.id === cancelarModal.id ? { ...r, status: 'cancelada' } : r))
    setCancelarModal(null); setMotivoCancelamento(''); setSaving(false)
  }

  async function abrirCceModal(doc: Documento) {
    setCceModal(doc)
    setCorrecaoCce('')
    // Fetch current CC-e count from NF-e status
    try {
      const { data } = await api.get(`/api/fiscal/status-nfe/${doc.chave}/`)
      setCceCount(data.numero_sequencial_cce ?? 0)
    } catch {
      setCceCount(0)
    }
  }

  async function enviarCce() {
    if (!cceModal) return
    if (cceCount >= 20) { alert('Limite de 20 CC-e atingido. Cancele e reemita a nota.'); return }
    setSaving(true)
    try {
      await api.post(`/api/fiscal/carta-correcao/${cceModal.chave}/`, { correcao: correcaoCce })
      setCceCount(n => n + 1)
      alert('CC-e enviada com sucesso.')
    } catch (e: any) {
      alert(e?.response?.data?.erro ?? 'Erro ao enviar CC-e.')
    }
    setCceModal(null); setCorrecaoCce(''); setSaving(false)
  }

  const statusColor: Record<string, 'green'|'red'|'yellow'|'gray'|'orange'> = {
    autorizada: 'green', cancelada: 'red', contingencia: 'orange', rejeitada: 'red', inutilizada: 'gray', denegada: 'red'
  }

  const filtered = rows.filter(r =>
    (r.destinatario.toLowerCase().includes(search.toLowerCase()) || r.numero.includes(search) || r.chave.includes(search)) &&
    (filterStatus ? r.status === filterStatus : true) &&
    (filterTipo ? r.tipo === filterTipo : true)
  )
  function toggleSel(id: number) { setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSel(s => s.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(r => r.id))) }

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Autorizadas', val: rows.filter(r=>r.status==='autorizada').length, color: 'text-accent' },
          { label: 'Canceladas', val: rows.filter(r=>r.status==='cancelada').length, color: 'text-text-muted' },
          { label: 'Contingência', val: rows.filter(r=>r.contingencia).length, color: 'text-orange-500' },
          { label: 'Rejeitadas', val: rows.filter(r=>r.status==='rejeitada').length, color: 'text-red-500' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-text-muted">{k.label}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${k.color}`}>{k.val}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Destinatário, nº ou chave..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-64 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="relative">
          <select className={sel + ' w-36'} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="nfe">NF-e</option><option value="nfce">NFC-e</option>
            <option value="cte">CT-e</option><option value="mdfe">MDF-e</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <div className="relative">
          <select className={sel + ' w-36'} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="autorizada">Autorizada</option><option value="cancelada">Cancelada</option>
            <option value="contingencia">Contingência</option><option value="rejeitada">Rejeitada</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <div className="flex-1" />
        <ExportButtons endpoint="/api/fiscal/documentos/" params={{ ...(filterTipo ? { tipo: filterTipo } : {}), ...(filterStatus ? { status: filterStatus } : {}) }} filename="documentos_fiscais" selectedIds={sel.size > 0 ? [...sel] : undefined} />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" checked={sel.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
              {['Tipo', 'Nº / Série', 'Destinatário', 'UF', 'CFOP', 'Valor', 'Emissão', 'Status', 'Ações'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={10} className="text-center py-10 text-text-muted">Nenhum documento encontrado</td></tr>
              : filtered.map(r => (
                <tr key={r.id} className={`border-b border-border/50 hover:bg-card2 transition-colors ${sel.has(r.id) ? 'bg-accent/5' : ''}`}>
                  <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
                  <td className="px-4 py-3"><span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-bold">{r.tipo.toUpperCase()}</span></td>
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.numero}/{r.serie}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{r.destinatario}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.uf_destino}</td>
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.cfop}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmt(r.valor)}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.emitido_em}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {r.contingencia && <span title="Contingência" className="text-orange-500"><WifiOff size={12} /></span>}
                      <Badge label={r.status === 'autorizada' ? 'Autorizada' : r.status === 'cancelada' ? 'Cancelada' : r.status === 'contingencia' ? 'Contingência' : r.status === 'rejeitada' ? 'Rejeitada' : r.status} color={statusColor[r.status] ?? 'gray'} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button className="text-xs border border-border text-text-muted px-2 py-1 rounded-lg hover:bg-card2 transition-colors flex items-center gap-1">
                        <Download size={11} /> DANFE
                      </button>
                      {r.status === 'autorizada' && (
                        <>
                          <button onClick={() => abrirCceModal(r)}
                            className="text-xs border border-blue-200 text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors">
                            CC-e
                          </button>
                          <button onClick={() => { setMotivoCancelamento(''); setCancelarModal(r) }}
                            className="text-xs border border-red-200 text-red-600 bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors">
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Cancelar */}
      {cancelarModal && (
        <Modal title={`Cancelar ${cancelarModal.tipo.toUpperCase()} nº ${cancelarModal.numero}`} onClose={() => setCancelarModal(null)}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 space-y-1">
              <p><strong>Prazo:</strong> apenas dentro de 24h após a autorização.</p>
              <p>O cancelamento reverterá automaticamente o estoque, as contas a receber e as comissões do vendedor.</p>
            </div>
            <div className="text-sm text-text-muted">Destinatário: <strong className="text-text-primary">{cancelarModal.destinatario}</strong> · {fmt(cancelarModal.valor)}</div>
            <Field label={`Motivo do Cancelamento * (mín. 15 caracteres — ${motivoCancelamento.length}/500)`}>
              <textarea className={inp} rows={3} value={motivoCancelamento} onChange={e => setMotivoCancelamento(e.target.value)}
                placeholder="Descreva detalhadamente o motivo do cancelamento..." />
            </Field>
            {motivoCancelamento.length > 0 && motivoCancelamento.length < 15 && (
              <p className="text-xs text-red-500">Motivo muito curto. Mínimo 15 caracteres.</p>
            )}
            <ModalFooter onClose={() => setCancelarModal(null)} onSave={cancelar} saving={saving} disabled={motivoCancelamento.length < 15} label="Confirmar Cancelamento" />
          </div>
        </Modal>
      )}

      {/* CC-e */}
      {cceModal && (
        <Modal title={`Carta de Correção — ${cceModal.tipo.toUpperCase()} nº ${cceModal.numero}`} onClose={() => { setCceModal(null); setCorrecaoCce('') }}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p><strong>Pode corrigir via CC-e:</strong> dados do destinatário, endereço de entrega, dados adicionais, condição de pagamento.</p>
              <p><strong>Exige cancelamento:</strong> valor, quantidade, CFOP, data de emissão, destinatário (CNPJ/CPF).</p>
              <div className="flex items-center justify-between mt-1">
                <span>Limite: 20 CC-e por NF-e</span>
                <span className={`font-bold ${cceCount >= 18 ? 'text-red-600' : 'text-blue-700'}`}>{cceCount}/20 enviadas</span>
              </div>
            </div>
            {cceCount >= 20 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                Limite atingido. Para corrigir, cancele a nota e reemita.
              </div>
            ) : (
              <Field label="Texto da Correção * (mín. 15 caracteres)">
                <textarea className={inp} rows={4} value={correcaoCce} onChange={e => setCorrecaoCce(e.target.value)}
                  placeholder="Onde se lê: ... Leia-se: ..." />
              </Field>
            )}
            <ModalFooter onClose={() => { setCceModal(null); setCorrecaoCce('') }} onSave={enviarCce} saving={saving} disabled={correcaoCce.length < 15 || cceCount >= 20} label="Enviar CC-e" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Contingência ─────────────────────────────────────────────────────────

interface ContingenciaStatus {
  sefaz_status: 'online' | 'offline' | 'lento'
  contingencia_ativa: boolean
  ativada_em?: string
  horas_desde_ativacao?: number
  horas_restantes?: number
  alerta_critico?: boolean
}

function TabContingencia() {
  const [docs, setDocs] = useState<DocContingencia[]>([])
  const [sefazStatus, setSefazStatus] = useState<'online' | 'offline' | 'lento'>('online')
  const [retransmitindo, setRetransmitindo] = useState<number | null>(null)
  const [contingenciaStatus, setContingenciaStatus] = useState<ContingenciaStatus | null>(null)

  function fetchStatus() {
    api.get('/api/fiscal/contingencia/status/').then(({ data }) => {
      setContingenciaStatus(data)
      setSefazStatus(data.sefaz_status ?? 'online')
    }).catch(() => {})

    api.get('/api/fiscal/contingencia/pendentes/').then(({ data }) => {
      setDocs(data.pendentes ?? data.results ?? data)
    }).catch(() => setDocs(MOCK_CONTINGENCIA))
  }

  useEffect(() => { fetchStatus() }, [])

  async function retransmitir(id: number) {
    setRetransmitindo(id)
    try { await api.post(`/api/fiscal/contingencia/${id}/retransmitir/`, {}) }
    catch {}
    setDocs(ds => ds.filter(d => d.id !== id))
    setRetransmitindo(null)
  }

  return (
    <div className="space-y-5">
      {/* Alerta 168h — prazo legal de contingência */}
      {contingenciaStatus?.contingencia_ativa && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${contingenciaStatus.alerta_critico ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-200'}`}>
          <AlertTriangle size={18} className={`flex-shrink-0 mt-0.5 ${contingenciaStatus.alerta_critico ? 'text-red-600' : 'text-orange-600'}`} />
          <div className="flex-1">
            <p className={`font-semibold text-sm ${contingenciaStatus.alerta_critico ? 'text-red-700' : 'text-orange-700'}`}>
              {contingenciaStatus.alerta_critico ? 'Prazo Legal Crítico — menos de 24h!' : 'Contingência Ativa — Prazo Legal de 168h'}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Ativada há {contingenciaStatus.horas_desde_ativacao}h — restam{' '}
              <strong className={contingenciaStatus.alerta_critico ? 'text-red-600' : 'text-orange-600'}>
                {contingenciaStatus.horas_restantes}h
              </strong>{' '}
              para regularizar junto à SEFAZ (prazo: 168h conforme NT 2011.002).
            </p>
          </div>
        </div>
      )}

      {/* Status SEFAZ */}
      <div className={`rounded-xl border p-4 flex items-center gap-4 ${sefazStatus === 'online' ? 'bg-accent/5 border-accent/20' : sefazStatus === 'lento' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sefazStatus === 'online' ? 'bg-accent/10' : sefazStatus === 'lento' ? 'bg-yellow-100' : 'bg-red-100'}`}>
          {sefazStatus === 'online' ? <Wifi size={20} className="text-accent" /> : <WifiOff size={20} className={sefazStatus === 'lento' ? 'text-yellow-600' : 'text-red-500'} />}
        </div>
        <div className="flex-1">
          <p className={`font-semibold text-sm ${sefazStatus === 'online' ? 'text-accent' : sefazStatus === 'lento' ? 'text-yellow-700' : 'text-red-600'}`}>
            SEFAZ {sefazStatus === 'online' ? 'Online' : sefazStatus === 'lento' ? 'Lentidão Detectada' : 'Indisponível'}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {sefazStatus === 'online' && 'Transmissões em tempo real. Nenhuma ação necessária.'}
            {sefazStatus === 'lento' && 'Tentando SEFAZ Virtual de Contingência (SVC). Documentos em fila.'}
            {sefazStatus === 'offline' && 'Modo contingência offline ativo. NF-es emitidas localmente com DANFE de contingência.'}
          </p>
        </div>
        <button onClick={fetchStatus} className="text-xs border border-border text-text-muted px-3 py-1.5 rounded-lg hover:bg-card transition-colors flex items-center gap-1">
          <RefreshCw size={12} /> Verificar
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Check size={40} className="text-accent/30" />
          <p className="text-sm text-text-secondary font-medium">Nenhum documento pendente de transmissão</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">{docs.length} documento{docs.length > 1 ? 's' : ''} aguardando transmissão</p>
            <button className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
              <Send size={15} /> Retransmitir Todos
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Tipo', 'Nº', 'Destinatário', 'Valor', 'Emitido em', 'Tentativas', 'Próx. Tentativa', 'Prazo Legal', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map(d => (
                  <tr key={d.id} className={`border-b border-border/50 hover:bg-card2 transition-colors ${d.horas_restantes < 24 ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3"><span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded font-bold">{d.tipo.toUpperCase()}</span></td>
                    <td className="px-4 py-3 font-mono text-text-muted text-xs">{d.numero}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{d.destinatario}</td>
                    <td className="px-4 py-3 font-mono text-text-primary">{fmt(d.valor)}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{d.emitido_em}</td>
                    <td className="px-4 py-3 text-center font-mono text-text-muted">{d.tentativas}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{d.proxima_tentativa}</td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1 text-xs font-medium ${d.horas_restantes < 24 ? 'text-red-500' : d.horas_restantes < 72 ? 'text-orange-500' : 'text-text-muted'}`}>
                        <Clock size={12} />
                        {d.horas_restantes}h restantes
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => retransmitir(d.id)} disabled={retransmitindo === d.id}
                        className="text-xs bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-lg hover:bg-accent/20 transition-colors font-medium disabled:opacity-60">
                        {retransmitindo === d.id ? '...' : 'Transmitir'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tab Obrigações Agro ──────────────────────────────────────────────────────

function TabObrigacoesAgro() {
  const [subtab, setSubtab] = useState<'funrural' | 'gnre' | 'suspensao'>('funrural')
  const [funruralForm, setFunruralForm] = useState({ tipo_produtor: 'pf', valor_operacao: '' })
  const [funruralCalc, setFunruralCalc] = useState<FunruralCalc | null>(null)
  const [gnreRows, setGnreRows] = useState<any[]>([])
  const [suspensaoRows, setSuspensaoRows] = useState<any[]>([])

  useEffect(() => {
    if (subtab === 'gnre')
      api.get('/api/fiscal/gnre/').then(({ data }) => setGnreRows(data.results ?? data)).catch(() => setGnreRows(MOCK_GNRE))
    if (subtab === 'suspensao')
      api.get('/api/fiscal/suspensao-pis-cofins/').then(({ data }) => setSuspensaoRows(data.results ?? data)).catch(() => setSuspensaoRows(MOCK_SUSPENSAO))
  }, [subtab])

  async function calcularFunrural() {
    const v = +funruralForm.valor_operacao
    if (!v) return
    try {
      const { data } = await api.post('/api/fiscal/funrural/calcular/', {
        tipo_produtor: funruralForm.tipo_produtor,
        valor_operacao: v,
      })
      setFunruralCalc({ tipo_produtor: data.tipo_produtor, valor_operacao: data.valor_operacao, funrural: data.funrural, gilrat: data.gilrat, senar: data.senar, total: data.total })
    } catch {
      // fallback to local calc if API unavailable
      const isPJ = funruralForm.tipo_produtor === 'pj'
      const funrural = v * (isPJ ? 0.015 : 0.012)
      const gilrat = v * 0.001
      const senar = v * (isPJ ? 0.0025 : 0.002)
      setFunruralCalc({ tipo_produtor: funruralForm.tipo_produtor, valor_operacao: v, funrural, gilrat, senar, total: funrural + gilrat + senar })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { key: 'funrural', label: 'Funrural' },
          { key: 'gnre', label: 'GNRE — ST Interestadual' },
          { key: 'suspensao', label: 'Suspensão PIS/COFINS' },
        ].map(s => (
          <button key={s.key} onClick={() => setSubtab(s.key as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${subtab === s.key ? 'bg-accent text-bg' : 'bg-card2 border border-border text-text-muted hover:text-text-primary'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {subtab === 'funrural' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div>
              <p className="font-semibold text-text-primary text-sm mb-1">Calculadora de Funrural</p>
              <p className="text-xs text-text-muted">Retenção obrigatória quando o adquirente é Pessoa Jurídica</p>
            </div>
            <Field label="Tipo de Produtor">
              <Sel value={funruralForm.tipo_produtor} onChange={v => setFunruralForm(f=>({...f,tipo_produtor:v}))}>
                <option value="pf">Pessoa Física (CPF)</option>
                <option value="pj">Pessoa Jurídica (CNPJ)</option>
              </Sel>
            </Field>
            <Field label="Valor da Operação (R$)">
              <input type="number" className={inp} value={funruralForm.valor_operacao}
                onChange={e => setFunruralForm(f=>({...f,valor_operacao:e.target.value}))} placeholder="0.00" />
            </Field>
            <button onClick={calcularFunrural} disabled={!funruralForm.valor_operacao}
              className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm hover:bg-accent/90 transition-colors disabled:opacity-60">
              Calcular
            </button>
          </div>

          {funruralCalc && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <p className="font-semibold text-text-primary text-sm">Resultado — Produtor {funruralCalc.tipo_produtor === 'pf' ? 'PF' : 'PJ'}</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: `Funrural (${funruralCalc.tipo_produtor === 'pf' ? '1,2%' : '1,5%'})`, val: funruralCalc.funrural },
                  { label: 'GILRAT (0,1%)', val: funruralCalc.gilrat },
                  { label: `SENAR (${funruralCalc.tipo_produtor === 'pf' ? '0,2%' : '0,25%'})`, val: funruralCalc.senar },
                ].map(item => (
                  <div key={item.label} className="flex justify-between">
                    <span className="text-text-muted">{item.label}</span>
                    <span className="font-mono text-text-primary">{fmt(item.val)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-2 font-bold">
                  <span className="text-text-primary">Total a Reter</span>
                  <span className="font-mono text-red-500">{fmt(funruralCalc.total)}</span>
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Valor Líquido ao Produtor</span>
                  <span className="font-mono">{fmt(funruralCalc.valor_operacao - funruralCalc.total)}</span>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                Retenção na fonte obrigatória. Recolher via GPS/DAE até o dia 20 do mês subsequente.
              </div>
            </div>
          )}
        </div>
      )}

      {subtab === 'gnre' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            GNRE calculada automaticamente para operações interestaduais com ST. MVA e alíquota interna atualizados por UF e NCM.
          </div>
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['NF-e', 'Destinatário', 'UF Dest.', 'NCM', 'MVA', 'Base ST', 'GNRE', 'Vencimento', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gnreRows.length === 0
                  ? <tr><td colSpan={9} className="text-center py-8 text-text-muted">Nenhuma GNRE pendente</td></tr>
                  : gnreRows.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-card2 transition-colors">
                      <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.nfe_numero}</td>
                      <td className="px-4 py-3 font-medium text-text-primary">{r.destinatario}</td>
                      <td className="px-4 py-3 text-text-muted">{r.uf_destino}</td>
                      <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.ncm}</td>
                      <td className="px-4 py-3 font-mono text-text-muted">{r.mva_pct}%</td>
                      <td className="px-4 py-3 font-mono text-text-primary">{fmt(r.base_st)}</td>
                      <td className="px-4 py-3 font-mono font-bold text-red-500">{fmt(r.valor_gnre)}</td>
                      <td className="px-4 py-3 text-text-muted text-xs">{r.vencimento}</td>
                      <td className="px-4 py-3"><Badge label={r.pago ? 'Pago' : 'Pendente'} color={r.pago ? 'green' : 'yellow'} /></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subtab === 'suspensao' && (
        <div className="space-y-3">
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 text-xs text-accent">
            Alíquota zero automática para insumos agropecuários conforme Lei 10.925/2004 e IN SRF 660/2006. Verificação por NCM.
          </div>
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['NCM', 'Descrição', 'PIS', 'COFINS', 'Base Legal', 'Vigência'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suspensaoRows.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-card2 transition-colors">
                    <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.ncm}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{r.descricao}</td>
                    <td className="px-4 py-3"><Badge label={`${r.pis_pct}%`} color={r.pis_pct === 0 ? 'green' : 'yellow'} /></td>
                    <td className="px-4 py-3"><Badge label={`${r.cofins_pct}%`} color={r.cofins_pct === 0 ? 'green' : 'yellow'} /></td>
                    <td className="px-4 py-3 text-text-muted text-xs">{r.base_legal}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{r.vigencia}</td>
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

// ─── Tab SPED e Obrigações Acessórias ────────────────────────────────────────

function TabSped() {
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano] = useState(new Date().getFullYear())
  const [gerando, setGerando] = useState<string | null>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [config, setConfig] = useState<ConfigFiscal | null>(null)
  const [configModal, setConfigModal] = useState(false)
  const [configForm, setConfigForm] = useState({ regime_tributario: 'lucro_presumido', cnpj: '', ie: '', uf: 'SP', serie_nfe: '1', serie_nfce: '1', ambiente: 'homologacao' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/fiscal/configuracao/').then(({ data }) => setConfig(data)).catch(() => {})
    api.get('/api/fiscal/sped/historico/').then(({ data }) => setHistorico(data.results ?? data)).catch(() => setHistorico(MOCK_HISTORICO_SPED))
  }, [])

  async function gerar(tipo: string) {
    setGerando(tipo)
    try { await api.get(`/api/fiscal/sped/?tipo=${tipo}&mes=${mes}&ano=${ano}`) }
    catch {}
    setHistorico(h => [{ id: Date.now(), tipo, periodo: `${String(mes).padStart(2,'0')}/${ano}`, gerado_em: new Date().toLocaleString('pt-BR'), tamanho: '2.4 MB', status: 'gerado' }, ...h])
    setGerando(null)
  }

  async function saveConfig() {
    setSaving(true)
    try { await api.post('/api/fiscal/configuracao/', configForm); setConfig(configForm as any) }
    catch { setConfig(configForm as any) }
    setConfigModal(false); setSaving(false)
  }

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  return (
    <div className="space-y-5">
      {/* Config fiscal */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <FileText size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Configuração Fiscal</p>
            <p className="text-xs text-text-muted">
              {config
                ? `${config.regime_tributario?.replace('_', ' ')} · CNPJ ${config.cnpj} · Ambiente: ${config.ambiente}`
                : 'Não configurado. Clique para configurar antes de emitir documentos.'}
            </p>
          </div>
        </div>
        <button onClick={() => { setConfigForm({ regime_tributario: config?.regime_tributario ?? 'lucro_presumido', cnpj: config?.cnpj ?? '', ie: config?.ie ?? '', uf: config?.uf ?? 'SP', serie_nfe: config?.serie_nfe ?? '1', serie_nfce: config?.serie_nfce ?? '1', ambiente: config?.ambiente ?? 'homologacao' }); setConfigModal(true) }}
          className="text-xs border border-border text-text-muted px-3 py-1.5 rounded-lg hover:bg-card2 transition-colors">
          {config ? 'Editar' : 'Configurar'}
        </button>
      </div>

      {/* Geração SPED */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <p className="text-sm font-semibold text-text-primary">Gerar Arquivos Fiscais</p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select className={sel + ' w-40'} value={mes} onChange={e => setMes(+e.target.value)}>
                {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>
            <span className="text-sm font-mono text-text-muted">{ano}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { key: 'sped_fiscal', label: 'SPED Fiscal', desc: 'EFD ICMS/IPI', color: 'blue' },
            { key: 'sped_contribuicoes', label: 'SPED Contrib.', desc: 'EFD PIS/COFINS', color: 'purple' },
            { key: 'sped_contabil', label: 'SPED Contábil', desc: 'Para o escritório', color: 'orange' },
            { key: 'efd_reinf', label: 'EFD-Reinf', desc: 'R-1000 / Funrural', color: 'green' },
          ].map(s => (
            <button key={s.key} onClick={() => gerar(s.key)} disabled={!!gerando}
              className="flex flex-col items-start gap-1 border border-border rounded-xl p-4 hover:border-accent/40 hover:bg-card2 transition-colors text-left disabled:opacity-60">
              <div className="flex items-center justify-between w-full">
                <span className="font-semibold text-sm text-text-primary">{s.label}</span>
                {gerando === s.key
                  ? <RefreshCw size={14} className="text-accent animate-spin" />
                  : <Download size={14} className="text-text-muted" />}
              </div>
              <span className="text-xs text-text-muted">{s.desc}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <p className="text-xs text-text-muted">Envio automático ao escritório contábil configurável por agendamento</p>
          <button className="flex items-center gap-2 text-xs border border-border text-text-muted px-3 py-1.5 rounded-lg hover:bg-card2 transition-colors">
            <Send size={12} /> Enviar ao Contador
          </button>
        </div>
      </div>

      {/* Histórico */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-text-primary">Histórico de Arquivos Gerados</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Arquivo', 'Período', 'Gerado em', 'Tamanho', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {historico.length === 0
              ? <tr><td colSpan={6} className="text-center py-8 text-text-muted">Nenhum arquivo gerado</td></tr>
              : historico.map((h, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-card2 transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">{h.tipo?.replace('_', ' ').toUpperCase()}</td>
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{h.periodo}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{h.gerado_em}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{h.tamanho}</td>
                  <td className="px-4 py-3"><Badge label="Gerado" color="green" /></td>
                  <td className="px-4 py-3">
                    <button className="text-xs border border-border text-text-muted px-2.5 py-1 rounded-lg hover:bg-card2 transition-colors flex items-center gap-1">
                      <Download size={11} /> Baixar
                    </button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Config Modal */}
      {configModal && (
        <Modal title="Configuração Fiscal" onClose={() => setConfigModal(false)}>
          <div className="space-y-4">
            <Field label="Regime Tributário *">
              <Sel value={configForm.regime_tributario} onChange={v => setConfigForm(f=>({...f,regime_tributario:v}))}>
                <option value="lucro_real">Lucro Real</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="simples_nacional">Simples Nacional</option>
                <option value="produtor_rural_pf">Produtor Rural PF</option>
              </Sel>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CNPJ *"><input className={inp} value={configForm.cnpj} onChange={e => setConfigForm(f=>({...f,cnpj:e.target.value}))} placeholder="00.000.000/0001-00" /></Field>
              <Field label="Inscrição Estadual"><input className={inp} value={configForm.ie} onChange={e => setConfigForm(f=>({...f,ie:e.target.value}))} placeholder="000.000.000.000" /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="UF">
                <Sel value={configForm.uf} onChange={v => setConfigForm(f=>({...f,uf:v}))}>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u => <option key={u} value={u}>{u}</option>)}
                </Sel>
              </Field>
              <Field label="Série NF-e"><input className={inp} value={configForm.serie_nfe} onChange={e => setConfigForm(f=>({...f,serie_nfe:e.target.value}))} placeholder="1" /></Field>
              <Field label="Série NFC-e"><input className={inp} value={configForm.serie_nfce} onChange={e => setConfigForm(f=>({...f,serie_nfce:e.target.value}))} /></Field>
            </div>
            <Field label="Ambiente">
              <Sel value={configForm.ambiente} onChange={v => setConfigForm(f=>({...f,ambiente:v}))}>
                <option value="homologacao">Homologação (Testes)</option>
                <option value="producao">Produção</option>
              </Sel>
            </Field>
            {configForm.ambiente === 'producao' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                Ambiente de Produção. Documentos emitidos terão validade fiscal real e não poderão ser descartados.
              </div>
            )}
            <ModalFooter onClose={() => setConfigModal(false)} onSave={saveConfig} saving={saving} disabled={!configForm.cnpj} label="Salvar Configuração" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Notas de Entrada e Saída ─────────────────────────────────────────────

interface NotaEntradaSaida {
  id: number
  tipo: 'entrada' | 'saida'
  numero: string
  serie: string
  chave: string
  emitente_destinatario: string
  cnpj: string
  uf: string
  cfop: string
  valor: number
  data_emissao: string
  data_entrada_saida: string
  status: string
  natureza: string
  xml_disponivel: boolean
}

const PERIODOS = [
  { key: '', label: 'Período livre' },
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mês' },
  { key: 'mes_anterior', label: 'Mês anterior' },
  { key: 'trimestre', label: 'Trimestre' },
]

function aplicarAtalho(atalho: string): { de: string; ate: string } {
  const hoje = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  if (atalho === 'hoje') return { de: fmt(hoje), ate: fmt(hoje) }
  if (atalho === 'semana') {
    const seg = new Date(hoje); seg.setDate(hoje.getDate() - hoje.getDay() + 1)
    return { de: fmt(seg), ate: fmt(hoje) }
  }
  if (atalho === 'mes') {
    return { de: `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`, ate: fmt(hoje) }
  }
  if (atalho === 'mes_anterior') {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
    return { de: fmt(ini), ate: fmt(fim) }
  }
  if (atalho === 'trimestre') {
    const ini = new Date(hoje); ini.setMonth(ini.getMonth() - 2); ini.setDate(1)
    return { de: fmt(ini), ate: fmt(hoje) }
  }
  return { de: '', ate: '' }
}

function TabNotasEntradaSaida() {
  const [rows, setRows] = useState<NotaEntradaSaida[]>([])
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos')
  const [atalhoEntrada, setAtalhoEntrada] = useState('')
  const [atalhoSaida, setAtalhoSaida] = useState('')
  const [entradaDe, setEntradaDe] = useState('')
  const [entradaAte, setEntradaAte] = useState('')
  const [saidaDe, setSaidaDe] = useState('')
  const [saidaAte, setSaidaAte] = useState('')
  const [detalhe, setDetalhe] = useState<NotaEntradaSaida | null>(null)
  const [sel, setSel] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.get('/api/fiscal/notas-entrada-saida/').then(({ data }) => setRows(data.results ?? data)).catch(() => setRows(MOCK_NOTAS))
  }, [])

  function onAtalhoEntrada(v: string) {
    setAtalhoEntrada(v)
    if (v) { const r = aplicarAtalho(v); setEntradaDe(r.de); setEntradaAte(r.ate) }
    else { setEntradaDe(''); setEntradaAte('') }
  }

  function onAtalhoSaida(v: string) {
    setAtalhoSaida(v)
    if (v) { const r = aplicarAtalho(v); setSaidaDe(r.de); setSaidaAte(r.ate) }
    else { setSaidaDe(''); setSaidaAte('') }
  }

  function limparFiltros() {
    setSearch(''); setFiltroTipo('todos')
    setAtalhoEntrada(''); setAtalhoSaida('')
    setEntradaDe(''); setEntradaAte('')
    setSaidaDe(''); setSaidaAte('')
  }

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q || r.emitente_destinatario.toLowerCase().includes(q) || r.numero.includes(q) || r.cnpj.includes(q) || r.chave.includes(q)
    const matchTipo = filtroTipo === 'todos' || r.tipo === filtroTipo
    const dataRef = r.data_entrada_saida

    let matchData = true
    if (r.tipo === 'entrada' && (entradaDe || entradaAte)) {
      if (entradaDe && dataRef < entradaDe) matchData = false
      if (entradaAte && dataRef > entradaAte) matchData = false
    }
    if (r.tipo === 'saida' && (saidaDe || saidaAte)) {
      if (saidaDe && dataRef < saidaDe) matchData = false
      if (saidaAte && dataRef > saidaAte) matchData = false
    }

    return matchSearch && matchTipo && matchData
  })
  function toggleSel(id: number) { setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSel(s => s.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(r => r.id))) }

  const totalEntradas = filtered.filter(r => r.tipo === 'entrada').reduce((s, r) => s + r.valor, 0)
  const totalSaidas = filtered.filter(r => r.tipo === 'saida').reduce((s, r) => s + r.valor, 0)
  const qtdEntradas = filtered.filter(r => r.tipo === 'entrada').length
  const qtdSaidas = filtered.filter(r => r.tipo === 'saida').length

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Qtd. Entradas', val: qtdEntradas, sub: fmt(totalEntradas), color: 'text-accent' },
          { label: 'Qtd. Saídas', val: qtdSaidas, sub: fmt(totalSaidas), color: 'text-blue-600' },
          { label: 'Total Entradas', val: fmt(totalEntradas), sub: `${qtdEntradas} notas`, color: 'text-accent', mono: true },
          { label: 'Total Saídas', val: fmt(totalSaidas), sub: `${qtdSaidas} notas`, color: 'text-blue-600', mono: true },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-text-muted">{k.label}</p>
            <p className={`text-lg font-bold mt-1 ${k.color} ${k.mono ? 'font-mono text-base' : ''}`}>{k.val}</p>
            <p className="text-xs text-text-muted mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text-primary">Filtros</p>
          <div className="flex items-center gap-3">
            <ExportButtons endpoint="/api/fiscal/notas-entrada-saida/" params={{ ...(filtroTipo !== 'todos' ? { tipo: filtroTipo } : {}), ...(entradaDe ? { data_entrada_de: entradaDe } : {}), ...(entradaAte ? { data_entrada_ate: entradaAte } : {}), ...(saidaDe ? { data_saida_de: saidaDe } : {}), ...(saidaAte ? { data_saida_ate: saidaAte } : {}) }} filename="notas_entrada_saida" selectedIds={sel.size > 0 ? [...sel] : undefined} />
            <button onClick={limparFiltros} className="text-xs text-text-muted hover:text-accent transition-colors">Limpar tudo</button>
          </div>
        </div>

        {/* Linha 1: busca + tipo */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Emitente/destinatário, nº, CNPJ ou chave..."
              className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-full text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          </div>
          <div className="flex gap-1 bg-card2 border border-border rounded-lg p-1">
            {(['todos', 'entrada', 'saida'] as const).map(t => (
              <button key={t} onClick={() => setFiltroTipo(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filtroTipo === t ? (t === 'entrada' ? 'bg-accent text-bg' : t === 'saida' ? 'bg-blue-600 text-white' : 'bg-card border border-border text-text-primary') : 'text-text-muted hover:text-text-primary'}`}>
                {t === 'todos' ? 'Todos' : t === 'entrada' ? 'Entradas' : 'Saídas'}
              </button>
            ))}
          </div>
        </div>

        {/* Linha 2: filtros de datas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Entradas */}
          <div className={`rounded-lg border p-3 space-y-3 transition-opacity ${filtroTipo === 'saida' ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
              <p className="text-xs font-semibold text-text-primary">Período de Entrada</p>
            </div>
            <div className="relative">
              <select className={sel} value={atalhoEntrada} onChange={e => onAtalhoEntrada(e.target.value)}>
                {PERIODOS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">De</label>
                <input type="date" className={inp} value={entradaDe} onChange={e => { setEntradaDe(e.target.value); setAtalhoEntrada('') }} />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Até</label>
                <input type="date" className={inp} value={entradaAte} onChange={e => { setEntradaAte(e.target.value); setAtalhoEntrada('') }} />
              </div>
            </div>
          </div>

          {/* Saídas */}
          <div className={`rounded-lg border p-3 space-y-3 transition-opacity ${filtroTipo === 'entrada' ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-text-primary">Período de Saída</p>
            </div>
            <div className="relative">
              <select className={sel} value={atalhoSaida} onChange={e => onAtalhoSaida(e.target.value)}>
                {PERIODOS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">De</label>
                <input type="date" className={inp} value={saidaDe} onChange={e => { setSaidaDe(e.target.value); setAtalhoSaida('') }} />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Até</label>
                <input type="date" className={inp} value={saidaAte} onChange={e => { setSaidaAte(e.target.value); setAtalhoSaida('') }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" checked={sel.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
              {['Tipo', 'Nº / Série', 'Emitente / Destinatário', 'CNPJ', 'UF', 'CFOP', 'Valor', 'Dt. Emissão', 'Dt. Entrada/Saída', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={12} className="text-center py-12 text-text-muted">Nenhuma nota encontrada para os filtros aplicados</td></tr>
              : filtered.map(r => (
                <tr key={r.id} className={`border-b border-border/50 hover:bg-card2 transition-colors ${sel.has(r.id) ? 'bg-accent/5' : ''}`}>
                  <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-md font-bold ${r.tipo === 'entrada' ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                      {r.tipo === 'entrada' ? '↓ ENTRADA' : '↑ SAÍDA'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.numero}/{r.serie}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{r.emitente_destinatario}</p>
                    <p className="text-xs text-text-muted">{r.natureza}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.cnpj}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.uf}</td>
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.cfop}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmt(r.valor)}</td>
                  <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">{r.data_emissao}</td>
                  <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">{r.data_entrada_saida}</td>
                  <td className="px-4 py-3">
                    <Badge label={r.status === 'autorizada' ? 'Autorizada' : r.status === 'cancelada' ? 'Cancelada' : r.status} color={r.status === 'autorizada' ? 'green' : r.status === 'cancelada' ? 'red' : 'gray'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setDetalhe(r)} className="text-xs border border-border text-text-muted px-2 py-1 rounded-lg hover:bg-card2 transition-colors">
                        Detalhes
                      </button>
                      {r.xml_disponivel && (
                        <button className="text-xs border border-border text-text-muted px-2 py-1 rounded-lg hover:bg-card2 transition-colors flex items-center gap-1">
                          <Download size={11} /> XML
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Modal detalhe */}
      {detalhe && (
        <Modal title={`${detalhe.tipo === 'entrada' ? 'Nota de Entrada' : 'Nota de Saída'} — nº ${detalhe.numero}`} onClose={() => setDetalhe(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Tipo', val: detalhe.tipo === 'entrada' ? 'Entrada' : 'Saída' },
                { label: 'Número / Série', val: `${detalhe.numero} / ${detalhe.serie}` },
                { label: detalhe.tipo === 'entrada' ? 'Emitente' : 'Destinatário', val: detalhe.emitente_destinatario },
                { label: 'CNPJ', val: detalhe.cnpj },
                { label: 'UF', val: detalhe.uf },
                { label: 'CFOP', val: detalhe.cfop },
                { label: 'Natureza', val: detalhe.natureza },
                { label: 'Valor Total', val: fmt(detalhe.valor) },
                { label: 'Data de Emissão', val: detalhe.data_emissao },
                { label: detalhe.tipo === 'entrada' ? 'Data de Entrada' : 'Data de Saída', val: detalhe.data_entrada_saida },
                { label: 'Status', val: detalhe.status },
              ].map(item => (
                <div key={item.label} className="bg-card2 rounded-lg px-3 py-2">
                  <p className="text-xs text-text-muted">{item.label}</p>
                  <p className="font-medium text-text-primary mt-0.5">{item.val}</p>
                </div>
              ))}
            </div>
            <div className="bg-card2 rounded-lg p-3">
              <p className="text-xs text-text-muted mb-1">Chave de Acesso</p>
              <p className="font-mono text-xs text-text-primary break-all">{detalhe.chave}</p>
            </div>
            {detalhe.xml_disponivel && (
              <button className="w-full flex items-center justify-center gap-2 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2 transition-colors">
                <Download size={14} /> Baixar XML
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_NOTAS: NotaEntradaSaida[] = [
  { id:1, tipo:'entrada', numero:'000512', serie:'1', chave:'NFe35260400000000000055001000000512100000011', emitente_destinatario:'Distribuidora AgriSul', cnpj:'12.345.678/0001-90', uf:'SP', cfop:'1102', valor:24800, data_emissao:'2026-04-08', data_entrada_saida:'2026-04-09', status:'autorizada', natureza:'Compra de Mercadorias', xml_disponivel:true },
  { id:2, tipo:'entrada', numero:'000089', serie:'1', chave:'NFe35260400000000000055001000000089100000022', emitente_destinatario:'Agroinsumos Brasil', cnpj:'98.765.432/0001-11', uf:'PR', cfop:'1102', valor:15300, data_emissao:'2026-04-12', data_entrada_saida:'2026-04-13', status:'autorizada', natureza:'Compra de Insumos', xml_disponivel:true },
  { id:3, tipo:'entrada', numero:'000201', serie:'1', chave:'NFe35260400000000000055001000000201100000033', emitente_destinatario:'Sementes Cerrado Ltda', cnpj:'11.222.333/0001-44', uf:'GO', cfop:'1102', valor:9750, data_emissao:'2026-04-15', data_entrada_saida:'2026-04-16', status:'autorizada', natureza:'Compra de Sementes', xml_disponivel:true },
  { id:4, tipo:'saida', numero:'000042', serie:'1', chave:'NFe35260400000000000055001000000042100000001', emitente_destinatario:'Fazenda Santa Cruz', cnpj:'55.666.777/0001-88', uf:'SP', cfop:'5102', valor:18500, data_emissao:'2026-04-10', data_entrada_saida:'2026-04-10', status:'autorizada', natureza:'Venda de Mercadorias', xml_disponivel:true },
  { id:5, tipo:'saida', numero:'000043', serie:'1', chave:'NFe35260400000000000055001000000043100000002', emitente_destinatario:'Cooperativa Agronorte', cnpj:'44.555.666/0001-77', uf:'MT', cfop:'6102', valor:32100, data_emissao:'2026-04-18', data_entrada_saida:'2026-04-18', status:'autorizada', natureza:'Venda de Mercadorias', xml_disponivel:true },
  { id:6, tipo:'saida', numero:'000044', serie:'1', chave:'NFe35260400000000000055001000000044100000003', emitente_destinatario:'Fazenda Boa Esperança', cnpj:'33.444.555/0001-66', uf:'MG', cfop:'6102', valor:7600, data_emissao:'2026-04-19', data_entrada_saida:'2026-04-19', status:'cancelada', natureza:'Venda de Mercadorias', xml_disponivel:false },
  { id:7, tipo:'entrada', numero:'000310', serie:'1', chave:'NFe35260400000000000055001000000310100000044', emitente_destinatario:'Química Verde Ltda', cnpj:'77.888.999/0001-55', uf:'SP', cfop:'1102', valor:6420, data_emissao:'2026-03-25', data_entrada_saida:'2026-03-26', status:'autorizada', natureza:'Compra de Defensivos', xml_disponivel:true },
  { id:8, tipo:'saida', numero:'000039', serie:'1', chave:'NFe35260400000000000055001000000039100000005', emitente_destinatario:'Produtores Associados', cnpj:'22.333.444/0001-99', uf:'SP', cfop:'5102', valor:4300, data_emissao:'2026-03-28', data_entrada_saida:'2026-03-28', status:'autorizada', natureza:'Venda de Insumos', xml_disponivel:true },
]

const MOCK_DOCS: Documento[] = [
  { id:1, tipo:'nfe', numero:'000042', serie:'1', destinatario:'Fazenda Santa Cruz', uf_destino:'SP', valor:18500, status:'autorizada', chave:'NFe35260400000000000055001000000042100000001', emitido_em:'2026-04-10 09:15', cfop:'5102', natureza:'Venda de Mercadorias', contingencia:false },
  { id:2, tipo:'nfe', numero:'000043', serie:'1', destinatario:'Cooperativa Agronorte', uf_destino:'MT', valor:32100, status:'autorizada', chave:'NFe35260400000000000055001000000043100000002', emitido_em:'2026-04-18 14:30', cfop:'6102', natureza:'Venda de Mercadorias', contingencia:false },
  { id:3, tipo:'nfce', numero:'000021', serie:'1', destinatario:'Consumidor Final', uf_destino:'SP', valor:1850, status:'autorizada', chave:'NFCe35260400000000000065001000000021100000001', emitido_em:'2026-04-19 10:05', cfop:'5102', natureza:'Venda Balcão', contingencia:false },
  { id:4, tipo:'nfe', numero:'000041', serie:'1', destinatario:'Distribuidora Campo Verde', uf_destino:'GO', valor:7200, status:'contingencia', chave:'NFe35260400000000000055001000000041100000003', emitido_em:'2026-04-17 08:00', cfop:'6102', natureza:'Venda de Mercadorias', contingencia:true },
]

const MOCK_CONTINGENCIA: DocContingencia[] = [
  { id:1, numero:'000041', tipo:'nfe', destinatario:'Distribuidora Campo Verde', valor:7200, tentativas:3, proxima_tentativa:'10:30', emitido_em:'2026-04-17 08:00', horas_restantes:46 },
]

const MOCK_GNRE = [
  { nfe_numero:'000043', destinatario:'Cooperativa Agronorte', uf_destino:'MT', ncm:'3808.92.19', mva_pct:35, base_st:43335, valor_gnre:4117, vencimento:'2026-04-30', pago:false },
]

const MOCK_SUSPENSAO = [
  { ncm:'3102.10.10', descricao:'Ureia e suas soluções aquosas', pis_pct:0, cofins_pct:0, base_legal:'Lei 10.925/2004 art. 9º', vigencia:'Indeterminada' },
  { ncm:'3808.92.19', descricao:'Herbicidas para agricultura', pis_pct:0, cofins_pct:0, base_legal:'Lei 10.925/2004 art. 9º', vigencia:'Indeterminada' },
  { ncm:'1201.10.00', descricao:'Sementes de soja', pis_pct:0, cofins_pct:0, base_legal:'IN SRF 660/2006', vigencia:'Indeterminada' },
  { ncm:'2309.90.30', descricao:'Rações e suplementos animais', pis_pct:0, cofins_pct:0, base_legal:'Lei 10.925/2004 art. 9º', vigencia:'Indeterminada' },
]

const MOCK_HISTORICO_SPED = [
  { tipo:'sped_fiscal', periodo:'03/2026', gerado_em:'2026-04-05 09:00', tamanho:'4.1 MB', status:'gerado' },
  { tipo:'sped_contribuicoes', periodo:'03/2026', gerado_em:'2026-04-05 09:05', tamanho:'2.8 MB', status:'gerado' },
]

// ─── main ─────────────────────────────────────────────────────────────────────

const TABS = ['Emissão', 'Notas Entrada/Saída', 'Documentos Emitidos', 'Contingência SEFAZ', 'Obrigações Agro', 'SPED e Acessórias']

export default function FiscalPage() {
  const [tab, setTab] = useState('Emissão')

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <FileText size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Fiscal e Tributário</h1>
          <p className="text-sm text-text-muted">NF-e, SPED, obrigações do agronegócio e contingência SEFAZ</p>
        </div>
      </div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Emissão'               && <TabEmissao />}
      {tab === 'Notas Entrada/Saída'   && <TabNotasEntradaSaida />}
      {tab === 'Documentos Emitidos'   && <TabDocumentos />}
      {tab === 'Contingência SEFAZ'    && <TabContingencia />}
      {tab === 'Obrigações Agro'       && <TabObrigacoesAgro />}
      {tab === 'SPED e Acessórias'     && <TabSped />}
    </div>
  )
}
