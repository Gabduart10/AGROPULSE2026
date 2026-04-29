import { useState } from 'react'
import { FileText, Sheet } from 'lucide-react'
import { api } from '../lib/api'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface ExportButtonsProps {
  endpoint: string
  params?: Record<string, string>
  filename?: string
  className?: string
  selectedIds?: number[]
}

export default function ExportButtons({ endpoint, params = {}, filename = 'exportacao', className = '', selectedIds }: ExportButtonsProps) {
  const [loading, setLoading] = useState<'pdf' | 'excel' | null>(null)

  const hasSelection = selectedIds && selectedIds.length > 0
  const count = selectedIds?.length ?? 0

  async function exportar(tipo: 'pdf' | 'excel') {
    setLoading(tipo)
    try {
      const merged: Record<string, string> = { ...params, exportar: tipo }
      if (hasSelection) merged.ids = selectedIds!.join(',')
      const qs = new URLSearchParams(merged).toString()
      const { data } = await api.get(`${endpoint}?${qs}`, { responseType: 'blob' })
      const ext = tipo === 'pdf' ? 'pdf' : 'xlsx'
      const url = URL.createObjectURL(new Blob([data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      const merged: Record<string, string> = { ...params, exportar: tipo }
      if (hasSelection) merged.ids = selectedIds!.join(',')
      window.open(`${BASE}${endpoint}?${new URLSearchParams(merged).toString()}`)
    } finally {
      setLoading(null)
    }
  }

  const badge = hasSelection
    ? <span className="ml-0.5 bg-current/20 rounded px-1 text-[10px] font-bold">{count}</span>
    : null

  return (
    <div className={`flex gap-1.5 ${className}`}>
      <button
        onClick={() => exportar('pdf')}
        disabled={!!loading}
        title={hasSelection ? `Exportar ${count} selecionado(s) em PDF` : 'Exportar tudo em PDF'}
        className="flex items-center gap-1.5 text-xs border border-border text-text-muted px-2.5 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-60"
      >
        <FileText size={13} />
        {loading === 'pdf' ? '...' : 'PDF'}{badge}
      </button>
      <button
        onClick={() => exportar('excel')}
        disabled={!!loading}
        title={hasSelection ? `Exportar ${count} selecionado(s) em Excel` : 'Exportar tudo em Excel'}
        className="flex items-center gap-1.5 text-xs border border-border text-text-muted px-2.5 py-1.5 rounded-lg hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-colors disabled:opacity-60"
      >
        <Sheet size={13} />
        {loading === 'excel' ? '...' : 'Excel'}{badge}
      </button>
    </div>
  )
}
