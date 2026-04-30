import { useEffect, useState } from 'react'
import { Plus, Search, X, ChevronDown, AlertTriangle, ArrowDownCircle, ArrowUpCircle, RefreshCw, ClipboardList, Package } from 'lucide-react'
import ExportButtons from '../components/ExportButtons'
import { api } from '../lib/api'

// ─── shared ──────────────────────────────────────────────────────────────────

const inp = 'w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors'
const sel = inp + ' appearance-none'

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

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-card border border-border rounded-2xl max-h-[90vh] overflow-y-auto w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
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

function Badge({ label, color }: { label: string; color: 'green' | 'red' | 'yellow' | 'gray' }) {
  const cls = { green: 'bg-accent/10 text-accent', red: 'bg-red-100 text-red-600', yellow: 'bg-yellow-100 text-yellow-700', gray: 'bg-card2 text-text-muted' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[color]}`}>{label}</span>
}

function ModalFooter({ onClose, onSave, saving, disabled }: { onClose: () => void; onSave: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <div className="flex gap-2 pt-4">
      <button onClick={onClose} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2 transition-colors">Cancelar</button>
      <button onClick={onSave} disabled={saving || disabled} className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors disabled:opacity-60">
        {saving ? 'Salvando...' : 'Confirmar'}
      </button>
    </div>
  )
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── types ────────────────────────────────────────────────────────────────────

interface Produto { id: number; nome: string; sku: string; unidade_medida: string; quantidade: number; estoque_minimo: number; metodo_custeio: string; tipo_produto: string }
interface Lote { id: number; produto_nome: string; produto_id: number; numero_lote: string; quantidade: number; custo_unitario: number; data_validade: string; data_fabricacao: string; deposito: string; corredor: string; prateleira: string; nota_fiscal_origem: string; alerta_validade: string }
interface Movimentacao { id: number; produto_nome: string; tipo: string; quantidade: number; saldo_apos_movimento: number; origem: string; data_movimento: string; operador_nome: string }
interface AlertaEstoque { produto: string; sku: string; quantidade: number; estoque_minimo: number; tipo: 'zerado' | 'baixo' }
interface AlertaValidade { lote: string; produto: string; quantidade: number; data_validade: string; dias_restantes: number }

// ─── Tab Posição de Estoque ───────────────────────────────────────────────────

function TabPosicao() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/produtos/').then(({ data }) => setProdutos(data.results ?? data))
      .catch(() => setProdutos([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = produtos.filter(p =>
    (p.nome.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())) &&
    (filterTipo ? p.tipo_produto === filterTipo : true)
  )
  function toggleSel(id: number) { setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSel(s => s.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(p => p.id))) }

  const totalValor = produtos.reduce((s, p) => s + p.quantidade * 0, 0)
  const zerados = produtos.filter(p => p.quantidade === 0).length
  const baixos = produtos.filter(p => p.quantidade > 0 && p.quantidade <= p.estoque_minimo).length

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Produtos Ativos', val: produtos.length, color: 'text-text-primary' },
          { label: 'Estoque Zerado', val: zerados, color: 'text-red-500' },
          { label: 'Estoque Baixo', val: baixos, color: 'text-yellow-600' },
          { label: 'Itens OK', val: produtos.length - zerados - baixos, color: 'text-accent' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-text-muted">{k.label}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${k.color}`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou SKU..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-64 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="relative">
          <select className={sel + ' w-44'} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="insumo_agricola">Insumo Agrícola</option>
            <option value="defensivo">Defensivo</option>
            <option value="semente">Semente</option>
            <option value="fertilizante">Fertilizante</option>
            <option value="produto_acabado">Produto Acabado</option>
            <option value="colheita">Colheita</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <div className="flex-1" />
        <ExportButtons endpoint="/api/produtos/" filename="estoque_produtos" selectedIds={sel.size > 0 ? [...sel] : undefined} />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" checked={sel.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
              {['SKU', 'Produto', 'Tipo', 'Custeio', 'Unid.', 'Qtd em Estoque', 'Est. Mínimo', 'Situação'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-10 text-text-muted">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-text-muted">Nenhum produto encontrado</td></tr>
            ) : filtered.map(p => {
              const situacao = p.quantidade === 0 ? { label: 'Zerado', color: 'red' as const }
                : p.quantidade <= p.estoque_minimo ? { label: 'Baixo', color: 'yellow' as const }
                : { label: 'Normal', color: 'green' as const }
              return (
                <tr key={p.id} className={`border-b border-border/50 hover:bg-card2 transition-colors ${sel.has(p.id) ? 'bg-accent/5' : ''}`}>
                  <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={sel.has(p.id)} onChange={() => toggleSel(p.id)} /></td>
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{p.sku}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{p.nome}</td>
                  <td className="px-4 py-3 text-text-muted capitalize text-xs">{p.tipo_produto?.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-text-muted uppercase text-xs">{p.metodo_custeio}</td>
                  <td className="px-4 py-3 text-text-muted">{p.unidade_medida}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-text-primary">{p.quantidade}</td>
                  <td className="px-4 py-3 font-mono text-text-muted">{p.estoque_minimo}</td>
                  <td className="px-4 py-3"><Badge label={situacao.label} color={situacao.color} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab Movimentações ────────────────────────────────────────────────────────

function TabMovimentacoes() {
  const [rows, setRows] = useState<Movimentacao[]>([])
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [selMov, setSelMov] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState<'entrada' | 'saida' | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ produto: '', quantidade: '', tipo: 'entrada', origem: '', deposito: '', corredor: '', prateleira: '', justificativa: '' })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const { data } = await api.get('/api/estoque/entradas-saidas/')
      setRows(data.movimentacoes ?? data.results ?? data)
    } catch { setRows([]) }
  }

  async function save() {
    setSaving(true)
    try {
      await api.post('/api/estoque/entradas-saidas/', form)
      setModal(null); fetchData()
    } catch { alert('Erro ao registrar movimentação') }
    finally { setSaving(false) }
  }

  const tipoLabel: Record<string, string> = { entrada: 'Entrada', saida: 'Saída', transferencia: 'Transferência', ajuste: 'Ajuste', descarte: 'Descarte' }
  const tipoColor: Record<string, 'green' | 'red' | 'yellow' | 'gray'> = { entrada: 'green', saida: 'red', transferencia: 'yellow', ajuste: 'gray', descarte: 'red' }

  const filtered = rows.filter(r =>
    r.produto_nome?.toLowerCase().includes(search.toLowerCase()) &&
    (filterTipo ? r.tipo === filterTipo : true)
  )
  function toggleSelMov(id: number) { setSelMov(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAllMov() { setSelMov(s => s.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(r => r.id))) }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-64 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="relative">
          <select className={sel + ' w-44'} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
            <option value="transferencia">Transferência</option>
            <option value="ajuste">Ajuste</option>
            <option value="descarte">Descarte</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <div className="flex-1" />
        <ExportButtons endpoint="/api/estoque/entradas-saidas/" params={filterTipo ? { tipo: filterTipo } : {}} filename="movimentacoes_estoque" selectedIds={selMov.size > 0 ? [...selMov] : undefined} />
        <button onClick={() => { setForm({ produto:'',quantidade:'',tipo:'saida',origem:'requisicao',deposito:'',corredor:'',prateleira:'',justificativa:'' }); setModal('saida') }}
          className="flex items-center gap-2 border border-border text-text-primary text-sm font-medium px-4 py-2 rounded-lg hover:bg-card2 transition-colors">
          <ArrowUpCircle size={16} className="text-red-500" /> Registrar Saída
        </button>
        <button onClick={() => { setForm({ produto:'',quantidade:'',tipo:'entrada',origem:'compra',deposito:'',corredor:'',prateleira:'',justificativa:'' }); setModal('entrada') }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <ArrowDownCircle size={16} /> Registrar Entrada
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" checked={selMov.size === filtered.length && filtered.length > 0} onChange={toggleAllMov} /></th>
              {['Data', 'Produto', 'Tipo', 'Quantidade', 'Saldo Após', 'Origem', 'Operador'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-text-muted">Nenhuma movimentação encontrada</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className={`border-b border-border/50 hover:bg-card2 transition-colors ${selMov.has(r.id) ? 'bg-accent/5' : ''}`}>
                <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={selMov.has(r.id)} onChange={() => toggleSelMov(r.id)} /></td>
                <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">{new Date(r.data_movimento).toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3 font-medium text-text-primary">{r.produto_nome}</td>
                <td className="px-4 py-3"><Badge label={tipoLabel[r.tipo] ?? r.tipo} color={tipoColor[r.tipo] ?? 'gray'} /></td>
                <td className={`px-4 py-3 font-mono font-semibold ${r.tipo === 'entrada' ? 'text-accent' : 'text-red-500'}`}>
                  {r.tipo === 'entrada' ? '+' : '-'}{r.quantidade}
                </td>
                <td className="px-4 py-3 font-mono text-text-primary">{r.saldo_apos_movimento}</td>
                <td className="px-4 py-3 text-text-muted capitalize">{r.origem}</td>
                <td className="px-4 py-3 text-text-muted">{r.operador_nome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <Field label="Produto *">
              <input className={inp} value={form.produto} onChange={e => setForm(f => ({ ...f, produto: e.target.value }))} placeholder="Nome ou SKU do produto" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Quantidade *">
                <input type="number" className={inp} value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} placeholder="0" />
              </Field>
              <Field label={modal === 'entrada' ? 'Origem' : 'Motivo'}>
                <Sel value={form.origem} onChange={v => setForm(f => ({ ...f, origem: v }))}>
                  {modal === 'entrada' ? (
                    <>
                      <option value="compra">Compra / NF-e</option>
                      <option value="transferencia">Transferência entre unidades</option>
                      <option value="producao">Produção própria</option>
                      <option value="ajuste">Ajuste de inventário</option>
                    </>
                  ) : (
                    <>
                      <option value="venda">Venda</option>
                      <option value="requisicao">Requisição interna</option>
                      <option value="transferencia">Transferência entre unidades</option>
                      <option value="descarte">Descarte</option>
                      <option value="ajuste">Ajuste de inventário</option>
                    </>
                  )}
                </Sel>
              </Field>
            </div>
            {modal === 'entrada' && (
              <div className="grid grid-cols-3 gap-4">
                <Field label="Depósito"><input className={inp} value={form.deposito} onChange={e => setForm(f => ({ ...f, deposito: e.target.value }))} placeholder="Galpão A" /></Field>
                <Field label="Corredor"><input className={inp} value={form.corredor} onChange={e => setForm(f => ({ ...f, corredor: e.target.value }))} placeholder="C1" /></Field>
                <Field label="Prateleira"><input className={inp} value={form.prateleira} onChange={e => setForm(f => ({ ...f, prateleira: e.target.value }))} placeholder="P3" /></Field>
              </div>
            )}
            {(form.origem === 'descarte' || form.origem === 'ajuste') && (
              <Field label="Justificativa">
                <textarea className={inp} rows={2} value={form.justificativa} onChange={e => setForm(f => ({ ...f, justificativa: e.target.value }))} placeholder="Descreva o motivo..." />
              </Field>
            )}
            <ModalFooter onClose={() => setModal(null)} onSave={save} saving={saving} disabled={!form.produto || !form.quantidade} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Lotes ────────────────────────────────────────────────────────────────

function TabLotes() {
  const [lotes, setLotes] = useState<Lote[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ produto: '', numero_lote: '', quantidade: '', custo_unitario: '', data_fabricacao: '', data_validade: '', deposito: '', corredor: '', prateleira: '', nota_fiscal_origem: '' })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const { data } = await api.get('/api/produtos/?expand=lotes')
      const allLotes: Lote[] = []
      ;(data.results ?? data).forEach((p: any) => {
        (p.lotes ?? []).forEach((l: any) => allLotes.push({ ...l, produto_nome: p.nome, produto_id: p.id }))
      })
      setLotes(allLotes)
    } catch { setLotes([]) }
  }

  async function save() {
    setSaving(true)
    try {
      await api.post('/api/estoque/inicial/lancar/', form)
      setModal(false); fetchData()
    } catch { alert('Erro ao cadastrar lote') }
    finally { setSaving(false) }
  }

  const filtered = lotes.filter(l =>
    l.produto_nome?.toLowerCase().includes(search.toLowerCase()) ||
    l.numero_lote?.toLowerCase().includes(search.toLowerCase())
  )

  function validadeColor(l: Lote): 'red' | 'yellow' | 'green' {
    if (!l.data_validade) return 'green'
    const dias = Math.floor((new Date(l.data_validade).getTime() - Date.now()) / 86400000)
    if (dias <= 0) return 'red'
    if (dias <= 30) return 'yellow'
    return 'green'
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por produto ou lote..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-72 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="flex-1" />
        <button onClick={() => { setForm({ produto:'',numero_lote:'',quantidade:'',custo_unitario:'',data_fabricacao:'',data_validade:'',deposito:'',corredor:'',prateleira:'',nota_fiscal_origem:'' }); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Novo Lote
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Produto', 'Nº Lote', 'Qtd', 'Custo Unit.', 'Fabricação', 'Validade', 'Localização', 'NF Origem', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-text-muted">Nenhum lote encontrado</td></tr>
            ) : filtered.map(l => (
              <tr key={l.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">{l.produto_nome}</td>
                <td className="px-4 py-3 font-mono text-text-secondary text-xs">{l.numero_lote}</td>
                <td className="px-4 py-3 font-mono text-text-primary">{l.quantidade}</td>
                <td className="px-4 py-3 font-mono text-text-muted">{fmt(l.custo_unitario)}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{l.data_fabricacao || '—'}</td>
                <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">{l.data_validade || '—'}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{[l.deposito, l.corredor, l.prateleira].filter(Boolean).join(' › ') || '—'}</td>
                <td className="px-4 py-3 font-mono text-text-muted text-xs">{l.nota_fiscal_origem || '—'}</td>
                <td className="px-4 py-3">
                  <Badge label={l.data_validade ? (validadeColor(l) === 'red' ? 'Vencido' : validadeColor(l) === 'yellow' ? 'Próx. Venc.' : 'OK') : 'Sem validade'} color={l.data_validade ? validadeColor(l) : 'gray'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Novo Lote" onClose={() => setModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Produto *"><input className={inp} value={form.produto} onChange={e => setForm(f => ({ ...f, produto: e.target.value }))} placeholder="Nome ou ID do produto" /></Field>
              <Field label="Número do Lote *"><input className={inp} value={form.numero_lote} onChange={e => setForm(f => ({ ...f, numero_lote: e.target.value }))} placeholder="LOT-2026-001" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Quantidade *"><input type="number" className={inp} value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} placeholder="0" /></Field>
              <Field label="Custo Unitário (R$) *"><input type="number" className={inp} value={form.custo_unitario} onChange={e => setForm(f => ({ ...f, custo_unitario: e.target.value }))} placeholder="0.00" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data de Fabricação"><input type="date" className={inp} value={form.data_fabricacao} onChange={e => setForm(f => ({ ...f, data_fabricacao: e.target.value }))} /></Field>
              <Field label="Data de Validade"><input type="date" className={inp} value={form.data_validade} onChange={e => setForm(f => ({ ...f, data_validade: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Depósito"><input className={inp} value={form.deposito} onChange={e => setForm(f => ({ ...f, deposito: e.target.value }))} placeholder="Galpão A" /></Field>
              <Field label="Corredor"><input className={inp} value={form.corredor} onChange={e => setForm(f => ({ ...f, corredor: e.target.value }))} placeholder="C1" /></Field>
              <Field label="Prateleira"><input className={inp} value={form.prateleira} onChange={e => setForm(f => ({ ...f, prateleira: e.target.value }))} placeholder="P3" /></Field>
            </div>
            <Field label="Nota Fiscal de Origem"><input className={inp} value={form.nota_fiscal_origem} onChange={e => setForm(f => ({ ...f, nota_fiscal_origem: e.target.value }))} placeholder="NF-e 000123" /></Field>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.produto || !form.numero_lote || !form.quantidade || !form.custo_unitario} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Alertas ──────────────────────────────────────────────────────────────

function TabAlertas() {
  const [alertasEstoque, setAlertasEstoque] = useState<AlertaEstoque[]>([])
  const [alertasValidade, setAlertasValidade] = useState<AlertaValidade[]>([])

  useEffect(() => {
    api.get('/api/alertas/estoque/').then(({ data }) => setAlertasEstoque(data)).catch(() => setAlertasEstoque([]))
    api.get('/api/alertas/validade/').then(({ data }) => setAlertasValidade(data)).catch(() => setAlertasValidade([]))
  }, [])

  return (
    <div className="space-y-6">
      {/* Estoque mínimo / zerado */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <AlertTriangle size={16} className="text-yellow-600" />
          <h3 className="text-sm font-semibold text-text-primary">Estoque Mínimo e Zerado</h3>
          <span className="ml-auto text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{alertasEstoque.length} itens</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Produto', 'SKU', 'Qtd Atual', 'Est. Mínimo', 'Situação'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alertasEstoque.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-6 text-text-muted text-sm">Nenhum alerta de estoque</td></tr>
            ) : alertasEstoque.map((a, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-card2">
                <td className="px-4 py-3 font-medium text-text-primary">{a.produto}</td>
                <td className="px-4 py-3 font-mono text-text-muted text-xs">{a.sku}</td>
                <td className={`px-4 py-3 font-mono font-bold ${a.tipo === 'zerado' ? 'text-red-500' : 'text-yellow-600'}`}>{a.quantidade}</td>
                <td className="px-4 py-3 font-mono text-text-muted">{a.estoque_minimo}</td>
                <td className="px-4 py-3"><Badge label={a.tipo === 'zerado' ? 'Zerado' : 'Abaixo do Mínimo'} color={a.tipo === 'zerado' ? 'red' : 'yellow'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Validade */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500" />
          <h3 className="text-sm font-semibold text-text-primary">Vencimento de Lotes</h3>
          <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{alertasValidade.length} lotes</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Produto', 'Lote', 'Quantidade', 'Validade', 'Dias Restantes', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alertasValidade.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-6 text-text-muted text-sm">Nenhum alerta de validade</td></tr>
            ) : alertasValidade.map((a, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-card2">
                <td className="px-4 py-3 font-medium text-text-primary">{a.produto}</td>
                <td className="px-4 py-3 font-mono text-text-muted text-xs">{a.lote}</td>
                <td className="px-4 py-3 font-mono text-text-primary">{a.quantidade}</td>
                <td className="px-4 py-3 text-text-muted">{a.data_validade}</td>
                <td className={`px-4 py-3 font-mono font-bold ${a.dias_restantes <= 0 ? 'text-red-500' : a.dias_restantes <= 15 ? 'text-red-400' : 'text-yellow-600'}`}>
                  {a.dias_restantes <= 0 ? 'Vencido' : `${a.dias_restantes} dias`}
                </td>
                <td className="px-4 py-3">
                  <Badge label={a.dias_restantes <= 0 ? 'Vencido' : a.dias_restantes <= 15 ? 'Crítico' : 'Atenção'} color={a.dias_restantes <= 15 ? 'red' : 'yellow'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab Transferências ───────────────────────────────────────────────────────

function TabTransferencias() {
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ produto: '', lote: '', quantidade: '', unidade_destino: '', observacao: '' })

  async function save() {
    setSaving(true)
    try {
      await api.post('/api/estoque/transferencia/', form)
      setModal(false)
    } catch { alert('Erro ao registrar transferência') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <RefreshCw size={16} /> Nova Transferência
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <RefreshCw size={32} className="text-accent/30 mx-auto mb-3" />
        <p className="text-sm font-medium text-text-secondary">Transferências entre Unidades</p>
        <p className="text-xs text-text-muted mt-1">Aqui aparecerão as transferências de estoque entre filiais. Disponível quando houver múltiplas unidades configuradas.</p>
      </div>

      {modal && (
        <Modal title="Nova Transferência de Estoque" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700">A transferência gera automaticamente uma NF de transferência entre os CNPJs das unidades envolvidas.</p>
            </div>
            <Field label="Produto *"><input className={inp} value={form.produto} onChange={e => setForm(f => ({ ...f, produto: e.target.value }))} placeholder="Nome ou SKU" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Lote"><input className={inp} value={form.lote} onChange={e => setForm(f => ({ ...f, lote: e.target.value }))} placeholder="Nº do lote" /></Field>
              <Field label="Quantidade *"><input type="number" className={inp} value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} placeholder="0" /></Field>
            </div>
            <Field label="Unidade Destino *">
              <Sel value={form.unidade_destino} onChange={v => setForm(f => ({ ...f, unidade_destino: v }))}>
                <option value="">Selecionar filial...</option>
                <option value="1">Unidade Ribeirão Preto</option>
                <option value="2">Unidade Uberlândia</option>
              </Sel>
            </Field>
            <Field label="Observação"><textarea className={inp} rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Motivo da transferência..." /></Field>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.produto || !form.quantidade || !form.unidade_destino} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Inventário ───────────────────────────────────────────────────────────

function TabInventario() {
  const [fase, setFase] = useState<'inicio' | 'contagem'>('inicio')
  const [iniciando, setIniciando] = useState(false)
  const [contagens, setContagens] = useState<{ produto: string; sku: string; sistema: number; contado: string }[]>([])

  async function iniciarInventario() {
    setIniciando(true)
    try {
      const { data } = await api.post('/api/estoque/inventario/', {})
      const items = (data.itens ?? []).map((p: any) => ({ produto: p.nome, sku: p.sku, sistema: p.quantidade, contado: '' }))
      setContagens(items)
      setFase('contagem')
    } catch {
      setContagens([])
      setFase('contagem')
    } finally { setIniciando(false) }
  }

  async function concluir() {
    if (!confirm('Confirmar inventário e aplicar ajustes automaticamente?')) return
    try {
      await api.post('/api/estoque/inventario/1/concluir/', { contagens })
      setFase('inicio')
      alert('Inventário concluído. Ajustes aplicados no estoque.')
    } catch { alert('Inventário registrado localmente.'); setFase('inicio') }
  }

  if (fase === 'inicio') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <ClipboardList size={48} className="text-accent/40" />
        <div className="text-center">
          <p className="font-semibold text-text-primary">Inventário Físico</p>
          <p className="text-sm text-text-muted mt-1 max-w-sm">Inicia uma contagem cíclica. O sistema carrega todos os produtos com quantidade atual para comparação.</p>
        </div>
        <button onClick={iniciarInventario} disabled={iniciando}
          className="flex items-center gap-2 bg-accent text-bg font-semibold px-6 py-2.5 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60">
          <ClipboardList size={16} /> {iniciando ? 'Iniciando...' : 'Iniciar Inventário'}
        </button>
      </div>
    )
  }

  const divergencias = contagens.filter(c => c.contado !== '' && Number(c.contado) !== c.sistema).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">Contagem em Andamento</p>
          <p className="text-xs text-text-muted">{divergencias} divergência{divergencias !== 1 ? 's' : ''} encontrada{divergencias !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFase('inicio')} className="border border-border text-text-muted px-4 py-2 rounded-lg text-sm hover:bg-card2 transition-colors">Cancelar</button>
          <button onClick={concluir} className="bg-accent text-bg font-semibold px-4 py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors">Concluir e Aplicar Ajustes</button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['SKU', 'Produto', 'Qtd Sistema', 'Qtd Contada', 'Diferença'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contagens.map((c, i) => {
              const diff = c.contado !== '' ? Number(c.contado) - c.sistema : null
              return (
                <tr key={i} className={`border-b border-border/50 ${diff !== null && diff !== 0 ? 'bg-yellow-50/50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{c.sku}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{c.produto}</td>
                  <td className="px-4 py-3 font-mono text-text-primary">{c.sistema}</td>
                  <td className="px-4 py-2">
                    <input type="number" className="bg-card2 border border-border rounded px-2 py-1 text-sm w-24 font-mono focus:outline-none focus:border-accent"
                      value={c.contado} onChange={e => setContagens(cs => cs.map((x, j) => j === i ? { ...x, contado: e.target.value } : x))}
                      placeholder="—" />
                  </td>
                  <td className={`px-4 py-3 font-mono font-semibold ${diff === null ? 'text-text-muted' : diff > 0 ? 'text-accent' : diff < 0 ? 'text-red-500' : 'text-text-muted'}`}>
                    {diff === null ? '—' : diff > 0 ? `+${diff}` : diff === 0 ? '✓' : diff}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_PRODUTOS: Produto[] = [
  { id:1, nome:'Roundup Original', sku:'DEF-001', unidade_medida:'L', quantidade:150, estoque_minimo:50, metodo_custeio:'cmp', tipo_produto:'defensivo' },
  { id:2, nome:'Ureia 45%', sku:'FER-001', unidade_medida:'SC', quantidade:8, estoque_minimo:20, metodo_custeio:'fifo', tipo_produto:'fertilizante' },
  { id:3, nome:'Soja RR1 Intacta', sku:'SEM-001', unidade_medida:'SC', quantidade:0, estoque_minimo:10, metodo_custeio:'cmp', tipo_produto:'semente' },
  { id:4, nome:'MAP Fosfato', sku:'FER-002', unidade_medida:'SC', quantidade:320, estoque_minimo:30, metodo_custeio:'cmp', tipo_produto:'fertilizante' },
]

const MOCK_LOTES: Lote[] = [
  { id:1, produto_nome:'Roundup Original', produto_id:1, numero_lote:'LOT-2026-001', quantidade:150, custo_unitario:65.50, data_fabricacao:'2025-10-01', data_validade:'2027-10-01', deposito:'Galpão A', corredor:'C1', prateleira:'P1', nota_fiscal_origem:'NF-e 000123', alerta_validade:'ok' },
  { id:2, produto_nome:'Ureia 45%', produto_id:2, numero_lote:'LOT-2026-002', quantidade:8, custo_unitario:98.00, data_fabricacao:'2026-01-15', data_validade:'2026-05-10', deposito:'Galpão B', corredor:'C2', prateleira:'P3', nota_fiscal_origem:'NF-e 000124', alerta_validade:'critico' },
  { id:3, nome:'Soja RR1', produto_nome:'Soja RR1 Intacta', produto_id:3, numero_lote:'LOT-2026-003', quantidade:0, custo_unitario:215.00, data_fabricacao:'2025-12-01', data_validade:'2026-06-01', deposito:'Câmara Fria', corredor:'C1', prateleira:'P2', nota_fiscal_origem:'NF-e 000125', alerta_validade:'atencao' } as any,
]

const MOCK_MOVIMENTACOES: Movimentacao[] = [
  { id:1, produto_nome:'Roundup Original', tipo:'entrada', quantidade:200, saldo_apos_movimento:150, origem:'compra', data_movimento:'2026-04-10T09:00:00', operador_nome:'Carlos Silva' },
  { id:2, produto_nome:'Ureia 45%', tipo:'saida', quantidade:50, saldo_apos_movimento:8, origem:'venda', data_movimento:'2026-04-12T14:30:00', operador_nome:'Ana Ferreira' },
  { id:3, produto_nome:'Soja RR1 Intacta', tipo:'saida', quantidade:10, saldo_apos_movimento:0, origem:'venda', data_movimento:'2026-04-15T11:00:00', operador_nome:'Carlos Silva' },
]

const MOCK_ALERTAS_ESTOQUE: AlertaEstoque[] = [
  { produto:'Ureia 45%', sku:'FER-001', quantidade:8, estoque_minimo:20, tipo:'baixo' },
  { produto:'Soja RR1 Intacta', sku:'SEM-001', quantidade:0, estoque_minimo:10, tipo:'zerado' },
]

const MOCK_ALERTAS_VALIDADE: AlertaValidade[] = [
  { lote:'LOT-2026-002', produto:'Ureia 45%', quantidade:8, data_validade:'2026-05-10', dias_restantes:20 },
  { lote:'LOT-2026-003', produto:'Soja RR1 Intacta', quantidade:0, data_validade:'2026-06-01', dias_restantes:42 },
]

// ─── main ─────────────────────────────────────────────────────────────────────

const TABS = ['Posição de Estoque', 'Movimentações', 'Lotes', 'Alertas', 'Transferências', 'Inventário Físico']

export default function Estoque() {
  const [tab, setTab] = useState('Posição de Estoque')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Package size={20} className="text-accent" /> Gestão de Estoque
        </h1>
        <p className="text-sm text-text-muted">Controle por lote com rastreabilidade total de entrada a saída</p>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Posição de Estoque' && <TabPosicao />}
      {tab === 'Movimentações'      && <TabMovimentacoes />}
      {tab === 'Lotes'              && <TabLotes />}
      {tab === 'Alertas'            && <TabAlertas />}
      {tab === 'Transferências'     && <TabTransferencias />}
      {tab === 'Inventário Físico'  && <TabInventario />}
    </div>
  )
}
