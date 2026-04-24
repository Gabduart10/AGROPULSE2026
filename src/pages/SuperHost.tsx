import { useEffect, useState } from 'react'
import { Shield, Ban, CheckCircle, Search } from 'lucide-react'
import { api } from '../lib/api'

interface Empresa {
  id: number
  nome: string
  cnpj: string
  tipo_negocio: string
  status_assinatura: string
  total_usuarios: number
  criado_em: string
}

export default function SuperHost() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [blocking, setBlocking] = useState<number | null>(null)

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

  const filtered = empresas.filter(e =>
    e.nome.toLowerCase().includes(search.toLowerCase()) || e.cnpj.includes(search)
  )

  const ativa = empresas.filter(e => e.status_assinatura === 'ativa').length
  const bloqueada = empresas.filter(e => e.status_assinatura === 'bloqueada').length
  const industrias = empresas.filter(e => e.tipo_negocio === 'industria').length

  if (loading) return <div className="flex items-center justify-center h-64 text-text-muted">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <Shield size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Painel SuperHost</h1>
          <p className="text-sm text-text-muted">Gerenciamento de todos os tenants da plataforma</p>
        </div>
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
              {['Empresa', 'CNPJ', 'Tipo', 'Usuários', 'Criado em', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-text-muted">Nenhuma empresa encontrada</td></tr>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
