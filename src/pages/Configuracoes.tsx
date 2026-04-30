import { useEffect, useState } from 'react'
import { Settings, Calendar, Plus, Pencil, Trash2, X, Save, ShieldCheck, ShieldOff, Copy, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

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

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>
      {help && <p className="text-xs text-text-muted mb-2">{help}</p>}
      {children}
    </div>
  )
}

function NumInput({ value, onChange, min = 1 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <input
      type="number" min={min} value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent w-36"
    />
  )
}

// ─── tipos ────────────────────────────────────────────────────────────────────

interface ConfigComercial {
  prazo_recompra_padrao: number
  prazo_expiracao_pedido: number
  comissao_padrao: number
}

interface DataComemorativa {
  id: number
  nome: string
  dia: number
  mes: number
  dias_antecedencia: number
  para_todos_vendedores: boolean
  ativo: boolean
}

interface LogAuditoriaEntry {
  id: number
  usuario_nome: string
  acao: string
  acao_display: string
  modelo_afetado: string
  registro_id: number
  campo_alterado?: string
  valor_anterior?: string
  valor_novo?: string
  descricao?: string
  ip_address?: string
  data_hora: string
}

const AUDITORIA_ACOES = [
  { value: '', label: 'Todas as ações' },
  { value: 'alteracao_preco', label: 'Alteração de Preço' },
  { value: 'alteracao_estoque', label: 'Alteração de Estoque' },
  { value: 'aprovacao_pedido', label: 'Aprovação de Pedido' },
  { value: 'recusa_pedido', label: 'Recusa de Pedido' },
  { value: 'cancelamento_nfe', label: 'Cancelamento de NF-e' },
  { value: 'carta_correcao_nfe', label: 'Carta de Correção NF-e' },
]

const AUDITORIA_MODELOS = [
  { value: '', label: 'Todos os modelos' },
  { value: 'PedidoVenda', label: 'Pedido de Venda' },
  { value: 'Produto', label: 'Produto' },
  { value: 'NotaFiscal', label: 'Nota Fiscal' },
  { value: 'ContaPagar', label: 'Conta a Pagar' },
  { value: 'ContaReceber', label: 'Conta a Receber' },
]

const MOCK_LOGS: LogAuditoriaEntry[] = [
  {
    id: 1,
    usuario_nome: 'Ana Silva',
    acao: 'alteracao_preco',
    acao_display: 'Alteração de Preço',
    modelo_afetado: 'Produto',
    registro_id: 1122,
    campo_alterado: 'preco_venda',
    valor_anterior: 'R$ 28,90',
    valor_novo: 'R$ 31,50',
    descricao: 'Atualização de preço para oferta de safra',
    ip_address: '192.168.0.15',
    data_hora: '2026-04-24T10:22:00Z',
  },
  {
    id: 2,
    usuario_nome: 'Bruno Lima',
    acao: 'aprovacao_pedido',
    acao_display: 'Aprovação de Pedido',
    modelo_afetado: 'PedidoVenda',
    registro_id: 4578,
    campo_alterado: '',
    valor_anterior: '',
    valor_novo: '',
    descricao: 'Pedido aprovado após revisão de crédito',
    ip_address: '192.168.0.22',
    data_hora: '2026-04-23T15:05:00Z',
  },
  {
    id: 3,
    usuario_nome: 'Carla Souza',
    acao: 'alteracao_estoque',
    acao_display: 'Alteração de Estoque',
    modelo_afetado: 'Produto',
    registro_id: 3301,
    campo_alterado: 'quantidade',
    valor_anterior: '120',
    valor_novo: '96',
    descricao: 'Baixa por expedição',
    ip_address: '192.168.0.18',
    data_hora: '2026-04-22T09:40:00Z',
  },
  {
    id: 4,
    usuario_nome: 'Sistema',
    acao: 'cancelamento_nfe',
    acao_display: 'Cancelamento de NF-e',
    modelo_afetado: 'NotaFiscal',
    registro_id: 7788,
    campo_alterado: '',
    valor_anterior: '',
    valor_novo: '',
    descricao: 'Nota cancelada por erro de chave',
    ip_address: '10.0.0.5',
    data_hora: '2026-04-21T11:55:00Z',
  },
  {
    id: 5,
    usuario_nome: 'Daniel Costa',
    acao: 'carta_correcao_nfe',
    acao_display: 'Carta de Correção NF-e',
    modelo_afetado: 'NotaFiscal',
    registro_id: 7788,
    campo_alterado: 'descricao',
    valor_anterior: 'Entrega em dois dias',
    valor_novo: 'Entrega em três dias',
    descricao: 'Correção de prazo de entrega no documento fiscal',
    ip_address: '192.168.0.33',
    data_hora: '2026-04-20T08:30:00Z',
  },
]

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// ─── aba Empresa ──────────────────────────────────────────────────────────────

