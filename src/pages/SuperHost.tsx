import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Ban, CheckCircle, Search, LogIn, X, Settings, Building2, ChevronDown, ChevronUp, Plus, Save, UserPlus } from 'lucide-react'
import { api } from '../lib/api'

interface Empresa {
  id: number
  nome: string
  cnpj: string
  tipo_negocio: string
  status_assinatura: string
  total_usuarios: number
  criado_em: string
  plano?: string
  max_usuarios?: number
}

interface Plano {
  plano: string
  max_usuarios: number
  modulos_habilitados: Record<string, boolean>
  total_usuarios: number
}

interface Unidade {
  id: number
  nome: string
  cnpj: string
  tipo_negocio: string
}

const MODULOS_LABELS: Record<string, string> = {
  vendas: 'Vendas e Pedidos', estoque: 'Estoque', compras: 'Compras',
  financeiro: 'Financeiro', fiscal: 'Fiscal', cobranca: 'Cobrança',
  crm: 'CRM', rh: 'RH', bi: 'BI e Relatórios', logistica: 'Logística',
  producao: 'Produção', safras: 'Safras', contratos: 'Contratos', manutencao: 'Manutenção',
}

// ─── Modal de justificativa ───────────────────────────────────────────────────

function ModalJustificativa({ empresa, onConfirm, onClose }: {
  empresa: Empresa
  onConfirm: (justificativa: string) => void
  onClose: () => void
}) {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')

  function confirmar() {
    if (texto.trim().length < 10) { setErro('Mínimo 10 caracteres.'); return }
    onConfirm(texto.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">Acessar ambiente de {empresa.nome}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-xs text-text-muted">Todo acesso é registrado em log de auditoria. Informe o motivo.</p>
          <textarea
            value={texto} onChange={e => setTexto(e.target.value)}
            placeholder="Ex: Diagnóstico de problema relatado pelo cliente..."
            rows={3}
            className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
          />
          {erro && <p className="text-xs text-red-400">{erro}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 text-sm px-4 py-2 rounded-lg border border-border text-text-muted hover:text-text-primary">Cancelar</button>
          <button onClick={confirmar} className="flex-1 text-sm font-semibold px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700">
            Acessar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Painel de plano/unidades ─────────────────────────────────────────────────

function PainelPlano({ empresa, onClose }: { empresa: Empresa; onClose: () => void }) {
  const [tab, setTab] = useState<'plano' | 'unidades'>('plano')
  const [plano, setPlano] = useState<Plano | null>(null)
  const [unidades, setUnidades] = useState<{ matriz: { id: number; nome: string }; filiais: Unidade[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [novaFilial, setNovaFilial] = useState({ nome: '', cnpj: '', max_usuarios: 5 })
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    api.get(`/api/superhost/plano/${empresa.id}/`).then(r => setPlano(r.data)).catch(() => {})
    api.get(`/api/superhost/unidades/${empresa.id}/`).then(r => setUnidades(r.data)).catch(() => {})
  }, [empresa.id])

  async function salvarPlano() {
    if (!plano) return
    setSaving(true)
    try {
      await api.patch(`/api/superhost/plano/${empresa.id}/`, {
        plano: plano.plano,
        max_usuarios: plano.max_usuarios,
        modulos_habilitados: plano.modulos_habilitados,
      })
    } catch { alert('Erro ao salvar.') }
    finally { setSaving(false) }
  }

  async function criarFilial() {
    if (!novaFilial.nome || !novaFilial.cnpj) { alert('Preencha nome e CNPJ.'); return }
    setCriando(true)
    try {
      await api.post(`/api/superhost/unidades/${empresa.id}/`, novaFilial)
      const r = await api.get(`/api/superhost/unidades/${empresa.id}/`)
      setUnidades(r.data)
      setNovaFilial({ nome: '', cnpj: '', max_usuarios: 5 })
    } catch { alert('Erro ao criar filial.') }
    finally { setCriando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-text-primary">{empresa.nome}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0">
          {(['plano', 'unidades'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${tab === t ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
              {t === 'plano' ? 'Plano e Módulos' : 'Unidades / Filiais'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'plano' && plano && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Plano</label>
                  <select value={plano.plano} onChange={e => setPlano(p => p ? { ...p, plano: e.target.value } : p)}
                    className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
                    {['starter', 'pro', 'enterprise'].map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Máx. usuários <span className="text-text-muted/60">({plano.total_usuarios} ativos)</span>
                  </label>
                  <input type="number" min={1} value={plano.max_usuarios}
                    onChange={e => setPlano(p => p ? { ...p, max_usuarios: Number(e.target.value) } : p)}
                    className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-text-muted mb-2">Módulos habilitados</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(plano.modulos_habilitados).map(([mod, ativo]) => (
                    <label key={mod} className="flex items-center gap-2 cursor-pointer bg-card2 rounded-lg px-3 py-2">
                      <input type="checkbox" checked={ativo}
                        onChange={e => setPlano(p => p ? { ...p, modulos_habilitados: { ...p.modulos_habilitados, [mod]: e.target.checked } } : p)}
                        className="accent-accent" />
                      <span className="text-xs text-text-primary">{MODULOS_LABELS[mod] ?? mod}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button onClick={salvarPlano} disabled={saving}
                className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 disabled:opacity-60">
                <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}

          {tab === 'unidades' && (
            <div className="space-y-4">
              {unidades?.filiais.length === 0 && (
                <p className="text-sm text-text-muted">Nenhuma filial cadastrada.</p>
              )}
              {unidades?.filiais.map(f => (
                <div key={f.id} className="flex items-center justify-between bg-card2 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{f.nome}</p>
                    <p className="text-xs text-text-muted font-mono">{f.cnpj}</p>
                  </div>
                  <span className="text-xs text-text-muted">{f.tipo_negocio}</span>
                </div>
              ))}

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-text-muted mb-3">Nova filial</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input placeholder="Nome da filial" value={novaFilial.nome}
                    onChange={e => setNovaFilial(f => ({ ...f, nome: e.target.value }))}
                    className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
                  <input placeholder="CNPJ" value={novaFilial.cnpj}
                    onChange={e => setNovaFilial(f => ({ ...f, cnpj: e.target.value }))}
                    className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
                </div>
                <div className="flex items-center gap-3">
                  <input type="number" min={1} placeholder="Máx. usuários" value={novaFilial.max_usuarios}
                    onChange={e => setNovaFilial(f => ({ ...f, max_usuarios: Number(e.target.value) }))}
                    className="w-36 bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
                  <button onClick={criarFilial} disabled={criando}
                    className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-accent text-bg hover:bg-accent/90 disabled:opacity-60">
                    <Plus size={14} /> {criando ? 'Criando...' : 'Criar filial'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal de Novo Usuário ───────────────────────────────────────────────────

function ModalNovoUsuario({ empresas, onConfirm, onClose }: {
  empresas: Empresa[]
  onConfirm: () => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    tipo: 'admin',
    empresa_id: ''
  })
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      await api.post('/api/superhost/usuarios/cadastrar/', formData)
      onConfirm()
    } catch (error) {
      alert('Erro ao cadastrar usuário.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">Cadastrar Novo Usuário</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Nome Completo</label>
              <input required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})}
                className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">E-mail</label>
              <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Senha Inicial</label>
              <input type="password" required value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})}
                className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Nível de Acesso</label>
                <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}
                  className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
                  <option value="admin">SuperAdmin</option>
                  <option value="cliente">Cliente (Tenant)</option>
                </select>
              </div>

              {formData.tipo === 'cliente' && (
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Empresa Vinculada</label>
                  <select required value={formData.empresa_id} onChange={e => setFormData({...formData, empresa_id: e.target.value})}
                    className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
                    <option value="">Selecione...</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.nome}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4 mt-2 border-t border-border">
            <button type="button" onClick={onClose} className="flex-1 text-sm px-4 py-2 rounded-lg border border-border text-text-muted hover:text-text-primary">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-accent text-bg hover:bg-accent/90 disabled:opacity-60">
              <Save size={16} /> {salvando ? 'Salvando...' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SuperHost() {
  const navigate = useNavigate()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [blocking, setBlocking] = useState<number | null>(null)
  const [modalAcesso, setModalAcesso] = useState<Empresa | null>(null)
  const [modalPlano, setModalPlano] = useState<Empresa | null>(null)
  const [modalNovoUsuario, setModalNovoUsuario] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const { data } = await api.get('/api/superhost/clientes/')
      setEmpresas(data.clientes ?? data)
    } catch {
      setEmpresas([
        { id: 1, nome: 'Agropecuária Norte', cnpj: '12.345.678/0001-01', tipo_negocio: 'revenda', status_assinatura: 'ativa', total_usuarios: 8, criado_em: '2026-01-15' },
        { id: 2, nome: 'Indústria Cerealista Oeste', cnpj: '98.765.432/0001-02', tipo_negocio: 'industria', status_assinatura: 'ativa', total_usuarios: 22, criado_em: '2026-02-10' },
        { id: 3, nome: 'Distribuidora Campo Verde', cnpj: '55.444.333/0001-03', tipo_negocio: 'revenda', status_assinatura: 'bloqueada', total_usuarios: 4, criado_em: '2026-03-01' },
      ])
    } finally { setLoading(false) }
  }

  async function toggleBloquear(id: number, status: string) {
    setBlocking(id)
    const acao = status === 'ativa' ? 'bloquear' : 'desbloquear'
    try {
      await api.post(`/api/superhost/bloquear/${id}/`, { acao })
      fetchData()
    } catch { alert('Erro ao alterar status') }
    finally { setBlocking(null) }
  }

  async function confirmarAcesso(empresa: Empresa, justificativa: string) {
    try {
      await api.post(`/api/superhost/acessar/${empresa.id}/`, { justificativa })
    } catch { /* log best-effort */ }
    localStorage.setItem('superhost_empresa_id', String(empresa.id))
    localStorage.setItem('superhost_empresa_nome', empresa.nome)
    setModalAcesso(null)
    navigate('/')
  }

  const filtered = empresas.filter(e =>
    e.nome.toLowerCase().includes(search.toLowerCase()) || e.cnpj.includes(search)
  )

  const ativa     = empresas.filter(e => e.status_assinatura === 'ativa').length
  const bloqueada = empresas.filter(e => e.status_assinatura === 'bloqueada').length
  const industrias = empresas.filter(e => e.tipo_negocio === 'industria').length

  if (loading) return <div className="flex items-center justify-center h-64 text-text-muted">Carregando...</div>

  return (
    <div className="space-y-6">
      
      {/* Header atualizado com o botão de Novo Usuário */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Shield size={20} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Painel SuperHost</h1>
            <p className="text-sm text-text-muted">Gerenciamento de todos os tenants da plataforma</p>
          </div>
        </div>

        <button 
          onClick={() => setModalNovoUsuario(true)}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl bg-accent text-bg hover:bg-accent/90 transition-colors shadow-sm"
        >
          <UserPlus size={16} /> Novo Usuário
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted">Total de Tenants</p>
          <p className="text-2xl font-bold text-text-primary font-mono mt-1">{empresas.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted">Ativos / Bloqueados</p>
          <p className="text-2xl font-bold font-mono mt-1">
            <span className="text-accent">{ativa}</span>
            <span className="text-text-muted text-lg"> / </span>
            <span className="text-red-500">{bloqueada}</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted">Indústrias</p>
          <p className="text-2xl font-bold text-text-primary font-mono mt-1">{industrias}</p>
        </div>
      </div>

      {/* Search + table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou CNPJ..."
              className="bg-card2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm w-full text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Empresa', 'CNPJ', 'Tipo', 'Usuários', 'Criado em', 'Status', '', '', ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-text-muted">Nenhuma empresa encontrada</td></tr>
            ) : filtered.map(e => (
              <tr key={e.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                <td className="px-4 py-3 font-medium text-text-primary">{e.nome}</td>
                <td className="px-4 py-3 font-mono text-text-muted text-xs">{e.cnpj}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    e.tipo_negocio === 'industria' ? 'bg-blue-100 text-blue-700' : 'bg-accent/10 text-accent'
                  }`}>
                    {e.tipo_negocio === 'industria' ? 'Indústria' : 'Revenda'}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted text-center">{e.total_usuarios}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{e.criado_em}</td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1 text-xs font-medium ${
                    e.status_assinatura === 'ativa' ? 'text-accent' : 'text-red-500'
                  }`}>
                    {e.status_assinatura === 'ativa'
                      ? <><CheckCircle size={13} /> Ativa</>
                      : <><Ban size={13} /> Bloqueada</>
                    }
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleBloquear(e.id, e.status_assinatura)}
                    disabled={blocking === e.id}
                    className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-60 ${
                      e.status_assinatura === 'ativa'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                        : 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20'
                    }`}
                  >
                    {blocking === e.id ? '...' : e.status_assinatura === 'ativa' ? 'Bloquear' : 'Desbloquear'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setModalPlano(e)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-medium bg-card2 text-text-muted hover:text-text-primary border border-border transition-colors"
                  >
                    <Settings size={12} /> Plano
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setModalAcesso(e)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"
                  >
                    <LogIn size={12} /> Acessar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAcesso && (
        <ModalJustificativa
          empresa={modalAcesso}
          onConfirm={j => confirmarAcesso(modalAcesso, j)}
          onClose={() => setModalAcesso(null)}
        />
      )}

      {modalPlano && (
        <PainelPlano empresa={modalPlano} onClose={() => setModalPlano(null)} />
      )}

      {modalNovoUsuario && (
        <ModalNovoUsuario
          empresas={empresas}
          onConfirm={() => {
            setModalNovoUsuario(false)
            alert('Usuário cadastrado com sucesso!')
          }}
          onClose={() => setModalNovoUsuario(false)}
        />
      )}
    </div>
  )
}