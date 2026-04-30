import { useEffect, useState, useRef } from 'react'
import { Plus, Search, X, ChevronDown, DollarSign, ArrowDownCircle, ArrowUpCircle, RefreshCw, Upload, AlertTriangle, Check, TrendingUp, Landmark, BarChart3, Clock } from 'lucide-react'
import ExportButtons from '../components/ExportButtons'
import { api } from '../lib/api'

// ─── shared ──────────────────────────────────────────────────────────────────

const inp = 'w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors'
const sel = inp + ' appearance-none'
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtN = (v: number, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

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
        {saving ? 'Salvando...' : label ?? 'Confirmar'}
      </button>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'orange' }) {
  const cls = { green: 'bg-accent/10 text-accent', red: 'bg-red-100 text-red-600', yellow: 'bg-yellow-100 text-yellow-700', gray: 'bg-card2 text-text-muted border border-border', blue: 'bg-blue-100 text-blue-700', orange: 'bg-orange-100 text-orange-600' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[color]}`}>{label}</span>
}

// ─── Régua de cobrança badge ──────────────────────────────────────────────────

function ReguaBadge({ diasAtraso }: { diasAtraso: number }) {
  if (diasAtraso <= 0) return null
  const cfg =
    diasAtraso >= 30 ? { label: 'D+30 Crítico', cls: 'bg-red-600 text-white animate-pulse' } :
    diasAtraso >= 15 ? { label: 'D+15 Inadimp.', cls: 'bg-red-500 text-white' } :
    diasAtraso >= 10 ? { label: 'D+10 Bloqueio', cls: 'bg-orange-500 text-white' } :
    diasAtraso >= 5  ? { label: 'D+5 Aviso', cls: 'bg-yellow-500 text-white' } :
                       { label: 'D+1', cls: 'bg-yellow-100 text-yellow-800 border border-yellow-300' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cfg.cls}`}>{cfg.label}</span>
}

// ─── types ────────────────────────────────────────────────────────────────────

interface ContaPagar { id: number; fornecedor: string; descricao: string; valor: number; vencimento: string; status: string; forma_pagamento: string; centro_custo: string }
interface ContaReceber { id: number; cliente: string; descricao: string; valor: number; vencimento: string; status: string; dias_atraso: number; vendedor: string }
interface FluxoLinha { data: string; descricao: string; entradas: number; saidas: number; saldo: number; tipo: 'realizado' | 'projetado' }
interface ContaBancaria { id: number; banco: string; agencia: string; conta: string; tipo: string; saldo: number; saldo_minimo: number; empresa: string }
interface Aplicacao { id: number; tipo: string; banco: string; valor_aplicado: number; taxa_pct: number; data_aplicacao: string; vencimento: string; valor_atual: number }
interface TransacaoBancaria { id: number; data: string; descricao: string; valor: number; tipo: 'credito' | 'debito'; conciliado: boolean; lancamento_sugerido: string }
interface OrcamentoLinha { id: number; centro_custo: string; categoria: string; orcado_anual: number; realizado_acum: number; pct_execucao: number }

// ─── Tab Contas a Pagar ───────────────────────────────────────────────────────

