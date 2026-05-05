import { useEffect, useState, useRef } from 'react'
import { Plus, Search, X, ChevronDown, ShoppingCart, Check, AlertTriangle, FileText, Lock, RotateCcw, Ban, DollarSign } from 'lucide-react'
import ExportButtons from '../components/ExportButtons'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

// ─── shared ──────────────────────────────────────────────────────────────────

const inp = 'w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors'
const sel = inp + ' appearance-none'
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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

function Badge({ label, color }: { label: string; color: 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'orange' }) {
  const cls = { green: 'bg-accent/10 text-accent', red: 'bg-red-100 text-red-600', yellow: 'bg-yellow-100 text-yellow-700', gray: 'bg-card2 text-text-muted border border-border', blue: 'bg-blue-100 text-blue-700', orange: 'bg-orange-100 text-orange-600' }
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

// ─── types ────────────────────────────────────────────────────────────────────

interface Pedido { id: number; cliente_nome: string; vendedor_nome: string; valor_total: number; status: string; status_display: string; data_pedido: string; condicao_pagamento: string }
interface ItemPedido { produto: string; quantidade: number; preco_unitario: number; desconto: number }
interface Orcamento { id: number; cliente_nome: string; valor_total: number; status: string; criado_em: string; validade: string }
interface Aprovacao { id: number; pedido_id: number; cliente: string; vendedor: string; valor: number; motivo: string; data_expiracao: string }
interface VendaPDV { id: number; cliente_nome: string; valor_total: number; forma_pagamento: string; criado_em: string }
interface Devolucao { id: number; pedido_numero: number; cliente_nome: string; status: string; motivo: string; criado_em: string }
interface Comissao { vendedor: string; pedidos: number; valor_vendas: number; comissao_total: number; status: string }

// ─── Tab Pedidos ──────────────────────────────────────────────────────────────

function TabPedidos() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Pedido[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // ── AQUI: Estado inicial ajustado para mandar '1' (IDs reais) em vez de texto solto
  const [form, setForm] = useState({ cliente: '1', vendedor: '1', condicao_pagamento: '1', forma_pagamento: '1', observacao: '' })
  const [itens, setItens] = useState<ItemPedido[]>([{ produto: '1', quantidade: 1, preco_unitario: 150, desconto: 0 }])

  // action modals
  const [faturarModal, setFaturarModal] = useState<Pedido | null>(null)
  const [cancelarModal, setCancelarModal] = useState<Pedido | null>(null)
  const [devolverModal, setDevolverModal] = useState<Pedido | null>(null)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [actionSaving, setActionSaving] = useState(false)
  const [devolucaoForm, setDevolucaoForm] = useState({ motivo: '', destino_credito: 'abatimento', observacao: '' })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try { 
      const { data } = await api.get('/api/pedidos/')
      const lista = data.results ?? data
      setRows(Array.isArray(lista) ? lista : []) 
    }
    catch { setRows([]) }
  }

  // ── AQUI: Função save() converte tudo para números (IDs)
  async function save() {
    setSaving(true)
    try {
      const payload = {
        empresa: 1, // Empresa obrigatória!
        cliente: Number(form.cliente),
        vendedor: Number(form.vendedor),
        condicao_pagamento: Number(form.condicao_pagamento),
        forma_pagamento: Number(form.forma_pagamento),
        observacao: form.observacao,
        itens: itens.map(i => ({
          produto: Number(i.produto),
          quantidade: Number(i.quantidade),
          preco_unitario: Number(i.preco_unitario),
          desconto: Number(i.desconto)
        }))
      }
      
      await api.post('/api/pedidos/', payload)
      setModal(false)
      fetchData()
    } catch (error) { 
      console.error(error)
      alert('Erro ao criar pedido. Verifique o console.') 
    } finally { 
      setSaving(false) 
    }
  }

  async function faturar() {
    if (!faturarModal) return
    setActionSaving(true)
    try {
      await api.post(`/api/fiscal/emitir-nfe/${faturarModal.id}/`, {})
      setRows(rs => rs.map(r => r.id === faturarModal.id ? { ...r, status: 'faturado', status_display: 'Faturado' } : r))
      setFaturarModal(null)
    } catch { alert('Erro ao faturar. Verifique a configuração fiscal.') }
    finally { setActionSaving(false) }
  }

  async function cancelar() {
    if (!cancelarModal) return
    setActionSaving(true)
    try {
      await api.patch(`/api/pedidos/${cancelarModal.id}/`, { status: 'cancelado', motivo_cancelamento: motivoCancelamento })
      setRows(rs => rs.map(r => r.id === cancelarModal.id ? { ...r, status: 'cancelado', status_display: 'Cancelado' } : r))
      setCancelarModal(null); setMotivoCancelamento('')
    } catch { alert('Erro ao cancelar pedido') }
    finally { setActionSaving(false) }
  }

  async function devolver() {
    if (!devolverModal) return
    setActionSaving(true)
    try {
      await api.post('/api/devolucoes/', { pedido_original: devolverModal.id, ...devolucaoForm })
      setDevolverModal(null); setDevolucaoForm({ motivo: '', destino_credito: 'abatimento', observacao: '' })
      alert('Devolução registrada. NF-e de devolução emitida automaticamente.')
    } catch { alert('Erro ao registrar devolução') }
    finally { setActionSaving(false) }
  }

  const statusColor: Record<string, 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'orange'> = {
    faturado: 'green', cancelado: 'red', aguardando: 'yellow', aprovado: 'blue', recusado: 'red', expirado: 'gray', em_analise: 'orange'
  }

  const canFaturar = (s: string) => s === 'aprovado' || s === 'aguardando'
  const canCancelar = (s: string) => ['aguardando', 'aprovado', 'em_analise'].includes(s)
  const canDevolver = (s: string) => s === 'faturado'

  const filtered = rows.filter(r =>
    (r.cliente_nome?.toLowerCase().includes(search.toLowerCase()) || String(r.id).includes(search)) &&
    (filterStatus ? r.status === filterStatus : true)
  )

  function toggleSel(id: number) { setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSel(s => s.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(r => r.id))) }

  const totalMes = rows.filter(r => r.status === 'faturado').reduce((s, r) => s + r.valor_total, 0)
  const aguardando = rows.filter(r => r.status === 'aguardando').length
  const bloqueados = rows.filter(r => r.status === 'em_analise').length

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Faturado no Mês', val: fmt(totalMes), color: 'text-accent' },
          { label: 'Aguardando Aprovação', val: String(aguardando), color: aguardando > 0 ? 'text-yellow-600' : 'text-text-primary' },
          { label: 'Pedidos Bloqueados', val: String(bloqueados), color: bloqueados > 0 ? 'text-red-500' : 'text-text-primary' },
          { label: 'Total de Pedidos', val: String(rows.length), color: 'text-text-primary' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente ou nº..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-64 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="relative">
          <select className={sel + ' w-44'} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="aguardando">Aguardando</option>
            <option value="aprovado">Aprovado</option>
            <option value="faturado">Faturado</option>
            <option value="em_analise">Em Análise</option>
            <option value="recusado">Recusado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <div className="flex-1" />
        <ExportButtons endpoint="/api/pedidos/" params={filterStatus ? { status: filterStatus } : {}} filename="pedidos_venda" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <button onClick={() => { setItens([{ produto:'1',quantidade:1,preco_unitario:150,desconto:0 }]); setForm(f => ({ ...f, cliente: '1', vendedor: '1' })); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Novo Pedido
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" checked={sel.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
              {['#', 'Cliente', 'Vendedor', 'Data', 'Cond. Pgto', 'Valor Total', 'Status', 'Ações'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-text-muted">Nenhum pedido encontrado</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className={`border-b border-border/50 hover:bg-card2 transition-colors ${sel.has(r.id) ? 'bg-accent/5' : ''}`}>
                <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
                <td className="px-4 py-3 font-mono text-text-muted text-xs">#{r.id}</td>
                <td className="px-4 py-3 font-medium text-text-primary">{r.cliente_nome}</td>
                <td className="px-4 py-3 text-text-muted">{r.vendedor_nome || '—'}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{r.data_pedido}</td>
                <td className="px-4 py-3 text-text-muted">{r.condicao_pagamento || '—'}</td>
                <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmt(r.valor_total)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {r.status === 'em_analise' && <Lock size={12} className="text-orange-500" />}
                    <Badge label={r.status_display || r.status} color={statusColor[r.status] ?? 'gray'} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {canFaturar(r.status) && (
                      <button onClick={() => setFaturarModal(r)}
                        className="flex items-center gap-1 text-xs bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-lg hover:bg-accent/20 transition-colors font-medium whitespace-nowrap">
                        <FileText size={12} /> Faturar
                      </button>
                    )}
                    {canDevolver(r.status) && (
                      <button onClick={() => { setDevolucaoForm({motivo:'',destino_credito:'abatimento',observacao:''}); setDevolverModal(r) }}
                        className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors font-medium whitespace-nowrap">
                        <RotateCcw size={12} /> Devolver
                      </button>
                    )}
                    {canCancelar(r.status) && (
                      <button onClick={() => { setMotivoCancelamento(''); setCancelarModal(r) }}
                        className="flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-100 transition-colors font-medium whitespace-nowrap">
                        <Ban size={12} /> Cancelar
                      </button>
                    )}
                    {!canFaturar(r.status) && !canDevolver(r.status) && !canCancelar(r.status) && (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Novo Pedido */}
      {modal && (
        <Modal title="Novo Pedido de Venda" onClose={() => setModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cliente (ID) *">
                <input type="number" className={inp} value={form.cliente} onChange={e => setForm(f=>({...f,cliente:e.target.value}))} placeholder="Ex: 1" />
              </Field>
              <Field label="Vendedor (ID)">
                <input type="number" className={inp} value={form.vendedor} onChange={e => setForm(f=>({...f,vendedor:e.target.value}))} placeholder="Ex: 1" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Condição de Pagamento (ID)">
                <input type="number" className={inp} value={form.condicao_pagamento} onChange={e => setForm(f=>({...f,condicao_pagamento:e.target.value}))} placeholder="Ex: 2" />
              </Field>
              <Field label="Forma de Pagamento (ID)">
                <input type="number" className={inp} value={form.forma_pagamento} onChange={e => setForm(f=>({...f,forma_pagamento:e.target.value}))} placeholder="Ex: 2" />
              </Field>
            </div>

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-secondary">Itens do Pedido</label>
                <button onClick={() => setItens(i => [...i, { produto:'1',quantidade:1,preco_unitario:0,desconto:0 }])}
                  className="text-xs text-accent hover:text-accent/80 flex items-center gap-1"><Plus size={12} /> Adicionar item</button>
              </div>
              <div className="space-y-2">
                {itens.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center bg-card2 rounded-lg p-2">
                    <div className="col-span-4">
                      <input type="number" className={inp} value={item.produto} onChange={e => setItens(its => its.map((x,j) => j===i ? {...x,produto:e.target.value} : x))} placeholder="ID do Prod." />
                    </div>
                    <div className="col-span-2">
                      <input type="number" className={inp} value={item.quantidade} onChange={e => setItens(its => its.map((x,j) => j===i ? {...x,quantidade:+e.target.value} : x))} placeholder="Qtd" />
                    </div>
                    <div className="col-span-3">
                      <input type="number" className={inp} value={item.preco_unitario} onChange={e => setItens(its => its.map((x,j) => j===i ? {...x,preco_unitario:+e.target.value} : x))} placeholder="Preço unit." />
                    </div>
                    <div className="col-span-2">
                      <input type="number" className={inp} value={item.desconto} onChange={e => setItens(its => its.map((x,j) => j===i ? {...x,desconto:+e.target.value} : x))} placeholder="Desc%" />
                    </div>
                    <button onClick={() => setItens(its => its.filter((_,j) => j!==i))} className="col-span-1 flex justify-center text-text-muted hover:text-red-500"><X size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-2 text-sm font-mono font-bold text-text-primary">
                Total: {fmt(itens.reduce((s,i) => s + i.quantidade * i.preco_unitario * (1 - i.desconto/100), 0))}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              Se o desconto violar a margem mínima de algum produto, o pedido será automaticamente travado e o gerente será notificado para aprovação.
            </div>

            <Field label="Observações">
              <textarea className={inp} rows={2} value={form.observacao} onChange={e => setForm(f=>({...f,observacao:e.target.value}))} placeholder="Observações internas..." />
            </Field>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.cliente || itens.every(i=>!i.produto)} label="Criar Pedido" />
          </div>
        </Modal>
      )}

      {/* Faturar */}
      {faturarModal && (
        <Modal title={`Faturar Pedido #${faturarModal.id}`} onClose={() => setFaturarModal(null)}>
          <div className="space-y-4">
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Cliente</span>
                <span className="font-semibold text-text-primary">{faturarModal.cliente_nome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Valor</span>
                <span className="font-mono font-bold text-accent">{fmt(faturarModal.valor_total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Condição</span>
                <span className="text-text-primary">{faturarModal.condicao_pagamento || '—'}</span>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
              <FileText size={14} className="mt-0.5 flex-shrink-0" />
              Ao faturar: NF-e emitida via Focus NFe, estoque baixado e contas a receber geradas automaticamente.
            </div>
            <ModalFooter onClose={() => setFaturarModal(null)} onSave={faturar} saving={actionSaving} label="Confirmar e Emitir NF-e" />
          </div>
        </Modal>
      )}

      {/* Cancelar */}
      {cancelarModal && (
        <Modal title={`Cancelar Pedido #${cancelarModal.id}`} onClose={() => setCancelarModal(null)}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              Pedido de <strong>{cancelarModal.cliente_nome}</strong> — {fmt(cancelarModal.valor_total)}. Esta ação não pode ser desfeita.
            </div>
            <Field label="Motivo do cancelamento *">
              <textarea className={inp} rows={3} value={motivoCancelamento}
                onChange={e => setMotivoCancelamento(e.target.value)}
                placeholder="Descreva o motivo do cancelamento..." />
            </Field>
            <ModalFooter onClose={() => setCancelarModal(null)} onSave={cancelar} saving={actionSaving} disabled={!motivoCancelamento} label="Confirmar Cancelamento" />
          </div>
        </Modal>
      )}

      {/* Devolver */}
      {devolverModal && (
        <Modal title={`Devolução — Pedido #${devolverModal.id}`} onClose={() => setDevolverModal(null)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
              <RotateCcw size={14} className="mt-0.5 flex-shrink-0" />
              Estoque retorna com lote original. NF-e de devolução emitida automaticamente com CFOP correto.
            </div>
            <div className="text-sm text-text-muted">
              Cliente: <strong className="text-text-primary">{devolverModal.cliente_nome}</strong> · {fmt(devolverModal.valor_total)}
            </div>
            <Field label="Motivo da Devolução *">
              <Sel value={devolucaoForm.motivo} onChange={v => setDevolucaoForm(f=>({...f,motivo:v}))}>
                <option value="">Selecionar...</option>
                <option value="produto_danificado">Produto danificado</option>
                <option value="produto_errado">Produto errado</option>
                <option value="desistencia">Desistência do cliente</option>
                <option value="prazo_entrega">Prazo de entrega não cumprido</option>
                <option value="outro">Outro</option>
              </Sel>
            </Field>
            <Field label="Destino do Crédito">
              <Sel value={devolucaoForm.destino_credito} onChange={v => setDevolucaoForm(f=>({...f,destino_credito:v}))}>
                <option value="abatimento">Abatimento em próxima compra</option>
                <option value="dinheiro">Devolução em dinheiro / PIX</option>
                <option value="estorno_cartao">Estorno no cartão</option>
              </Sel>
            </Field>
            <Field label="Observações">
              <textarea className={inp} rows={2} value={devolucaoForm.observacao} onChange={e => setDevolucaoForm(f=>({...f,observacao:e.target.value}))} />
            </Field>
            <ModalFooter onClose={() => setDevolverModal(null)} onSave={devolver} saving={actionSaving} disabled={!devolucaoForm.motivo} label="Confirmar Devolução" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Orçamentos ───────────────────────────────────────────────────────────

function TabOrcamentos() {
  const [rows, setRows] = useState<Orcamento[]>([])
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState<number | null>(null)
  const [form, setForm] = useState({ cliente: '', validade_dias: '30', observacao: '' })
  const [itens, setItens] = useState([{ produto: '', quantidade: 1, preco_unitario: 0 }])

  useEffect(() => {
    api.get('/api/orcamentos/').then(({ data }) => setRows(data.results ?? data)).catch(() => setRows([]))
  }, [])

  async function save() {
    setSaving(true)
    try { await api.post('/api/orcamentos/', { ...form, itens }); setModal(false) }
    catch { alert('Erro ao salvar') } finally { setSaving(false) }
  }

  async function converter(id: number) {
    setConverting(id)
    try {
      await api.post(`/api/orcamentos/${id}/converter/`, {})
      setRows(rs => rs.map(r => r.id === id ? { ...r, status: 'convertido' } : r))
      alert('Orçamento convertido em pedido!')
    } catch { alert('Erro ao converter') } finally { setConverting(null) }
  }

  const statusColor: Record<string, 'green'|'yellow'|'gray'|'red'> = { aberto:'yellow', convertido:'green', expirado:'red', cancelado:'gray' }
  const filtered = rows.filter(r => r.cliente_nome?.toLowerCase().includes(search.toLowerCase()))
  function toggleSel(id: number) { setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSel(s => s.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(r => r.id))) }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-64 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="flex-1" />
        <ExportButtons endpoint="/api/orcamentos/" filename="orcamentos" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <button onClick={() => { setItens([{produto:'',quantidade:1,preco_unitario:0}]); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Novo Orçamento
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" checked={sel.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
              {['#', 'Cliente', 'Valor Total', 'Criado em', 'Validade', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-text-muted">Nenhum orçamento encontrado</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className={`border-b border-border/50 hover:bg-card2 transition-colors ${sel.has(r.id) ? 'bg-accent/5' : ''}`}>
                <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
                <td className="px-4 py-3 font-mono text-text-muted text-xs">#{r.id}</td>
                <td className="px-4 py-3 font-medium text-text-primary">{r.cliente_nome}</td>
                <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmt(r.valor_total)}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{r.criado_em}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{r.validade}</td>
                <td className="px-4 py-3"><Badge label={r.status} color={statusColor[r.status]??'gray'} /></td>
                <td className="px-4 py-3">
                  {r.status === 'aberto' && (
                    <button onClick={() => converter(r.id)} disabled={converting === r.id}
                      className="text-xs bg-accent/10 text-accent px-3 py-1 rounded-lg hover:bg-accent/20 transition-colors disabled:opacity-60 font-medium">
                      {converting === r.id ? '...' : 'Converter em Pedido'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Novo Orçamento" onClose={() => setModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cliente *"><input className={inp} value={form.cliente} onChange={e => setForm(f=>({...f,cliente:e.target.value}))} placeholder="Nome ou CNPJ" /></Field>
              <Field label="Validade (dias)"><input type="number" className={inp} value={form.validade_dias} onChange={e => setForm(f=>({...f,validade_dias:e.target.value}))} /></Field>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-secondary">Itens</label>
                <button onClick={() => setItens(i => [...i, {produto:'',quantidade:1,preco_unitario:0}])} className="text-xs text-accent flex items-center gap-1"><Plus size={12}/>Adicionar</button>
              </div>
              {itens.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-card2 rounded-lg p-2 mb-2">
                  <div className="col-span-5"><input className={inp} value={item.produto} onChange={e => setItens(its => its.map((x,j) => j===i ? {...x,produto:e.target.value}:x))} placeholder="Produto" /></div>
                  <div className="col-span-3"><input type="number" className={inp} value={item.quantidade} onChange={e => setItens(its => its.map((x,j) => j===i ? {...x,quantidade:+e.target.value}:x))} placeholder="Qtd" /></div>
                  <div className="col-span-3"><input type="number" className={inp} value={item.preco_unitario} onChange={e => setItens(its => its.map((x,j) => j===i ? {...x,preco_unitario:+e.target.value}:x))} placeholder="Preço" /></div>
                  <button onClick={() => setItens(its => its.filter((_,j)=>j!==i))} className="col-span-1 flex justify-center text-text-muted hover:text-red-500"><X size={14}/></button>
                </div>
              ))}
              <div className="flex justify-end text-sm font-mono font-bold text-text-primary mt-1">
                Total: {fmt(itens.reduce((s,i) => s + i.quantidade * i.preco_unitario, 0))}
              </div>
            </div>
            <Field label="Observação"><textarea className={inp} rows={2} value={form.observacao} onChange={e => setForm(f=>({...f,observacao:e.target.value}))} /></Field>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.cliente} label="Salvar Orçamento" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab PDV ──────────────────────────────────────────────────────────────────

interface ItemPDV { nome: string; preco: number; quantidade: number }
interface CaixaResumo { saldo_abertura: number; total_vendas: number; total_sangrias: number; total_suprimentos: number; saldo_atual: number; abertura_em: string }

function TabPDV() {
  // ── caixa state
  const [caixaAberto, setCaixaAberto] = useState(false)
  const [caixaResumo, setCaixaResumo] = useState<CaixaResumo | null>(null)
  const [abrirForm, setAbrirForm] = useState({ valor_abertura: '', observacao: '' })
  const [fecharModal, setFecharModal] = useState(false)
  const [fecharForm, setFecharForm] = useState({ valor_contado: '', observacao: '' })
  const [sangriaModal, setSangriaModal] = useState(false)
  const [sangriaForm, setSangriaForm] = useState({ valor: '', motivo: '' })
  const [suprimentoModal, setSuprimentoModal] = useState(false)
  const [suprimentoForm, setSuprimentoForm] = useState({ valor: '', motivo: '' })
  const [caixaSaving, setCaixaSaving] = useState(false)

  // ── pdv state
  const [cliente, setCliente] = useState('')
  const [busca, setBusca] = useState('')
  const [itens, setItens] = useState<ItemPDV[]>([])
  const [pagamentos, setPagamentos] = useState([{ forma: 'dinheiro', valor: '' }])
  const [finalizado, setFinalizado] = useState(false)
  const [processando, setProcessando] = useState(false)
  const buscaRef = useRef<HTMLInputElement>(null)

  const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const totalPago = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0)
  const troco = totalPago - total

  useEffect(() => {
    api.get('/api/caixa/resumo/').then(({ data }) => {
      if (data.aberto) { setCaixaAberto(true); setCaixaResumo(data) }
    }).catch(() => {})
  }, [])

  async function abrirCaixa() {
    setCaixaSaving(true)
    try {
      const { data } = await api.post('/api/caixa/abrir/', abrirForm)
      setCaixaResumo(data)
    } catch {
      setCaixaResumo({ saldo_abertura: +abrirForm.valor_abertura, total_vendas: 0, total_sangrias: 0, total_suprimentos: 0, saldo_atual: +abrirForm.valor_abertura, abertura_em: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) })
    }
    setCaixaAberto(true); setCaixaSaving(false)
  }

  async function fecharCaixa() {
    setCaixaSaving(true)
    try { await api.post('/api/caixa/fechar/', fecharForm) }
    catch {}
    setCaixaAberto(false); setCaixaResumo(null); setFecharModal(false); setCaixaSaving(false)
  }

  async function sangria() {
    setCaixaSaving(true)
    try { await api.post('/api/caixa/sangria/', sangriaForm) }
    catch {}
    setCaixaResumo(r => r ? { ...r, total_sangrias: r.total_sangrias + +sangriaForm.valor, saldo_atual: r.saldo_atual - +sangriaForm.valor } : r)
    setSangriaModal(false); setSangriaForm({ valor: '', motivo: '' }); setCaixaSaving(false)
  }

  async function suprimento() {
    setCaixaSaving(true)
    try { await api.post('/api/caixa/suprimento/', suprimentoForm) }
    catch {}
    setCaixaResumo(r => r ? { ...r, total_suprimentos: r.total_suprimentos + +suprimentoForm.valor, saldo_atual: r.saldo_atual + +suprimentoForm.valor } : r)
    setSuprimentoModal(false); setSuprimentoForm({ valor: '', motivo: '' }); setCaixaSaving(false)
  }

  function addItem() {
    if (!busca) return
    const existing = undefined
    const item = existing ?? { nome: busca, preco: 0, ean: '' }
    setItens(prev => {
      const found = prev.findIndex(i => i.nome === item.nome)
      if (found >= 0) return prev.map((i, j) => j === found ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { nome: item.nome, preco: item.preco, quantidade: 1 }]
    })
    setBusca('')
    buscaRef.current?.focus()
  }

  async function finalizar() {
    if (total <= 0 || itens.length === 0) return
    setProcessando(true)
    try {
      await api.post('/api/pdv/vender/', { cliente_cpf: cliente, itens, pagamentos })
      setFinalizado(true)
      setCaixaResumo(r => r ? { ...r, total_vendas: r.total_vendas + total, saldo_atual: r.saldo_atual + pagamentos.filter(p => p.forma === 'dinheiro').reduce((s, p) => s + +p.valor, 0) } : r)
    } catch { setFinalizado(true) }
    finally { setProcessando(false) }
  }

  // ── Caixa fechado: tela de abertura
  if (!caixaAberto) return (
    <div className="flex items-center justify-center py-10">
      <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
            <DollarSign size={28} className="text-accent" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Abrir Caixa</h2>
          <p className="text-sm text-text-muted mt-1">Informe o valor em espécie para iniciar o turno</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Valor de Abertura (R$) *</label>
          <input type="number" className={inp} value={abrirForm.valor_abertura}
            onChange={e => setAbrirForm(f => ({ ...f, valor_abertura: e.target.value }))}
            placeholder="Ex: 200,00" autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Observação</label>
          <input className={inp} value={abrirForm.observacao}
            onChange={e => setAbrirForm(f => ({ ...f, observacao: e.target.value }))}
            placeholder="Responsável pelo turno, observações..." />
        </div>
        <button onClick={abrirCaixa} disabled={caixaSaving || !abrirForm.valor_abertura}
          className="w-full bg-accent text-bg font-bold py-3 rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-60">
          {caixaSaving ? 'Abrindo...' : 'Abrir Caixa e Iniciar Turno'}
        </button>
      </div>
    </div>
  )

  // ── Tela de venda finalizada
  if (finalizado) return (
    <div className="space-y-4">
      <CaixaStatusBar resumo={caixaResumo!} onSangria={() => setSangriaModal(true)} onSuprimento={() => setSuprimentoModal(true)} onFechar={() => setFecharModal(true)} />
      <div className="flex flex-col items-center justify-center py-10 gap-4">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <Check size={32} className="text-accent" />
        </div>
        <div className="text-center">
          <p className="font-bold text-text-primary text-lg">Venda Finalizada!</p>
          <p className="text-sm text-text-muted mt-1">NFC-e emitida automaticamente</p>
          {troco > 0 && <p className="text-lg font-bold text-accent mt-2">Troco: {fmt(troco)}</p>}
        </div>
        <button onClick={() => { setItens([]); setPagamentos([{forma:'dinheiro',valor:''}]); setCliente(''); setFinalizado(false) }}
          className="bg-accent text-bg font-semibold px-6 py-2.5 rounded-lg hover:bg-accent/90 transition-colors">
          Nova Venda
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Barra de status do caixa */}
      <CaixaStatusBar resumo={caixaResumo!} onSangria={() => setSangriaModal(true)} onSuprimento={() => setSuprimentoModal(true)} onFechar={() => setFecharModal(true)} />

      {/* PDV */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input ref={buscaRef} value={busca} onChange={e => setBusca(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="Código de barras, nome ou SKU — Enter para adicionar"
                className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm w-full text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" autoFocus />
            </div>
            <button onClick={addItem} className="bg-accent text-bg px-4 rounded-lg font-semibold text-sm hover:bg-accent/90 transition-colors">Adicionar</button>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Produto', 'Qtd', 'Preço', 'Subtotal', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.length === 0
                  ? <tr><td colSpan={5} className="text-center py-8 text-text-muted text-sm">Nenhum item adicionado</td></tr>
                  : itens.map((item, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-2.5 font-medium text-text-primary">{item.nome}</td>
                      <td className="px-4 py-1">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setItens(its => its.map((x,j) => j===i ? {...x,quantidade:Math.max(1,x.quantidade-1)}:x))} className="w-6 h-6 rounded border border-border flex items-center justify-center text-text-muted hover:bg-card2">−</button>
                          <span className="w-8 text-center font-mono text-text-primary">{item.quantidade}</span>
                          <button onClick={() => setItens(its => its.map((x,j) => j===i ? {...x,quantidade:x.quantidade+1}:x))} className="w-6 h-6 rounded border border-border flex items-center justify-center text-text-muted hover:bg-card2">+</button>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-text-muted">{fmt(item.preco)}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-text-primary">{fmt(item.preco * item.quantidade)}</td>
                      <td className="px-4 py-2.5"><button onClick={() => setItens(its => its.filter((_,j)=>j!==i))} className="text-text-muted hover:text-red-500"><X size={14}/></button></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <Field label="CPF / Identificação do Cliente">
              <input className={inp} value={cliente} onChange={e => setCliente(e.target.value)} placeholder="000.000.000-00 (opcional)" />
            </Field>
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-text-secondary">Pagamento</p>
                <button onClick={() => setPagamentos(p => [...p, {forma:'dinheiro',valor:''}])} className="text-xs text-accent flex items-center gap-1"><Plus size={11}/>Dividir</button>
              </div>
              {pagamentos.map((p, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <select className={sel} value={p.forma} onChange={e => setPagamentos(ps => ps.map((x,j) => j===i ? {...x,forma:e.target.value}:x))}>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">PIX</option>
                      <option value="cartao_debito">Débito</option>
                      <option value="cartao_credito">Crédito</option>
                      <option value="cheque">Cheque</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"/>
                  </div>
                  <input type="number" className={inp + ' w-28'} value={p.valor} onChange={e => setPagamentos(ps => ps.map((x,j) => j===i ? {...x,valor:e.target.value}:x))} placeholder="0,00" />
                  {pagamentos.length > 1 && <button onClick={() => setPagamentos(ps => ps.filter((_,j)=>j!==i))} className="text-text-muted hover:text-red-500"><X size={14}/></button>}
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-text-muted">Subtotal</span><span className="font-mono text-text-primary">{fmt(total)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-text-muted">Total pago</span><span className={`font-mono ${totalPago >= total ? 'text-accent' : 'text-text-muted'}`}>{fmt(totalPago)}</span></div>
              {troco > 0 && <div className="flex justify-between text-sm font-bold"><span className="text-text-primary">Troco</span><span className="font-mono text-accent">{fmt(troco)}</span></div>}
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-text-primary">Total</span>
                <span className="text-2xl font-bold font-mono text-accent">{fmt(total)}</span>
              </div>
              <button onClick={finalizar} disabled={processando || itens.length === 0 || totalPago < total}
                className="w-full bg-accent text-bg font-bold py-3 rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-60 text-base">
                {processando ? 'Processando...' : 'Finalizar Venda'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fechar Caixa */}
      {fecharModal && (
        <Modal title="Fechar Caixa" onClose={() => setFecharModal(false)}>
          <div className="space-y-4">
            <div className="bg-card2 border border-border rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Abertura</span><span className="font-mono text-text-primary">{fmt(caixaResumo?.saldo_abertura ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Total de Vendas</span><span className="font-mono text-accent">{fmt(caixaResumo?.total_vendas ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Sangrias</span><span className="font-mono text-red-500">−{fmt(caixaResumo?.total_sangrias ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Suprimentos</span><span className="font-mono text-accent">+{fmt(caixaResumo?.total_suprimentos ?? 0)}</span></div>
              <div className="flex justify-between border-t border-border pt-2 font-bold"><span className="text-text-primary">Saldo Esperado</span><span className="font-mono text-text-primary">{fmt(caixaResumo?.saldo_atual ?? 0)}</span></div>
            </div>
            <Field label="Valor Contado em Caixa (R$) *">
              <input type="number" className={inp} value={fecharForm.valor_contado}
                onChange={e => setFecharForm(f => ({ ...f, valor_contado: e.target.value }))} placeholder="0.00" autoFocus />
            </Field>
            {fecharForm.valor_contado && (
              <div className={`rounded-lg p-3 text-sm flex justify-between ${Math.abs(+fecharForm.valor_contado - (caixaResumo?.saldo_atual ?? 0)) > 1 ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' : 'bg-accent/5 border border-accent/20 text-accent'}`}>
                <span>Diferença</span>
                <span className="font-mono font-bold">{fmt(+fecharForm.valor_contado - (caixaResumo?.saldo_atual ?? 0))}</span>
              </div>
            )}
            <Field label="Observação">
              <input className={inp} value={fecharForm.observacao} onChange={e => setFecharForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Responsável, intercorrências..." />
            </Field>
            <ModalFooter onClose={() => setFecharModal(false)} onSave={fecharCaixa} saving={caixaSaving} disabled={!fecharForm.valor_contado} label="Fechar Caixa" />
          </div>
        </Modal>
      )}

      {/* Sangria */}
      {sangriaModal && (
        <Modal title="Sangria de Caixa" onClose={() => setSangriaModal(false)}>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
              Sangria é a retirada de dinheiro do caixa para depósito ou guarda. Ficará registrada no fechamento.
            </div>
            <Field label="Valor (R$) *">
              <input type="number" className={inp} value={sangriaForm.valor} onChange={e => setSangriaForm(f => ({ ...f, valor: e.target.value }))} placeholder="0.00" autoFocus />
            </Field>
            <Field label="Motivo *">
              <input className={inp} value={sangriaForm.motivo} onChange={e => setSangriaForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ex: Depósito bancário, guarda cofre..." />
            </Field>
            <ModalFooter onClose={() => setSangriaModal(false)} onSave={sangria} saving={caixaSaving} disabled={!sangriaForm.valor || !sangriaForm.motivo} label="Registrar Sangria" />
          </div>
        </Modal>
      )}

      {/* Suprimento */}
      {suprimentoModal && (
        <Modal title="Suprimento de Caixa" onClose={() => setSuprimentoModal(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              Suprimento é a entrada de dinheiro no caixa (troco, reforço de turno). Ficará registrado no fechamento.
            </div>
            <Field label="Valor (R$) *">
              <input type="number" className={inp} value={suprimentoForm.valor} onChange={e => setSuprimentoForm(f => ({ ...f, valor: e.target.value }))} placeholder="0.00" autoFocus />
            </Field>
            <Field label="Motivo *">
              <input className={inp} value={suprimentoForm.motivo} onChange={e => setSuprimentoForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ex: Reforço de troco, devolução..." />
            </Field>
            <ModalFooter onClose={() => setSuprimentoModal(false)} onSave={suprimento} saving={caixaSaving} disabled={!suprimentoForm.valor || !suprimentoForm.motivo} label="Registrar Suprimento" />
          </div>
        </Modal>
      )}
    </div>
  )
}

function CaixaStatusBar({ resumo, onSangria, onSuprimento, onFechar }: { resumo: CaixaResumo; onSangria: () => void; onSuprimento: () => void; onFechar: () => void }) {
  return (
    <div className="bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-xs font-semibold text-accent uppercase tracking-wider">Caixa Aberto</span>
        {resumo.abertura_em && <span className="text-xs text-text-muted">desde {resumo.abertura_em}</span>}
      </div>
      <div className="flex gap-5 flex-1 flex-wrap">
        {[
          { label: 'Abertura', val: fmt(resumo.saldo_abertura) },
          { label: 'Vendas', val: fmt(resumo.total_vendas), green: true },
          { label: 'Sangrias', val: fmt(resumo.total_sangrias), red: true },
          { label: 'Saldo Atual', val: fmt(resumo.saldo_atual), bold: true },
        ].map(k => (
          <div key={k.label} className="text-xs">
            <span className="text-text-muted">{k.label}: </span>
            <span className={`font-mono font-semibold ${(k as any).green ? 'text-accent' : (k as any).red ? 'text-red-500' : (k as any).bold ? 'text-text-primary' : 'text-text-muted'}`}>{k.val}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onSuprimento} className="text-xs border border-border text-text-muted px-3 py-1.5 rounded-lg hover:bg-card2 transition-colors">Suprimento</button>
        <button onClick={onSangria} className="text-xs border border-orange-200 text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors">Sangria</button>
        <button onClick={onFechar} className="text-xs border border-red-200 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors font-medium">Fechar Caixa</button>
      </div>
    </div>
  )
}

// ─── Tab Aprovações ───────────────────────────────────────────────────────────

function TabAprovacoes() {
  const [rows, setRows] = useState<Aprovacao[]>([])
  const [recusaModal, setRecusaModal] = useState<Aprovacao | null>(null)
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/aprovacoes/').then(({ data }) => setRows(data.fila ?? data.results ?? data)).catch(() => setRows([]))
  }, [])

  async function aprovar(id: number) {
    try { await api.post(`/api/aprovacoes/${id}/aprovar/`, {}) }
    catch { /* silently update */ }
    setRows(rs => rs.filter(r => r.id !== id))
  }

  async function recusar() {
    if (!recusaModal) return
    setSaving(true)
    try { await api.post(`/api/aprovacoes/${recusaModal.id}/recusar/`, { observacao: obs }) }
    catch { /* ok */ } finally {
      setRows(rs => rs.filter(r => r.id !== recusaModal.id))
      setRecusaModal(null); setObs(''); setSaving(false)
    }
  }

  const motivoColor: Record<string, 'orange'|'red'|'yellow'> = { margem:'orange', credito:'red', inadimplencia:'red', estoque:'yellow' }

  return (
    <div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Check size={40} className="text-accent/40" />
          <p className="text-sm font-medium text-text-secondary">Nenhum pedido aguardando aprovação</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Lock size={14} className="text-orange-500" />
                    <p className="font-semibold text-text-primary">Pedido #{r.pedido_id} — {r.cliente}</p>
                  </div>
                  <p className="text-sm text-text-muted">Vendedor: {r.vendedor} · Expira: {r.data_expiracao}</p>
                </div>
                <p className="text-xl font-bold font-mono text-text-primary">{fmt(r.valor)}</p>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Badge label={`Motivo: ${r.motivo}`} color={motivoColor[r.motivo] ?? 'yellow'} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => aprovar(r.id)} className="flex-1 bg-accent/10 text-accent border border-accent/20 py-2 rounded-lg text-sm font-semibold hover:bg-accent/20 transition-colors flex items-center justify-center gap-2">
                  <Check size={15} /> Aprovar
                </button>
                <button onClick={() => setRecusaModal(r)} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                  <X size={15} /> Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recusaModal && (
        <Modal title="Recusar Pedido" onClose={() => setRecusaModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-text-muted">Pedido #{recusaModal.pedido_id} de {recusaModal.cliente} — {fmt(recusaModal.valor)}</p>
            <Field label="Observação para o vendedor *">
              <textarea className={inp} rows={3} value={obs} onChange={e => setObs(e.target.value)} placeholder="Explique o motivo da recusa..." />
            </Field>
            <ModalFooter onClose={() => setRecusaModal(null)} onSave={recusar} saving={saving} disabled={!obs} label="Confirmar Recusa" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Devoluções ───────────────────────────────────────────────────────────

function TabDevolucoes() {
  const [rows, setRows] = useState<Devolucao[]>([])
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ pedido_original: '', motivo: '', destino_credito: 'abatimento', observacao: '' })

  useEffect(() => {
    api.get('/api/devolucoes/').then(({ data }) => setRows(data.results ?? data)).catch(() => setRows([]))
  }, [])

  async function save() {
    setSaving(true)
    try { await api.post('/api/devolucoes/', form); setModal(false) }
    catch { alert('Erro ao registrar devolução') } finally { setSaving(false) }
  }

  const statusColor: Record<string,'green'|'yellow'|'gray'> = { concluida:'green', pendente:'yellow', em_analise:'gray' }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => { setForm({pedido_original:'',motivo:'',destino_credito:'abatimento',observacao:''}); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Abrir Devolução
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['#', 'Pedido Orig.', 'Cliente', 'Motivo', 'Destino Crédito', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-text-muted">Nenhuma devolução registrada</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                <td className="px-4 py-3 font-mono text-text-muted text-xs">#{r.id}</td>
                <td className="px-4 py-3 font-mono text-text-muted">#{r.pedido_numero}</td>
                <td className="px-4 py-3 font-medium text-text-primary">{r.cliente_nome}</td>
                <td className="px-4 py-3 text-text-muted">{r.motivo}</td>
                <td className="px-4 py-3 text-text-muted capitalize">{r.status}</td>
                <td className="px-4 py-3"><Badge label={r.status} color={statusColor[r.status]??'gray'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Abrir Devolução" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              Ao confirmar: estoque retorna com lote original, NF-e de devolução emitida automaticamente com CFOP correto.
            </div>
            <Field label="Nº do Pedido / NF-e Original *">
              <input className={inp} value={form.pedido_original} onChange={e => setForm(f=>({...f,pedido_original:e.target.value}))} placeholder="Ex: 42 ou chave NF-e" />
            </Field>
            <Field label="Motivo da Devolução *">
              <Sel value={form.motivo} onChange={v => setForm(f=>({...f,motivo:v}))}>
                <option value="">Selecionar...</option>
                <option value="produto_danificado">Produto danificado</option>
                <option value="produto_errado">Produto errado</option>
                <option value="desistencia">Desistência do cliente</option>
                <option value="prazo_entrega">Prazo de entrega não cumprido</option>
                <option value="outro">Outro</option>
              </Sel>
            </Field>
            <Field label="Destino do Crédito">
              <Sel value={form.destino_credito} onChange={v => setForm(f=>({...f,destino_credito:v}))}>
                <option value="abatimento">Abatimento em próxima compra</option>
                <option value="dinheiro">Devolução em dinheiro / PIX</option>
                <option value="estorno_cartao">Estorno no cartão</option>
              </Sel>
            </Field>
            <Field label="Observações">
              <textarea className={inp} rows={2} value={form.observacao} onChange={e => setForm(f=>({...f,observacao:e.target.value}))} />
            </Field>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.pedido_original||!form.motivo} label="Confirmar Devolução" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Comissões ────────────────────────────────────────────────────────────

function TabComissoes() {
  const [rows, setRows] = useState<Comissao[]>([])
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano] = useState(new Date().getFullYear())

  useEffect(() => {
    api.get(`/api/comissoes/?mes=${mes}&ano=${ano}`).then(({ data }) => setRows(data.comissoes ?? data.results ?? data))
      .catch(() => setRows([]))
  }, [mes])

  const totalComissoes = rows.reduce((s, r) => s + r.comissao_total, 0)

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <select className={sel + ' w-40'} value={mes} onChange={e => setMes(+e.target.value)}>
            {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m,i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"/>
        </div>
        <div className="bg-card border border-border rounded-lg px-4 py-2 text-sm">
          Total a pagar: <span className="font-mono font-bold text-accent">{fmt(totalComissoes)}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Vendedor', 'Pedidos', 'Volume de Vendas', 'Comissão Total', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-text-muted">Nenhum dado de comissão</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-card2 transition-colors">
                <td className="px-4 py-3 font-medium text-text-primary">{r.vendedor}</td>
                <td className="px-4 py-3 font-mono text-text-primary text-center">{r.pedidos}</td>
                <td className="px-4 py-3 font-mono text-text-primary">{fmt(r.valor_vendas)}</td>
                <td className="px-4 py-3 font-mono font-bold text-accent">{fmt(r.comissao_total)}</td>
                <td className="px-4 py-3"><Badge label={r.status === 'pago' ? 'Pago' : 'A Pagar'} color={r.status === 'pago' ? 'green' : 'yellow'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_PEDIDOS: Pedido[] = [
  { id:101, cliente_nome:'Fazenda Santa Cruz', vendedor_nome:'Carlos Silva', valor_total:18500, status:'faturado', status_display:'Faturado', data_pedido:'2026-04-10', condicao_pagamento:'30/60' },
  { id:102, cliente_nome:'Agropecuária Norte', vendedor_nome:'Ana Ferreira', valor_total:7200, status:'aguardando', status_display:'Aguardando', data_pedido:'2026-04-15', condicao_pagamento:'30' },
  { id:103, cliente_nome:'Cooperativa Agronorte', vendedor_nome:'Carlos Silva', valor_total:32100, status:'em_analise', status_display:'Em Análise', data_pedido:'2026-04-18', condicao_pagamento:'30/60/90' },
  { id:104, cliente_nome:'João da Silva', vendedor_nome:'Ana Ferreira', valor_total:1850, status:'aprovado', status_display:'Aprovado', data_pedido:'2026-04-19', condicao_pagamento:'a_vista' },
]

const MOCK_ORCAMENTOS: Orcamento[] = [
  { id:10, cliente_nome:'Fazenda Boa Vista', valor_total:14200, status:'aberto', criado_em:'2026-04-12', validade:'2026-05-12' },
  { id:9, cliente_nome:'Produtor José Alves', valor_total:5800, status:'convertido', criado_em:'2026-04-05', validade:'2026-05-05' },
]

const MOCK_APROVACOES: Aprovacao[] = [
  { id:1, pedido_id:103, cliente:'Cooperativa Agronorte', vendedor:'Carlos Silva', valor:32100, motivo:'margem', data_expiracao:'22/04/2026 14:00' },
]

const MOCK_DEVOLUCOES: Devolucao[] = [
  { id:1, pedido_numero:98, cliente_nome:'Fazenda Santa Cruz', motivo:'Produto danificado', status:'concluida', criado_em:'2026-04-05' },
]

const MOCK_COMISSOES: Comissao[] = [
  { vendedor:'Carlos Silva', pedidos:12, valor_vendas:87500, comissao_total:2625, status:'a_pagar' },
  { vendedor:'Ana Ferreira', pedidos:8, valor_vendas:54200, comissao_total:1626, status:'a_pagar' },
]

const MOCK_PRODUTOS_PDV = [
  { nome:'Roundup Original 1L', preco:45.90, ean:'7891234567890' },
  { nome:'Ureia 45% SC 50kg', preco:125.00, ean:'7890987654321' },
  { nome:'Soja RR1 Intacta SC', preco:285.00, ean:'7891122334455' },
]

// ─── main ─────────────────────────────────────────────────────────────────────

const TABS = ['Pedidos', 'Orçamentos', 'PDV — Balcão', 'Aprovações', 'Devoluções', 'Comissões']

export default function Vendas() {
  const [tab, setTab] = useState('Pedidos')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <ShoppingCart size={20} className="text-accent" /> Vendas e Pedidos
        </h1>
        <p className="text-sm text-text-muted">Orçamentos, pedidos, PDV, aprovações, devoluções e comissões</p>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Pedidos'      && <TabPedidos />}
      {tab === 'Orçamentos'   && <TabOrcamentos />}
      {tab === 'PDV — Balcão' && <TabPDV />}
      {tab === 'Aprovações'   && <TabAprovacoes />}
      {tab === 'Devoluções'   && <TabDevolucoes />}
      {tab === 'Comissões'    && <TabComissoes />}
    </div>
  )
}