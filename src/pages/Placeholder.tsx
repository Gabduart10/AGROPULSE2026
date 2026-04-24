import { Construction } from 'lucide-react'

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-text-muted">
      <Construction size={40} className="text-accent/40" />
      <div className="text-center">
        <p className="font-semibold text-text-secondary">{title}</p>
        <p className="text-sm">Módulo em desenvolvimento</p>
      </div>
    </div>
  )
}
