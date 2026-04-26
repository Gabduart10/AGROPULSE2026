import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ShieldCheck } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [requires2fa, setRequires2fa] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const resultado = await login(email, password, requires2fa ? totpCode : undefined)
      if (resultado === 'requires_2fa') {
        setRequires2fa(true)
      } else {
        navigate('/')
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message
      setError(msg || (requires2fa ? 'Código 2FA inválido.' : 'E-mail ou senha inválidos.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <span className="text-bg font-bold text-lg">A</span>
          </div>
          <span className="text-2xl font-bold text-text-primary">AgroPulse</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          {!requires2fa ? (
            <>
              <h1 className="text-xl font-semibold text-text-primary mb-1">Entrar</h1>
              <p className="text-sm text-text-muted mb-6">Acesse sua conta para continuar</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">E-mail</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full bg-card2 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                    placeholder="seu@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Senha</label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    className="w-full bg-card2 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60">
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={18} className="text-accent" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-text-primary">Verificação em 2 etapas</h1>
                  <p className="text-xs text-text-muted">Abra seu aplicativo autenticador e insira o código</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Código de 6 dígitos</label>
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                    value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus required
                    className="w-full bg-card2 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent text-center tracking-widest text-lg font-mono"
                    placeholder="000000"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
                )}

                <button type="submit" disabled={loading || totpCode.length !== 6}
                  className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60">
                  {loading ? 'Verificando...' : 'Verificar'}
                </button>

                <button type="button" onClick={() => { setRequires2fa(false); setTotpCode(''); setError('') }}
                  className="w-full text-sm text-text-muted hover:text-text-primary transition-colors">
                  Voltar
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