function AbaEmpresa() {
  const { user } = useAuth()
  const isDiretor = user?.nivel === 'diretor'
  const [config, setConfig] = useState<ConfigComercial>({ prazo_recompra_padrao: 25, prazo_expiracao_pedido: 2, comissao_padrao: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    api.get('/api/comercial/configuracoes/')
      .then(r => setConfig(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function salvar() {
    setSaving(true)
    try {
      const { data } = await api.patch('/api/comercial/configuracoes/', config)
      setConfig(data)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 3000)
    } catch {
      alert('Erro ao salvar configurações.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-text-muted">Carregando...</p>

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h3 className="text-sm font-semibold text-text-primary">Prazos Comerciais</h3>

        <Field
          label="Prazo de recompra padrão (dias)"
          help="Clientes sem comprar há mais que este prazo serão alertados. Pode ser sobrescrito individualmente no cadastro do cliente."
        >
          <NumInput value={config.prazo_recompra_padrao} onChange={v => setConfig(c => ({ ...c, prazo_recompra_padrao: v }))} />
        </Field>

        <Field
          label="Prazo de expiração de pedidos (dias)"
          help="Pedidos aguardando aprovação expiram automaticamente após este prazo."
        >
          <NumInput value={config.prazo_expiracao_pedido} onChange={v => setConfig(c => ({ ...c, prazo_expiracao_pedido: v }))} />
        </Field>

        <Field
          label="Comissão padrão (%)"
          help="Percentual padrão usado ao cadastrar novos produtos sem comissão específica."
        >
          <NumInput value={config.comissao_padrao} onChange={v => setConfig(c => ({ ...c, comissao_padrao: v }))} />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={salvar} disabled={saving || !isDiretor}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
        >
          <Save size={15} /> {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
        {salvo && <span className="text-sm text-accent">Salvo com sucesso!</span>}
      </div>
      {!isDiretor && (
        <p className="text-sm text-amber-300 mt-2">Somente o Diretor pode alterar esses parâmetros.</p>
      )}
    </div>
  )
}

// ─── aba Datas Comemorativas ──────────────────────────────────────────────────

const FORM_VAZIO = { nome: '', dia: 1, mes: 1, dias_antecedencia: 3, para_todos_vendedores: true }

function AbaDatas() {
  const [datas, setDatas] = useState<DataComemorativa[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | typeof FORM_VAZIO & { id?: number }>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try {
      const { data } = await api.get('/api/comercial/datas-comemorativas/')
      setDatas(data)
    } catch {
      setDatas([])
    } finally {
      setLoading(false)
    }
  }

  function abrirNovo() {
    setModal({ ...FORM_VAZIO })
  }

  function abrirEditar(d: DataComemorativa) {
    setModal({ id: d.id, nome: d.nome, dia: d.dia, mes: d.mes, dias_antecedencia: d.dias_antecedencia, para_todos_vendedores: d.para_todos_vendedores })
  }

  async function salvar() {
    if (!modal) return
    if (!modal.nome.trim()) { alert('Informe o nome.'); return }
    setSaving(true)
    try {
      if (modal.id) {
        await api.patch(`/api/comercial/datas-comemorativas/${modal.id}/`, modal)
      } else {
        await api.post('/api/comercial/datas-comemorativas/', modal)
      }
      setModal(null)
      carregar()
    } catch {
      alert('Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function remover(id: number) {
    if (!confirm('Remover esta data comemorativa?')) return
    try {
      await api.delete(`/api/comercial/datas-comemorativas/${id}/`)
      carregar()
    } catch {
      alert('Erro ao remover.')
    }
  }

  if (loading) return <p className="text-sm text-text-muted">Carregando...</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={abrirNovo}
          className="flex items-center gap-2 bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          <Plus size={16} /> Nova data
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {datas.length === 0 ? (
          <p className="text-center py-10 text-sm text-text-muted">Nenhuma data comemorativa cadastrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Data', 'Nome', 'Antecedência', 'Alvo', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datas.map(d => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">
                    {String(d.dia).padStart(2, '0')}/{String(d.mes).padStart(2, '0')}
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">{d.nome}</td>
                  <td className="px-4 py-3 text-text-muted">{d.dias_antecedencia} dia(s) antes</td>
                  <td className="px-4 py-3 text-text-muted">
                    {d.para_todos_vendedores ? 'Todos os vendedores' : 'Vendedores específicos'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.ativo ? 'bg-accent/20 text-accent' : 'bg-white/10 text-text-muted'}`}>
                      {d.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => abrirEditar(d)}
                        className="p-1.5 rounded hover:bg-card2 text-text-muted hover:text-accent transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => remover(d.id)}
                        className="p-1.5 rounded hover:bg-card2 text-text-muted hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-text-primary">{modal.id ? 'Editar' : 'Nova'} data comemorativa</h2>
              <button onClick={() => setModal(null)} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Field label="Nome">
                <input value={modal.nome} onChange={e => setModal(m => m ? { ...m, nome: e.target.value } : m)}
                  placeholder="Ex: Dia do Agricultor"
                  className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Dia">
                  <input type="number" min={1} max={31} value={modal.dia}
                    onChange={e => setModal(m => m ? { ...m, dia: Number(e.target.value) } : m)}
                    className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </Field>
                <Field label="Mês">
                  <select value={modal.mes} onChange={e => setModal(m => m ? { ...m, mes: Number(e.target.value) } : m)}
                    className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
                    {MESES.map((nome, i) => (
                      <option key={i + 1} value={i + 1}>{nome}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Avisar com quantos dias de antecedência">
                <NumInput value={modal.dias_antecedencia} onChange={v => setModal(m => m ? { ...m, dias_antecedencia: v } : m)} />
              </Field>
              <Field label="Notificar">
                <div className="flex gap-3">
                  {[
                    { label: 'Todos os vendedores', value: true },
                    { label: 'Vendedores específicos', value: false },
                  ].map(opt => (
                    <button key={String(opt.value)}
                      onClick={() => setModal(m => m ? { ...m, para_todos_vendedores: opt.value } : m)}
                      className={`flex-1 text-sm px-3 py-2 rounded-lg border transition-colors ${
                        modal.para_todos_vendedores === opt.value
                          ? 'bg-accent/20 border-accent text-accent font-medium'
                          : 'bg-card2 border-border text-text-muted hover:border-accent/50'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setModal(null)}
                className="flex-1 text-sm px-4 py-2 rounded-lg border border-border text-text-muted hover:text-text-primary transition-colors">
                Cancelar
              </button>
              <button onClick={salvar} disabled={saving}
                className="flex-1 text-sm font-semibold px-4 py-2 rounded-lg bg-accent text-bg hover:bg-accent/90 transition-colors disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── página principal ─────────────────────────────────────────────────────────

function AbaAuditoria() {
  const [logs, setLogs] = useState<LogAuditoriaEntry[]>([])
  const [acaoFiltro, setAcaoFiltro] = useState('')
  const [modeloFiltro, setModeloFiltro] = useState('')
  const [dataInicio, setDataInicio] = useState('2026-04-20')
  const [dataFim, setDataFim] = useState('2026-04-25')

  const filtrosAtivos = logs.filter((log) => {
    const acaoOk = !acaoFiltro || log.acao === acaoFiltro
    const modeloOk = !modeloFiltro || log.modelo_afetado === modeloFiltro
    const data = new Date(log.data_hora).toISOString().slice(0, 10)
    const inicioOk = !dataInicio || data >= dataInicio
    const fimOk = !dataFim || data <= dataFim
    return acaoOk && modeloOk && inicioOk && fimOk
  })

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Logs de Auditoria</h3>
          <p className="text-sm text-text-muted">
            Mostrando registros fictícios para visualização. Use os filtros abaixo para testar a pesquisa.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase mb-2 block">Ação</label>
            <select value={acaoFiltro} onChange={(e) => setAcaoFiltro(e.target.value)}
              className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
              {AUDITORIA_ACOES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-muted uppercase mb-2 block">Modelo</label>
            <select value={modeloFiltro} onChange={(e) => setModeloFiltro(e.target.value)}
              className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
              {AUDITORIA_MODELOS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase mb-2 block">Data início</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase mb-2 block">Data fim</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
          </div>
        </div>

        <div className="text-sm text-text-muted">
          {filtrosAtivos.length} registro(s) encontrados.
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        {filtrosAtivos.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum registro corresponde aos filtros selecionados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-card2 text-text-muted uppercase text-xs tracking-wider">
                  {['Data/Hora', 'Usuário', 'Ação', 'Modelo', 'Registro', 'Campo', 'Valor anterior', 'Valor novo', 'IP'].map((col) => (
                    <th key={col} className="px-3 py-3 text-left">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrosAtivos.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-card2 transition-colors">
                    <td className="px-3 py-3 text-text-muted">{new Date(log.data_hora).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-3">{log.usuario_nome || 'Sistema'}</td>
                    <td className="px-3 py-3">{log.acao_display}</td>
                    <td className="px-3 py-3">{log.modelo_afetado}</td>
                    <td className="px-3 py-3">{log.registro_id}</td>
                    <td className="px-3 py-3">{log.campo_alterado || '-'}</td>
                    <td className="px-3 py-3">{log.valor_anterior || '-'}</td>
                    <td className="px-3 py-3">{log.valor_novo || '-'}</td>
                    <td className="px-3 py-3">{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── aba 2FA ──────────────────────────────────────────────────────────────────

function Aba2FA() {
  const [ativo, setAtivo] = useState<boolean | null>(null)
  const [etapa, setEtapa] = useState<'idle' | 'setup' | 'confirmar' | 'desabilitar'>('idle')
  const [uri, setUri] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    api.get('/api/auth/2fa/status/').then(r => setAtivo(r.data.totp_habilitado)).catch(() => setAtivo(false))
  }, [])

  async function iniciarSetup() {
    try {
      const { data } = await api.post('/api/auth/2fa/habilitar/')
      setUri(data.uri)
      setSecret(data.secret)
      setEtapa('setup')
      setErro('')
    } catch { setErro('Erro ao iniciar configuração.') }
  }

  async function confirmar() {
    setErro('')
    try {
      await api.post('/api/auth/2fa/confirmar/', { code })
      setAtivo(true)
      setEtapa('idle')
      setCode('')
    } catch { setErro('Código inválido. Tente novamente.') }
  }

  async function desabilitar() {
    setErro('')
    try {
      await api.post('/api/auth/2fa/desabilitar/', { code })
      setAtivo(false)
      setEtapa('idle')
      setCode('')
    } catch { setErro('Código inválido.') }
  }

  function copiarSecret() {
    navigator.clipboard.writeText(secret)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (ativo === null) return <p className="text-sm text-text-muted">Carregando...</p>

  return (
    <div className="max-w-lg space-y-4">
      <div className={`bg-card border rounded-xl p-5 flex items-start gap-4 ${ativo ? 'border-accent/40' : 'border-border'}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ativo ? 'bg-accent/10' : 'bg-white/5'}`}>
          {ativo ? <ShieldCheck size={20} className="text-accent" /> : <ShieldOff size={20} className="text-text-muted" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-text-primary">
            {ativo ? 'Autenticação de dois fatores ativa' : 'Autenticação de dois fatores inativa'}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {ativo
              ? 'Sua conta está protegida com TOTP. Um código será exigido a cada login.'
              : 'Recomendado para contas com acesso administrativo.'}
          </p>
        </div>
        {ativo
          ? <button onClick={() => { setEtapa('desabilitar'); setCode(''); setErro('') }}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-400/40 text-red-400 hover:bg-red-900/20 transition-colors whitespace-nowrap">
              Desativar
            </button>
          : <button onClick={iniciarSetup}
              className="text-xs px-3 py-1.5 rounded-lg bg-accent text-bg font-semibold hover:bg-accent/90 transition-colors whitespace-nowrap">
              Ativar 2FA
            </button>
        }
      </div>

      {etapa === 'setup' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-text-primary">Configurar autenticador</p>
          <ol className="text-xs text-text-muted space-y-1 list-decimal list-inside">
            <li>Abra o Google Authenticator ou similar</li>
            <li>Escaneie o QR Code ou insira a chave manual abaixo</li>
            <li>Digite o código gerado para confirmar</li>
          </ol>

          {/* QR Code via API pública de imagem */}
          <div className="flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(uri)}`}
              alt="QR Code 2FA"
              className="rounded-lg border border-border"
              width={180} height={180}
            />
          </div>

          <div className="flex items-center gap-2 bg-card2 rounded-lg px-3 py-2">
            <code className="flex-1 text-xs font-mono text-text-primary break-all">{secret}</code>
            <button onClick={copiarSecret} className="text-text-muted hover:text-accent transition-colors flex-shrink-0">
              {copiado ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Código do autenticador</label>
            <input
              type="text" inputMode="numeric" maxLength={6} value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono tracking-widest text-center focus:outline-none focus:border-accent"
            />
          </div>

          {erro && <p className="text-xs text-red-400">{erro}</p>}

          <div className="flex gap-3">
            <button onClick={() => { setEtapa('idle'); setErro('') }}
              className="flex-1 text-sm px-4 py-2 rounded-lg border border-border text-text-muted hover:text-text-primary">
              Cancelar
            </button>
            <button onClick={confirmar} disabled={code.length !== 6}
              className="flex-1 text-sm font-semibold px-4 py-2 rounded-lg bg-accent text-bg hover:bg-accent/90 disabled:opacity-60">
              Confirmar
            </button>
          </div>
        </div>
      )}

      {etapa === 'desabilitar' && (
        <div className="bg-card border border-red-900/40 rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-text-primary">Desativar 2FA</p>
          <p className="text-xs text-text-muted">Insira o código atual do autenticador para confirmar.</p>
          <input
            type="text" inputMode="numeric" maxLength={6} value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000" autoFocus
            className="w-full bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono tracking-widest text-center focus:outline-none focus:border-accent"
          />
          {erro && <p className="text-xs text-red-400">{erro}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setEtapa('idle'); setErro('') }}
              className="flex-1 text-sm px-4 py-2 rounded-lg border border-border text-text-muted hover:text-text-primary">
              Cancelar
            </button>
            <button onClick={desabilitar} disabled={code.length !== 6}
              className="flex-1 text-sm font-semibold px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
              Desativar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Configuracoes() {
  const { user } = useAuth()
  const [tab, setTab] = useState('Empresa')

  const nivel = user?.nivel
  const tabs = ['Empresa', 'Datas Comemorativas', 'Segurança (2FA)']
  const podeVerAuditoria = nivel === 'diretor' || nivel === 'gerente'

  if (podeVerAuditoria) {
    tabs.push('Auditoria')
  }

  if (user && !['diretor', 'gerente'].includes(user.nivel)) {
    return (
      <div className="rounded-xl bg-card border border-border p-6">
        <h1 className="text-xl font-bold text-text-primary">Acesso negado</h1>
        <p className="text-sm text-text-muted mt-2">
          Esta área é visível apenas para Diretor e Gerente.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Settings size={20} className="text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Configurações</h1>
          <p className="text-sm text-text-muted">Parâmetros gerais do sistema</p>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'Empresa'             && <AbaEmpresa />}
      {tab === 'Datas Comemorativas' && <AbaDatas />}
      {tab === 'Segurança (2FA)'     && <Aba2FA />}
      {tab === 'Auditoria'           && <AbaAuditoria />}
    </div>
  )
}
