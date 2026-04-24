import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, X, ChevronDown, Upload } from 'lucide-react'
import { api } from '../lib/api'
import ExportButtons from '../components/ExportButtons'

// ─── shared UI ───────────────────────────────────────────────────────────────

function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex flex-wrap border-b border-border mb-6 gap-0">
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
            active === t ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'
          }`}>
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

function Badge({ label, green }: { label: string; green: boolean }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${green ? 'bg-accent/20 text-accent' : 'bg-red-900/30 text-red-400'}`}>{label}</span>
}

function Table({ heads, children, cols, selHead }: { heads: string[]; children: React.ReactNode; cols?: number; selHead?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {selHead !== undefined && <th className="w-10 px-3 py-3">{selHead}</th>}
            {heads.map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>)}
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {!children || (Array.isArray(children) && children.length === 0) ? (
        <p className="text-center py-10 text-text-muted text-sm">Nenhum registro encontrado</p>
      ) : null}
    </div>
  )
}

function Empty({ cols }: { cols: number }) {
  return <tr><td colSpan={cols + 1} className="text-center py-10 text-text-muted text-sm">Nenhum registro encontrado</td></tr>
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

function Actions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <td className="px-4 py-3">
      <div className="flex gap-1 justify-end">
        {onEdit && <button onClick={onEdit} className="p-1.5 hover:bg-card rounded text-text-muted hover:text-accent transition-colors"><Pencil size={14} /></button>}
        {onDelete && <button onClick={onDelete} className="p-1.5 hover:bg-card rounded text-text-muted hover:text-red-400 transition-colors"><Trash2 size={14} /></button>}
      </div>
    </td>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="font-semibold text-text-primary">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={half ? '' : ''}>
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
const sel = inp + ' appearance-none'

function Sel({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select className={sel} value={value} onChange={e => onChange(e.target.value)}>{children}</select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
    </div>
  )
}

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

// ─── PRODUTOS ─────────────────────────────────────────────────────────────────

interface Produto {
  id: number; nome: string; sku: string; ean: string; tipo_produto: string
  tipo_produto_label: string; metodo_custeio: string; unidade_medida: string
  preco_venda: number; quantidade: number; ncm: string; ativo: boolean
}

function TabProdutos() {
  const [rows, setRows] = useState<Produto[]>([])
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Produto | null>(null)
  const [saving, setSaving] = useState(false)
  const [selP, setSelP] = useState<Set<number>>(new Set())
  const toggleSelP = (id: number) => setSelP(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAllP = (ids: number[]) => setSelP(s => s.size === ids.length ? new Set() : new Set(ids))
  const [form, setForm] = useState({
    nome: '', sku: '', ean: '', tipo_produto: 'insumo_agricola', metodo_custeio: 'cmp',
    unidade_medida: 'KG', preco_venda: '', estoque_minimo: '', margem_minima: '',
    comissao_percentual: '', ncm: '', cest: '', origem: '0', ativo: true,
  })

  useEffect(() => { fetch() }, [])

  async function fetch() {
    try { const { data } = await api.get('/api/produtos/'); setRows(data.results ?? data) }
    catch { setRows(MOCK_PRODUTOS) }
  }

  function openNew() { setEditing(null); setForm({ nome:'',sku:'',ean:'',tipo_produto:'insumo_agricola',metodo_custeio:'cmp',unidade_medida:'KG',preco_venda:'',estoque_minimo:'',margem_minima:'',comissao_percentual:'',ncm:'',cest:'',origem:'0',ativo:true }); setModal(true) }
  function openEdit(r: Produto) { setEditing(r); setForm({ nome:r.nome,sku:r.sku,ean:r.ean,tipo_produto:r.tipo_produto,metodo_custeio:r.metodo_custeio,unidade_medida:r.unidade_medida,preco_venda:String(r.preco_venda),estoque_minimo:'',margem_minima:'',comissao_percentual:'',ncm:r.ncm,cest:'',origem:'0',ativo:r.ativo }); setModal(true) }

  async function save() {
    setSaving(true)
    try {
      if (editing) await api.patch(`/api/produtos/${editing.id}/`, form)
      else await api.post('/api/produtos/', form)
      setModal(false); fetch()
    } catch { alert('Erro ao salvar') } finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!confirm('Excluir produto?')) return
    try { await api.delete(`/api/produtos/${id}/`); fetch() } catch { alert('Erro') }
  }

  const filtered = rows.filter(r =>
    (r.nome.toLowerCase().includes(search.toLowerCase()) || r.sku?.toLowerCase().includes(search.toLowerCase()) || r.ean?.includes(search)) &&
    (filterTipo ? r.tipo_produto === filterTipo : true)
  )

  const tiposMap: Record<string, string> = { insumo_agricola:'Insumo Agrícola', defensivo:'Defensivo', semente:'Semente', fertilizante:'Fertilizante', produto_acabado:'Prod. Acabado', colheita:'Colheita' }

  return (
    <div>
      <Bar value={search} onChange={setSearch} placeholder="Buscar por nome, SKU, EAN...">
        <Sel value={filterTipo} onChange={setFilterTipo}>
          <option value="">Todos os tipos</option>
          {Object.entries(tiposMap).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </Sel>
        <ExportButtons endpoint="/api/produtos/" filename="produtos" selectedIds={selP.size > 0 ? [...selP] : undefined} />
        <BtnNew onClick={openNew} label="Novo Produto" />
      </Bar>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total de Produtos', val: rows.length },
          { label: 'Ativos', val: rows.filter(r => r.ativo).length },
          { label: 'Estoque Baixo', val: '—' },
          { label: 'Zerados', val: rows.filter(r => r.quantidade === 0).length },
        ].map(k => (
          <div key={k.label} className="bg-card2 border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-text-muted">{k.label}</p>
            <p className="text-xl font-bold text-text-primary font-mono mt-1">{k.val}</p>
          </div>
        ))}
      </div>

      <Table heads={['SKU', 'EAN', 'Nome', 'Tipo', 'Custeio', 'Unid.', 'Preço', 'Estoque', 'Status']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={selP.size === filtered.length && filtered.length > 0} onChange={() => toggleAllP(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={10} /> : filtered.map(r => (
          <Tr key={r.id} selected={selP.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={selP.has(r.id)} onChange={() => toggleSelP(r.id)} /></td>
            <Td mono>{r.sku}</Td>
            <Td mono>{r.ean}</Td>
            <TdMain>{r.nome}</TdMain>
            <Td>{r.tipo_produto_label || tiposMap[r.tipo_produto]}</Td>
            <Td>{r.metodo_custeio?.toUpperCase()}</Td>
            <Td>{r.unidade_medida}</Td>
            <Td mono>R$ {Number(r.preco_venda).toFixed(2)}</Td>
            <Td mono>{r.quantidade}</Td>
            <td className="px-4 py-3"><Badge label={r.ativo ? 'Ativo' : 'Inativo'} green={r.ativo} /></td>
            <Actions onEdit={() => openEdit(r)} onDelete={() => del(r.id)} />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title={editing ? 'Editar Produto' : 'Novo Produto'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Nome *"><input className={inp} value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))} placeholder="Ex: Roundup Original" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="SKU / Código Interno"><input className={inp} value={form.sku} onChange={e => setForm(f=>({...f,sku:e.target.value}))} placeholder="PRD-0001" /></Field>
              <Field label="EAN / Código de Barras"><input className={inp} value={form.ean} onChange={e => setForm(f=>({...f,ean:e.target.value}))} placeholder="7891234567890" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de Produto *">
                <Sel value={form.tipo_produto} onChange={v => setForm(f=>({...f,tipo_produto:v}))}>
                  <option value="insumo_agricola">Insumo Agrícola</option>
                  <option value="defensivo">Defensivo</option>
                  <option value="semente">Semente</option>
                  <option value="fertilizante">Fertilizante</option>
                  <option value="produto_acabado">Produto Acabado</option>
                  <option value="colheita">Colheita</option>
                </Sel>
              </Field>
              <Field label="Método de Custeio">
                <Sel value={form.metodo_custeio} onChange={v => setForm(f=>({...f,metodo_custeio:v}))}>
                  <option value="cmp">CMP — Custo Médio</option>
                  <option value="fifo">FIFO — Primeiro a Entrar</option>
                </Sel>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Unidade">
                <Sel value={form.unidade_medida} onChange={v => setForm(f=>({...f,unidade_medida:v}))}>
                  {['KG','G','TON','L','ML','UN','SC','CX','M','M2','M3'].map(u => <option key={u} value={u}>{u}</option>)}
                </Sel>
              </Field>
              <Field label="Preço de Venda"><input type="number" className={inp} value={form.preco_venda} onChange={e => setForm(f=>({...f,preco_venda:e.target.value}))} placeholder="0.00" /></Field>
              <Field label="Estoque Mínimo"><input type="number" className={inp} value={form.estoque_minimo} onChange={e => setForm(f=>({...f,estoque_minimo:e.target.value}))} placeholder="0" /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="NCM"><input className={inp} value={form.ncm} onChange={e => setForm(f=>({...f,ncm:e.target.value}))} placeholder="3808.92.19" /></Field>
              <Field label="CEST"><input className={inp} value={form.cest} onChange={e => setForm(f=>({...f,cest:e.target.value}))} placeholder="00.000.00" /></Field>
              <Field label="Origem">
                <Sel value={form.origem} onChange={v => setForm(f=>({...f,origem:v}))}>
                  <option value="0">0 — Nacional</option>
                  <option value="1">1 — Estrangeiro importação direta</option>
                  <option value="2">2 — Estrangeiro adquirido no mercado interno</option>
                </Sel>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Margem Mínima (%)"><input type="number" className={inp} value={form.margem_minima} onChange={e => setForm(f=>({...f,margem_minima:e.target.value}))} placeholder="15" /></Field>
              <Field label="Comissão (%)"><input type="number" className={inp} value={form.comissao_percentual} onChange={e => setForm(f=>({...f,comissao_percentual:e.target.value}))} placeholder="3" /></Field>
            </div>
            {form.tipo_produto === 'defensivo' && (
              <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-lg p-3">
                <p className="text-xs text-yellow-400 font-medium mb-2">Defensivo — anexos obrigatórios</p>
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-xs text-text-muted hover:text-accent hover:border-accent transition-colors"><Upload size={13} /> FISPQ</button>
                  <button className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-xs text-text-muted hover:text-accent hover:border-accent transition-colors"><Upload size={13} /> Ficha Técnica</button>
                </div>
              </div>
            )}
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.nome} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── CLIENTES ─────────────────────────────────────────────────────────────────

interface Cliente {
  id: number; nome_razao: string; nome_fantasia: string; cnpj_cpf: string
  tipo_pessoa: string; tipo_cliente: string; telefone: string
  limite_credito: number; ativo: boolean; grupo_nome: string
  tabela_preco_id?: number; tabela_preco_nome?: string
}

interface TabelaOpcao { id: number; nome: string }

function TabClientes() {
  const [rows, setRows] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [saving, setSaving] = useState(false)
  const [selC, setSelC] = useState<Set<number>>(new Set())
  const toggleSelC = (id: number) => setSelC(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAllC = (ids: number[]) => setSelC(s => s.size === ids.length ? new Set() : new Set(ids))
  const [tabelasOpcoes, setTabelasOpcoes] = useState<TabelaOpcao[]>([])
  const [form, setForm] = useState({
    tipo_pessoa:'PJ', tipo_cliente:'produtor_rural', nome_razao:'', nome_fantasia:'',
    cnpj_cpf:'', responsavel:'', telefone:'', endereco:'', limite_credito:'', ativo:true,
    tabela_preco_id: '' as string | number,
  })

  useEffect(() => {
    fetch()
    api.get('/api/tabelas-preco/').then(({ data }) => setTabelasOpcoes(data.results ?? data)).catch(() => setTabelasOpcoes(MOCK_TABELAS))
  }, [])

  async function fetch() {
    try { const { data } = await api.get('/api/clientes/'); setRows(data.results ?? data) }
    catch { setRows(MOCK_CLIENTES) }
  }

  function openNew() { setEditing(null); setForm({tipo_pessoa:'PJ',tipo_cliente:'produtor_rural',nome_razao:'',nome_fantasia:'',cnpj_cpf:'',responsavel:'',telefone:'',endereco:'',limite_credito:'',ativo:true,tabela_preco_id:''}); setModal(true) }
  function openEdit(r: Cliente) { setEditing(r); setForm({tipo_pessoa:r.tipo_pessoa,tipo_cliente:r.tipo_cliente,nome_razao:r.nome_razao,nome_fantasia:r.nome_fantasia,cnpj_cpf:r.cnpj_cpf,responsavel:'',telefone:r.telefone,endereco:'',limite_credito:String(r.limite_credito),ativo:r.ativo,tabela_preco_id:r.tabela_preco_id ?? ''}); setModal(true) }

  async function save() {
    setSaving(true)
    try {
      if (editing) await api.patch(`/api/clientes/${editing.id}/`, form)
      else await api.post('/api/clientes/', form)
      setModal(false); fetch()
    } catch { alert('Erro ao salvar') } finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!confirm('Excluir cliente?')) return
    try { await api.delete(`/api/clientes/${id}/`); fetch() } catch { alert('Erro') }
  }

  const tiposMap: Record<string,string> = { balcao:'Balcão', produtor_rural:'Produtor Rural', cooperativa:'Cooperativa', orgao_publico:'Órgão Público' }

  const filtered = rows.filter(r =>
    (r.nome_razao.toLowerCase().includes(search.toLowerCase()) || r.cnpj_cpf?.includes(search)) &&
    (filterTipo ? r.tipo_cliente === filterTipo : true)
  )

  return (
    <div>
      <Bar value={search} onChange={setSearch} placeholder="Buscar por nome ou CNPJ/CPF...">
        <Sel value={filterTipo} onChange={setFilterTipo}>
          <option value="">Todos os tipos</option>
          {Object.entries(tiposMap).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </Sel>
        <ExportButtons endpoint="/api/clientes/" filename="clientes" selectedIds={selC.size > 0 ? [...selC] : undefined} />
        <BtnNew onClick={openNew} label="Novo Cliente" />
      </Bar>

      <Table heads={['Nome / Razão Social', 'CNPJ/CPF', 'Tipo', 'Grupo', 'Telefone', 'Limite de Crédito', 'Tabela Especial', 'Status']}
        selHead={<input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={selC.size === filtered.length && filtered.length > 0} onChange={() => toggleAllC(filtered.map(r => r.id))} />}>
        {filtered.length === 0 ? <Empty cols={9} /> : filtered.map(r => (
          <Tr key={r.id} selected={selC.has(r.id)}>
            <td className="px-3 py-3"><input type="checkbox" className="accent-accent w-3.5 h-3.5 cursor-pointer" checked={selC.has(r.id)} onChange={() => toggleSelC(r.id)} /></td>
            <TdMain>{r.nome_razao}{r.nome_fantasia && <span className="block text-xs text-text-muted font-normal">{r.nome_fantasia}</span>}</TdMain>
            <Td mono>{r.cnpj_cpf}</Td>
            <Td>{tiposMap[r.tipo_cliente] || r.tipo_cliente}</Td>
            <Td>{r.grupo_nome}</Td>
            <Td>{r.telefone}</Td>
            <Td mono>R$ {Number(r.limite_credito||0).toLocaleString('pt-BR')}</Td>
            <td className="px-4 py-3">
              {r.tabela_preco_nome
                ? <span className="text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full font-medium">{r.tabela_preco_nome}</span>
                : <span className="text-xs text-text-muted">—</span>}
            </td>
            <td className="px-4 py-3"><Badge label={r.ativo ? 'Ativo' : 'Inativo'} green={r.ativo} /></td>
            <Actions onEdit={() => openEdit(r)} onDelete={() => del(r.id)} />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title={editing ? 'Editar Cliente' : 'Novo Cliente'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de Pessoa *">
                <Sel value={form.tipo_pessoa} onChange={v => setForm(f=>({...f,tipo_pessoa:v}))}>
                  <option value="PF">Pessoa Física (CPF)</option>
                  <option value="PJ">Pessoa Jurídica (CNPJ)</option>
                </Sel>
              </Field>
              <Field label="Tipo de Cliente *">
                <Sel value={form.tipo_cliente} onChange={v => setForm(f=>({...f,tipo_cliente:v}))}>
                  <option value="balcao">Balcão</option>
                  <option value="produtor_rural">Produtor Rural</option>
                  <option value="cooperativa">Cooperativa</option>
                  <option value="orgao_publico">Órgão Público</option>
                </Sel>
              </Field>
            </div>
            <Field label={form.tipo_pessoa === 'PF' ? 'Nome Completo *' : 'Razão Social *'}>
              <input className={inp} value={form.nome_razao} onChange={e => setForm(f=>({...f,nome_razao:e.target.value}))} placeholder={form.tipo_pessoa==='PF' ? 'João da Silva' : 'Agropecuária Silva Ltda'} />
            </Field>
            {form.tipo_pessoa === 'PJ' && (
              <Field label="Nome Fantasia">
                <input className={inp} value={form.nome_fantasia} onChange={e => setForm(f=>({...f,nome_fantasia:e.target.value}))} placeholder="Nome Fantasia" />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label={form.tipo_pessoa === 'PF' ? 'CPF *' : 'CNPJ *'}>
                <input className={inp} value={form.cnpj_cpf} onChange={e => setForm(f=>({...f,cnpj_cpf:e.target.value}))} placeholder={form.tipo_pessoa==='PF' ? '000.000.000-00' : '00.000.000/0001-00'} />
              </Field>
              <Field label="Telefone">
                <input className={inp} value={form.telefone} onChange={e => setForm(f=>({...f,telefone:e.target.value}))} placeholder="(16) 99999-0000" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Responsável">
                <input className={inp} value={form.responsavel} onChange={e => setForm(f=>({...f,responsavel:e.target.value}))} placeholder="Nome do responsável" />
              </Field>
              <Field label="Limite de Crédito (R$)">
                <input type="number" className={inp} value={form.limite_credito} onChange={e => setForm(f=>({...f,limite_credito:e.target.value}))} placeholder="0.00" />
              </Field>
            </div>
            <Field label="Endereço">
              <input className={inp} value={form.endereco} onChange={e => setForm(f=>({...f,endereco:e.target.value}))} placeholder="Rua, número, cidade - UF" />
            </Field>

            {/* Tabela especial */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">Tabela de Preço Especial</p>
                  <p className="text-xs text-text-muted mt-0.5">Quando definida, substitui a tabela padrão nos pedidos deste cliente</p>
                </div>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, tabela_preco_id: f.tabela_preco_id ? '' : (tabelasOpcoes[0]?.id ?? '') }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.tabela_preco_id ? 'bg-accent' : 'bg-border'}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.tabela_preco_id ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </div>
              {form.tabela_preco_id !== '' && (
                <Field label="Selecionar Tabela">
                  <Sel value={String(form.tabela_preco_id)} onChange={v => setForm(f => ({ ...f, tabela_preco_id: v }))}>
                    {tabelasOpcoes.length === 0
                      ? <option value="">Nenhuma tabela cadastrada</option>
                      : tabelasOpcoes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)
                    }
                  </Sel>
                </Field>
              )}
            </div>

            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.nome_razao || !form.cnpj_cpf} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── FORNECEDORES ─────────────────────────────────────────────────────────────

interface Fornecedor { id: number; nome_razao: string; cnpj: string; telefone?: string; email?: string; ativo?: boolean }

function TabFornecedores() {
  const [rows, setRows] = useState<Fornecedor[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Fornecedor | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome_razao:'', cnpj:'', telefone:'', email:'', endereco:'', contato_nome:'', condicao_pagamento:'' })

  useEffect(() => { fetch() }, [])

  async function fetch() {
    try { const { data } = await api.get('/api/fornecedores/'); setRows(data.results ?? data) }
    catch { setRows(MOCK_FORNECEDORES) }
  }

  function openNew() { setEditing(null); setForm({nome_razao:'',cnpj:'',telefone:'',email:'',endereco:'',contato_nome:'',condicao_pagamento:''}); setModal(true) }
  function openEdit(r: Fornecedor) { setEditing(r); setForm({nome_razao:r.nome_razao,cnpj:r.cnpj,telefone:r.telefone||'',email:r.email||'',endereco:'',contato_nome:'',condicao_pagamento:''}); setModal(true) }

  async function save() {
    setSaving(true)
    try {
      if (editing) await api.patch(`/api/fornecedores/${editing.id}/`, form)
      else await api.post('/api/fornecedores/', form)
      setModal(false); fetch()
    } catch { alert('Erro ao salvar') } finally { setSaving(false) }
  }

  const filtered = rows.filter(r => r.nome_razao.toLowerCase().includes(search.toLowerCase()) || r.cnpj?.includes(search))

  return (
    <div>
      <Bar value={search} onChange={setSearch} placeholder="Buscar por nome ou CNPJ...">
        <BtnNew onClick={openNew} label="Novo Fornecedor" />
      </Bar>
      <Table heads={['Razão Social', 'CNPJ', 'Telefone', 'E-mail']}>
        {filtered.length === 0 ? <Empty cols={4} /> : filtered.map(r => (
          <Tr key={r.id}>
            <TdMain>{r.nome_razao}</TdMain>
            <Td mono>{r.cnpj}</Td>
            <Td>{r.telefone}</Td>
            <Td>{r.email}</Td>
            <Actions onEdit={() => openEdit(r)} onDelete={async () => { if(confirm('Excluir fornecedor?')) { try { await api.delete(`/api/fornecedores/${r.id}/`); fetch() } catch { alert('Erro') } } }} />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title={editing ? 'Editar Fornecedor' : 'Novo Fornecedor'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Razão Social *"><input className={inp} value={form.nome_razao} onChange={e => setForm(f=>({...f,nome_razao:e.target.value}))} placeholder="Distribuidora XYZ Ltda" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CNPJ *"><input className={inp} value={form.cnpj} onChange={e => setForm(f=>({...f,cnpj:e.target.value}))} placeholder="00.000.000/0001-00" /></Field>
              <Field label="Telefone"><input className={inp} value={form.telefone} onChange={e => setForm(f=>({...f,telefone:e.target.value}))} placeholder="(11) 99999-0000" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="E-mail"><input type="email" className={inp} value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="contato@fornecedor.com" /></Field>
              <Field label="Contato Principal"><input className={inp} value={form.contato_nome} onChange={e => setForm(f=>({...f,contato_nome:e.target.value}))} placeholder="Nome do contato" /></Field>
            </div>
            <Field label="Endereço"><input className={inp} value={form.endereco} onChange={e => setForm(f=>({...f,endereco:e.target.value}))} placeholder="Rua, número, cidade - UF" /></Field>
            <Field label="Condição de Pagamento Padrão">
              <Sel value={form.condicao_pagamento} onChange={v => setForm(f=>({...f,condicao_pagamento:v}))}>
                <option value="">Selecionar...</option>
                <option value="30">30 dias</option>
                <option value="30/60">30/60 dias</option>
                <option value="30/60/90">30/60/90 dias</option>
                <option value="a_vista">À vista</option>
              </Sel>
            </Field>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.nome_razao || !form.cnpj} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── COLABORADORES ────────────────────────────────────────────────────────────

interface Colaborador { id: number; nome: string; cargo: string; nivel: string; email: string; ativo: boolean }

function TabColaboradores() {
  const [rows, setRows] = useState<Colaborador[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome:'', email:'', cargo:'', nivel:'vendedor', tipo_contrato:'clt', salario_base:'', data_admissao:'' })

  useEffect(() => { fetch() }, [])

  async function fetch() {
    try { const { data } = await api.get('/api/rh/colaboradores/'); setRows(data.results ?? data) }
    catch { setRows(MOCK_COLABORADORES) }
  }

  async function save() {
    setSaving(true)
    try { await api.post('/api/rh/colaboradores/', form); setModal(false); fetch() }
    catch { alert('Erro ao salvar') } finally { setSaving(false) }
  }

  const niveis: Record<string,string> = { diretor:'Diretor', gerente:'Gerente', vendedor:'Vendedor / Consultor', operacional:'Operacional', administrativo:'Administrativo' }

  const filtered = rows.filter(r => r.nome.toLowerCase().includes(search.toLowerCase()) || r.cargo?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <Bar value={search} onChange={setSearch} placeholder="Buscar por nome ou cargo...">
        <BtnNew onClick={() => { setForm({nome:'',email:'',cargo:'',nivel:'vendedor',tipo_contrato:'clt',salario_base:'',data_admissao:''}); setModal(true) }} label="Novo Colaborador" />
      </Bar>
      <Table heads={['Nome', 'Cargo', 'Perfil de Acesso', 'E-mail', 'Status']}>
        {filtered.length === 0 ? <Empty cols={5} /> : filtered.map(r => (
          <Tr key={r.id}>
            <TdMain>{r.nome}</TdMain>
            <Td>{r.cargo}</Td>
            <td className="px-4 py-3">
              <span className="text-xs bg-card2 border border-border px-2 py-0.5 rounded text-text-secondary">{niveis[r.nivel] || r.nivel}</span>
            </td>
            <Td>{r.email}</Td>
            <td className="px-4 py-3"><Badge label={r.ativo ? 'Ativo' : 'Inativo'} green={r.ativo} /></td>
            <Actions />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Novo Colaborador" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Nome Completo *"><input className={inp} value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))} placeholder="Carlos Eduardo Silva" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="E-mail *"><input type="email" className={inp} value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="carlos@empresa.com" /></Field>
              <Field label="Cargo"><input className={inp} value={form.cargo} onChange={e => setForm(f=>({...f,cargo:e.target.value}))} placeholder="Vendedor Externo" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Perfil de Acesso *">
                <Sel value={form.nivel} onChange={v => setForm(f=>({...f,nivel:v}))}>
                  <option value="diretor">Diretor — acesso total</option>
                  <option value="gerente">Gerente — aprova pedidos</option>
                  <option value="administrativo">Administrativo</option>
                  <option value="vendedor">Vendedor / Consultor — vê seus clientes</option>
                  <option value="operacional">Operacional — estoque sem valores</option>
                </Sel>
              </Field>
              <Field label="Vínculo Empregatício">
                <Sel value={form.tipo_contrato} onChange={v => setForm(f=>({...f,tipo_contrato:v}))}>
                  <option value="clt">CLT</option>
                  <option value="pj">PJ</option>
                  <option value="autonomo">Autônomo</option>
                  <option value="estagio">Estágio</option>
                </Sel>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Salário Base (R$)"><input type="number" className={inp} value={form.salario_base} onChange={e => setForm(f=>({...f,salario_base:e.target.value}))} placeholder="3000.00" /></Field>
              <Field label="Data de Admissão"><input type="date" className={inp} value={form.data_admissao} onChange={e => setForm(f=>({...f,data_admissao:e.target.value}))} /></Field>
            </div>
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
              <p className="text-xs text-accent">O sistema enviará um e-mail com as instruções de acesso para o colaborador após o cadastro.</p>
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.nome || !form.email} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── VEÍCULOS ─────────────────────────────────────────────────────────────────

interface Veiculo { id: number; tipo: string; tipo_label: string; descricao: string; placa: string; marca: string; modelo: string; ano: number; numero_serie: string; vencimento_doc: string; ativo: boolean }

function TabVeiculos() {
  const [rows, setRows] = useState<Veiculo[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Veiculo | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ tipo:'caminhao', descricao:'', placa:'', marca:'', modelo:'', ano:new Date().getFullYear(), numero_serie:'', vencimento_doc:'', ativo:true })

  useEffect(() => { fetch() }, [])

  async function fetch() {
    try { const { data } = await api.get('/api/veiculos/'); setRows(data.results ?? data) }
    catch { setRows(MOCK_VEICULOS) }
  }

  function openEdit(r: Veiculo) { setEditing(r); setForm({tipo:r.tipo,descricao:r.descricao,placa:r.placa,marca:r.marca,modelo:r.modelo,ano:r.ano,numero_serie:r.numero_serie||'',vencimento_doc:r.vencimento_doc||'',ativo:r.ativo}); setModal(true) }

  async function save() {
    setSaving(true)
    try {
      if (editing) await api.patch(`/api/veiculos/${editing.id}/`, form)
      else await api.post('/api/veiculos/', form)
      setModal(false); fetch()
    } catch { alert('Erro ao salvar') } finally { setSaving(false) }
  }

  const filtered = rows.filter(r => r.placa?.toLowerCase().includes(search.toLowerCase()) || r.descricao.toLowerCase().includes(search.toLowerCase()) || r.marca?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <Bar value={search} onChange={setSearch} placeholder="Buscar por placa, marca...">
        <BtnNew onClick={() => { setEditing(null); setForm({tipo:'caminhao',descricao:'',placa:'',marca:'',modelo:'',ano:new Date().getFullYear(),numero_serie:'',vencimento_doc:'',ativo:true}); setModal(true) }} label="Cadastrar Veículo" />
      </Bar>
      <Table heads={['Tipo', 'Descrição', 'Placa', 'Marca / Modelo', 'Ano', 'Nº Série', 'Venc. Doc.', 'Status']}>
        {filtered.length === 0 ? <Empty cols={8} /> : filtered.map(r => (
          <Tr key={r.id}>
            <Td>{r.tipo_label || r.tipo}</Td>
            <TdMain>{r.descricao}</TdMain>
            <Td mono>{r.placa}</Td>
            <Td>{r.marca} {r.modelo}</Td>
            <Td>{r.ano}</Td>
            <Td mono>{r.numero_serie}</Td>
            <Td>{r.vencimento_doc}</Td>
            <td className="px-4 py-3"><Badge label={r.ativo ? 'Ativo' : 'Inativo'} green={r.ativo} /></td>
            <Actions onEdit={() => openEdit(r)} onDelete={async () => { if(confirm('Excluir?')) { try { await api.delete(`/api/veiculos/${r.id}/`); fetch() } catch { alert('Erro') } } }} />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title={editing ? 'Editar Veículo' : 'Cadastrar Veículo'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo *">
                <Sel value={form.tipo} onChange={v => setForm(f=>({...f,tipo:v}))}>
                  <option value="caminhao">Caminhão</option>
                  <option value="van">Van</option>
                  <option value="pickup">Pickup</option>
                  <option value="trator">Trator</option>
                  <option value="implemento">Implemento Agrícola</option>
                  <option value="moto">Motocicleta</option>
                  <option value="outro">Outro</option>
                </Sel>
              </Field>
              <Field label="Placa"><input className={inp} value={form.placa} onChange={e => setForm(f=>({...f,placa:e.target.value.toUpperCase()}))} placeholder="ABC-1D23" /></Field>
            </div>
            <Field label="Descrição *"><input className={inp} value={form.descricao} onChange={e => setForm(f=>({...f,descricao:e.target.value}))} placeholder="Ex: Caminhão Baú Principal" /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Marca"><input className={inp} value={form.marca} onChange={e => setForm(f=>({...f,marca:e.target.value}))} placeholder="Volvo" /></Field>
              <Field label="Modelo"><input className={inp} value={form.modelo} onChange={e => setForm(f=>({...f,modelo:e.target.value}))} placeholder="FH 460" /></Field>
              <Field label="Ano"><input type="number" className={inp} value={form.ano} onChange={e => setForm(f=>({...f,ano:+e.target.value}))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Número de Série"><input className={inp} value={form.numero_serie} onChange={e => setForm(f=>({...f,numero_serie:e.target.value}))} placeholder="9BWZZZ377VT004251" /></Field>
              <Field label="Vencimento CRLV"><input type="date" className={inp} value={form.vencimento_doc} onChange={e => setForm(f=>({...f,vencimento_doc:e.target.value}))} /></Field>
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.descricao} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── FAZENDAS ─────────────────────────────────────────────────────────────────

interface Fazenda { id: number; nome: string; cliente_nome: string; municipio: string; uf: string; area_total_ha: number; car: string; ativa: boolean }

function TabFazendas() {
  const [rows, setRows] = useState<Fazenda[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome:'', municipio:'', uf:'', area_total_ha:'', car:'', coordenadas:'' })

  useEffect(() => { fetch() }, [])

  async function fetch() {
    try { const { data } = await api.get('/api/fazendas/'); setRows(data.results ?? data) }
    catch { setRows(MOCK_FAZENDAS) }
  }

  async function save() {
    setSaving(true)
    try { await api.post('/api/fazendas/', form); setModal(false); fetch() }
    catch { alert('Erro ao salvar') } finally { setSaving(false) }
  }

  const filtered = rows.filter(r => r.nome.toLowerCase().includes(search.toLowerCase()) || (r.cliente_nome||'').toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <Bar value={search} onChange={setSearch} placeholder="Buscar fazenda ou produtor...">
        <BtnNew onClick={() => { setForm({nome:'',municipio:'',uf:'',area_total_ha:'',car:'',coordenadas:''}); setModal(true) }} label="Cadastrar Fazenda" />
      </Bar>
      <Table heads={['Nome', 'Produtor Vinculado', 'Município / UF', 'Área Total (ha)', 'CAR', 'Status']}>
        {filtered.length === 0 ? <Empty cols={6} /> : filtered.map(r => (
          <Tr key={r.id}>
            <TdMain>{r.nome}</TdMain>
            <Td>{r.cliente_nome}</Td>
            <Td>{r.municipio} / {r.uf}</Td>
            <Td mono>{Number(r.area_total_ha).toLocaleString('pt-BR')} ha</Td>
            <Td mono>{r.car}</Td>
            <td className="px-4 py-3"><Badge label={r.ativa ? 'Ativa' : 'Inativa'} green={r.ativa} /></td>
            <Actions />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Cadastrar Fazenda" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Nome da Fazenda *"><input className={inp} value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))} placeholder="Fazenda Santa Cruz" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Município *"><input className={inp} value={form.municipio} onChange={e => setForm(f=>({...f,municipio:e.target.value}))} placeholder="Ribeirão Preto" /></Field>
              <Field label="UF *">
                <Sel value={form.uf} onChange={v => setForm(f=>({...f,uf:v}))}>
                  <option value="">Selecionar...</option>
                  {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                </Sel>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Área Total (ha)"><input type="number" className={inp} value={form.area_total_ha} onChange={e => setForm(f=>({...f,area_total_ha:e.target.value}))} placeholder="1500.00" /></Field>
              <Field label="CAR"><input className={inp} value={form.car} onChange={e => setForm(f=>({...f,car:e.target.value}))} placeholder="SP-3543402-..." /></Field>
            </div>
            <Field label="Coordenadas GPS (opcional)"><input className={inp} value={form.coordenadas} onChange={e => setForm(f=>({...f,coordenadas:e.target.value}))} placeholder="-21.1767, -47.8208" /></Field>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.nome || !form.municipio || !form.uf} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── TABELAS DE PREÇO ─────────────────────────────────────────────────────────

interface TabelaPreco { id: number; nome: string; canal_venda: string; grupo_nome: string; cliente_nome: string; regiao: string; data_inicio: string; data_fim: string; ativa: boolean }

function TabTabelasPreco() {
  const [rows, setRows] = useState<TabelaPreco[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome:'', canal_venda:'', regiao:'', data_inicio:'', data_fim:'', ativa:true })

  useEffect(() => { fetch() }, [])

  async function fetch() {
    try { const { data } = await api.get('/api/tabelas-preco/'); setRows(data.results ?? data) }
    catch { setRows(MOCK_TABELAS) }
  }

  async function save() {
    setSaving(true)
    try { await api.post('/api/tabelas-preco/', form); setModal(false); fetch() }
    catch { alert('Erro ao salvar') } finally { setSaving(false) }
  }

  const filtered = rows.filter(r => r.nome.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <Bar value={search} onChange={setSearch} placeholder="Buscar tabela...">
        <BtnNew onClick={() => { setForm({nome:'',canal_venda:'',regiao:'',data_inicio:'',data_fim:'',ativa:true}); setModal(true) }} label="Nova Tabela" />
      </Bar>
      <Table heads={['Nome', 'Canal de Venda', 'Grupo / Cliente', 'Região', 'Vigência', 'Status']}>
        {filtered.length === 0 ? <Empty cols={6} /> : filtered.map(r => (
          <Tr key={r.id}>
            <TdMain>{r.nome}</TdMain>
            <Td>{r.canal_venda || '—'}</Td>
            <Td>{r.grupo_nome || r.cliente_nome || 'Geral'}</Td>
            <Td>{r.regiao || '—'}</Td>
            <Td>{r.data_inicio} → {r.data_fim || '∞'}</Td>
            <td className="px-4 py-3"><Badge label={r.ativa ? 'Ativa' : 'Inativa'} green={r.ativa} /></td>
            <Actions />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Nova Tabela de Preço" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Nome *"><input className={inp} value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))} placeholder="Tabela Varejo SP" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Canal de Venda">
                <Sel value={form.canal_venda} onChange={v => setForm(f=>({...f,canal_venda:v}))}>
                  <option value="">Todos</option>
                  <option value="balcao">Balcão</option>
                  <option value="campo">Campo</option>
                  <option value="televendas">Televendas</option>
                  <option value="ecommerce">E-commerce</option>
                </Sel>
              </Field>
              <Field label="Região"><input className={inp} value={form.regiao} onChange={e => setForm(f=>({...f,regiao:e.target.value}))} placeholder="Sudeste" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vigência Início"><input type="date" className={inp} value={form.data_inicio} onChange={e => setForm(f=>({...f,data_inicio:e.target.value}))} /></Field>
              <Field label="Vigência Fim"><input type="date" className={inp} value={form.data_fim} onChange={e => setForm(f=>({...f,data_fim:e.target.value}))} /></Field>
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.nome} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── TRANSPORTADORAS ─────────────────────────────────────────────────────────

interface Transportadora { id: number; nome_razao: string; cnpj: string; rntrc: string; telefone?: string; email?: string; ativo?: boolean }

const MOCK_TRANSPORTADORAS_CAD = [
  { id:1, nome_razao:'Expresso Rural Transportes Ltda', cnpj:'12.345.678/0001-99', rntrc:'00123456', telefone:'(16) 3333-1111', email:'cte@expressorrural.com.br', ativo:true },
  { id:2, nome_razao:'Logística Agro Centro-Oeste', cnpj:'98.765.432/0001-11', rntrc:'00987654', telefone:'(67) 9999-2222', email:'frete@agrocentrooeste.com', ativo:true },
]

function TabTransportadoras() {
  const [rows, setRows] = useState<Transportadora[]>(MOCK_TRANSPORTADORAS_CAD)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Transportadora | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome_razao:'', cnpj:'', rntrc:'', telefone:'', email:'', contato_nome:'', endereco:'', municipio:'', uf:'' })

  useEffect(() => { loadRows() }, [])

  async function loadRows() {
    try { const { data } = await api.get('/api/transportadoras/'); setRows(data.results ?? data) }
    catch { setRows(MOCK_TRANSPORTADORAS_CAD) }
  }

  function openNew() { setEditing(null); setForm({ nome_razao:'', cnpj:'', rntrc:'', telefone:'', email:'', contato_nome:'', endereco:'', municipio:'', uf:'' }); setModal(true) }
  function openEdit(r: Transportadora) { setEditing(r); setForm({ nome_razao:r.nome_razao, cnpj:r.cnpj, rntrc:r.rntrc, telefone:r.telefone||'', email:r.email||'', contato_nome:'', endereco:'', municipio:'', uf:'' }); setModal(true) }

  async function save() {
    setSaving(true)
    try {
      if (editing) await api.patch(`/api/transportadoras/${editing.id}/`, form)
      else await api.post('/api/transportadoras/', form)
      setModal(false); loadRows()
    } catch {
      if (!editing) setRows(r => [...r, { id: Date.now(), ...form, ativo: true }])
      setModal(false)
    } finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!confirm('Excluir transportadora?')) return
    try { await api.delete(`/api/transportadoras/${id}/`); loadRows() } catch { setRows(r => r.filter(x => x.id !== id)) }
  }

  const filtered = rows.filter(r => r.nome_razao.toLowerCase().includes(search.toLowerCase()) || r.cnpj?.includes(search) || r.rntrc?.includes(search))

  return (
    <div>
      <Bar value={search} onChange={setSearch} placeholder="Buscar por nome, CNPJ ou RNTRC...">
        <ExportButtons endpoint="/api/transportadoras/" filename="transportadoras" />
        <BtnNew onClick={openNew} label="Nova Transportadora" />
      </Bar>
      <Table heads={['Razão Social', 'CNPJ', 'RNTRC', 'Telefone', 'E-mail', 'Status']}>
        {filtered.length === 0 ? <Empty cols={6} /> : filtered.map(r => (
          <Tr key={r.id}>
            <TdMain>{r.nome_razao}</TdMain>
            <Td mono>{r.cnpj}</Td>
            <Td mono>{r.rntrc}</Td>
            <Td>{r.telefone}</Td>
            <Td>{r.email}</Td>
            <td className="px-4 py-3"><Badge label={r.ativo !== false ? 'Ativa' : 'Inativa'} green={r.ativo !== false} /></td>
            <Actions onEdit={() => openEdit(r)} onDelete={() => del(r.id)} />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title={editing ? 'Editar Transportadora' : 'Nova Transportadora'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Razão Social *"><input className={inp} value={form.nome_razao} onChange={e => setForm(f=>({...f,nome_razao:e.target.value}))} placeholder="Expresso Rural Transportes Ltda" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CNPJ *"><input className={inp} value={form.cnpj} onChange={e => setForm(f=>({...f,cnpj:e.target.value}))} placeholder="00.000.000/0001-00" /></Field>
              <Field label="RNTRC *"><input className={inp} value={form.rntrc} onChange={e => setForm(f=>({...f,rntrc:e.target.value}))} placeholder="00000000" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Telefone"><input className={inp} value={form.telefone} onChange={e => setForm(f=>({...f,telefone:e.target.value}))} placeholder="(16) 3333-1111" /></Field>
              <Field label="E-mail"><input type="email" className={inp} value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="cte@transportadora.com" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Contato Principal"><input className={inp} value={form.contato_nome} onChange={e => setForm(f=>({...f,contato_nome:e.target.value}))} placeholder="Nome do responsável" /></Field>
              <Field label="Município / UF">
                <div className="flex gap-2">
                  <input className={inp} value={form.municipio} onChange={e => setForm(f=>({...f,municipio:e.target.value}))} placeholder="Cidade" />
                  <div className="relative w-24 shrink-0">
                    <select className={sel} value={form.uf} onChange={e => setForm(f=>({...f,uf:e.target.value}))}>
                      <option value="">UF</option>
                      {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  </div>
                </div>
              </Field>
            </div>
            <Field label="Endereço"><input className={inp} value={form.endereco} onChange={e => setForm(f=>({...f,endereco:e.target.value}))} placeholder="Rua, número" /></Field>
            <div className="bg-card2 border border-border rounded-lg px-4 py-3">
              <p className="text-xs text-text-muted">A tabela de fretes por rota e peso é gerenciada no módulo <span className="text-accent">Logística → Transportadoras</span>.</p>
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.nome_razao || !form.cnpj || !form.rntrc} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── TABELAS AUXILIARES ───────────────────────────────────────────────────────

interface AuxItem { id: number; nome: string; descricao?: string }

function AuxTable({ title, endpoint, placeholder }: { title: string; endpoint: string; placeholder: string }) {
  const [rows, setRows] = useState<AuxItem[]>([])
  const [modal, setModal] = useState(false)
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetch() }, [endpoint])

  async function fetch() {
    try { const { data } = await api.get(endpoint); setRows(data.results ?? data) }
    catch { setRows([]) }
  }

  async function save() {
    if (!nome) return
    setSaving(true)
    try { await api.post(endpoint, { nome }); setModal(false); setNome(''); fetch() }
    catch { /* silently keep mock */ setRows(r => [...r, { id: Date.now(), nome }]); setModal(false); setNome('') }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <button onClick={() => { setNome(''); setModal(true) }} className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"><Plus size={13} /> Adicionar</button>
      </div>
      <div className="divide-y divide-border/50 max-h-48 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">Nenhum registro</p>
        ) : rows.map(r => (
          <div key={r.id} className="flex items-center justify-between px-4 py-2 hover:bg-card2 transition-colors">
            <span className="text-sm text-text-primary">{r.nome}</span>
            <button onClick={async () => { try { await api.delete(`${endpoint}${r.id}/`); fetch() } catch { setRows(rs => rs.filter(x => x.id !== r.id)) } }} className="text-text-muted hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm">
            <h4 className="font-semibold text-text-primary mb-4">Adicionar — {title}</h4>
            <input className={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder={placeholder} autoFocus onKeyDown={e => e.key === 'Enter' && save()} />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModal(false)} className="flex-1 border border-border text-text-muted py-2 rounded-lg text-sm hover:bg-card2">Cancelar</button>
              <button onClick={save} disabled={saving || !nome} className="flex-1 bg-accent text-bg font-semibold py-2 rounded-lg text-sm disabled:opacity-60">{saving ? '...' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabAuxiliares() {
  return (
    <div>
      <p className="text-sm text-text-muted mb-4">Listas de apoio usadas em todo o sistema — grupos de cliente e centros de custo.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AuxTable title="Grupos de Cliente"  endpoint="/api/grupos-cliente/"           placeholder="Ex: Produtor Premium" />
        <AuxTable title="Centros de Custo"   endpoint="/api/financeiro/centros-custo/" placeholder="Ex: Comercial SP" />
      </div>
      <p className="text-xs text-text-muted mt-4">Demais tabelas auxiliares (unidades, bancos, condições de pagamento) serão adicionadas conforme os endpoints forem criados no backend.</p>
    </div>
  )
}

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK_PRODUTOS = [
  { id:1, nome:'Roundup Original', sku:'DEF-001', ean:'7891234567890', tipo_produto:'defensivo', tipo_produto_label:'Defensivo', metodo_custeio:'cmp', unidade_medida:'L', preco_venda:89.90, quantidade:150, ncm:'3808.92.19', ativo:true },
  { id:2, nome:'Ureia 45%', sku:'FER-001', ean:'', tipo_produto:'fertilizante', tipo_produto_label:'Fertilizante', metodo_custeio:'fifo', unidade_medida:'SC', preco_venda:125.00, quantidade:320, ncm:'3102.10.10', ativo:true },
  { id:3, nome:'Soja RR1 Intacta', sku:'SEM-001', ean:'', tipo_produto:'semente', tipo_produto_label:'Semente', metodo_custeio:'cmp', unidade_medida:'SC', preco_venda:285.00, quantidade:0, ncm:'1201.10.00', ativo:true },
]

const MOCK_CLIENTES = [
  { id:1, nome_razao:'Fazenda Santa Cruz', nome_fantasia:'', cnpj_cpf:'12.345.678/0001-90', tipo_pessoa:'PJ', tipo_cliente:'produtor_rural', telefone:'(16) 99999-0001', limite_credito:50000, ativo:true, grupo_nome:'Produtor Premium', tabela_preco_id:1, tabela_preco_nome:'Tabela Campo Premium' },
  { id:2, nome_razao:'João da Silva', nome_fantasia:'', cnpj_cpf:'123.456.789-00', tipo_pessoa:'PF', tipo_cliente:'balcao', telefone:'(16) 98888-0002', limite_credito:5000, ativo:true, grupo_nome:'Balcão', tabela_preco_id:undefined, tabela_preco_nome:undefined },
  { id:3, nome_razao:'Cooperativa Agronorte', nome_fantasia:'Agronorte', cnpj_cpf:'98.765.432/0001-10', tipo_pessoa:'PJ', tipo_cliente:'cooperativa', telefone:'(17) 3333-0003', limite_credito:200000, ativo:true, grupo_nome:'Cooperativa', tabela_preco_id:undefined, tabela_preco_nome:undefined },
]

const MOCK_FORNECEDORES = [
  { id:1, nome_razao:'Monsanto do Brasil Ltda', cnpj:'60.557.660/0001-01', telefone:'(11) 3333-1111', email:'contato@monsanto.com' },
  { id:2, nome_razao:'Yara Brasil Fertilizantes', cnpj:'84.496.066/0001-19', telefone:'(11) 4444-2222', email:'vendas@yara.com.br' },
]

const MOCK_COLABORADORES = [
  { id:1, nome:'Carlos Eduardo Silva', cargo:'Vendedor Externo', nivel:'vendedor', email:'carlos@agropulse.com', ativo:true },
  { id:2, nome:'Ana Paula Ferreira', cargo:'Gerente Comercial', nivel:'gerente', email:'ana@agropulse.com', ativo:true },
]

const MOCK_VEICULOS = [
  { id:1, tipo:'caminhao', tipo_label:'Caminhão', descricao:'Caminhão Baú Principal', placa:'ABC-1234', marca:'Volvo', modelo:'FH 460', ano:2022, numero_serie:'9BW000000V0000001', vencimento_doc:'2026-12-31', ativo:true },
  { id:2, tipo:'pickup', tipo_label:'Pickup', descricao:'Pickup Vendedor', placa:'DEF-5678', marca:'Toyota', modelo:'Hilux', ano:2023, numero_serie:'', vencimento_doc:'2027-06-30', ativo:true },
]

const MOCK_FAZENDAS = [
  { id:1, nome:'Fazenda Santa Cruz', cliente_nome:'João da Silva', municipio:'Ribeirão Preto', uf:'SP', area_total_ha:1500, car:'SP-3543402-ABC123', ativa:true },
  { id:2, nome:'Sítio Boa Esperança', cliente_nome:'Maria Souza', municipio:'Uberlândia', uf:'MG', area_total_ha:320, car:'MG-3170206-DEF456', ativa:true },
]

const MOCK_TABELAS = [
  { id:1, nome:'Tabela Varejo SP', canal_venda:'balcao', grupo_nome:'Balcão', cliente_nome:'', regiao:'Sudeste', data_inicio:'2026-01-01', data_fim:'2026-12-31', ativa:true },
  { id:2, nome:'Tabela Campo Premium', canal_venda:'campo', grupo_nome:'Produtor Premium', cliente_nome:'', regiao:'Centro-Oeste', data_inicio:'2026-01-01', data_fim:'', ativa:true },
]

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

const TABS = ['Produtos', 'Clientes', 'Fornecedores', 'Transportadoras', 'Colaboradores', 'Veículos', 'Fazendas', 'Tabelas de Preço', 'Tabelas Auxiliares']

export default function Cadastros() {
  const [tab, setTab] = useState('Produtos')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Cadastros Gerais</h1>
        <p className="text-sm text-text-muted">Base central de todas as entidades do sistema</p>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Produtos'           && <TabProdutos />}
      {tab === 'Clientes'           && <TabClientes />}
      {tab === 'Fornecedores'       && <TabFornecedores />}
      {tab === 'Transportadoras'    && <TabTransportadoras />}
      {tab === 'Colaboradores'      && <TabColaboradores />}
      {tab === 'Veículos'           && <TabVeiculos />}
      {tab === 'Fazendas'           && <TabFazendas />}
      {tab === 'Tabelas de Preço'   && <TabTabelasPreco />}
      {tab === 'Tabelas Auxiliares' && <TabAuxiliares />}
    </div>
  )
}