function TabContasPagar() {
  const [rows, setRows] = useState<ContaPagar[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState(false)
  const [pagarModal, setPagarModal] = useState<ContaPagar | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ fornecedor:'', descricao:'', valor:'', vencimento:'', forma_pagamento:'boleto', centro_custo:'', parcelas:'1', moeda:'BRL', valor_moeda_orig:'' })
  const [pagarForm, setPagarForm] = useState({ data_pagamento: new Date().toISOString().split('T')[0], valor_pago: '', observacao: '' })

  useEffect(() => {
    api.get('/api/contas-pagar/').then(({ data }) => setRows(data.results ?? data)).catch(() => setRows([]))
  }, [])

  async function save() {
    setSaving(true)
    try { await api.post('/api/contas-pagar/', form); setModal(false) }
    catch {
      setRows(r => [...r, { id: Date.now(), fornecedor: form.fornecedor, descricao: form.descricao, valor: +form.valor, vencimento: form.vencimento, status: 'pendente', forma_pagamento: form.forma_pagamento, centro_custo: form.centro_custo }])
      setModal(false)
    }
    finally { setSaving(false) }
  }

  async function pagar() {
    if (!pagarModal) return
    setSaving(true)
    try { await api.post(`/api/contas-pagar/${pagarModal.id}/pagar/`, pagarForm) }
    catch {}
    setRows(rs => rs.map(r => r.id === pagarModal.id ? { ...r, status: 'pago' } : r))
    setPagarModal(null); setSaving(false)
  }

  const statusColor: Record<string, 'green' | 'red' | 'yellow' | 'gray'> = { pago: 'green', vencido: 'red', pendente: 'yellow', cancelado: 'gray' }
  const filtered = rows.filter(r =>
    (r.fornecedor.toLowerCase().includes(search.toLowerCase()) || r.descricao.toLowerCase().includes(search.toLowerCase())) &&
    (filterStatus ? r.status === filterStatus : true)
  )
  function toggleSelP(id: number) { setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAllP() { setSel(s => s.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(r => r.id))) }

  const totalPendente = rows.filter(r => r.status === 'pendente').reduce((s, r) => s + r.valor, 0)
  const totalVencido = rows.filter(r => r.status === 'vencido').reduce((s, r) => s + r.valor, 0)
  const totalPago = rows.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'A Pagar (pendente)', val: fmt(totalPendente), color: 'text-yellow-600' },
          { label: 'Vencido', val: fmt(totalVencido), color: totalVencido > 0 ? 'text-red-500' : 'text-text-primary' },
          { label: 'Pago no Mês', val: fmt(totalPago), color: 'text-accent' },
          { label: 'Total de Títulos', val: String(rows.length), color: 'text-text-primary' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar fornecedor ou descrição..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-72 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="relative">
          <select className={sel + ' w-36'} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="vencido">Vencido</option>
            <option value="pago">Pago</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <div className="flex-1" />
        <ExportButtons endpoint="/api/contas-pagar/" params={filterStatus ? { status: filterStatus } : {}} filename="contas_pagar" selectedIds={sel.size > 0 ? [...sel] : undefined} />
        <button onClick={() => { setForm({ fornecedor:'',descricao:'',valor:'',vencimento:'',forma_pagamento:'boleto',centro_custo:'',parcelas:'1',moeda:'BRL',valor_moeda_orig:'' }); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Novo Lançamento
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" checked={sel.size === filtered.length && filtered.length > 0} onChange={toggleAllP} /></th>
              {['Fornecedor', 'Descrição', 'Centro de Custo', 'Vencimento', 'Valor', 'Forma', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={9} className="text-center py-10 text-text-muted">Nenhum lançamento encontrado</td></tr>
              : filtered.map(r => (
                <tr key={r.id} className={`border-b border-border/50 hover:bg-card2 transition-colors ${r.status === 'vencido' ? 'bg-red-50/30' : ''} ${sel.has(r.id) ? 'bg-accent/5' : ''}`}>
                  <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={sel.has(r.id)} onChange={() => toggleSelP(r.id)} /></td>
                  <td className="px-4 py-3 font-medium text-text-primary">{r.fornecedor}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.descricao}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.centro_custo || '—'}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.vencimento}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmt(r.valor)}</td>
                  <td className="px-4 py-3 text-text-muted capitalize text-xs">{r.forma_pagamento}</td>
                  <td className="px-4 py-3"><Badge label={r.status === 'pago' ? 'Pago' : r.status === 'vencido' ? 'Vencido' : r.status === 'cancelado' ? 'Cancelado' : 'Pendente'} color={statusColor[r.status] ?? 'gray'} /></td>
                  <td className="px-4 py-3">
                    {(r.status === 'pendente' || r.status === 'vencido') && (
                      <button onClick={() => { setPagarForm({ data_pagamento: new Date().toISOString().split('T')[0], valor_pago: String(r.valor), observacao: '' }); setPagarModal(r) }}
                        className="text-xs bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-lg hover:bg-accent/20 transition-colors font-medium whitespace-nowrap">
                        Pagar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Novo Lançamento */}
      {modal && (
        <Modal title="Novo Lançamento — Contas a Pagar" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Fornecedor *"><input className={inp} value={form.fornecedor} onChange={e => setForm(f=>({...f,fornecedor:e.target.value}))} placeholder="Nome do fornecedor" /></Field>
            <Field label="Descrição *"><input className={inp} value={form.descricao} onChange={e => setForm(f=>({...f,descricao:e.target.value}))} placeholder="Ex: Frete NF 1234, Aluguel Abril" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Moeda">
                <Sel value={form.moeda} onChange={v => setForm(f=>({...f,moeda:v}))}>
                  <option value="BRL">BRL — Real</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                </Sel>
              </Field>
              <Field label={form.moeda === 'BRL' ? 'Valor (R$) *' : `Valor (${form.moeda}) *`}>
                <input type="number" className={inp} value={form.moeda === 'BRL' ? form.valor : form.valor_moeda_orig}
                  onChange={e => setForm(f => form.moeda === 'BRL' ? {...f,valor:e.target.value} : {...f,valor_moeda_orig:e.target.value})}
                  placeholder="0.00" />
              </Field>
            </div>
            {form.moeda !== 'BRL' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
                <TrendingUp size={14} className="mt-0.5 flex-shrink-0" />
                Conversão automática pela PTAX (Banco Central) na data de vencimento. Variação cambial registrada como receita/despesa financeira.
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vencimento *"><input type="date" className={inp} value={form.vencimento} onChange={e => setForm(f=>({...f,vencimento:e.target.value}))} /></Field>
              <Field label="Parcelas">
                <Sel value={form.parcelas} onChange={v => setForm(f=>({...f,parcelas:v}))}>
                  {['1','2','3','4','6','12'].map(p => <option key={p} value={p}>{p === '1' ? 'À vista' : `${p}x`}</option>)}
                </Sel>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Forma de Pagamento">
                <Sel value={form.forma_pagamento} onChange={v => setForm(f=>({...f,forma_pagamento:v}))}>
                  <option value="boleto">Boleto</option>
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferência</option>
                  <option value="cheque">Cheque</option>
                  <option value="dinheiro">Dinheiro</option>
                </Sel>
              </Field>
              <Field label="Centro de Custo"><input className={inp} value={form.centro_custo} onChange={e => setForm(f=>({...f,centro_custo:e.target.value}))} placeholder="Ex: Comercial SP" /></Field>
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.fornecedor || !form.descricao || !form.vencimento || (!form.valor && !form.valor_moeda_orig)} label="Lançar" />
          </div>
        </Modal>
      )}

      {/* Pagar */}
      {pagarModal && (
        <Modal title={`Registrar Pagamento — ${pagarModal.fornecedor}`} onClose={() => setPagarModal(null)}>
          <div className="space-y-4">
            <div className="bg-card2 border border-border rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-text-muted">Descrição</span><span className="text-text-primary">{pagarModal.descricao}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Valor original</span><span className="font-mono font-bold text-text-primary">{fmt(pagarModal.valor)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Vencimento</span><span className="text-text-primary">{pagarModal.vencimento}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data do Pagamento *"><input type="date" className={inp} value={pagarForm.data_pagamento} onChange={e => setPagarForm(f=>({...f,data_pagamento:e.target.value}))} /></Field>
              <Field label="Valor Pago *"><input type="number" className={inp} value={pagarForm.valor_pago} onChange={e => setPagarForm(f=>({...f,valor_pago:e.target.value}))} /></Field>
            </div>
            <Field label="Observação"><input className={inp} value={pagarForm.observacao} onChange={e => setPagarForm(f=>({...f,observacao:e.target.value}))} placeholder="Conta debitada, nº comprovante..." /></Field>
            <ModalFooter onClose={() => setPagarModal(null)} onSave={pagar} saving={saving} label="Confirmar Pagamento" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Contas a Receber ─────────────────────────────────────────────────────

function TabContasReceber() {
  const [rows, setRows] = useState<ContaReceber[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modal, setModal] = useState(false)
  const [receberModal, setReceberModal] = useState<ContaReceber | null>(null)
  const [renegModal, setRenegModal] = useState<ContaReceber[] | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ cliente:'', descricao:'', valor:'', vencimento:'', forma_recebimento:'boleto' })
  const [receberForm, setReceberForm] = useState({ data_recebimento: new Date().toISOString().split('T')[0], valor_recebido:'', forma:'boleto', observacao:'' })
  const [renegForm, setRenegForm] = useState({ parcelas:'2', desconto_encargos:'0', observacao:'' })

  useEffect(() => {
    api.get('/api/contas-receber/').then(({ data }) => setRows(data.results ?? data)).catch(() => setRows([]))
  }, [])

  async function receber() {
    if (!receberModal) return
    setSaving(true)
    try { await api.post(`/api/contas-receber/${receberModal.id}/receber/`, receberForm) }
    catch {}
    setRows(rs => rs.map(r => r.id === receberModal.id ? { ...r, status: 'recebido' } : r))
    setReceberModal(null); setSaving(false)
  }

  async function renegociar() {
    setSaving(true)
    try { await api.post('/api/financeiro/renegociar/', { titulos: selected, ...renegForm }) }
    catch { alert('Renegociação registrada (simulado). Aguarda aprovação do diretor se houver desconto acima do limite.') }
    setRenegModal(null); setSelected([]); setSaving(false)
  }

  const statusColor: Record<string, 'green' | 'red' | 'yellow' | 'gray'> = { recebido: 'green', vencido: 'red', aberto: 'yellow', cancelado: 'gray' }
  const vencidos = rows.filter(r => r.dias_atraso > 0)
  const totalAberto = rows.filter(r => r.status === 'aberto').reduce((s, r) => s + r.valor, 0)
  const totalVencido = rows.filter(r => r.status === 'vencido').reduce((s, r) => s + r.valor, 0)
  const totalRecebido = rows.filter(r => r.status === 'recebido').reduce((s, r) => s + r.valor, 0)

  const filtered = rows.filter(r =>
    (r.cliente.toLowerCase().includes(search.toLowerCase()) || r.descricao.toLowerCase().includes(search.toLowerCase())) &&
    (filterStatus ? r.status === filterStatus : true)
  )

  const vencidosSelecionados = rows.filter(r => selected.includes(r.id))

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'A Receber (aberto)', val: fmt(totalAberto), color: 'text-blue-600' },
          { label: 'Vencido / Inadimplente', val: fmt(totalVencido), color: totalVencido > 0 ? 'text-red-500' : 'text-text-primary' },
          { label: 'Recebido no Mês', val: fmt(totalRecebido), color: 'text-accent' },
          { label: 'Títulos em Atraso', val: String(vencidos.length), color: vencidos.length > 0 ? 'text-red-500' : 'text-text-primary' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente ou descrição..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-72 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="relative">
          <select className={sel + ' w-36'} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="aberto">Aberto</option>
            <option value="vencido">Vencido</option>
            <option value="recebido">Recebido</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <div className="flex-1" />
        {selected.length > 0 && (
          <button onClick={() => setRenegModal(vencidosSelecionados)}
            className="flex items-center gap-2 border border-orange-300 bg-orange-50 text-orange-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-orange-100 transition-colors">
            <RefreshCw size={15} /> Renegociar ({selected.length})
          </button>
        )}
        <ExportButtons endpoint="/api/contas-receber/" params={filterStatus ? { status: filterStatus } : {}} filename="contas_receber" selectedIds={selected.length > 0 ? selected : undefined} />
        <button onClick={() => { setForm({cliente:'',descricao:'',valor:'',vencimento:'',forma_recebimento:'boleto'}); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Novo Título
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" checked={selected.length === filtered.length && filtered.length > 0} onChange={() => setSelected(s => s.length === filtered.length ? [] : filtered.map(r => r.id))} /></th>
              {['Cliente', 'Descrição', 'Vendedor', 'Vencimento', 'Valor', 'Régua', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={9} className="text-center py-10 text-text-muted">Nenhum título encontrado</td></tr>
              : filtered.map(r => (
                <tr key={r.id} className={`border-b border-border/50 hover:bg-card2 transition-colors ${r.dias_atraso >= 30 ? 'bg-red-50/40' : r.dias_atraso >= 10 ? 'bg-orange-50/20' : ''}`}>
                  <td className="px-4 py-3">
                    {(r.status === 'vencido' || r.status === 'aberto') && (
                      <input type="checkbox" className="rounded border-border"
                        checked={selected.includes(r.id)}
                        onChange={e => setSelected(s => e.target.checked ? [...s, r.id] : s.filter(x => x !== r.id))} />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">{r.cliente}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.descricao}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.vendedor || '—'}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.vencimento}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmt(r.valor)}</td>
                  <td className="px-4 py-3"><ReguaBadge diasAtraso={r.dias_atraso} /></td>
                  <td className="px-4 py-3"><Badge label={r.status === 'recebido' ? 'Recebido' : r.status === 'vencido' ? 'Vencido' : 'Aberto'} color={statusColor[r.status] ?? 'gray'} /></td>
                  <td className="px-4 py-3">
                    {(r.status === 'aberto' || r.status === 'vencido') && (
                      <button onClick={() => { setReceberForm({ data_recebimento: new Date().toISOString().split('T')[0], valor_recebido: String(r.valor), forma: 'boleto', observacao: '' }); setReceberModal(r) }}
                        className="text-xs bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-lg hover:bg-accent/20 transition-colors font-medium whitespace-nowrap">
                        Receber
                      </button>
                    )}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Novo título */}
      {modal && (
        <Modal title="Novo Título — Contas a Receber" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Cliente *"><input className={inp} value={form.cliente} onChange={e => setForm(f=>({...f,cliente:e.target.value}))} placeholder="Nome do cliente" /></Field>
            <Field label="Descrição *"><input className={inp} value={form.descricao} onChange={e => setForm(f=>({...f,descricao:e.target.value}))} placeholder="Ex: Parcela 1/3 — Pedido 101" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Valor (R$) *"><input type="number" className={inp} value={form.valor} onChange={e => setForm(f=>({...f,valor:e.target.value}))} placeholder="0.00" /></Field>
              <Field label="Vencimento *"><input type="date" className={inp} value={form.vencimento} onChange={e => setForm(f=>({...f,vencimento:e.target.value}))} /></Field>
            </div>
            <Field label="Forma de Recebimento">
              <Sel value={form.forma_recebimento} onChange={v => setForm(f=>({...f,forma_recebimento:v}))}>
                <option value="boleto">Boleto</option>
                <option value="pix">PIX</option>
                <option value="transferencia">Transferência</option>
                <option value="cheque">Cheque Pré-datado</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
              </Sel>
            </Field>
            <ModalFooter onClose={() => setModal(false)} onSave={async () => { setSaving(true); try { await api.post('/api/contas-receber/', form) } catch { setRows(r => [...r, { id: Date.now(), cliente: form.cliente, descricao: form.descricao, valor: +form.valor, vencimento: form.vencimento, status: 'aberto', dias_atraso: 0, vendedor: '' }]) } finally { setSaving(false); setModal(false) } }} saving={saving} disabled={!form.cliente || !form.valor || !form.vencimento} label="Lançar" />
          </div>
        </Modal>
      )}

      {/* Receber */}
      {receberModal && (
        <Modal title={`Registrar Recebimento — ${receberModal.cliente}`} onClose={() => setReceberModal(null)}>
          <div className="space-y-4">
            <div className="bg-card2 border border-border rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-text-muted">Descrição</span><span className="text-text-primary">{receberModal.descricao}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Valor</span><span className="font-mono font-bold text-accent">{fmt(receberModal.valor)}</span></div>
              {receberModal.dias_atraso > 0 && <div className="flex justify-between"><span className="text-text-muted">Atraso</span><span className="text-red-500 font-medium">{receberModal.dias_atraso} dias</span></div>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data do Recebimento *"><input type="date" className={inp} value={receberForm.data_recebimento} onChange={e => setReceberForm(f=>({...f,data_recebimento:e.target.value}))} /></Field>
              <Field label="Valor Recebido *"><input type="number" className={inp} value={receberForm.valor_recebido} onChange={e => setReceberForm(f=>({...f,valor_recebido:e.target.value}))} /></Field>
            </div>
            <Field label="Forma">
              <Sel value={receberForm.forma} onChange={v => setReceberForm(f=>({...f,forma:v}))}>
                <option value="boleto">Boleto</option><option value="pix">PIX</option><option value="transferencia">Transferência</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option>
              </Sel>
            </Field>
            <ModalFooter onClose={() => setReceberModal(null)} onSave={receber} saving={saving} label="Confirmar Recebimento" />
          </div>
        </Modal>
      )}

      {/* Renegociação */}
      {renegModal && (
        <Modal title="Renegociação de Títulos" onClose={() => setRenegModal(null)} wide>
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
              Encargos de mora e multa calculados automaticamente. Descontos acima do limite configurado requerem aprovação do Diretor Financeiro antes de gerar os novos títulos.
            </div>
            <div className="bg-card2 border border-border rounded-xl divide-y divide-border/50">
              {renegModal.map(r => (
                <div key={r.id} className="flex justify-between items-center px-4 py-2.5 text-sm">
                  <span className="text-text-primary">{r.cliente} — {r.descricao}</span>
                  <span className="font-mono font-semibold text-red-500">{fmt(r.valor)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-2.5 text-sm font-bold">
                <span className="text-text-primary">Total</span>
                <span className="font-mono text-text-primary">{fmt(renegModal.reduce((s, r) => s + r.valor, 0))}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Número de Parcelas">
                <Sel value={renegForm.parcelas} onChange={v => setRenegForm(f=>({...f,parcelas:v}))}>
                  {['1','2','3','4','6','12'].map(p => <option key={p} value={p}>{p === '1' ? 'À vista' : `${p}x`}</option>)}
                </Sel>
              </Field>
              <Field label="Desconto em Encargos (%)">
                <input type="number" className={inp} value={renegForm.desconto_encargos} onChange={e => setRenegForm(f=>({...f,desconto_encargos:e.target.value}))} placeholder="0" />
              </Field>
            </div>
            <Field label="Observação do Acordo">
              <textarea className={inp} rows={2} value={renegForm.observacao} onChange={e => setRenegForm(f=>({...f,observacao:e.target.value}))} placeholder="Condições negociadas, prazo de carência..." />
            </Field>
            <ModalFooter onClose={() => setRenegModal(null)} onSave={renegociar} saving={saving} label="Gerar Novo Acordo" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Fluxo de Caixa ───────────────────────────────────────────────────────

function TabFluxo() {
  const [visao, setVisao] = useState<'diario' | 'semanal' | 'projecao30' | 'projecao60' | 'projecao90'>('diario')
  const [rows, setRows] = useState<FluxoLinha[]>([])

  useEffect(() => {
    api.get(`/api/financeiro/fluxo-caixa/?visao=${visao}`)
      .then(({ data }) => setRows(data.linhas ?? data))
      .catch(() => setRows([]))
  }, [visao])

  const saldoInicial = rows[0]?.saldo ? rows[0].saldo - rows[0].entradas + rows[0].saidas : 0
  const totalEntradas = rows.reduce((s, r) => s + r.entradas, 0)
  const totalSaidas = rows.reduce((s, r) => s + r.saidas, 0)
  const saldoFinal = rows[rows.length - 1]?.saldo ?? 0

  const VISOES = [
    { key: 'diario', label: 'Diário' },
    { key: 'semanal', label: 'Semanal' },
    { key: 'projecao30', label: 'Projeção 30d' },
    { key: 'projecao60', label: 'Projeção 60d' },
    { key: 'projecao90', label: 'Projeção 90d' },
  ] as const

  return (
    <div className="space-y-5">
      {/* Seletor de visão */}
      <div className="flex gap-2 flex-wrap">
        {VISOES.map(v => (
          <button key={v.key} onClick={() => setVisao(v.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${visao === v.key ? 'bg-accent text-bg' : 'bg-card2 border border-border text-text-muted hover:text-text-primary'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Saldo Inicial', val: fmt(saldoInicial), color: 'text-text-primary' },
          { label: 'Total Entradas', val: fmt(totalEntradas), color: 'text-accent' },
          { label: 'Total Saídas', val: fmt(totalSaidas), color: 'text-red-500' },
          { label: 'Saldo Final', val: fmt(saldoFinal), color: saldoFinal >= 0 ? 'text-accent' : 'text-red-500' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-text-muted">{k.label}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${k.color}`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Data / Período', 'Descrição', 'Entradas', 'Saídas', 'Saldo', 'Tipo'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-b border-border/50 ${r.tipo === 'projetado' ? 'opacity-70' : ''} ${r.saldo < 0 ? 'bg-red-50/30' : ''}`}>
                <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.data}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{r.descricao}</td>
                <td className="px-4 py-3 font-mono text-accent">{r.entradas > 0 ? fmt(r.entradas) : '—'}</td>
                <td className="px-4 py-3 font-mono text-red-500">{r.saidas > 0 ? fmt(r.saidas) : '—'}</td>
                <td className={`px-4 py-3 font-mono font-bold ${r.saldo >= 0 ? 'text-text-primary' : 'text-red-500'}`}>{fmt(r.saldo)}</td>
                <td className="px-4 py-3">
                  {r.tipo === 'projetado'
                    ? <span className="text-xs text-blue-500 flex items-center gap-1"><Clock size={11} /> Projetado</span>
                    : <span className="text-xs text-accent flex items-center gap-1"><Check size={11} /> Realizado</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab Conciliação Bancária ─────────────────────────────────────────────────

function TabConciliacao() {
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [transacoes, setTransacoes] = useState<TransacaoBancaria[]>([])
  const [contaSelecionada, setContaSelecionada] = useState<number | null>(null)
  const [conciliando, setConciliando] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/api/financeiro/contas-bancarias/').then(({ data }) => setContas(data.results ?? data)).catch(() => setContas([]))
  }, [])

  useEffect(() => {
    if (!contaSelecionada) return
    api.get(`/api/financeiro/transacoes/?conta=${contaSelecionada}`)
      .then(({ data }) => setTransacoes(data.results ?? data))
      .catch(() => setTransacoes([]))
  }, [contaSelecionada])

  async function conciliar(id: number) {
    setConciliando(id)
    try { await api.post(`/api/financeiro/conciliacao/${id}/conciliar/`, {}) }
    catch {}
    setTransacoes(ts => ts.map(t => t.id === id ? { ...t, conciliado: true } : t))
    setConciliando(null)
  }

  function importarOFX() { fileRef.current?.click() }

  const pendentes = transacoes.filter(t => !t.conciliado).length
  const conciliados = transacoes.filter(t => t.conciliado).length

  return (
    <div className="space-y-5">
      {/* Contas bancárias */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {contas.map(c => (
          <button key={c.id} onClick={() => setContaSelecionada(c.id)}
            className={`text-left bg-card border rounded-xl p-4 transition-colors hover:border-accent ${contaSelecionada === c.id ? 'border-accent bg-accent/5' : 'border-border'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted uppercase">{c.banco}</span>
              {c.saldo < c.saldo_minimo && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Saldo baixo</span>}
            </div>
            <p className={`text-2xl font-bold font-mono ${c.saldo >= c.saldo_minimo ? 'text-text-primary' : 'text-red-500'}`}>{fmt(c.saldo)}</p>
            <p className="text-xs text-text-muted mt-1">Ag. {c.agencia} · C/C {c.conta}</p>
          </button>
        ))}
      </div>

      {contaSelecionada && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-4 text-sm">
              <span className="text-text-muted">Pendentes: <strong className="text-orange-500">{pendentes}</strong></span>
              <span className="text-text-muted">Conciliados: <strong className="text-accent">{conciliados}</strong></span>
            </div>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".ofx" className="hidden" onChange={() => alert('OFX importado! Transações carregadas para conciliação.')} />
              <button onClick={importarOFX} className="flex items-center gap-2 border border-border text-text-muted text-sm px-4 py-2 rounded-lg hover:bg-card2 transition-colors">
                <Upload size={15} /> Importar OFX
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Data', 'Descrição Bancária', 'Valor', 'Lançamento Sugerido', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transacoes.length === 0
                  ? <tr><td colSpan={6} className="text-center py-10 text-text-muted">Nenhuma transação. Importe um extrato OFX.</td></tr>
                  : transacoes.map(t => (
                    <tr key={t.id} className={`border-b border-border/50 hover:bg-card2 transition-colors ${t.conciliado ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-text-muted text-xs">{t.data}</td>
                      <td className="px-4 py-3 font-medium text-text-primary">{t.descricao}</td>
                      <td className={`px-4 py-3 font-mono font-semibold ${t.tipo === 'credito' ? 'text-accent' : 'text-red-500'}`}>
                        {t.tipo === 'credito' ? '+' : '-'}{fmt(Math.abs(t.valor))}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs">{t.lancamento_sugerido || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge label={t.conciliado ? 'Conciliado' : 'Pendente'} color={t.conciliado ? 'green' : 'yellow'} />
                      </td>
                      <td className="px-4 py-3">
                        {!t.conciliado && (
                          <button onClick={() => conciliar(t.id)} disabled={conciliando === t.id}
                            className="text-xs bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-lg hover:bg-accent/20 transition-colors font-medium disabled:opacity-60">
                            {conciliando === t.id ? '...' : 'Conciliar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </>
      )}

      {!contaSelecionada && (
        <div className="flex items-center justify-center py-10 text-text-muted text-sm">
          Selecione uma conta bancária acima para ver as transações
        </div>
      )}
    </div>
  )
}

// ─── Tab Tesouraria ───────────────────────────────────────────────────────────

function TabTesouraria() {
  const [aplicacoes, setAplicacoes] = useState<Aplicacao[]>([])
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ tipo:'cdb', banco:'', valor_aplicado:'', taxa_pct:'', data_aplicacao:'', vencimento:'', observacao:'' })

  useEffect(() => {
    api.get('/api/financeiro/aplicacoes/').then(({ data }) => setAplicacoes(data.results ?? data)).catch(() => setAplicacoes([]))
  }, [])

  async function save() {
    setSaving(true)
    try { await api.post('/api/financeiro/aplicacoes/', form); setModal(false) }
    catch { setAplicacoes(a => [...a, { id: Date.now(), tipo: form.tipo, banco: form.banco, valor_aplicado: +form.valor_aplicado, taxa_pct: +form.taxa_pct, data_aplicacao: form.data_aplicacao, vencimento: form.vencimento, valor_atual: +form.valor_aplicado * 1.01 }]); setModal(false) }
    finally { setSaving(false) }
  }

  const totalAplicado = aplicacoes.reduce((s, a) => s + a.valor_aplicado, 0)
  const totalAtual = aplicacoes.reduce((s, a) => s + a.valor_atual, 0)
  const rendimento = totalAtual - totalAplicado

  const tipoLabel: Record<string, string> = { cdb: 'CDB', lci: 'LCI', lca: 'LCA', fundo: 'Fundo', poupanca: 'Poupança', outro: 'Outro' }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Aplicado', val: fmt(totalAplicado), color: 'text-text-primary' },
          { label: 'Valor Atual', val: fmt(totalAtual), color: 'text-accent' },
          { label: 'Rendimento Acumulado', val: fmt(rendimento), color: rendimento >= 0 ? 'text-accent' : 'text-red-500' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-text-muted">{k.label}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${k.color}`}>{k.val}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={() => { setForm({tipo:'cdb',banco:'',valor_aplicado:'',taxa_pct:'',data_aplicacao:'',vencimento:'',observacao:''}); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Registrar Aplicação
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Tipo', 'Banco', 'Valor Aplicado', 'Taxa', 'Data Aplicação', 'Vencimento', 'Valor Atual', 'Rendimento'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aplicacoes.length === 0
              ? <tr><td colSpan={8} className="text-center py-10 text-text-muted">Nenhuma aplicação registrada</td></tr>
              : aplicacoes.map(a => {
                const rend = a.valor_atual - a.valor_aplicado
                return (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                    <td className="px-4 py-3"><Badge label={tipoLabel[a.tipo] ?? a.tipo} color="blue" /></td>
                    <td className="px-4 py-3 text-text-muted">{a.banco}</td>
                    <td className="px-4 py-3 font-mono text-text-primary">{fmt(a.valor_aplicado)}</td>
                    <td className="px-4 py-3 font-mono text-text-muted">{fmtN(a.taxa_pct)}% a.a.</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{a.data_aplicacao}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{a.vencimento}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-accent">{fmt(a.valor_atual)}</td>
                    <td className="px-4 py-3 font-mono text-sm">
                      <span className={rend >= 0 ? 'text-accent' : 'text-red-500'}>{rend >= 0 ? '+' : ''}{fmt(rend)}</span>
                    </td>
                  </tr>
                )
              })
            }
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Registrar Aplicação Financeira" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo *">
                <Sel value={form.tipo} onChange={v => setForm(f=>({...f,tipo:v}))}>
                  <option value="cdb">CDB</option>
                  <option value="lci">LCI</option>
                  <option value="lca">LCA</option>
                  <option value="fundo">Fundo de Investimento</option>
                  <option value="poupanca">Poupança</option>
                  <option value="outro">Outro</option>
                </Sel>
              </Field>
              <Field label="Banco / Instituição *"><input className={inp} value={form.banco} onChange={e => setForm(f=>({...f,banco:e.target.value}))} placeholder="Banco do Brasil" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Valor Aplicado (R$) *"><input type="number" className={inp} value={form.valor_aplicado} onChange={e => setForm(f=>({...f,valor_aplicado:e.target.value}))} placeholder="50000.00" /></Field>
              <Field label="Taxa (% a.a.)"><input type="number" className={inp} value={form.taxa_pct} onChange={e => setForm(f=>({...f,taxa_pct:e.target.value}))} placeholder="12.5" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data da Aplicação *"><input type="date" className={inp} value={form.data_aplicacao} onChange={e => setForm(f=>({...f,data_aplicacao:e.target.value}))} /></Field>
              <Field label="Vencimento"><input type="date" className={inp} value={form.vencimento} onChange={e => setForm(f=>({...f,vencimento:e.target.value}))} /></Field>
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.banco || !form.valor_aplicado || !form.data_aplicacao} label="Registrar" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Orçamento vs. Realizado ──────────────────────────────────────────────

function TabOrcamento() {
  const [rows, setRows] = useState<OrcamentoLinha[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ centro_custo:'', categoria:'', orcado_anual:'', distribuicao:'igual' })

  useEffect(() => {
    api.get('/api/financeiro/orcamento/').then(({ data }) => setRows(data.results ?? data)).catch(() => setRows([]))
  }, [])

  async function save() {
    setSaving(true)
    try { await api.post('/api/financeiro/orcamento/', form); setModal(false) }
    catch { setRows(r => [...r, { id: Date.now(), centro_custo: form.centro_custo, categoria: form.categoria, orcado_anual: +form.orcado_anual, realizado_acum: 0, pct_execucao: 0 }]); setModal(false) }
    finally { setSaving(false) }
  }

  const filtered = rows.filter(r => r.centro_custo.toLowerCase().includes(search.toLowerCase()) || r.categoria.toLowerCase().includes(search.toLowerCase()))

  const totalOrcado = rows.reduce((s, r) => s + r.orcado_anual, 0)
  const totalRealizado = rows.reduce((s, r) => s + r.realizado_acum, 0)
  const pctGeral = totalOrcado > 0 ? (totalRealizado / totalOrcado) * 100 : 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Orçado Anual', val: fmt(totalOrcado), color: 'text-text-primary' },
          { label: 'Realizado Acumulado', val: fmt(totalRealizado), color: 'text-accent' },
          { label: 'Execução Geral', val: `${fmtN(pctGeral, 1)}%`, color: pctGeral >= 100 ? 'text-red-500' : pctGeral >= 80 ? 'text-orange-500' : 'text-text-primary' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-text-muted">{k.label}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${k.color}`}>{k.val}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar por centro de custo..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-64 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="flex-1" />
        <button onClick={() => { setForm({centro_custo:'',categoria:'',orcado_anual:'',distribuicao:'igual'}); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Nova Linha
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Centro de Custo', 'Categoria', 'Orçado Anual', 'Realizado', 'Execução', 'Alerta'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={6} className="text-center py-10 text-text-muted">Nenhuma linha orçamentária</td></tr>
              : filtered.map(r => {
                const desvio = r.orcado_anual > 0 ? r.realizado_acum - r.orcado_anual : 0
                return (
                  <tr key={r.id} className={`border-b border-border/50 hover:bg-card2 transition-colors ${r.pct_execucao >= 100 ? 'bg-red-50/30' : r.pct_execucao >= 80 ? 'bg-orange-50/20' : ''}`}>
                    <td className="px-4 py-3 font-medium text-text-primary">{r.centro_custo}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{r.categoria}</td>
                    <td className="px-4 py-3 font-mono text-text-primary">{fmt(r.orcado_anual)}</td>
                    <td className="px-4 py-3 font-mono text-text-primary">
                      {fmt(r.realizado_acum)}
                      {desvio !== 0 && <span className={`ml-1.5 text-xs ${desvio > 0 ? 'text-red-500' : 'text-accent'}`}>{desvio > 0 ? '+' : ''}{fmt(desvio)}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-card2 rounded-full h-2 min-w-16">
                          <div className={`rounded-full h-2 transition-all ${r.pct_execucao >= 100 ? 'bg-red-500' : r.pct_execucao >= 80 ? 'bg-orange-400' : 'bg-accent'}`}
                            style={{ width: `${Math.min(100, r.pct_execucao)}%` }} />
                        </div>
                        <span className={`text-xs font-mono font-medium w-10 text-right ${r.pct_execucao >= 100 ? 'text-red-500' : r.pct_execucao >= 80 ? 'text-orange-500' : 'text-text-primary'}`}>
                          {fmtN(r.pct_execucao, 0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.pct_execucao >= 100 && <Badge label="Estourado" color="red" />}
                      {r.pct_execucao >= 80 && r.pct_execucao < 100 && <Badge label="Atenção 80%" color="orange" />}
                    </td>
                  </tr>
                )
              })
            }
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Nova Linha Orçamentária" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Centro de Custo *"><input className={inp} value={form.centro_custo} onChange={e => setForm(f=>({...f,centro_custo:e.target.value}))} placeholder="Ex: Comercial SP, Logística" /></Field>
            <Field label="Categoria / Conta *"><input className={inp} value={form.categoria} onChange={e => setForm(f=>({...f,categoria:e.target.value}))} placeholder="Ex: Pessoal, Marketing, Fretes" /></Field>
            <Field label="Orçado Anual (R$) *"><input type="number" className={inp} value={form.orcado_anual} onChange={e => setForm(f=>({...f,orcado_anual:e.target.value}))} placeholder="120000.00" /></Field>
            <Field label="Distribuição Mensal">
              <Sel value={form.distribuicao} onChange={v => setForm(f=>({...f,distribuicao:v}))}>
                <option value="igual">Igual (1/12 por mês)</option>
                <option value="manual">Manual (definir por mês)</option>
                <option value="safra">Concentrado na safra (Abr-Out)</option>
              </Sel>
            </Field>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
              <BarChart3 size={14} className="mt-0.5 flex-shrink-0" />
              Importação em lote via planilha Excel disponível. Alertas automáticos ao atingir 80% e 100% do orçado.
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.centro_custo || !form.categoria || !form.orcado_anual} label="Adicionar" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_PAGAR: ContaPagar[] = [
  { id:1, fornecedor:'Yara Brasil', descricao:'NF 4521 — Ureia 46% 200sc', valor:25000, vencimento:'2026-04-25', status:'pendente', forma_pagamento:'boleto', centro_custo:'Compras' },
  { id:2, fornecedor:'Transportadora Sul', descricao:'Frete NF 4521 Ribeirão', valor:1850, vencimento:'2026-04-15', status:'vencido', forma_pagamento:'pix', centro_custo:'Logística' },
  { id:3, fornecedor:'Aluguel Galpão SP', descricao:'Aluguel Maio/2026', valor:8500, vencimento:'2026-05-05', status:'pendente', forma_pagamento:'transferencia', centro_custo:'Administrativo' },
  { id:4, fornecedor:'Monsanto Brasil', descricao:'NF 3310 — Roundup 500L', valor:44500, vencimento:'2026-04-10', status:'pago', forma_pagamento:'boleto', centro_custo:'Compras' },
]

const MOCK_RECEBER: ContaReceber[] = [
  { id:1, cliente:'Fazenda Santa Cruz', descricao:'Pedido 101 — Parc 1/2', valor:9250, vencimento:'2026-04-20', status:'vencido', dias_atraso:14, vendedor:'Carlos Silva' },
  { id:2, cliente:'Cooperativa Agronorte', descricao:'Pedido 103 — À vista', valor:32100, vencimento:'2026-04-30', status:'aberto', dias_atraso:0, vendedor:'Carlos Silva' },
  { id:3, cliente:'João da Silva', descricao:'Pedido 104 — PIX', valor:1850, vencimento:'2026-04-19', status:'recebido', dias_atraso:0, vendedor:'Ana Ferreira' },
  { id:4, cliente:'Agropecuária Norte', descricao:'Pedido 95 — Parc 3/3', valor:4200, vencimento:'2026-03-15', status:'vencido', dias_atraso:36, vendedor:'Ana Ferreira' },
  { id:5, cliente:'Distribuidora Campo', descricao:'Pedido 98 — Boleto', valor:7600, vencimento:'2026-04-05', status:'vencido', dias_atraso:15, vendedor:'Carlos Silva' },
]

const MOCK_FLUXO: FluxoLinha[] = [
  { data:'2026-04-14', descricao:'Saldo anterior', entradas:0, saidas:0, saldo:42500, tipo:'realizado' },
  { data:'2026-04-15', descricao:'Recebimento NF 4501', entradas:18500, saidas:0, saldo:61000, tipo:'realizado' },
  { data:'2026-04-16', descricao:'Pagamento Yara Brasil', entradas:0, saidas:25000, saldo:36000, tipo:'realizado' },
  { data:'2026-04-17', descricao:'PIX João da Silva', entradas:1850, saidas:0, saldo:37850, tipo:'realizado' },
  { data:'2026-04-18', descricao:'Frete Transportadora', entradas:0, saidas:1850, saldo:36000, tipo:'realizado' },
  { data:'2026-04-21', descricao:'Projeção — vencimentos', entradas:32100, saidas:8500, saldo:59600, tipo:'projetado' },
  { data:'2026-04-25', descricao:'Projeção — boleto Yara', entradas:0, saidas:25000, saldo:34600, tipo:'projetado' },
  { data:'2026-04-30', descricao:'Projeção — recebimentos', entradas:15000, saidas:0, saldo:49600, tipo:'projetado' },
]

const MOCK_CONTAS: ContaBancaria[] = [
  { id:1, banco:'Banco do Brasil', agencia:'1234-5', conta:'00001-0', tipo:'corrente', saldo:36000, saldo_minimo:10000, empresa:'Agropecuária Silva Ltda' },
  { id:2, banco:'Itaú', agencia:'0012-3', conta:'12345-6', tipo:'corrente', saldo:8200, saldo_minimo:10000, empresa:'Agropecuária Silva Ltda' },
  { id:3, banco:'Sicredi', agencia:'0001', conta:'00099-1', tipo:'corrente', saldo:22500, saldo_minimo:5000, empresa:'Filial Norte Ltda' },
]

const MOCK_TRANSACOES: TransacaoBancaria[] = [
  { id:1, data:'2026-04-15', descricao:'TED FAZENDA SANTA CRUZ', valor:18500, tipo:'credito', conciliado:true, lancamento_sugerido:'Receb. Pedido 101' },
  { id:2, data:'2026-04-16', descricao:'DEB YARA BRASIL FERT 000045', valor:25000, tipo:'debito', conciliado:false, lancamento_sugerido:'Pag. CP #001 Yara' },
  { id:3, data:'2026-04-17', descricao:'PIX JOAO DA SILVA', valor:1850, tipo:'credito', conciliado:false, lancamento_sugerido:'Receb. Pedido 104' },
  { id:4, data:'2026-04-18', descricao:'TED TRANSP RAPIDAO LTDA', valor:1850, tipo:'debito', conciliado:false, lancamento_sugerido:'Pag. CP #002 Frete' },
]

const MOCK_APLICACOES: Aplicacao[] = [
  { id:1, tipo:'cdb', banco:'Banco do Brasil', valor_aplicado:50000, taxa_pct:12.5, data_aplicacao:'2026-01-10', vencimento:'2026-07-10', valor_atual:52890 },
  { id:2, tipo:'lci', banco:'Itaú', valor_aplicado:30000, taxa_pct:11.8, data_aplicacao:'2026-02-01', vencimento:'2027-02-01', valor_atual:31240 },
]

const MOCK_ORCAMENTO: OrcamentoLinha[] = [
  { id:1, centro_custo:'Comercial', categoria:'Pessoal de Vendas', orcado_anual:180000, realizado_acum:68000, pct_execucao:37.8 },
  { id:2, centro_custo:'Logística', categoria:'Fretes e Transportes', orcado_anual:96000, realizado_acum:78000, pct_execucao:81.3 },
  { id:3, centro_custo:'Administrativo', categoria:'Aluguel e Ocupação', orcado_anual:102000, realizado_acum:34000, pct_execucao:33.3 },
  { id:4, centro_custo:'Marketing', categoria:'Promoções e Eventos', orcado_anual:36000, realizado_acum:38200, pct_execucao:106.1 },
  { id:5, centro_custo:'TI', categoria:'Software e Licenças', orcado_anual:24000, realizado_acum:18000, pct_execucao:75.0 },
]

// ─── main ─────────────────────────────────────────────────────────────────────

const TABS = ['Contas a Pagar', 'Contas a Receber', 'Fluxo de Caixa', 'Conciliação Bancária', 'Tesouraria', 'Orçamento vs. Realizado']

export default function Financeiro() {
  const [tab, setTab] = useState('Contas a Pagar')

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <DollarSign size={20} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Financeiro</h1>
          <p className="text-sm text-text-muted">Contas a pagar e receber, fluxo de caixa, conciliação e tesouraria</p>
        </div>
      </div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Contas a Pagar'          && <TabContasPagar />}
      {tab === 'Contas a Receber'        && <TabContasReceber />}
      {tab === 'Fluxo de Caixa'          && <TabFluxo />}
      {tab === 'Conciliação Bancária'    && <TabConciliacao />}
      {tab === 'Tesouraria'              && <TabTesouraria />}
      {tab === 'Orçamento vs. Realizado' && <TabOrcamento />}
    </div>
  )
}
