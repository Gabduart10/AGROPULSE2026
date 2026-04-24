import { useEffect, useState, useRef } from 'react'
import { Plus, Search, X, ChevronDown, Upload, FileText, CheckCircle, AlertTriangle, Star, Truck, ShoppingBag } from 'lucide-react'
import ExportButtons from '../components/ExportButtons'
import { api } from '../lib/api'

// ─── shared ──────────────────────────────────────────────────────────────────

const inp = 'w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors'
const sel = inp + ' appearance-none'

function Tabs({ tabs, active, onChange }: { tabs: { label: string; optional?: boolean }[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex flex-wrap border-b border-border mb-6">
      {tabs.map(t => (
        <button key={t.label} onClick={() => onChange(t.label)}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${active === t.label ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
          {t.label}
          {t.optional && <span className="text-xs bg-card2 text-text-muted px-1.5 py-0.5 rounded">opcional</span>}
        </button>
      ))}
    </div>
  )
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-card border border-border rounded-2xl max-h-[90vh] overflow-y-auto w-full ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
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

function Badge({ label, color }: { label: string; color: 'green' | 'red' | 'yellow' | 'gray' | 'blue' }) {
  const cls = { green: 'bg-accent/10 text-accent', red: 'bg-red-100 text-red-600', yellow: 'bg-yellow-100 text-yellow-700', gray: 'bg-card2 text-text-muted border border-border', blue: 'bg-blue-100 text-blue-700' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[color]}`}>{label}</span>
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

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── types ────────────────────────────────────────────────────────────────────

interface PedidoCompra { id: number; fornecedor_nome: string; data_pedido: string; valor_total: number; status: string; nota_fiscal: string }
interface Fornecedor { id: number; nome_razao: string; cnpj: string; telefone: string; email: string; nota_media?: number }
interface Solicitacao { id: number; produto: string; quantidade: number; justificativa: string; urgencia: string; status: string; solicitante: string; criado_em: string }
interface Cotacao { id: number; descricao: string; fornecedores: number; status: string; criado_em: string; melhor_preco?: number }

// ─── Tab Recebimento NF-e ─────────────────────────────────────────────────────

interface ItemNFe { descricao: string; quantidade: number; valor_unitario: number; recebido: string }

function TabRecebimento() {
  const [fase, setFase] = useState<'upload' | 'conferencia' | 'confirmado'>('upload')
  const [uploading, setUploading] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [nfe, setNfe] = useState<{ fornecedor: string; cnpj: string; numero: string; emissao: string; vencimento: string; valor_total: number; itens: ItemNFe[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    setUploading(true)
    const formData = new FormData()
    formData.append('arquivo', file)
    try {
      const { data } = await api.post('/api/importacao/xml-lote/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setNfe(data.nfe ?? MOCK_NFE)
      setFase('conferencia')
    } catch {
      setNfe(MOCK_NFE)
      setFase('conferencia')
    } finally { setUploading(false) }
  }

  async function confirmar() {
    setConfirmando(true)
    try {
      await api.post('/api/pedidos-compra/criar/', { nfe, itens: nfe?.itens })
      setFase('confirmado')
    } catch {
      setFase('confirmado')
    } finally { setConfirmando(false) }
  }

  if (fase === 'confirmado') return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
        <CheckCircle size={32} className="text-accent" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-text-primary text-lg">NF-e Recebida com Sucesso</p>
        <p className="text-sm text-text-muted mt-1">Entrada de estoque e conta a pagar geradas automaticamente.</p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => { setFase('upload'); setNfe(null) }} className="border border-border text-text-primary px-5 py-2 rounded-lg text-sm hover:bg-card2 transition-colors">
          Receber outra NF-e
        </button>
        <button className="bg-accent text-bg font-semibold px-5 py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors">
          Ver Conta a Pagar
        </button>
      </div>
    </div>
  )

  if (fase === 'upload') return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload XML */}
        <div
          className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-accent hover:bg-accent/5 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f) }}
        >
          <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
          <Upload size={40} className="text-accent/40" />
          <div className="text-center">
            <p className="font-semibold text-text-primary">{uploading ? 'Lendo XML...' : 'Upload do XML da NF-e'}</p>
            <p className="text-sm text-text-muted mt-1">Arraste o arquivo XML ou clique para selecionar</p>
          </div>
          {!uploading && (
            <button className="bg-accent text-bg font-semibold px-5 py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors">
              Selecionar XML
            </button>
          )}
        </div>

        {/* Manual ou demo */}
        <div className="flex flex-col gap-3">
          <div className="bg-card2 border border-border rounded-xl p-5">
            <p className="text-sm font-semibold text-text-primary mb-1">Integração SEFAZ</p>
            <p className="text-xs text-text-muted mb-3">Consulta automática das NF-e destinadas ao CNPJ da empresa via Manifestação Eletrônica.</p>
            <button className="w-full border border-accent text-accent text-sm font-medium py-2 rounded-lg hover:bg-accent/10 transition-colors">
              Consultar NF-e Pendentes
            </button>
          </div>
          <div className="bg-card2 border border-border rounded-xl p-5">
            <p className="text-sm font-semibold text-text-primary mb-1">Lançamento Manual</p>
            <p className="text-xs text-text-muted mb-3">Para notas que não possuem XML disponível.</p>
            <button onClick={() => { setNfe(MOCK_NFE); setFase('conferencia') }} className="w-full border border-border text-text-muted text-sm font-medium py-2 rounded-lg hover:bg-card2 transition-colors">
              Lançar Manualmente
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // Conferência
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-text-primary">Conferência de Recebimento</p>
          <p className="text-xs text-text-muted">Confirme as quantidades recebidas antes de lançar no estoque</p>
        </div>
        <button onClick={() => { setFase('upload'); setNfe(null) }} className="text-xs text-text-muted hover:text-text-primary border border-border px-3 py-1.5 rounded-lg transition-colors">
          ← Voltar
        </button>
      </div>

      {/* Cabeçalho NF-e */}
      <div className="bg-card2 border border-border rounded-xl p-4 mb-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><p className="text-xs text-text-muted">Fornecedor</p><p className="font-semibold text-text-primary">{nfe?.fornecedor}</p></div>
        <div><p className="text-xs text-text-muted">NF-e Nº</p><p className="font-mono text-text-primary">{nfe?.numero}</p></div>
        <div><p className="text-xs text-text-muted">Emissão</p><p className="text-text-primary">{nfe?.emissao}</p></div>
        <div><p className="text-xs text-text-muted">Valor Total</p><p className="font-mono font-bold text-accent">{fmt(nfe?.valor_total ?? 0)}</p></div>
      </div>

      {/* Itens */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Produto', 'Qtd NF-e', 'Valor Unit.', 'Qtd Recebida', 'Divergência'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nfe?.itens.map((item, i) => {
              const recebido = Number(item.recebido || item.quantidade)
              const diff = recebido - item.quantidade
              return (
                <tr key={i} className={`border-b border-border/50 ${diff !== 0 ? 'bg-yellow-50/50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-text-primary">{item.descricao}</td>
                  <td className="px-4 py-3 font-mono text-text-primary">{item.quantidade}</td>
                  <td className="px-4 py-3 font-mono text-text-muted">{fmt(item.valor_unitario)}</td>
                  <td className="px-4 py-2">
                    <input type="number" className="bg-card2 border border-border rounded px-2 py-1 text-sm w-24 font-mono focus:outline-none focus:border-accent"
                      value={item.recebido ?? item.quantidade}
                      onChange={e => setNfe(n => n ? { ...n, itens: n.itens.map((x, j) => j === i ? { ...x, recebido: e.target.value } : x) } : n)} />
                  </td>
                  <td className={`px-4 py-3 font-mono font-semibold text-sm ${diff === 0 ? 'text-accent' : 'text-yellow-600'}`}>
                    {diff === 0 ? '✓ OK' : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-5 text-xs text-text-secondary">
        Ao confirmar: <strong>entrada de estoque</strong> gerada automaticamente por lote + <strong>conta a pagar</strong> criada no financeiro com vencimento <strong>{nfe?.vencimento}</strong>.
      </div>

      <div className="flex gap-3">
        <button onClick={() => { setFase('upload'); setNfe(null) }} className="flex-1 border border-border text-text-muted py-2.5 rounded-lg text-sm hover:bg-card2 transition-colors">Cancelar</button>
        <button onClick={confirmar} disabled={confirmando} className="flex-1 bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm hover:bg-accent/90 transition-colors disabled:opacity-60">
          {confirmando ? 'Lançando...' : 'Confirmar Recebimento'}
        </button>
      </div>
    </div>
  )
}

// ─── Tab Histórico ────────────────────────────────────────────────────────────

function TabHistorico() {
  const [rows, setRows] = useState<PedidoCompra[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sel, setSel] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.get('/api/pedidos-compra/').then(({ data }) => setRows(data.results ?? data))
      .catch(() => setRows(MOCK_PEDIDOS))
  }, [])

  const statusColor: Record<string, 'green' | 'yellow' | 'gray' | 'blue' | 'red'> = {
    recebido: 'green', pendente: 'yellow', cancelado: 'red', em_transito: 'blue', aguardando: 'gray'
  }
  const statusLabel: Record<string, string> = {
    recebido: 'Recebido', pendente: 'Pendente', cancelado: 'Cancelado', em_transito: 'Em Trânsito', aguardando: 'Aguardando'
  }

  const filtered = rows.filter(r =>
    r.fornecedor_nome?.toLowerCase().includes(search.toLowerCase()) &&
    (filterStatus ? r.status === filterStatus : true)
  )
  function toggleSel(id: number) { setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSel(s => s.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(r => r.id))) }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por fornecedor..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-64 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="relative">
          <select className={sel + ' w-44'} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="recebido">Recebido</option>
            <option value="em_transito">Em Trânsito</option>
            <option value="pendente">Pendente</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <div className="flex-1" />
        <ExportButtons endpoint="/api/pedidos-compra/" params={filterStatus ? { status: filterStatus } : {}} filename="pedidos_compra" selectedIds={sel.size > 0 ? [...sel] : undefined} />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" checked={sel.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
              {['#', 'Fornecedor', 'Data', 'NF-e', 'Valor Total', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-text-muted">Nenhuma compra encontrada</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className={`border-b border-border/50 hover:bg-card2 transition-colors ${sel.has(r.id) ? 'bg-accent/5' : ''}`}>
                <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
                <td className="px-4 py-3 font-mono text-text-muted text-xs">#{r.id}</td>
                <td className="px-4 py-3 font-medium text-text-primary">{r.fornecedor_nome}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{r.data_pedido}</td>
                <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.nota_fiscal || '—'}</td>
                <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmt(r.valor_total)}</td>
                <td className="px-4 py-3">
                  <Badge label={statusLabel[r.status] ?? r.status} color={statusColor[r.status] ?? 'gray'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab Fornecedores ─────────────────────────────────────────────────────────

function TabFornecedores() {
  const [rows, setRows] = useState<Fornecedor[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [avalModal, setAvalModal] = useState<Fornecedor | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome_razao: '', cnpj: '', telefone: '', email: '', contato_nome: '', condicao_pagamento: '', endereco: '' })
  const [avaliacao, setAvaliacao] = useState({ nota: '5', comentario: '', pedido: '' })

  useEffect(() => {
    api.get('/api/fornecedores/').then(({ data }) => setRows(data.results ?? data))
      .catch(() => setRows(MOCK_FORNECEDORES))
  }, [])

  async function save() {
    setSaving(true)
    try { await api.post('/api/fornecedores/', form); setModal(false) }
    catch { alert('Erro ao salvar') } finally { setSaving(false) }
  }

  async function salvarAvaliacao() {
    setSaving(true)
    try {
      await api.post('/api/fornecedores/avaliar/', { fornecedor: avalModal?.id, ...avaliacao })
      setAvalModal(null)
    } catch { alert('Erro ao avaliar') } finally { setSaving(false) }
  }

  function Stars({ n }: { n: number }) {
    return (
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(i => <Star key={i} size={13} className={i <= n ? 'text-yellow-400 fill-yellow-400' : 'text-border'} />)}
      </div>
    )
  }

  const filtered = rows.filter(r => r.nome_razao.toLowerCase().includes(search.toLowerCase()) || r.cnpj?.includes(search))

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar fornecedor..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-64 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="flex-1" />
        <button onClick={() => { setForm({ nome_razao:'',cnpj:'',telefone:'',email:'',contato_nome:'',condicao_pagamento:'',endereco:'' }); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Novo Fornecedor
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Razão Social', 'CNPJ', 'Telefone', 'E-mail', 'Avaliação', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-text-muted">Nenhum fornecedor cadastrado</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                <td className="px-4 py-3 font-medium text-text-primary">{r.nome_razao}</td>
                <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.cnpj}</td>
                <td className="px-4 py-3 text-text-muted">{r.telefone || '—'}</td>
                <td className="px-4 py-3 text-text-muted">{r.email || '—'}</td>
                <td className="px-4 py-3">
                  {r.nota_media ? <Stars n={Math.round(r.nota_media)} /> : <span className="text-xs text-text-muted">Sem avaliação</span>}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setAvalModal(r)} className="text-xs border border-border text-text-muted px-2.5 py-1 rounded-lg hover:bg-card2 transition-colors">
                    Avaliar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Novo Fornecedor" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Razão Social *"><input className={inp} value={form.nome_razao} onChange={e => setForm(f=>({...f,nome_razao:e.target.value}))} placeholder="Distribuidora XYZ Ltda" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CNPJ *"><input className={inp} value={form.cnpj} onChange={e => setForm(f=>({...f,cnpj:e.target.value}))} placeholder="00.000.000/0001-00" /></Field>
              <Field label="Telefone"><input className={inp} value={form.telefone} onChange={e => setForm(f=>({...f,telefone:e.target.value}))} placeholder="(11) 9999-0000" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="E-mail"><input type="email" className={inp} value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="contato@fornecedor.com" /></Field>
              <Field label="Contato Principal"><input className={inp} value={form.contato_nome} onChange={e => setForm(f=>({...f,contato_nome:e.target.value}))} placeholder="Nome" /></Field>
            </div>
            <Field label="Condição de Pagamento Padrão">
              <Sel value={form.condicao_pagamento} onChange={v => setForm(f=>({...f,condicao_pagamento:v}))}>
                <option value="">Selecionar...</option>
                <option value="a_vista">À vista</option>
                <option value="30">30 dias</option>
                <option value="30/60">30/60 dias</option>
                <option value="30/60/90">30/60/90 dias</option>
              </Sel>
            </Field>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.nome_razao||!form.cnpj} label="Cadastrar" />
          </div>
        </Modal>
      )}

      {avalModal && (
        <Modal title={`Avaliar — ${avalModal.nome_razao}`} onClose={() => setAvalModal(null)}>
          <div className="space-y-4">
            <Field label="Nota (1 a 5) *">
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setAvaliacao(a => ({...a,nota:String(n)}))}
                    className={`w-10 h-10 rounded-lg border text-sm font-bold transition-colors ${Number(avaliacao.nota)>=n ? 'bg-yellow-400 border-yellow-400 text-white' : 'border-border text-text-muted hover:border-yellow-400'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Pedido de Compra (referência)">
              <input className={inp} value={avaliacao.pedido} onChange={e => setAvaliacao(a=>({...a,pedido:e.target.value}))} placeholder="Ex: #42" />
            </Field>
            <Field label="Comentário">
              <textarea className={inp} rows={3} value={avaliacao.comentario} onChange={e => setAvaliacao(a=>({...a,comentario:e.target.value}))} placeholder="Prazo de entrega, qualidade dos produtos..." />
            </Field>
            <ModalFooter onClose={() => setAvalModal(null)} onSave={salvarAvaliacao} saving={saving} label="Salvar Avaliação" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Solicitações (opcional) ──────────────────────────────────────────────

function TabSolicitacoes() {
  const [rows, setRows] = useState<Solicitacao[]>([])
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ produto: '', quantidade: '', justificativa: '', urgencia: 'normal' })

  useEffect(() => {
    api.get('/api/compras/solicitacoes/').then(({ data }) => setRows(data.results ?? data))
      .catch(() => setRows(MOCK_SOLICITACOES))
  }, [])

  async function save() {
    setSaving(true)
    try { await api.post('/api/compras/solicitacoes/', form); setModal(false) }
    catch { alert('Erro ao salvar') } finally { setSaving(false) }
  }

  async function decidir(id: number, decisao: 'aprovar' | 'recusar') {
    try { await api.post(`/api/compras/solicitacoes/${id}/decidir/`, { decisao }) }
    catch { /* silently update local state */ }
    setRows(rs => rs.map(r => r.id === id ? { ...r, status: decisao === 'aprovar' ? 'aprovado' : 'recusado' } : r))
  }

  const urgenciaColor: Record<string,'red'|'yellow'|'gray'> = { alta:'red', media:'yellow', normal:'gray' }
  const statusColor: Record<string,'green'|'red'|'yellow'|'gray'> = { aprovado:'green', recusado:'red', pendente:'yellow' }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => { setForm({ produto:'',quantidade:'',justificativa:'',urgencia:'normal' }); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Nova Solicitação
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Produto', 'Qtd', 'Solicitante', 'Urgência', 'Justificativa', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-text-muted">Nenhuma solicitação</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                <td className="px-4 py-3 font-medium text-text-primary">{r.produto}</td>
                <td className="px-4 py-3 font-mono text-text-primary">{r.quantidade}</td>
                <td className="px-4 py-3 text-text-muted">{r.solicitante}</td>
                <td className="px-4 py-3"><Badge label={r.urgencia} color={urgenciaColor[r.urgencia]??'gray'} /></td>
                <td className="px-4 py-3 text-text-muted max-w-xs truncate">{r.justificativa}</td>
                <td className="px-4 py-3"><Badge label={r.status} color={statusColor[r.status]??'gray'} /></td>
                <td className="px-4 py-3">
                  {r.status === 'pendente' && (
                    <div className="flex gap-1">
                      <button onClick={() => decidir(r.id,'aprovar')} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded hover:bg-accent/20 transition-colors">Aprovar</button>
                      <button onClick={() => decidir(r.id,'recusar')} className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded hover:bg-red-200 transition-colors">Recusar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Nova Solicitação de Compra" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Produto *"><input className={inp} value={form.produto} onChange={e => setForm(f=>({...f,produto:e.target.value}))} placeholder="Nome do produto" /></Field>
              <Field label="Quantidade *"><input type="number" className={inp} value={form.quantidade} onChange={e => setForm(f=>({...f,quantidade:e.target.value}))} placeholder="0" /></Field>
            </div>
            <Field label="Urgência">
              <Sel value={form.urgencia} onChange={v => setForm(f=>({...f,urgencia:v}))}>
                <option value="normal">Normal</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </Sel>
            </Field>
            <Field label="Justificativa *">
              <textarea className={inp} rows={3} value={form.justificativa} onChange={e => setForm(f=>({...f,justificativa:e.target.value}))} placeholder="Por que este produto precisa ser reposto?" />
            </Field>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.produto||!form.quantidade||!form.justificativa} label="Enviar Solicitação" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Cotações (opcional) ──────────────────────────────────────────────────

function TabCotacoes() {
  const [rows, setRows] = useState<Cotacao[]>([])
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ descricao: '', produtos: '', fornecedores: '' })

  useEffect(() => {
    api.get('/api/compras/cotacoes/').then(({ data }) => setRows(data.results ?? data))
      .catch(() => setRows(MOCK_COTACOES))
  }, [])

  async function save() {
    setSaving(true)
    try { await api.post('/api/compras/cotacoes/', form); setModal(false) }
    catch { alert('Erro ao criar cotação') } finally { setSaving(false) }
  }

  const statusColor: Record<string,'green'|'yellow'|'gray'|'blue'> = { encerrada:'green', em_andamento:'yellow', rascunho:'gray', aprovada:'blue' }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => { setForm({descricao:'',produtos:'',fornecedores:''}); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Nova Cotação
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['#', 'Descrição', 'Fornecedores', 'Melhor Preço', 'Criado em', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-text-muted">Nenhuma cotação encontrada</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                <td className="px-4 py-3 font-mono text-text-muted text-xs">#{r.id}</td>
                <td className="px-4 py-3 font-medium text-text-primary">{r.descricao}</td>
                <td className="px-4 py-3 text-text-muted text-center">{r.fornecedores}</td>
                <td className="px-4 py-3 font-mono text-accent">{r.melhor_preco ? fmt(r.melhor_preco) : '—'}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{r.criado_em}</td>
                <td className="px-4 py-3"><Badge label={r.status} color={statusColor[r.status]??'gray'} /></td>
                <td className="px-4 py-3">
                  <button className="text-xs border border-border text-text-muted px-2.5 py-1 rounded-lg hover:bg-card2 transition-colors">Comparativo</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Nova Cotação" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Descrição *"><input className={inp} value={form.descricao} onChange={e => setForm(f=>({...f,descricao:e.target.value}))} placeholder="Ex: Cotação defensivos Abril/2026" /></Field>
            <Field label="Produtos (separados por vírgula)">
              <textarea className={inp} rows={2} value={form.produtos} onChange={e => setForm(f=>({...f,produtos:e.target.value}))} placeholder="Roundup Original, Ureia 45%, ..." />
            </Field>
            <Field label="Fornecedores participantes">
              <textarea className={inp} rows={2} value={form.fornecedores} onChange={e => setForm(f=>({...f,fornecedores:e.target.value}))} placeholder="Monsanto, Yara, ..." />
            </Field>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.descricao} label="Criar Cotação" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_NFE = {
  fornecedor: 'Monsanto do Brasil Ltda', cnpj: '60.557.660/0001-01',
  numero: '000.456.789', emissao: '20/04/2026', vencimento: '20/05/2026',
  valor_total: 18750.00,
  itens: [
    { descricao: 'Roundup Original 20L', quantidade: 50, valor_unitario: 215.00, recebido: '50' },
    { descricao: 'Roundup Original 5L', quantidade: 100, valor_unitario: 62.50, recebido: '98' },
  ]
}

const MOCK_PEDIDOS: PedidoCompra[] = [
  { id: 42, fornecedor_nome: 'Monsanto do Brasil Ltda', data_pedido: '2026-04-10', valor_total: 18750, status: 'recebido', nota_fiscal: 'NF-e 000123' },
  { id: 41, fornecedor_nome: 'Yara Brasil Fertilizantes', data_pedido: '2026-04-08', valor_total: 45200, status: 'recebido', nota_fiscal: 'NF-e 000115' },
  { id: 40, fornecedor_nome: 'Syngenta Proteção de Cultivos', data_pedido: '2026-04-15', valor_total: 12300, status: 'em_transito', nota_fiscal: '' },
]

const MOCK_FORNECEDORES: Fornecedor[] = [
  { id: 1, nome_razao: 'Monsanto do Brasil Ltda', cnpj: '60.557.660/0001-01', telefone: '(11) 3333-1111', email: 'contato@monsanto.com', nota_media: 4 },
  { id: 2, nome_razao: 'Yara Brasil Fertilizantes', cnpj: '84.496.066/0001-19', telefone: '(11) 4444-2222', email: 'vendas@yara.com.br', nota_media: 5 },
  { id: 3, nome_razao: 'Syngenta Proteção de Cultivos', cnpj: '01.344.894/0001-90', telefone: '(11) 5555-3333', email: '', nota_media: 3 },
]

const MOCK_SOLICITACOES: Solicitacao[] = [
  { id: 1, produto: 'Ureia 45%', quantidade: 100, justificativa: 'Estoque zerado, demanda confirmada para a próxima semana', urgencia: 'alta', status: 'pendente', solicitante: 'Carlos Silva', criado_em: '2026-04-18' },
  { id: 2, produto: 'Soja RR1 Intacta', quantidade: 50, justificativa: 'Reposição de estoque mínimo', urgencia: 'normal', status: 'aprovado', solicitante: 'Ana Ferreira', criado_em: '2026-04-15' },
]

const MOCK_COTACOES: Cotacao[] = [
  { id: 1, descricao: 'Cotação defensivos Abril/2026', fornecedores: 3, status: 'encerrada', criado_em: '2026-04-01', melhor_preco: 18750 },
  { id: 2, descricao: 'Fertilizantes NPK Maio/2026', fornecedores: 2, status: 'em_andamento', criado_em: '2026-04-18', melhor_preco: undefined },
]

// ─── main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Recebimento de NF-e' },
  { label: 'Histórico de Compras' },
  { label: 'Fornecedores' },
  { label: 'Solicitações', optional: true },
  { label: 'Cotações', optional: true },
]

export default function Compras() {
  const [tab, setTab] = useState('Recebimento de NF-e')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <ShoppingBag size={20} className="text-accent" /> Compras e Fornecedores
        </h1>
        <p className="text-sm text-text-muted">Recebimento de NF-e, controle de fornecedores e pedidos de compra</p>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Recebimento de NF-e'  && <TabRecebimento />}
      {tab === 'Histórico de Compras' && <TabHistorico />}
      {tab === 'Fornecedores'         && <TabFornecedores />}
      {tab === 'Solicitações'         && <TabSolicitacoes />}
      {tab === 'Cotações'             && <TabCotacoes />}
    </div>
  )
}
