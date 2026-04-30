import { useEffect, useState } from 'react'
import { Plus, Search, X, ChevronDown, Factory, Check, AlertTriangle, ClipboardList, FlaskConical, Gauge, StopCircle } from 'lucide-react'
import { api } from '../lib/api'

// ─── shared ──────────────────────────────────────────────────────────────────

const inp = 'w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors'
const sel = inp + ' appearance-none'
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtN = (v: number, dec = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

function Tabs({ tabs, active, onChange }: { tabs: { label: string; icon: React.ReactNode }[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex flex-wrap border-b border-border mb-6">
      {tabs.map(t => (
        <button key={t.label} onClick={() => onChange(t.label)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${active === t.label ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
          {t.icon}{t.label}
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

function Badge({ label, color }: { label: string; color: 'green' | 'yellow' | 'blue' | 'red' | 'gray' | 'orange' }) {
  const cls = { green: 'bg-accent/10 text-accent', yellow: 'bg-yellow-100 text-yellow-700', blue: 'bg-blue-100 text-blue-700', red: 'bg-red-100 text-red-600', gray: 'bg-card2 text-text-muted border border-border', orange: 'bg-orange-100 text-orange-600' }
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

interface OrdemProducao {
  id: number; numero: string; produto_nome: string; lote_saida: string
  quantidade_planejada: number; quantidade_produzida: number; unidade: string
  status: string; data_inicio: string; data_fim: string
  custo_planejado: number; custo_real: number
}

interface ItemBOM { insumo: string; quantidade: number; unidade: string; tolerancia_pct: number }
interface BOM { id: number; produto_nome: string; versao: string; ativa: boolean; itens: ItemBOM[] }

interface Laudo {
  id: number; lote: string; produto_nome: string; data_analise: string
  analista: string; resultado: string; parametros: string; aprovado: boolean
}

interface Parada {
  id: number; ordem_numero: string; causa: string; inicio: string; fim: string
  duracao_min: number; impacto_unidades: number; resolvida: boolean
}

// ─── Tab Ordens ───────────────────────────────────────────────────────────────

function TabOrdens() {
  const [rows, setRows] = useState<OrdemProducao[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modal, setModal] = useState(false)
  const [apontarModal, setApontarModal] = useState<OrdemProducao | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ produto: '', lote_saida: '', quantidade_planejada: '', data_inicio: '', data_fim_prevista: '', bom_id: '' })
  const [apontamento, setApontamento] = useState({ quantidade_produzida: '', observacao: '' })

  useEffect(() => {
    api.get('/api/producao/ordens/').then(({ data }) => setRows(data.results ?? data)).catch(() => setRows([]))
  }, [])

  async function save() {
    setSaving(true)
    try { await api.post('/api/producao/ordens/', form); setModal(false) }
    catch { setRows(r => [...r, { id: Date.now(), numero: `OP-${String(r.length+1).padStart(4,'0')}`, produto_nome: form.produto, lote_saida: form.lote_saida, quantidade_planejada: +form.quantidade_planejada, quantidade_produzida: 0, unidade: 'KG', status: 'aberta', data_inicio: form.data_inicio, data_fim: form.data_fim_prevista, custo_planejado: 0, custo_real: 0 }]); setModal(false) }
    finally { setSaving(false) }
  }

  async function apontar() {
    if (!apontarModal) return
    setSaving(true)
    try {
      await api.post(`/api/producao/ordens/${apontarModal.id}/apontar/`, apontamento)
      setRows(rs => rs.map(r => r.id === apontarModal.id ? { ...r, quantidade_produzida: +apontamento.quantidade_produzida, status: 'em_andamento' } : r))
      setApontarModal(null)
    } catch { alert('Erro ao registrar apontamento') }
    finally { setSaving(false) }
  }

  async function encerrar(id: number) {
    if (!confirm('Encerrar esta ordem de produção?')) return
    try {
      await api.post(`/api/producao/ordens/${id}/encerrar/`, {})
      setRows(rs => rs.map(r => r.id === id ? { ...r, status: 'encerrada' } : r))
    } catch { setRows(rs => rs.map(r => r.id === id ? { ...r, status: 'encerrada' } : r)) }
  }

  const statusColor: Record<string, 'blue' | 'yellow' | 'green' | 'gray'> = { aberta: 'blue', em_andamento: 'yellow', encerrada: 'green', cancelada: 'gray' }
  const statusLabel: Record<string, string> = { aberta: 'Aberta', em_andamento: 'Em Andamento', encerrada: 'Encerrada', cancelada: 'Cancelada' }

  const filtered = rows.filter(r =>
    (r.produto_nome.toLowerCase().includes(search.toLowerCase()) || r.numero.includes(search)) &&
    (filterStatus ? r.status === filterStatus : true)
  )

  const emAndamento = rows.filter(r => r.status === 'em_andamento').length
  const encerradas = rows.filter(r => r.status === 'encerrada').length
  const totalPlanejado = rows.filter(r => r.status !== 'cancelada').reduce((s, r) => s + r.quantidade_planejada, 0)

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Em Andamento', val: String(emAndamento), color: emAndamento > 0 ? 'text-yellow-600' : 'text-text-primary' },
          { label: 'Encerradas (total)', val: String(encerradas), color: 'text-accent' },
          { label: 'Volume Planejado', val: `${fmtN(totalPlanejado, 0)} kg`, color: 'text-text-primary' },
          { label: 'Total de Ordens', val: String(rows.length), color: 'text-text-primary' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por produto ou nº..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-64 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="relative">
          <select className={sel + ' w-44'} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="aberta">Aberta</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="encerrada">Encerrada</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <div className="flex-1" />
        <button onClick={() => { setForm({ produto:'', lote_saida:'', quantidade_planejada:'', data_inicio:'', data_fim_prevista:'', bom_id:'' }); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Nova Ordem
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Nº', 'Produto', 'Lote Saída', 'Planejado', 'Produzido', 'Dt. Início', 'Custo Real vs Plan.', 'Status', 'Ações'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={9} className="text-center py-10 text-text-muted">Nenhuma ordem encontrada</td></tr>
              : filtered.map(r => {
                  const desvio = r.custo_real > 0 && r.custo_planejado > 0 ? ((r.custo_real - r.custo_planejado) / r.custo_planejado) * 100 : null
                  return (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                      <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.numero}</td>
                      <td className="px-4 py-3 font-medium text-text-primary">{r.produto_nome}</td>
                      <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.lote_saida || '—'}</td>
                      <td className="px-4 py-3 font-mono text-text-muted">{fmtN(r.quantidade_planejada, 0)} {r.unidade}</td>
                      <td className="px-4 py-3 font-mono text-text-primary">
                        {r.quantidade_produzida > 0 ? `${fmtN(r.quantidade_produzida, 0)} ${r.unidade}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs">{r.data_inicio}</td>
                      <td className="px-4 py-3">
                        {r.custo_real > 0 ? (
                          <div className="text-xs">
                            <span className="font-mono text-text-primary">{fmt(r.custo_real)}</span>
                            {desvio !== null && (
                              <span className={`ml-1.5 font-medium ${desvio > 5 ? 'text-red-500' : desvio < -5 ? 'text-accent' : 'text-text-muted'}`}>
                                {desvio > 0 ? '+' : ''}{fmtN(desvio, 1)}%
                              </span>
                            )}
                          </div>
                        ) : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3"><Badge label={statusLabel[r.status] ?? r.status} color={statusColor[r.status] ?? 'gray'} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {(r.status === 'aberta' || r.status === 'em_andamento') && (
                            <button onClick={() => { setApontamento({ quantidade_produzida: String(r.quantidade_produzida||''), observacao:'' }); setApontarModal(r) }}
                              className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors font-medium">
                              Apontar
                            </button>
                          )}
                          {r.status === 'em_andamento' && (
                            <button onClick={() => encerrar(r.id)}
                              className="text-xs bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-lg hover:bg-accent/20 transition-colors font-medium">
                              Encerrar
                            </button>
                          )}
                          {(r.status === 'encerrada' || r.status === 'cancelada') && (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>

      {/* Nova Ordem */}
      {modal && (
        <Modal title="Nova Ordem de Produção" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Field label="Produto Final *">
              <input className={inp} value={form.produto} onChange={e => setForm(f=>({...f,produto:e.target.value}))} placeholder="Ex: Fertilizante NPK 10-10-10" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Lote de Saída">
                <input className={inp} value={form.lote_saida} onChange={e => setForm(f=>({...f,lote_saida:e.target.value}))} placeholder="LOT-2026-001" />
              </Field>
              <Field label="Quantidade Planejada *">
                <input type="number" className={inp} value={form.quantidade_planejada} onChange={e => setForm(f=>({...f,quantidade_planejada:e.target.value}))} placeholder="1000 kg" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data de Início">
                <input type="date" className={inp} value={form.data_inicio} onChange={e => setForm(f=>({...f,data_inicio:e.target.value}))} />
              </Field>
              <Field label="Previsão de Término">
                <input type="date" className={inp} value={form.data_fim_prevista} onChange={e => setForm(f=>({...f,data_fim_prevista:e.target.value}))} />
              </Field>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
              <ClipboardList size={14} className="mt-0.5 flex-shrink-0" />
              O consumo de insumos será calculado automaticamente com base na BOM vinculada ao produto.
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.produto || !form.quantidade_planejada} label="Abrir Ordem" />
          </div>
        </Modal>
      )}

      {/* Apontamento */}
      {apontarModal && (
        <Modal title={`Apontamento — ${apontarModal.numero}`} onClose={() => setApontarModal(null)}>
          <div className="space-y-4">
            <div className="bg-card2 border border-border rounded-xl p-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-text-muted">Produto</span><span className="font-medium text-text-primary">{apontarModal.produto_nome}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Planejado</span><span className="font-mono text-text-primary">{fmtN(apontarModal.quantidade_planejada, 0)} {apontarModal.unidade}</span></div>
            </div>
            <Field label="Quantidade Produzida *">
              <input type="number" className={inp} value={apontamento.quantidade_produzida}
                onChange={e => setApontamento(a => ({ ...a, quantidade_produzida: e.target.value }))}
                placeholder={`Planejado: ${apontarModal.quantidade_planejada} ${apontarModal.unidade}`} />
            </Field>
            {apontamento.quantidade_produzida && +apontamento.quantidade_produzida < apontarModal.quantidade_planejada * 0.9 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                Produção abaixo de 90% do planejado. Verifique perdas e registre paradas se necessário.
              </div>
            )}
            <Field label="Observações">
              <textarea className={inp} rows={2} value={apontamento.observacao} onChange={e => setApontamento(a => ({ ...a, observacao: e.target.value }))} placeholder="Intercorrências, ajustes de formulação..." />
            </Field>
            <ModalFooter onClose={() => setApontarModal(null)} onSave={apontar} saving={saving} disabled={!apontamento.quantidade_produzida} label="Registrar Apontamento" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab BOM ──────────────────────────────────────────────────────────────────

function TabBOM() {
  const [rows, setRows] = useState<BOM[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState<BOM | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ produto: '', versao: '1.0' })
  const [itens, setItens] = useState<ItemBOM[]>([{ insumo: '', quantidade: 0, unidade: 'KG', tolerancia_pct: 5 }])

  useEffect(() => {
    api.get('/api/producao/bom/').then(({ data }) => setRows(data.results ?? data)).catch(() => setRows([]))
  }, [])

  async function save() {
    setSaving(true)
    try { await api.post('/api/producao/bom/', { ...form, itens }); setModal(false) }
    catch {
      setRows(r => [...r, { id: Date.now(), produto_nome: form.produto, versao: form.versao, ativa: true, itens }])
      setModal(false)
    }
    finally { setSaving(false) }
  }

  const filtered = rows.filter(r => r.produto_nome.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-64 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="flex-1" />
        <button onClick={() => { setForm({ produto:'', versao:'1.0' }); setItens([{ insumo:'', quantidade:0, unidade:'KG', tolerancia_pct:5 }]); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Nova BOM
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-text-primary">Fórmulas Cadastradas</p>
          </div>
          <div className="divide-y divide-border/50">
            {filtered.length === 0
              ? <p className="text-center py-8 text-text-muted text-sm">Nenhuma BOM cadastrada</p>
              : filtered.map(r => (
                <button key={r.id} onClick={() => setSelected(r)}
                  className={`w-full flex items-center justify-between px-4 py-3 hover:bg-card2 transition-colors text-left ${selected?.id === r.id ? 'bg-accent/5 border-l-2 border-accent' : ''}`}>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{r.produto_nome}</p>
                    <p className="text-xs text-text-muted">v{r.versao} · {r.itens.length} componentes</p>
                  </div>
                  {r.ativa && <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">Ativa</span>}
                </button>
              ))
            }
          </div>
        </div>

        {/* Detalhe */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted text-sm gap-2">
              <ClipboardList size={28} className="opacity-30" />
              Selecione uma BOM para visualizar os componentes
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <p className="font-semibold text-text-primary">{selected.produto_nome}</p>
                  <p className="text-xs text-text-muted">Versão {selected.versao}</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card2">
                    {['Insumo / Matéria-Prima', 'Qtd.', 'Unidade', 'Tolerância'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.itens.map((item, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium text-text-primary">{item.insumo}</td>
                      <td className="px-4 py-3 font-mono text-text-primary">{fmtN(item.quantidade)}</td>
                      <td className="px-4 py-3 text-text-muted">{item.unidade}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${item.tolerancia_pct <= 2 ? 'text-red-500' : item.tolerancia_pct <= 5 ? 'text-yellow-600' : 'text-text-muted'}`}>
                          ± {item.tolerancia_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {modal && (
        <Modal title="Nova BOM — Estrutura de Produto" onClose={() => setModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Field label="Produto Final *">
                  <input className={inp} value={form.produto} onChange={e => setForm(f=>({...f,produto:e.target.value}))} placeholder="Ex: NPK 10-10-10 Granulado" />
                </Field>
              </div>
              <Field label="Versão">
                <input className={inp} value={form.versao} onChange={e => setForm(f=>({...f,versao:e.target.value}))} placeholder="1.0" />
              </Field>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-secondary">Componentes (BOM)</label>
                <button onClick={() => setItens(i => [...i, { insumo:'', quantidade:0, unidade:'KG', tolerancia_pct:5 }])}
                  className="text-xs text-accent flex items-center gap-1"><Plus size={12} /> Adicionar</button>
              </div>
              <div className="space-y-2">
                {itens.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center bg-card2 rounded-lg p-2">
                    <div className="col-span-4">
                      <input className={inp} value={item.insumo} onChange={e => setItens(its => its.map((x,j) => j===i ? {...x,insumo:e.target.value}:x))} placeholder="Insumo" />
                    </div>
                    <div className="col-span-2">
                      <input type="number" className={inp} value={item.quantidade} onChange={e => setItens(its => its.map((x,j) => j===i ? {...x,quantidade:+e.target.value}:x))} placeholder="Qtd" />
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <select className={sel} value={item.unidade} onChange={e => setItens(its => its.map((x,j) => j===i ? {...x,unidade:e.target.value}:x))}>
                          {['KG','G','TON','L','ML','UN','SC'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                      </div>
                    </div>
                    <div className="col-span-3">
                      <div className="relative">
                        <input type="number" className={inp} value={item.tolerancia_pct} onChange={e => setItens(its => its.map((x,j) => j===i ? {...x,tolerancia_pct:+e.target.value}:x))} placeholder="Tol.%" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">%</span>
                      </div>
                    </div>
                    <button onClick={() => setItens(its => its.filter((_,j) => j!==i))} className="col-span-1 flex justify-center text-text-muted hover:text-red-500"><X size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.produto || itens.every(i => !i.insumo)} label="Salvar BOM" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Qualidade ────────────────────────────────────────────────────────────

function TabQualidade() {
  const [rows, setRows] = useState<Laudo[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ lote: '', produto: '', analista: '', data_analise: '', parametros: '', resultado: '', aprovado: true, observacao: '' })

  useEffect(() => {
    api.get('/api/producao/laudos/').then(({ data }) => setRows(data.results ?? data)).catch(() => setRows([]))
  }, [])

  async function save() {
    setSaving(true)
    try { await api.post('/api/producao/laudos/', form); setModal(false) }
    catch {
      setRows(r => [...r, { id: Date.now(), lote: form.lote, produto_nome: form.produto, data_analise: form.data_analise, analista: form.analista, resultado: form.resultado, parametros: form.parametros, aprovado: form.aprovado }])
      setModal(false)
    }
    finally { setSaving(false) }
  }

  const filtered = rows.filter(r => r.lote.includes(search) || r.produto_nome.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por lote ou produto..."
            className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-64 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
        <div className="flex-1" />
        <button onClick={() => { setForm({ lote:'', produto:'', analista:'', data_analise:'', parametros:'', resultado:'', aprovado:true, observacao:'' }); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Novo Laudo
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Lote', 'Produto', 'Data Análise', 'Analista', 'Parâmetros', 'Resultado', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={7} className="text-center py-10 text-text-muted">Nenhum laudo encontrado</td></tr>
              : filtered.map(r => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.lote}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{r.produto_nome}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.data_analise}</td>
                  <td className="px-4 py-3 text-text-muted">{r.analista}</td>
                  <td className="px-4 py-3 text-text-muted text-xs max-w-48 truncate">{r.parametros}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.resultado}</td>
                  <td className="px-4 py-3">
                    <Badge label={r.aprovado ? 'Aprovado' : 'Reprovado'} color={r.aprovado ? 'green' : 'red'} />
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Novo Laudo de Qualidade" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Lote *"><input className={inp} value={form.lote} onChange={e => setForm(f=>({...f,lote:e.target.value}))} placeholder="LOT-2026-001" /></Field>
              <Field label="Produto *"><input className={inp} value={form.produto} onChange={e => setForm(f=>({...f,produto:e.target.value}))} placeholder="NPK 10-10-10" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Analista *"><input className={inp} value={form.analista} onChange={e => setForm(f=>({...f,analista:e.target.value}))} placeholder="Nome do analista" /></Field>
              <Field label="Data da Análise *"><input type="date" className={inp} value={form.data_analise} onChange={e => setForm(f=>({...f,data_analise:e.target.value}))} /></Field>
            </div>
            <Field label="Parâmetros Analisados">
              <input className={inp} value={form.parametros} onChange={e => setForm(f=>({...f,parametros:e.target.value}))} placeholder="pH: 6.8, Umidade: 4.2%, Granulometria: 95%" />
            </Field>
            <Field label="Resultado / Conclusão">
              <input className={inp} value={form.resultado} onChange={e => setForm(f=>({...f,resultado:e.target.value}))} placeholder="Dentro das especificações técnicas" />
            </Field>
            <div className="flex items-center justify-between border border-border rounded-xl p-4">
              <div>
                <p className="text-sm font-medium text-text-primary">Lote Aprovado?</p>
                <p className="text-xs text-text-muted mt-0.5">Lote reprovado bloqueia saída do estoque</p>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, aprovado: !f.aprovado }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.aprovado ? 'bg-accent' : 'bg-red-400'}`}>
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.aprovado ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </div>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.lote || !form.produto || !form.analista || !form.data_analise} label="Registrar Laudo" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Paradas ──────────────────────────────────────────────────────────────

function TabParadas() {
  const [rows, setRows] = useState<Parada[]>([])
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ordem_numero: '', causa: '', tipo_causa: 'mecanica', inicio: '', fim: '', impacto_unidades: '' })

  useEffect(() => {
    api.get('/api/producao/paradas/').then(({ data }) => setRows(data.results ?? data)).catch(() => setRows([]))
  }, [])

  async function save() {
    setSaving(true)
    const inicio = new Date(form.inicio)
    const fim = new Date(form.fim)
    const duracao = form.fim ? Math.round((fim.getTime() - inicio.getTime()) / 60000) : 0
    try { await api.post('/api/producao/paradas/', { ...form, duracao_min: duracao }); setModal(false) }
    catch {
      setRows(r => [...r, { id: Date.now(), ordem_numero: form.ordem_numero, causa: form.causa, inicio: form.inicio, fim: form.fim, duracao_min: duracao, impacto_unidades: +form.impacto_unidades || 0, resolvida: !!form.fim }])
      setModal(false)
    }
    finally { setSaving(false) }
  }

  const totalParadas = rows.length
  const totalMinutos = rows.reduce((s, r) => s + r.duracao_min, 0)
  const abertas = rows.filter(r => !r.resolvida).length

  const causaLabel: Record<string, string> = { mecanica: 'Mecânica', eletrica: 'Elétrica', processo: 'Processo', qualidade: 'Qualidade', falta_insumo: 'Falta de Insumo', outro: 'Outro' }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Paradas Registradas', val: String(totalParadas) },
          { label: 'Tempo Total Parado', val: `${Math.floor(totalMinutos/60)}h ${totalMinutos%60}min` },
          { label: 'Paradas em Aberto', val: String(abertas), alert: abertas > 0 },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-text-muted">{k.label}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${(k as any).alert ? 'text-red-500' : 'text-text-primary'}`}>{k.val}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={() => { setForm({ ordem_numero:'', causa:'', tipo_causa:'mecanica', inicio:'', fim:'', impacto_unidades:'' }); setModal(true) }}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Registrar Parada
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Ordem', 'Causa', 'Início', 'Fim', 'Duração', 'Impacto (un.)', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={7} className="text-center py-10 text-text-muted">Nenhuma parada registrada</td></tr>
              : rows.map(r => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{r.ordem_numero || '—'}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{r.causa}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.inicio}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{r.fim || '—'}</td>
                  <td className="px-4 py-3 font-mono text-text-muted">{r.duracao_min >= 60 ? `${Math.floor(r.duracao_min/60)}h${r.duracao_min%60 > 0 ? ` ${r.duracao_min%60}min` : ''}` : `${r.duracao_min}min`}</td>
                  <td className="px-4 py-3 font-mono text-text-muted">{r.impacto_unidades > 0 ? fmtN(r.impacto_unidades, 0) : '—'}</td>
                  <td className="px-4 py-3"><Badge label={r.resolvida ? 'Resolvida' : 'Em Aberto'} color={r.resolvida ? 'green' : 'red'} /></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Registrar Parada de Linha" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ordem de Produção">
                <input className={inp} value={form.ordem_numero} onChange={e => setForm(f=>({...f,ordem_numero:e.target.value}))} placeholder="OP-0001" />
              </Field>
              <Field label="Tipo de Causa *">
                <Sel value={form.tipo_causa} onChange={v => setForm(f=>({...f,tipo_causa:v}))}>
                  <option value="mecanica">Mecânica</option>
                  <option value="eletrica">Elétrica</option>
                  <option value="processo">Processo</option>
                  <option value="qualidade">Qualidade</option>
                  <option value="falta_insumo">Falta de Insumo</option>
                  <option value="outro">Outro</option>
                </Sel>
              </Field>
            </div>
            <Field label="Descrição da Causa *">
              <input className={inp} value={form.causa} onChange={e => setForm(f=>({...f,causa:e.target.value}))} placeholder="Ex: Quebra de correia transportadora" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Início *"><input type="datetime-local" className={inp} value={form.inicio} onChange={e => setForm(f=>({...f,inicio:e.target.value}))} /></Field>
              <Field label="Retorno (deixe vazio se ainda parada)"><input type="datetime-local" className={inp} value={form.fim} onChange={e => setForm(f=>({...f,fim:e.target.value}))} /></Field>
            </div>
            <Field label="Impacto (unidades perdidas)">
              <input type="number" className={inp} value={form.impacto_unidades} onChange={e => setForm(f=>({...f,impacto_unidades:e.target.value}))} placeholder="0" />
            </Field>
            <ModalFooter onClose={() => setModal(false)} onSave={save} saving={saving} disabled={!form.causa || !form.inicio} label="Registrar Parada" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab OEE ──────────────────────────────────────────────────────────────────

function TabOEE() {
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano] = useState(new Date().getFullYear())
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    api.get(`/api/producao/oee/?mes=${mes}&ano=${ano}`)
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
  }, [mes])

  const GaugeRing = ({ value, label, color }: { value: number; label: string; color: string }) => {
    const pct = Math.min(100, Math.max(0, value))
    const r = 36, circ = 2 * Math.PI * r
    const dash = (pct / 100) * circ
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
            <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-border" />
            <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold font-mono text-text-primary">{pct.toFixed(0)}%</span>
          </div>
        </div>
        <p className="text-xs font-medium text-text-secondary">{label}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative">
          <select className={sel + ' w-40'} value={mes} onChange={e => setMes(+e.target.value)}>
            {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m,i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
      </div>

      {data && (
        <>
          {/* OEE geral */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="text-center">
                <p className="text-sm text-text-muted mb-1">OEE Geral</p>
                <p className={`text-5xl font-bold font-mono ${data.oee >= 85 ? 'text-accent' : data.oee >= 65 ? 'text-yellow-600' : 'text-red-500'}`}>
                  {data.oee}%
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {data.oee >= 85 ? 'Excelente' : data.oee >= 65 ? 'Aceitável' : 'Abaixo do esperado'}
                </p>
              </div>
              <div className="h-16 w-px bg-border hidden lg:block" />
              <div className="flex gap-10">
                <GaugeRing value={data.disponibilidade} label="Disponibilidade" color="#2A7D45" />
                <GaugeRing value={data.performance} label="Performance" color="#3B82F6" />
                <GaugeRing value={data.qualidade} label="Qualidade" color="#F59E0B" />
              </div>
            </div>
          </div>

          {/* Detalhes */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Horas Disponíveis', val: `${data.horas_disponiveis}h` },
              { label: 'Horas Produzindo', val: `${data.horas_produzindo}h` },
              { label: 'Volume Produzido', val: `${fmtN(data.volume_produzido, 0)} ${data.unidade}` },
              { label: 'Perdas por Qualidade', val: `${fmtN(data.perdas_qualidade, 0)} ${data.unidade}` },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-xs text-text-muted">{k.label}</p>
                <p className="text-lg font-bold font-mono text-text-primary mt-1">{k.val}</p>
              </div>
            ))}
          </div>

          {/* Paradas do período */}
          {data.top_paradas?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-semibold text-text-primary mb-3">Principais Causas de Parada</p>
              <div className="space-y-2">
                {data.top_paradas.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-text-muted w-28 shrink-0">{p.causa}</span>
                    <div className="flex-1 bg-card2 rounded-full h-2">
                      <div className="bg-accent rounded-full h-2 transition-all" style={{ width: `${p.pct}%` }} />
                    </div>
                    <span className="text-xs font-mono font-medium text-text-primary w-12 text-right">{p.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_ORDENS: OrdemProducao[] = [
  { id:1, numero:'OP-0001', produto_nome:'NPK 10-10-10 Granulado', lote_saida:'LOT-2026-001', quantidade_planejada:5000, quantidade_produzida:4870, unidade:'KG', status:'encerrada', data_inicio:'2026-04-01', data_fim:'2026-04-03', custo_planejado:12500, custo_real:12280 },
  { id:2, numero:'OP-0002', produto_nome:'Fertilizante Foliar Especial', lote_saida:'LOT-2026-002', quantidade_planejada:2000, quantidade_produzida:1850, unidade:'L', status:'em_andamento', data_inicio:'2026-04-18', data_fim:'2026-04-22', custo_planejado:8000, custo_real:7600 },
  { id:3, numero:'OP-0003', produto_nome:'Ureia Revestida 46%', lote_saida:'', quantidade_planejada:10000, quantidade_produzida:0, unidade:'KG', status:'aberta', data_inicio:'2026-04-21', data_fim:'2026-04-25', custo_planejado:22000, custo_real:0 },
]

const MOCK_BOMS: BOM[] = [
  { id:1, produto_nome:'NPK 10-10-10 Granulado', versao:'2.1', ativa:true, itens:[
    { insumo:'Ureia', quantidade:220, unidade:'KG', tolerancia_pct:3 },
    { insumo:'Superfosfato Simples', quantidade:310, unidade:'KG', tolerancia_pct:5 },
    { insumo:'Cloreto de Potássio', quantidade:170, unidade:'KG', tolerancia_pct:3 },
    { insumo:'Granulante', quantidade:50, unidade:'KG', tolerancia_pct:10 },
  ]},
  { id:2, produto_nome:'Fertilizante Foliar Especial', versao:'1.0', ativa:true, itens:[
    { insumo:'Nitrato de Cálcio', quantidade:80, unidade:'KG', tolerancia_pct:2 },
    { insumo:'Sulfato de Magnésio', quantidade:40, unidade:'KG', tolerancia_pct:5 },
    { insumo:'Água destilada', quantidade:800, unidade:'L', tolerancia_pct:10 },
  ]},
]

const MOCK_LAUDOS: Laudo[] = [
  { id:1, lote:'LOT-2026-001', produto_nome:'NPK 10-10-10 Granulado', data_analise:'2026-04-03', analista:'Dr. Carlos Mendes', resultado:'Conforme especificação técnica', parametros:'N: 10.2%, P: 9.8%, K: 10.1%, Umidade: 3.8%', aprovado:true },
  { id:2, lote:'LOT-2026-002', produto_nome:'Fertilizante Foliar Especial', data_analise:'2026-04-19', analista:'Dra. Ana Lima', resultado:'pH fora do limite — aguardando reprocessamento', parametros:'pH: 8.4 (limite: 6.5-7.5), Condutividade: 2.1 mS/cm', aprovado:false },
]

const MOCK_PARADAS: Parada[] = [
  { id:1, ordem_numero:'OP-0001', causa:'Quebra de correia transportadora', inicio:'2026-04-02 14:30', fim:'2026-04-02 16:15', duracao_min:105, impacto_unidades:320, resolvida:true },
  { id:2, ordem_numero:'OP-0002', causa:'Falta de Ureia — aguardando entrega', inicio:'2026-04-19 08:00', fim:'', duracao_min:240, impacto_unidades:600, resolvida:false },
]

const MOCK_OEE = {
  oee: 71, disponibilidade: 82, performance: 88, qualidade: 98,
  horas_disponiveis: 160, horas_produzindo: 131, volume_produzido: 6870, perdas_qualidade: 145, unidade: 'KG',
  top_paradas: [
    { causa: 'Mecânica', pct: 42 },
    { causa: 'Falta de Insumo', pct: 31 },
    { causa: 'Elétrica', pct: 18 },
    { causa: 'Processo', pct: 9 },
  ]
}

// ─── main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Ordens de Produção', icon: <ClipboardList size={15} /> },
  { label: 'Estrutura de Produto (BOM)', icon: <Factory size={15} /> },
  { label: 'Controle de Qualidade', icon: <FlaskConical size={15} /> },
  { label: 'Paradas de Linha', icon: <StopCircle size={15} /> },
  { label: 'Eficiência e OEE', icon: <Gauge size={15} /> },
]

export default function Producao() {
  const [tab, setTab] = useState('Ordens de Produção')

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <Factory size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Produção e Beneficiamento</h1>
          <p className="text-sm text-text-muted">Ordens de produção, BOM, qualidade e eficiência de linha</p>
        </div>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Ordens de Produção'          && <TabOrdens />}
      {tab === 'Estrutura de Produto (BOM)'  && <TabBOM />}
      {tab === 'Controle de Qualidade'       && <TabQualidade />}
      {tab === 'Paradas de Linha'            && <TabParadas />}
      {tab === 'Eficiência e OEE'            && <TabOEE />}
    </div>
  )
}
