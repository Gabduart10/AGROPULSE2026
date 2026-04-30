import { useState } from 'react'
import {
  Plus, Search, X, ChevronDown, MapPin, Phone, Mail,
  CheckCircle2, Clock, AlertCircle, Eye, BarChart2,
  TrendingUp, Users, Calendar, Star, MessageSquare,
  Camera, Wifi, WifiOff, Target, Award, FileText,
} from 'lucide-react'
import ExportButtons from '../components/ExportButtons'
import { api } from '../lib/api'

// ─── Shared UI ────────────────────────────────────────────────────────────────

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

function KpiCard({ label, val, sub, warn, ok, neutral }: { label: string; val: string | number; sub?: string; warn?: boolean; ok?: boolean; neutral?: boolean }) {
  return (
    <div className={`border rounded-xl px-4 py-3 ${warn ? 'bg-yellow-900/10 border-yellow-800/40' : ok ? 'bg-emerald-900/10 border-emerald-800/40' : 'bg-card2 border-border'}`}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-xl font-bold font-mono mt-1 ${warn ? 'text-amber-300' : ok ? 'text-emerald-400' : 'text-text-primary'}`}>{val}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function Table({ heads, children, selHead }: { heads: string[]; children: React.ReactNode; selHead?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {selHead !== undefined && <th className="w-10 px-3 py-3">{selHead}</th>}
            {heads.map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>)}
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Tr({ children, selected }: { children: React.ReactNode; selected?: boolean }) {
  return <tr className={`border-b border-border/50 hover:bg-card2 transition-colors ${selected ? 'bg-accent/5' : ''}`}>{children}</tr>
}
function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-4 py-3 ${mono ? 'font-mono text-text-secondary' : 'text-text-muted'}`}>{children ?? '—'}</td>
}
function TdMain({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-text-primary font-medium">{children}</td>
}
function TdSel({ id, sel, toggle }: { id: number; sel: Set<number>; toggle: (id: number) => void }) {
  return (
    <td className="px-3 py-3">
      <input type="checkbox" checked={sel.has(id)} onChange={() => toggle(id)}
        className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />
    </td>
  )
}
function Empty({ label }: { label: string }) {
  return <tr><td colSpan={20} className="px-4 py-10 text-center text-text-muted text-sm">{label}</td></tr>
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto ${wide ? 'w-full max-w-3xl' : 'w-full max-w-xl'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-text-muted font-medium">{label}</label>
      {children}
    </div>
  )
}

function Inp({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
  )
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent pr-8">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
    </div>
  )
}

function Footer({ onClose, onSave, saving }: { onClose: () => void; onSave: () => void; saving?: boolean }) {
  return (
    <div className="flex justify-end gap-3 pt-2 border-t border-border mt-2">
      <button onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary border border-border rounded-lg transition-colors">Cancelar</button>
      <button onClick={onSave} disabled={saving} className="px-5 py-2 text-sm font-semibold bg-accent text-bg rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50">
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  const map: Record<string, string> = {
    green: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    red: 'bg-red-900/30 text-red-400 border-red-800/40',
    yellow: 'bg-amber-950/50 text-amber-200 border-amber-800/50',
    blue: 'bg-blue-900/30 text-blue-400 border-blue-800/40',
    purple: 'bg-purple-900/30 text-purple-400 border-purple-800/40',
    gray: 'bg-gray-800/50 text-text-muted border-border',
    orange: 'bg-orange-900/30 text-orange-400 border-orange-800/40',
  }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${map[color] ?? map.gray}`}>{label}</span>
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Produtor {
  id: number; nome: string; cpf_cnpj: string; municipio: string; uf: string
  area_total_ha: number; culturas: string[]; telefone: string; email: string
  consultor: string; status: 'ativo' | 'inativo' | 'prospecto'
  ultima_compra: string; total_compras: number; limite_credito: number
  score_credito: number; safras_ativas: number
}

interface Visita {
  id: number; produtor: string; consultor: string; data: string
  duracao_min: number; tipo: 'tecnica' | 'comercial' | 'cobranca' | 'pos_venda'
  status: 'agendada' | 'realizada' | 'cancelada'
  lat?: number; lng?: number; municipio: string
  recomendacao?: string; fotos: number; observacoes: string
}

interface Oportunidade {
  id: number; produtor: string; consultor: string
  produto: string; cultura: string; safra: string
  valor_estimado: number; etapa: 'prospeccao' | 'qualificacao' | 'proposta' | 'negociacao' | 'fechado_ganho' | 'fechado_perdido'
  probabilidade: number; data_prevista: string; observacoes: string
}

interface Credito {
  id: number; produtor: string; cpf_cnpj: string
  score: number; limite_sugerido: number; limite_aprovado: number
  adimplencia_pct: number; parcelas_atraso: number
  ultima_analise: string; status: 'aprovado' | 'pendente' | 'suspenso' | 'recusado'
  historico_compras: number; observacoes: string
}

interface Amostra {
  id: number; produtor: string; consultor: string
  produto: string; quantidade: number; unidade: string
  data_entrega: string; data_retorno?: string
  status: 'entregue' | 'em_avaliacao' | 'convertida' | 'nao_convertida' | 'aguardando_retorno'
  cultura: string; resultado?: string; pedido_gerado?: string
}

interface Campanha {
  id: number; nome: string; tipo: 'email' | 'whatsapp' | 'ambos'
  segmento: string; status: 'rascunho' | 'ativa' | 'pausada' | 'concluida'
  envios: number; aberturas: number; respostas: number; conversoes: number
  data_inicio: string; data_fim?: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_PRODUTORES: Produtor[] = [
  { id: 1, nome: 'João Carlos Mendonça', cpf_cnpj: '123.456.789-00', municipio: 'Sorriso', uf: 'MT', area_total_ha: 1200, culturas: ['Soja', 'Milho'], telefone: '(66) 99999-1111', email: 'joao@fazenda.com.br', consultor: 'Carlos Souza', status: 'ativo', ultima_compra: '2026-03-15', total_compras: 485000, limite_credito: 200000, score_credito: 820, safras_ativas: 2 },
  { id: 2, nome: 'Fazenda São Lucas Ltda', cpf_cnpj: '12.345.678/0001-90', municipio: 'Lucas do Rio Verde', uf: 'MT', area_total_ha: 3500, culturas: ['Soja', 'Algodão', 'Milho'], telefone: '(65) 98888-2222', email: 'gerencia@saolucas.agr.br', consultor: 'Ana Lima', status: 'ativo', ultima_compra: '2026-04-01', total_compras: 1250000, limite_credito: 500000, score_credito: 950, safras_ativas: 3 },
  { id: 3, nome: 'Pedro Alves Neto', cpf_cnpj: '987.654.321-00', municipio: 'Primavera do Leste', uf: 'MT', area_total_ha: 450, culturas: ['Soja'], telefone: '(66) 97777-3333', email: 'pedro@ruralnet.com', consultor: 'Carlos Souza', status: 'ativo', ultima_compra: '2026-02-10', total_compras: 198000, limite_credito: 80000, score_credito: 710, safras_ativas: 1 },
  { id: 4, nome: 'Agropecuária Cerrado', cpf_cnpj: '98.765.432/0001-10', municipio: 'Rondonópolis', uf: 'MT', area_total_ha: 2100, culturas: ['Milho', 'Soja', 'Feijão'], telefone: '(65) 96666-4444', email: 'compras@cerrado.agr.br', consultor: 'Ana Lima', status: 'prospecto', ultima_compra: '—', total_compras: 0, limite_credito: 0, score_credito: 680, safras_ativas: 0 },
  { id: 5, nome: 'Maria Lúcia Ferreira', cpf_cnpj: '555.444.333-22', municipio: 'Campo Verde', uf: 'MT', area_total_ha: 180, culturas: ['Soja', 'Sorghum'], telefone: '(66) 95555-5555', email: 'maria@protonmail.com', consultor: 'Carlos Souza', status: 'inativo', ultima_compra: '2025-09-20', total_compras: 45000, limite_credito: 20000, score_credito: 590, safras_ativas: 0 },
]

const MOCK_VISITAS: Visita[] = [
  { id: 1, produtor: 'Fazenda São Lucas Ltda', consultor: 'Ana Lima', data: '2026-04-18', duracao_min: 120, tipo: 'tecnica', status: 'realizada', lat: -13.05, lng: -55.92, municipio: 'Lucas do Rio Verde', recomendacao: 'Aplicar fungicida preventivo na soja — pressão de ferrugem asiática detectada no talhão 3.', fotos: 4, observacoes: 'Produtor interessado em ampliar área de algodão para 2026/27.' },
  { id: 2, produtor: 'João Carlos Mendonça', consultor: 'Carlos Souza', data: '2026-04-20', duracao_min: 90, tipo: 'comercial', status: 'agendada', municipio: 'Sorriso', fotos: 0, observacoes: 'Apresentar proposta de pacote insumos safra 2026/27.' },
  { id: 3, produtor: 'Pedro Alves Neto', consultor: 'Carlos Souza', data: '2026-04-15', duracao_min: 60, tipo: 'tecnica', status: 'realizada', lat: -15.55, lng: -54.28, municipio: 'Primavera do Leste', recomendacao: 'Calagem necessária — análise de solo indicou pH 5,2. Recomendar 2t/ha de calcário.', fotos: 2, observacoes: 'Coleta de solo enviada ao laboratório.' },
  { id: 4, produtor: 'Agropecuária Cerrado', consultor: 'Ana Lima', data: '2026-04-22', duracao_min: 0, tipo: 'comercial', status: 'agendada', municipio: 'Rondonópolis', fotos: 0, observacoes: 'Primeira visita — prospect. Levar portfólio completo.' },
  { id: 5, produtor: 'Maria Lúcia Ferreira', consultor: 'Carlos Souza', data: '2026-03-28', duracao_min: 45, tipo: 'pos_venda', status: 'realizada', lat: -15.54, lng: -55.16, municipio: 'Campo Verde', fotos: 1, observacoes: 'Produtora insatisfeita com atraso na entrega. Registrar ocorrência com logística.' },
  { id: 6, produtor: 'João Carlos Mendonça', consultor: 'Carlos Souza', data: '2026-04-10', duracao_min: 75, tipo: 'tecnica', status: 'realizada', lat: -12.54, lng: -55.72, municipio: 'Sorriso', recomendacao: 'Adensamento de plantio no talhão 7 para maximizar produtividade.', fotos: 3, observacoes: 'Produtor aberto a testar novo herbicida pré-emergente.' },
]

const MOCK_OPORTUNIDADES: Oportunidade[] = [
  { id: 1, produtor: 'Fazenda São Lucas Ltda', consultor: 'Ana Lima', produto: 'Fungicida Priori Xtra', cultura: 'Soja', safra: '2026/27', valor_estimado: 85000, etapa: 'negociacao', probabilidade: 75, data_prevista: '2026-05-15', observacoes: 'Aguardando aprovação do gerente de compras.' },
  { id: 2, produtor: 'João Carlos Mendonça', consultor: 'Carlos Souza', produto: 'Pacote Insumos Milho', cultura: 'Milho', safra: '2026/27', valor_estimado: 42000, etapa: 'proposta', probabilidade: 60, data_prevista: '2026-04-30', observacoes: 'Concorrendo com distribuidora local.' },
  { id: 3, produtor: 'Agropecuária Cerrado', consultor: 'Ana Lima', produto: 'Herbicida + Adjuvante', cultura: 'Soja', safra: '2026/27', valor_estimado: 120000, etapa: 'qualificacao', probabilidade: 40, data_prevista: '2026-06-01', observacoes: 'Prospect — visita comercial agendada para 22/04.' },
  { id: 4, produtor: 'Pedro Alves Neto', consultor: 'Carlos Souza', produto: 'Calcário + Gesso Agrícola', cultura: 'Soja', safra: '2026/27', valor_estimado: 28000, etapa: 'fechado_ganho', probabilidade: 100, data_prevista: '2026-04-18', observacoes: 'Pedido gerado: #2847.' },
  { id: 5, produtor: 'Maria Lúcia Ferreira', consultor: 'Carlos Souza', produto: 'Semente Soja Intacta RR2', cultura: 'Soja', safra: '2026/27', valor_estimado: 18000, etapa: 'fechado_perdido', probabilidade: 0, data_prevista: '2026-04-05', observacoes: 'Produtora optou por concorrente. Motivo: preço.' },
  { id: 6, produtor: 'Fazenda São Lucas Ltda', consultor: 'Ana Lima', produto: 'Regulador de Crescimento', cultura: 'Algodão', safra: '2026/27', valor_estimado: 67000, etapa: 'prospeccao', probabilidade: 25, data_prevista: '2026-07-01', observacoes: 'Primeiro contato após visita técnica.' },
]

const MOCK_CREDITO: Credito[] = [
  { id: 1, produtor: 'Fazenda São Lucas Ltda', cpf_cnpj: '12.345.678/0001-90', score: 950, limite_sugerido: 600000, limite_aprovado: 500000, adimplencia_pct: 100, parcelas_atraso: 0, ultima_analise: '2026-02-01', status: 'aprovado', historico_compras: 1250000, observacoes: 'Excelente histórico. Sem pendências.' },
  { id: 2, produtor: 'João Carlos Mendonça', cpf_cnpj: '123.456.789-00', score: 820, limite_sugerido: 220000, limite_aprovado: 200000, adimplencia_pct: 98, parcelas_atraso: 0, ultima_analise: '2026-01-15', status: 'aprovado', historico_compras: 485000, observacoes: '2 atrasos no último ano. Regularizados.' },
  { id: 3, produtor: 'Pedro Alves Neto', cpf_cnpj: '987.654.321-00', score: 710, limite_sugerido: 90000, limite_aprovado: 80000, adimplencia_pct: 94, parcelas_atraso: 1, ultima_analise: '2026-03-10', status: 'aprovado', historico_compras: 198000, observacoes: '1 parcela em atraso (15 dias). Contato feito.' },
  { id: 4, produtor: 'Agropecuária Cerrado', cpf_cnpj: '98.765.432/0001-10', score: 680, limite_sugerido: 0, limite_aprovado: 0, adimplencia_pct: 0, parcelas_atraso: 0, ultima_analise: '—', status: 'pendente', historico_compras: 0, observacoes: 'Prospect — análise não iniciada.' },
  { id: 5, produtor: 'Maria Lúcia Ferreira', cpf_cnpj: '555.444.333-22', score: 590, limite_sugerido: 15000, limite_aprovado: 0, adimplencia_pct: 85, parcelas_atraso: 3, ultima_analise: '2025-10-01', status: 'suspenso', historico_compras: 45000, observacoes: '3 parcelas em atraso. Limite suspenso até regularização.' },
]

const MOCK_AMOSTRAS: Amostra[] = [
  { id: 1, produtor: 'Fazenda São Lucas Ltda', consultor: 'Ana Lima', produto: 'Fungicida Helix Xtra', quantidade: 5, unidade: 'L', data_entrega: '2026-03-20', status: 'convertida', cultura: 'Soja', resultado: 'Aprovado pelo agrônomo da fazenda.', pedido_gerado: '#2815' },
  { id: 2, produtor: 'João Carlos Mendonça', consultor: 'Carlos Souza', produto: 'Semente Milho DKB390', quantidade: 2, unidade: 'sc', data_entrega: '2026-04-05', status: 'em_avaliacao', cultura: 'Milho', data_retorno: '2026-05-20' },
  { id: 3, produtor: 'Pedro Alves Neto', consultor: 'Carlos Souza', produto: 'Inoculante Soja Nitrobacter', quantidade: 10, unidade: 'doses', data_entrega: '2026-03-10', data_retorno: '2026-04-10', status: 'aguardando_retorno', cultura: 'Soja' },
  { id: 4, produtor: 'Agropecuária Cerrado', consultor: 'Ana Lima', produto: 'Herbicida Gamit 500', quantidade: 3, unidade: 'L', data_entrega: '2026-04-22', status: 'entregue', cultura: 'Milho' },
  { id: 5, produtor: 'Maria Lúcia Ferreira', consultor: 'Carlos Souza', produto: 'Adjuvante Nimbus', quantidade: 2, unidade: 'L', data_entrega: '2026-02-15', data_retorno: '2026-03-15', status: 'nao_convertida', cultura: 'Soja', resultado: 'Preferiu produto concorrente por custo.' },
]

const MOCK_CAMPANHAS: Campanha[] = [
  { id: 1, nome: 'Safra 2026/27 — Abertura Soja MT', tipo: 'whatsapp', segmento: 'Produtores de Soja · MT · >500ha', status: 'ativa', envios: 87, aberturas: 71, respostas: 38, conversoes: 12, data_inicio: '2026-04-01' },
  { id: 2, nome: 'Reativação de Inativos Q1', tipo: 'email', segmento: 'Clientes sem compra nos últimos 6 meses', status: 'concluida', envios: 34, aberturas: 18, respostas: 7, conversoes: 3, data_inicio: '2026-03-01', data_fim: '2026-03-31' },
  { id: 3, nome: 'Fungicida Anti-Ferrugem — Alerta', tipo: 'ambos', segmento: 'Produtores de Soja · Safra em R3-R5', status: 'ativa', envios: 120, aberturas: 102, respostas: 61, conversoes: 28, data_inicio: '2026-04-10' },
  { id: 4, nome: 'Onboarding Novos Prospects', tipo: 'email', segmento: 'Status: prospecto · sem compra', status: 'rascunho', envios: 0, aberturas: 0, respostas: 0, conversoes: 0, data_inicio: '—' },
  { id: 5, nome: 'Aniversário do Produtor', tipo: 'whatsapp', segmento: 'Todos os clientes ativos', status: 'ativa', envios: 12, aberturas: 12, respostas: 9, conversoes: 2, data_inicio: '2026-01-01' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function scoreColor(s: number) {
  if (s >= 850) return 'text-emerald-400'
  if (s >= 700) return 'text-amber-300'
  return 'text-red-400'
}

function scoreBadge(s: number): { label: string; color: string } {
  if (s >= 850) return { label: 'Excelente', color: 'green' }
  if (s >= 700) return { label: 'Bom', color: 'blue' }
  if (s >= 550) return { label: 'Regular', color: 'yellow' }
  return { label: 'Alto Risco', color: 'red' }
}

const ETAPA_LABELS: Record<string, string> = {
  prospeccao: 'Prospecção', qualificacao: 'Qualificação', proposta: 'Proposta',
  negociacao: 'Negociação', fechado_ganho: 'Ganho', fechado_perdido: 'Perdido',
}
const ETAPA_COLORS: Record<string, string> = {
  prospeccao: 'gray', qualificacao: 'blue', proposta: 'yellow',
  negociacao: 'orange', fechado_ganho: 'green', fechado_perdido: 'red',
}

const TIPO_VISITA_LABEL: Record<string, string> = {
  tecnica: 'Técnica', comercial: 'Comercial', cobranca: 'Cobrança', pos_venda: 'Pós-venda',
}

const STATUS_AMOSTRA_LABEL: Record<string, string> = {
  entregue: 'Entregue', em_avaliacao: 'Em avaliação', convertida: 'Convertida',
  nao_convertida: 'Não convertida', aguardando_retorno: 'Aguardando retorno',
}
const STATUS_AMOSTRA_COLOR: Record<string, string> = {
  entregue: 'blue', em_avaliacao: 'yellow', convertida: 'green',
  nao_convertida: 'red', aguardando_retorno: 'orange',
}

// ─── Tab: Produtores ──────────────────────────────────────────────────────────

function TabProdutores() {
  const [rows, setRows] = useState<Produtor[]>([])
  const [q, setQ] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroConsultor, setFiltroConsultor] = useState('todos')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState(false)
  const [detalhe, setDetalhe] = useState<Produtor | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome: '', cpf_cnpj: '', municipio: '', uf: 'MT', area_total_ha: '', culturas: '', telefone: '', email: '', consultor: '', status: 'ativo' })

  useState(() => {
    api.get('/api/crm/produtores/').then(r => setRows(r.data)).catch(() => setRows([]))
  })

  const consultores: string[] = []

  const visible = rows.filter(r => {
    if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false
    if (filtroConsultor !== 'todos' && r.consultor !== filtroConsultor) return false
    const s = q.toLowerCase()
    return !s || r.nome.toLowerCase().includes(s) || r.municipio.toLowerCase().includes(s) || r.culturas.join(' ').toLowerCase().includes(s)
  })

  const toggleSel = (id: number) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(sel.size === visible.length ? new Set() : new Set(visible.map(r => r.id)))

  const save = async () => {
    setSaving(true)
    try { await api.post('/api/crm/produtores/', form); setModal(false) }
    catch { setModal(false) }
    finally { setSaving(false) }
  }

  const statusColor = (s: string) => s === 'ativo' ? 'green' : s === 'prospecto' ? 'blue' : 'gray'

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total de produtores" val={rows.length} />
        <KpiCard label="Ativos" val={rows.filter(r => r.status === 'ativo').length} ok />
        <KpiCard label="Prospects" val={rows.filter(r => r.status === 'prospecto').length} neutral />
        <KpiCard label="Área total (ha)" val={rows.reduce((a, r) => a + (r.area_total_ha ?? 0), 0).toLocaleString('pt-BR')} sub="em carteira" />
      </div>

      <Bar value={q} onChange={setQ} placeholder="Buscar produtor, município...">
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="prospecto">Prospecto</option>
          <option value="inativo">Inativo</option>
        </select>
        <select value={filtroConsultor} onChange={e => setFiltroConsultor(e.target.value)}
          className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="todos">Todos os consultores</option>
          {consultores.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <ExportButtons selectedIds={[...sel]} />
        <BtnNew onClick={() => setModal(true)} label="Novo Produtor" />
      </Bar>

      <Table heads={['Produtor', 'Município / UF', 'Área (ha)', 'Culturas', 'Consultor', 'Última compra', 'Score', 'Status']}
        selHead={<input type="checkbox" checked={sel.size === visible.length && visible.length > 0} onChange={toggleAll} className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />}>
        {visible.length === 0 ? <Empty label="Nenhum produtor encontrado." /> : visible.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <TdSel id={r.id} sel={sel} toggle={toggleSel} />
            <TdMain><button onClick={() => setDetalhe(r)} className="hover:text-accent transition-colors text-left">{r.nome}</button></TdMain>
            <Td>{r.municipio} / {r.uf}</Td>
            <Td mono>{r.area_total_ha.toLocaleString('pt-BR')}</Td>
            <Td>{r.culturas.join(', ')}</Td>
            <Td>{r.consultor}</Td>
            <Td mono>{r.ultima_compra !== '—' ? new Date(r.ultima_compra + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</Td>
            <td className="px-4 py-3"><span className={`font-mono font-bold text-sm ${scoreColor(r.score_credito)}`}>{r.score_credito}</span></td>
            <td className="px-4 py-3"><Badge label={r.status.charAt(0).toUpperCase() + r.status.slice(1)} color={statusColor(r.status)} /></td>
            <td className="px-4 py-3"><button onClick={() => setDetalhe(r)} className="text-text-muted hover:text-accent transition-colors"><Eye size={15} /></button></td>
          </Tr>
        ))}
      </Table>

      {/* Modal detalhe produtor */}
      {detalhe && (
        <Modal title={detalhe.nome} onClose={() => setDetalhe(null)} wide>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">CPF / CNPJ</span><span className="text-text-primary font-mono">{detalhe.cpf_cnpj}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Município / UF</span><span className="text-text-primary">{detalhe.municipio} — {detalhe.uf}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Área Total</span><span className="text-text-primary font-mono">{detalhe.area_total_ha.toLocaleString('pt-BR')} ha</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Culturas</span><span className="text-text-primary">{detalhe.culturas.join(', ')}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Telefone</span><span className="text-text-primary">{detalhe.telefone}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">E-mail</span><span className="text-text-primary">{detalhe.email}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Consultor</span><span className="text-text-primary">{detalhe.consultor}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Safras ativas</span><span className="text-text-primary font-mono">{detalhe.safras_ativas}</span></div>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs text-text-muted mb-2 font-semibold uppercase tracking-wider">Crédito</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card2 border border-border rounded-lg px-3 py-2">
                <p className="text-xs text-text-muted">Score</p>
                <p className={`text-lg font-bold font-mono ${scoreColor(detalhe.score_credito)}`}>{detalhe.score_credito}</p>
                <Badge label={scoreBadge(detalhe.score_credito).label} color={scoreBadge(detalhe.score_credito).color} />
              </div>
              <div className="bg-card2 border border-border rounded-lg px-3 py-2">
                <p className="text-xs text-text-muted">Limite aprovado</p>
                <p className="text-sm font-bold font-mono text-text-primary">{fmtBRL(detalhe.limite_credito)}</p>
              </div>
              <div className="bg-card2 border border-border rounded-lg px-3 py-2">
                <p className="text-xs text-text-muted">Total em compras</p>
                <p className="text-sm font-bold font-mono text-text-primary">{fmtBRL(detalhe.total_compras)}</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="flex items-center gap-2 text-sm px-4 py-2 border border-border rounded-lg text-text-muted hover:text-text-primary transition-colors">
              <MessageSquare size={14} /> WhatsApp
            </button>
            <button className="flex items-center gap-2 text-sm px-4 py-2 border border-border rounded-lg text-text-muted hover:text-text-primary transition-colors">
              <Mail size={14} /> E-mail
            </button>
            <button className="flex items-center gap-2 text-sm px-4 py-2 bg-accent text-bg rounded-lg font-semibold hover:bg-accent/90 transition-colors">
              <Calendar size={14} /> Agendar visita
            </button>
          </div>
        </Modal>
      )}

      {/* Modal novo produtor */}
      {modal && (
        <Modal title="Novo Produtor" onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Razão Social / Nome"><Inp value={form.nome} onChange={v => setForm(p => ({ ...p, nome: v }))} /></Field>
            <Field label="CPF / CNPJ"><Inp value={form.cpf_cnpj} onChange={v => setForm(p => ({ ...p, cpf_cnpj: v }))} /></Field>
            <Field label="Município"><Inp value={form.municipio} onChange={v => setForm(p => ({ ...p, municipio: v }))} /></Field>
            <Field label="UF"><Inp value={form.uf} onChange={v => setForm(p => ({ ...p, uf: v }))} /></Field>
            <Field label="Área Total (ha)"><Inp value={form.area_total_ha} onChange={v => setForm(p => ({ ...p, area_total_ha: v }))} type="number" /></Field>
            <Field label="Culturas (separar por vírgula)"><Inp value={form.culturas} onChange={v => setForm(p => ({ ...p, culturas: v }))} placeholder="Soja, Milho" /></Field>
            <Field label="Telefone"><Inp value={form.telefone} onChange={v => setForm(p => ({ ...p, telefone: v }))} /></Field>
            <Field label="E-mail"><Inp value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} type="email" /></Field>
            <Field label="Consultor responsável"><Inp value={form.consultor} onChange={v => setForm(p => ({ ...p, consultor: v }))} /></Field>
            <Field label="Status"><Sel value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))} options={[{ value: 'ativo', label: 'Ativo' }, { value: 'prospecto', label: 'Prospecto' }, { value: 'inativo', label: 'Inativo' }]} /></Field>
          </div>
          <Footer onClose={() => setModal(false)} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  )
}

// ─── Tab: Visitas Técnicas ────────────────────────────────────────────────────

function TabVisitas() {
  const [rows, setRows] = useState<Visita[]>([])
  const [q, setQ] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState(false)
  const [detalhe, setDetalhe] = useState<Visita | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ produtor: '', consultor: '', data: '', tipo: 'tecnica', status: 'agendada', observacoes: '' })

  useState(() => {
    api.get('/api/crm/visitas/').then(r => setRows(r.data)).catch(() => setRows([]))
  })

  const visible = rows.filter(r => {
    if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false
    const s = q.toLowerCase()
    return !s || r.produtor.toLowerCase().includes(s) || r.consultor.toLowerCase().includes(s) || r.municipio.toLowerCase().includes(s)
  })

  const toggleSel = (id: number) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(sel.size === visible.length ? new Set() : new Set(visible.map(r => r.id)))

  const save = async () => {
    setSaving(true)
    try { await api.post('/api/crm/visitas/', form); setModal(false) }
    catch { setModal(false) }
    finally { setSaving(false) }
  }

  const statusColor = (s: string) => s === 'realizada' ? 'green' : s === 'agendada' ? 'blue' : 'red'

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total de visitas" val={rows.length} />
        <KpiCard label="Agendadas" val={rows.filter((v: any) => v.status === 'agendada').length} neutral />
        <KpiCard label="Realizadas" val={rows.filter((v: any) => v.status === 'realizada').length} ok />
        <KpiCard label="Com recomendação" val={rows.filter((v: any) => v.recomendacao).length} sub="visitas técnicas" />
      </div>

      <Bar value={q} onChange={setQ} placeholder="Buscar produtor, município...">
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="todos">Todos os status</option>
          <option value="agendada">Agendada</option>
          <option value="realizada">Realizada</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <ExportButtons selectedIds={[...sel]} />
        <BtnNew onClick={() => setModal(true)} label="Nova Visita" />
      </Bar>

      <Table heads={['Produtor', 'Consultor', 'Data', 'Tipo', 'Duração', 'Fotos', 'Geoloc.', 'Status']}
        selHead={<input type="checkbox" checked={sel.size === visible.length && visible.length > 0} onChange={toggleAll} className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />}>
        {visible.length === 0 ? <Empty label="Nenhuma visita encontrada." /> : visible.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <TdSel id={r.id} sel={sel} toggle={toggleSel} />
            <TdMain><button onClick={() => setDetalhe(r)} className="hover:text-accent transition-colors text-left">{r.produtor}</button></TdMain>
            <Td>{r.consultor}</Td>
            <Td mono>{new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}</Td>
            <td className="px-4 py-3"><Badge label={TIPO_VISITA_LABEL[r.tipo]} color={r.tipo === 'tecnica' ? 'green' : r.tipo === 'comercial' ? 'blue' : r.tipo === 'cobranca' ? 'red' : 'gray'} /></td>
            <Td mono>{r.duracao_min > 0 ? `${r.duracao_min} min` : '—'}</Td>
            <Td mono>{r.fotos > 0 ? `${r.fotos} foto${r.fotos > 1 ? 's' : ''}` : '—'}</Td>
            <td className="px-4 py-3">
              {r.lat ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><MapPin size={12} /> {r.lat.toFixed(2)}, {r.lng?.toFixed(2)}</span>
                : <span className="text-text-muted text-xs">—</span>}
            </td>
            <td className="px-4 py-3"><Badge label={r.status.charAt(0).toUpperCase() + r.status.slice(1)} color={statusColor(r.status)} /></td>
            <td className="px-4 py-3"><button onClick={() => setDetalhe(r)} className="text-text-muted hover:text-accent transition-colors"><Eye size={15} /></button></td>
          </Tr>
        ))}
      </Table>

      {/* Detalhe visita */}
      {detalhe && (
        <Modal title={`Visita — ${detalhe.produtor}`} onClose={() => setDetalhe(null)} wide>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Consultor</span><span className="text-text-primary">{detalhe.consultor}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Data</span><span className="text-text-primary font-mono">{new Date(detalhe.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Tipo</span><span className="text-text-primary">{TIPO_VISITA_LABEL[detalhe.tipo]}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Duração</span><span className="text-text-primary font-mono">{detalhe.duracao_min > 0 ? `${detalhe.duracao_min} min` : '—'}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Município</span><span className="text-text-primary">{detalhe.municipio}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Geolocalização</span><span className="text-text-primary font-mono">{detalhe.lat ? `${detalhe.lat}, ${detalhe.lng}` : 'Não registrada'}</span></div>
          </div>
          {detalhe.recomendacao && (
            <div className="bg-emerald-900/10 border border-emerald-800/40 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-400 mb-1 uppercase tracking-wider">Recomendação Agronômica</p>
              <p className="text-sm text-text-primary">{detalhe.recomendacao}</p>
            </div>
          )}
          {detalhe.observacoes && (
            <div className="bg-card2 border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-text-muted mb-1 uppercase tracking-wider">Observações</p>
              <p className="text-sm text-text-primary">{detalhe.observacoes}</p>
            </div>
          )}
          <div className="flex items-center gap-4 text-sm text-text-muted">
            <span className="flex items-center gap-1"><Camera size={14} /> {detalhe.fotos} foto(s)</span>
            <span className="flex items-center gap-1">{detalhe.lat ? <Wifi size={14} className="text-emerald-400" /> : <WifiOff size={14} />} {detalhe.lat ? 'GPS capturado' : 'Sem GPS'}</span>
          </div>
        </Modal>
      )}

      {/* Modal nova visita */}
      {modal && (
        <Modal title="Nova Visita" onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Produtor"><Inp value={form.produtor} onChange={v => setForm(p => ({ ...p, produtor: v }))} /></Field>
            <Field label="Consultor"><Inp value={form.consultor} onChange={v => setForm(p => ({ ...p, consultor: v }))} /></Field>
            <Field label="Data"><Inp value={form.data} onChange={v => setForm(p => ({ ...p, data: v }))} type="date" /></Field>
            <Field label="Tipo"><Sel value={form.tipo} onChange={v => setForm(p => ({ ...p, tipo: v }))} options={[{ value: 'tecnica', label: 'Técnica' }, { value: 'comercial', label: 'Comercial' }, { value: 'cobranca', label: 'Cobrança' }, { value: 'pos_venda', label: 'Pós-venda' }]} /></Field>
            <Field label="Status"><Sel value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))} options={[{ value: 'agendada', label: 'Agendada' }, { value: 'realizada', label: 'Realizada' }, { value: 'cancelada', label: 'Cancelada' }]} /></Field>
          </div>
          <Field label="Observações">
            <textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={3}
              className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none" />
          </Field>
          <Footer onClose={() => setModal(false)} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  )
}

// ─── Tab: Pipeline ────────────────────────────────────────────────────────────

function TabPipeline() {
  const [rows, setRows] = useState<Oportunidade[]>([])
  const [q, setQ] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState('todos')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ produtor: '', consultor: '', produto: '', cultura: 'Soja', safra: '2026/27', valor_estimado: '', etapa: 'prospeccao', probabilidade: '', data_prevista: '', observacoes: '' })

  useState(() => {
    api.get('/api/crm/oportunidades/').then(r => setRows(r.data)).catch(() => setRows(MOCK_OPORTUNIDADES))
  })

  const data = rows.length ? rows : MOCK_OPORTUNIDADES

  const visible = data.filter(r => {
    if (filtroEtapa !== 'todos' && r.etapa !== filtroEtapa) return false
    const s = q.toLowerCase()
    return !s || r.produtor.toLowerCase().includes(s) || r.produto.toLowerCase().includes(s) || r.cultura.toLowerCase().includes(s)
  })

  const toggleSel = (id: number) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(sel.size === visible.length ? new Set() : new Set(visible.map(r => r.id)))

  const save = async () => {
    setSaving(true)
    try { await api.post('/api/crm/oportunidades/', form); setModal(false) }
    catch { setModal(false) }
    finally { setSaving(false) }
  }

  const etapas = ['prospeccao', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho', 'fechado_perdido']
  const totalAtivo = data.filter(r => r.etapa !== 'fechado_perdido').reduce((a, r) => a + r.valor_estimado, 0)
  const totalGanho = data.filter(r => r.etapa === 'fechado_ganho').reduce((a, r) => a + r.valor_estimado, 0)

  return (
    <div>
      {/* Funil visual */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
        {etapas.map(e => {
          const count = data.filter(r => r.etapa === e).length
          const val = data.filter(r => r.etapa === e).reduce((a, r) => a + r.valor_estimado, 0)
          return (
            <div key={e} className={`border rounded-xl px-3 py-3 cursor-pointer transition-colors ${filtroEtapa === e ? 'border-accent bg-accent/5' : 'bg-card2 border-border hover:border-accent/50'}`}
              onClick={() => setFiltroEtapa(filtroEtapa === e ? 'todos' : e)}>
              <p className="text-xs text-text-muted whitespace-nowrap overflow-hidden text-ellipsis">{ETAPA_LABELS[e]}</p>
              <p className="text-xl font-bold font-mono text-text-primary mt-0.5">{count}</p>
              {val > 0 && <p className="text-xs font-mono text-text-muted">{fmtBRL(val)}</p>}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Pipeline ativo" val={fmtBRL(totalAtivo)} sub="excluindo perdidos" />
        <KpiCard label="Ganhos" val={fmtBRL(totalGanho)} ok />
        <KpiCard label="Taxa de conversão" val={`${data.length > 0 ? Math.round((data.filter(r => r.etapa === 'fechado_ganho').length / data.filter(r => ['fechado_ganho', 'fechado_perdido'].includes(r.etapa)).length || 0) * 100) : 0}%`} />
      </div>

      <Bar value={q} onChange={setQ} placeholder="Buscar produtor, produto, cultura...">
        <select value={filtroEtapa} onChange={e => setFiltroEtapa(e.target.value)}
          className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="todos">Todas as etapas</option>
          {etapas.map(e => <option key={e} value={e}>{ETAPA_LABELS[e]}</option>)}
        </select>
        <ExportButtons selectedIds={[...sel]} />
        <BtnNew onClick={() => setModal(true)} label="Nova Oportunidade" />
      </Bar>

      <Table heads={['Produtor', 'Produto', 'Cultura', 'Safra', 'Valor Est.', 'Prob. %', 'Prev. Fechamento', 'Consultor', 'Etapa']}
        selHead={<input type="checkbox" checked={sel.size === visible.length && visible.length > 0} onChange={toggleAll} className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />}>
        {visible.length === 0 ? <Empty label="Nenhuma oportunidade encontrada." /> : visible.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <TdSel id={r.id} sel={sel} toggle={toggleSel} />
            <TdMain>{r.produtor}</TdMain>
            <Td>{r.produto}</Td>
            <Td>{r.cultura}</Td>
            <Td mono>{r.safra}</Td>
            <Td mono>{fmtBRL(r.valor_estimado)}</Td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-card2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${r.probabilidade >= 75 ? 'bg-emerald-500' : r.probabilidade >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${r.probabilidade}%` }} />
                </div>
                <span className="text-text-muted text-xs font-mono">{r.probabilidade}%</span>
              </div>
            </td>
            <Td mono>{new Date(r.data_prevista + 'T12:00:00').toLocaleDateString('pt-BR')}</Td>
            <Td>{r.consultor}</Td>
            <td className="px-4 py-3"><Badge label={ETAPA_LABELS[r.etapa]} color={ETAPA_COLORS[r.etapa]} /></td>
            <td className="w-4" />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Nova Oportunidade" onClose={() => setModal(false)} wide>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Produtor"><Inp value={form.produtor} onChange={v => setForm(p => ({ ...p, produtor: v }))} /></Field>
            <Field label="Consultor"><Inp value={form.consultor} onChange={v => setForm(p => ({ ...p, consultor: v }))} /></Field>
            <Field label="Produto"><Inp value={form.produto} onChange={v => setForm(p => ({ ...p, produto: v }))} /></Field>
            <Field label="Cultura"><Inp value={form.cultura} onChange={v => setForm(p => ({ ...p, cultura: v }))} /></Field>
            <Field label="Safra"><Inp value={form.safra} onChange={v => setForm(p => ({ ...p, safra: v }))} /></Field>
            <Field label="Valor Estimado"><Inp value={form.valor_estimado} onChange={v => setForm(p => ({ ...p, valor_estimado: v }))} type="number" /></Field>
            <Field label="Etapa"><Sel value={form.etapa} onChange={v => setForm(p => ({ ...p, etapa: v }))} options={etapas.map(e => ({ value: e, label: ETAPA_LABELS[e] }))} /></Field>
            <Field label="Probabilidade (%)"><Inp value={form.probabilidade} onChange={v => setForm(p => ({ ...p, probabilidade: v }))} type="number" /></Field>
            <Field label="Previsão de Fechamento"><Inp value={form.data_prevista} onChange={v => setForm(p => ({ ...p, data_prevista: v }))} type="date" /></Field>
          </div>
          <Field label="Observações">
            <textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={3}
              className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none" />
          </Field>
          <Footer onClose={() => setModal(false)} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  )
}

// ─── Tab: Análise de Crédito ─────────────────────────────────────────────────

function TabCredito() {
  const [rows, setRows] = useState<Credito[]>([])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [detalhe, setDetalhe] = useState<Credito | null>(null)

  useState(() => {
    api.get('/api/crm/credito/').then(r => setRows(r.data)).catch(() => setRows(MOCK_CREDITO))
  })

  const data = rows.length ? rows : MOCK_CREDITO
  const visible = data.filter(r => {
    const s = q.toLowerCase()
    return !s || r.produtor.toLowerCase().includes(s) || r.cpf_cnpj.includes(s)
  })

  const toggleSel = (id: number) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(sel.size === visible.length ? new Set() : new Set(visible.map(r => r.id)))

  const statusColor = (s: string) => s === 'aprovado' ? 'green' : s === 'pendente' ? 'yellow' : s === 'suspenso' ? 'orange' : 'red'

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Aprovados" val={data.filter(r => r.status === 'aprovado').length} ok />
        <KpiCard label="Pendentes" val={data.filter(r => r.status === 'pendente').length} warn />
        <KpiCard label="Suspensos / Recusados" val={data.filter(r => ['suspenso', 'recusado'].includes(r.status)).length} warn />
        <KpiCard label="Limite total aprovado" val={fmtBRL(data.reduce((a, r) => a + r.limite_aprovado, 0))} sub="carteira ativa" />
      </div>

      <div className="bg-blue-900/10 border border-blue-800/40 rounded-xl p-4 mb-4 text-sm text-blue-300">
        <strong>Score de crédito:</strong> Calculado automaticamente com base em histórico de compras, adimplência, tempo de relacionamento e volume. Faixa: 0–1000. &nbsp;≥ 850 Excelente · ≥ 700 Bom · ≥ 550 Regular · abaixo Alto Risco.
      </div>

      <Bar value={q} onChange={setQ} placeholder="Buscar produtor ou CPF/CNPJ...">
        <ExportButtons selectedIds={[...sel]} />
      </Bar>

      <Table heads={['Produtor', 'CPF / CNPJ', 'Score', 'Adimplência', 'Parcelas atraso', 'Limite sugerido', 'Limite aprovado', 'Última análise', 'Status']}
        selHead={<input type="checkbox" checked={sel.size === visible.length && visible.length > 0} onChange={toggleAll} className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />}>
        {visible.length === 0 ? <Empty label="Nenhum produtor encontrado." /> : visible.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <TdSel id={r.id} sel={sel} toggle={toggleSel} />
            <TdMain><button onClick={() => setDetalhe(r)} className="hover:text-accent transition-colors text-left">{r.produtor}</button></TdMain>
            <Td mono>{r.cpf_cnpj}</Td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold font-mono ${scoreColor(r.score)}`}>{r.score}</span>
                <Badge label={scoreBadge(r.score).label} color={scoreBadge(r.score).color} />
              </div>
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-14 h-1.5 bg-card2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${r.adimplencia_pct >= 95 ? 'bg-emerald-500' : r.adimplencia_pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${r.adimplencia_pct}%` }} />
                </div>
                <span className="text-text-muted text-xs font-mono">{r.adimplencia_pct}%</span>
              </div>
            </td>
            <td className="px-4 py-3">
              <span className={`font-mono text-sm ${r.parcelas_atraso > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{r.parcelas_atraso}</span>
            </td>
            <Td mono>{r.limite_sugerido > 0 ? fmtBRL(r.limite_sugerido) : '—'}</Td>
            <Td mono>{r.limite_aprovado > 0 ? fmtBRL(r.limite_aprovado) : '—'}</Td>
            <Td mono>{r.ultima_analise !== '—' ? new Date(r.ultima_analise + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</Td>
            <td className="px-4 py-3"><Badge label={r.status.charAt(0).toUpperCase() + r.status.slice(1)} color={statusColor(r.status)} /></td>
            <td className="px-4 py-3"><button onClick={() => setDetalhe(r)} className="text-text-muted hover:text-accent transition-colors"><Eye size={15} /></button></td>
          </Tr>
        ))}
      </Table>

      {detalhe && (
        <Modal title={`Análise de Crédito — ${detalhe.produtor}`} onClose={() => setDetalhe(null)} wide>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card2 border border-border rounded-xl p-4 text-center">
              <p className="text-xs text-text-muted">Score</p>
              <p className={`text-4xl font-bold font-mono mt-1 ${scoreColor(detalhe.score)}`}>{detalhe.score}</p>
              <div className="mt-2"><Badge label={scoreBadge(detalhe.score).label} color={scoreBadge(detalhe.score).color} /></div>
            </div>
            <div className="bg-card2 border border-border rounded-xl p-4 text-center">
              <p className="text-xs text-text-muted">Adimplência</p>
              <p className={`text-4xl font-bold font-mono mt-1 ${detalhe.adimplencia_pct >= 95 ? 'text-emerald-400' : detalhe.adimplencia_pct >= 80 ? 'text-amber-300' : 'text-red-400'}`}>{detalhe.adimplencia_pct}%</p>
              <p className="text-xs text-text-muted mt-2">{detalhe.parcelas_atraso} parce{detalhe.parcelas_atraso !== 1 ? 'las' : 'la'} em atraso</p>
            </div>
            <div className="bg-card2 border border-border rounded-xl p-4 text-center">
              <p className="text-xs text-text-muted">Histórico de compras</p>
              <p className="text-2xl font-bold font-mono mt-1 text-text-primary">{fmtBRL(detalhe.historico_compras)}</p>
              <p className="text-xs text-text-muted mt-2">acumulado</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Limite sugerido pelo sistema</span><span className="text-text-primary font-mono font-bold">{fmtBRL(detalhe.limite_sugerido)}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Limite aprovado pelo gerente</span><span className="text-text-primary font-mono font-bold">{detalhe.limite_aprovado > 0 ? fmtBRL(detalhe.limite_aprovado) : 'Não aprovado'}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Última análise</span><span className="text-text-primary font-mono">{detalhe.ultima_analise !== '—' ? new Date(detalhe.ultima_analise + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span></div>
            <div className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Status atual</span><Badge label={detalhe.status.charAt(0).toUpperCase() + detalhe.status.slice(1)} color={detalhe.status === 'aprovado' ? 'green' : detalhe.status === 'suspenso' ? 'orange' : 'red'} /></div>
          </div>
          {detalhe.observacoes && (
            <div className="bg-card2 border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-text-muted mb-1 uppercase tracking-wider">Observações</p>
              <p className="text-sm text-text-primary">{detalhe.observacoes}</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 text-sm bg-accent text-bg rounded-lg font-semibold hover:bg-accent/90 transition-colors">Alterar limite aprovado</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab: Amostras e Demos ────────────────────────────────────────────────────

function TabAmostras() {
  const [rows, setRows] = useState<Amostra[]>([])
  const [q, setQ] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ produtor: '', consultor: '', produto: '', quantidade: '', unidade: 'L', data_entrega: '', cultura: '', status: 'entregue' })

  useState(() => {
    api.get('/api/crm/amostras/').then(r => setRows(r.data)).catch(() => setRows(MOCK_AMOSTRAS))
  })

  const data = rows.length ? rows : MOCK_AMOSTRAS
  const visible = data.filter(r => {
    if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false
    const s = q.toLowerCase()
    return !s || r.produtor.toLowerCase().includes(s) || r.produto.toLowerCase().includes(s)
  })

  const toggleSel = (id: number) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(sel.size === visible.length ? new Set() : new Set(visible.map(r => r.id)))

  const save = async () => {
    setSaving(true)
    try { await api.post('/api/crm/amostras/', form); setModal(false) }
    catch { setModal(false) }
    finally { setSaving(false) }
  }

  const txConversao = data.filter(r => ['convertida', 'nao_convertida'].includes(r.status)).length > 0
    ? Math.round(data.filter(r => r.status === 'convertida').length / data.filter(r => ['convertida', 'nao_convertida'].includes(r.status)).length * 100)
    : 0

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total de amostras" val={data.length} />
        <KpiCard label="Em avaliação" val={data.filter(r => ['em_avaliacao', 'entregue', 'aguardando_retorno'].includes(r.status)).length} neutral />
        <KpiCard label="Convertidas" val={data.filter(r => r.status === 'convertida').length} ok />
        <KpiCard label="Taxa de conversão" val={`${txConversao}%`} ok={txConversao >= 50} warn={txConversao < 30} />
      </div>

      <Bar value={q} onChange={setQ} placeholder="Buscar produtor, produto...">
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_AMOSTRA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <ExportButtons selectedIds={[...sel]} />
        <BtnNew onClick={() => setModal(true)} label="Nova Amostra" />
      </Bar>

      <Table heads={['Produtor', 'Produto', 'Qtd', 'Cultura', 'Entrega', 'Retorno', 'Consultor', 'Resultado', 'Status']}
        selHead={<input type="checkbox" checked={sel.size === visible.length && visible.length > 0} onChange={toggleAll} className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />}>
        {visible.length === 0 ? <Empty label="Nenhuma amostra encontrada." /> : visible.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <TdSel id={r.id} sel={sel} toggle={toggleSel} />
            <TdMain>{r.produtor}</TdMain>
            <Td>{r.produto}</Td>
            <Td mono>{r.quantidade} {r.unidade}</Td>
            <Td>{r.cultura}</Td>
            <Td mono>{new Date(r.data_entrega + 'T12:00:00').toLocaleDateString('pt-BR')}</Td>
            <Td mono>{r.data_retorno ? new Date(r.data_retorno + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</Td>
            <Td>{r.consultor}</Td>
            <td className="px-4 py-3 text-sm text-text-muted max-w-xs truncate">{r.resultado ?? '—'}</td>
            <td className="px-4 py-3"><Badge label={STATUS_AMOSTRA_LABEL[r.status]} color={STATUS_AMOSTRA_COLOR[r.status]} /></td>
            <td className="w-4" />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Nova Amostra / Demonstração" onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Produtor"><Inp value={form.produtor} onChange={v => setForm(p => ({ ...p, produtor: v }))} /></Field>
            <Field label="Consultor"><Inp value={form.consultor} onChange={v => setForm(p => ({ ...p, consultor: v }))} /></Field>
            <Field label="Produto"><Inp value={form.produto} onChange={v => setForm(p => ({ ...p, produto: v }))} /></Field>
            <Field label="Cultura"><Inp value={form.cultura} onChange={v => setForm(p => ({ ...p, cultura: v }))} /></Field>
            <Field label="Quantidade"><Inp value={form.quantidade} onChange={v => setForm(p => ({ ...p, quantidade: v }))} type="number" /></Field>
            <Field label="Unidade"><Sel value={form.unidade} onChange={v => setForm(p => ({ ...p, unidade: v }))} options={[{ value: 'L', label: 'Litros (L)' }, { value: 'kg', label: 'Kilos (kg)' }, { value: 'sc', label: 'Sacas' }, { value: 'doses', label: 'Doses' }, { value: 'un', label: 'Unidades' }]} /></Field>
            <Field label="Data de entrega"><Inp value={form.data_entrega} onChange={v => setForm(p => ({ ...p, data_entrega: v }))} type="date" /></Field>
            <Field label="Status"><Sel value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))} options={Object.entries(STATUS_AMOSTRA_LABEL).map(([v, l]) => ({ value: v, label: l }))} /></Field>
          </div>
          <Footer onClose={() => setModal(false)} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  )
}

// ─── Tab: Campanhas ───────────────────────────────────────────────────────────

function TabCampanhas() {
  const [rows, setRows] = useState<Campanha[]>([])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome: '', tipo: 'whatsapp', segmento: '', data_inicio: '' })

  useState(() => {
    api.get('/api/crm/campanhas/').then(r => setRows(r.data)).catch(() => setRows(MOCK_CAMPANHAS))
  })

  const data = rows.length ? rows : MOCK_CAMPANHAS
  const visible = data.filter(r => {
    const s = q.toLowerCase()
    return !s || r.nome.toLowerCase().includes(s) || r.segmento.toLowerCase().includes(s)
  })

  const toggleSel = (id: number) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(sel.size === visible.length ? new Set() : new Set(visible.map(r => r.id)))

  const save = async () => {
    setSaving(true)
    try { await api.post('/api/crm/campanhas/', form); setModal(false) }
    catch { setModal(false) }
    finally { setSaving(false) }
  }

  const statusColor = (s: string) => s === 'ativa' ? 'green' : s === 'rascunho' ? 'gray' : s === 'pausada' ? 'yellow' : 'blue'
  const tipoColor = (t: string) => t === 'whatsapp' ? 'green' : t === 'email' ? 'blue' : 'purple'

  return (
    <div>
      <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 mb-4 flex items-start gap-3">
        <MessageSquare size={18} className="text-amber-300 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-200">
          <strong>Integração com WhatsApp e e-mail:</strong> O envio das campanhas requer integração ativa com a API do WhatsApp Business (via Z-API ou similar) e um servidor SMTP configurado. Configure em <strong>Configurações → Integrações</strong>.
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Campanhas ativas" val={data.filter(r => r.status === 'ativa').length} ok />
        <KpiCard label="Total de envios" val={data.reduce((a, r) => a + r.envios, 0).toLocaleString('pt-BR')} />
        <KpiCard label="Taxa de abertura" val={`${data.reduce((a, r) => a + r.envios, 0) > 0 ? Math.round(data.reduce((a, r) => a + r.aberturas, 0) / data.reduce((a, r) => a + r.envios, 0) * 100) : 0}%`} />
        <KpiCard label="Conversões" val={data.reduce((a, r) => a + r.conversoes, 0)} ok />
      </div>

      <Bar value={q} onChange={setQ} placeholder="Buscar campanha, segmento...">
        <ExportButtons selectedIds={[...sel]} />
        <BtnNew onClick={() => setModal(true)} label="Nova Campanha" />
      </Bar>

      <Table heads={['Campanha', 'Canal', 'Segmento', 'Envios', 'Aberturas', 'Respostas', 'Conversões', 'Início', 'Status']}
        selHead={<input type="checkbox" checked={sel.size === visible.length && visible.length > 0} onChange={toggleAll} className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />}>
        {visible.length === 0 ? <Empty label="Nenhuma campanha encontrada." /> : visible.map(r => (
          <Tr key={r.id} selected={sel.has(r.id)}>
            <TdSel id={r.id} sel={sel} toggle={toggleSel} />
            <TdMain>{r.nome}</TdMain>
            <td className="px-4 py-3"><Badge label={r.tipo === 'ambos' ? 'WhatsApp + E-mail' : r.tipo === 'whatsapp' ? 'WhatsApp' : 'E-mail'} color={tipoColor(r.tipo)} /></td>
            <td className="px-4 py-3 text-text-muted text-xs max-w-xs truncate">{r.segmento}</td>
            <Td mono>{r.envios.toLocaleString('pt-BR')}</Td>
            <td className="px-4 py-3">
              <span className="font-mono text-sm text-text-muted">{r.aberturas}</span>
              {r.envios > 0 && <span className="text-xs text-text-muted ml-1">({Math.round(r.aberturas / r.envios * 100)}%)</span>}
            </td>
            <Td mono>{r.respostas}</Td>
            <td className="px-4 py-3">
              <span className={`font-mono text-sm font-bold ${r.conversoes > 0 ? 'text-emerald-400' : 'text-text-muted'}`}>{r.conversoes}</span>
            </td>
            <Td mono>{r.data_inicio !== '—' ? new Date(r.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</Td>
            <td className="px-4 py-3"><Badge label={r.status.charAt(0).toUpperCase() + r.status.slice(1)} color={statusColor(r.status)} /></td>
            <td className="w-4" />
          </Tr>
        ))}
      </Table>

      {modal && (
        <Modal title="Nova Campanha" onClose={() => setModal(false)}>
          <Field label="Nome da campanha"><Inp value={form.nome} onChange={v => setForm(p => ({ ...p, nome: v }))} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Canal"><Sel value={form.tipo} onChange={v => setForm(p => ({ ...p, tipo: v }))} options={[{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'email', label: 'E-mail' }, { value: 'ambos', label: 'WhatsApp + E-mail' }]} /></Field>
            <Field label="Data de início"><Inp value={form.data_inicio} onChange={v => setForm(p => ({ ...p, data_inicio: v }))} type="date" /></Field>
          </div>
          <Field label="Segmentação (descreva o público-alvo)">
            <textarea value={form.segmento} onChange={e => setForm(p => ({ ...p, segmento: e.target.value }))} rows={2}
              placeholder="Ex: Produtores de Soja · MT · >500ha · safra 2026/27"
              className="bg-card2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none" />
          </Field>
          <Footer onClose={() => setModal(false)} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  )
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

function TabDashboard() {
  const consultores = [
    { nome: 'Ana Lima', visitas: 18, pedidos: 12, conversao: 67, pipeline: 272000, visitas_meta: 20, pedidos_meta: 15 },
    { nome: 'Carlos Souza', visitas: 14, pedidos: 8, conversao: 57, pipeline: 88000, visitas_meta: 20, pedidos_meta: 15 },
  ]

  const porTipo = [
    { tipo: 'Técnica', count: MOCK_VISITAS.filter(v => v.tipo === 'tecnica').length, color: 'bg-emerald-500' },
    { tipo: 'Comercial', count: MOCK_VISITAS.filter(v => v.tipo === 'comercial').length, color: 'bg-blue-500' },
    { tipo: 'Pós-venda', count: MOCK_VISITAS.filter(v => v.tipo === 'pos_venda').length, color: 'bg-purple-500' },
    { tipo: 'Cobrança', count: MOCK_VISITAS.filter(v => v.tipo === 'cobranca').length, color: 'bg-yellow-500' },
  ]
  const totalVisitas = MOCK_VISITAS.length

  return (
    <div className="space-y-6">
      {/* KPIs gerais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Produtores na carteira" val={MOCK_PRODUTORES.filter(p => p.status === 'ativo').length} ok />
        <KpiCard label="Visitas este mês" val={rows.filter((v: any) => v.status === 'realizada').length} />
        <KpiCard label="Pipeline total" val={fmtBRL(MOCK_OPORTUNIDADES.filter(o => !['fechado_perdido'].includes(o.etapa)).reduce((a, o) => a + o.valor_estimado, 0))} />
        <KpiCard label="Conversão de amostras" val={`${Math.round(MOCK_AMOSTRAS.filter(a => a.status === 'convertida').length / Math.max(MOCK_AMOSTRAS.filter(a => ['convertida', 'nao_convertida'].includes(a.status)).length, 1) * 100)}%`} ok />
      </div>

      {/* Por consultor */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Produtividade por Consultor</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {consultores.map(c => (
            <div key={c.nome} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
                    <span className="text-accent text-sm font-bold">{c.nome.split(' ').map(n => n[0]).join('')}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary text-sm">{c.nome}</p>
                    <p className="text-xs text-text-muted">Consultor / Vendedor</p>
                  </div>
                </div>
                <Badge label={`${c.conversao}% conv.`} color={c.conversao >= 60 ? 'green' : 'yellow'} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm mb-4">
                <div>
                  <p className="text-xs text-text-muted">Visitas</p>
                  <p className="font-bold font-mono text-text-primary">{c.visitas}<span className="text-xs text-text-muted">/{c.visitas_meta}</span></p>
                  <div className="w-full h-1 bg-card2 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full rounded-full ${c.visitas >= c.visitas_meta ? 'bg-emerald-500' : 'bg-accent'}`} style={{ width: `${Math.min(c.visitas / c.visitas_meta * 100, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Pedidos</p>
                  <p className="font-bold font-mono text-text-primary">{c.pedidos}<span className="text-xs text-text-muted">/{c.pedidos_meta}</span></p>
                  <div className="w-full h-1 bg-card2 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full rounded-full ${c.pedidos >= c.pedidos_meta ? 'bg-emerald-500' : 'bg-accent'}`} style={{ width: `${Math.min(c.pedidos / c.pedidos_meta * 100, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Pipeline</p>
                  <p className="font-bold font-mono text-text-primary text-xs">{fmtBRL(c.pipeline)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visitas por tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Visitas por Tipo</h3>
          <div className="space-y-3">
            {porTipo.map(t => (
              <div key={t.tipo} className="flex items-center gap-3">
                <span className="text-sm text-text-muted w-24">{t.tipo}</span>
                <div className="flex-1 h-2 bg-card2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${t.color}`} style={{ width: `${totalVisitas > 0 ? t.count / totalVisitas * 100 : 0}%` }} />
                </div>
                <span className="text-sm font-mono text-text-primary w-6 text-right">{t.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Pipeline por Etapa</h3>
          <div className="space-y-3">
            {['prospeccao', 'qualificacao', 'proposta', 'negociacao'].map(e => {
              const val = MOCK_OPORTUNIDADES.filter(o => o.etapa === e).reduce((a, o) => a + o.valor_estimado, 0)
              const max = MOCK_OPORTUNIDADES.reduce((a, o) => a + o.valor_estimado, 0)
              return (
                <div key={e} className="flex items-center gap-3">
                  <span className="text-sm text-text-muted w-28 whitespace-nowrap">{ETAPA_LABELS[e]}</span>
                  <div className="flex-1 h-2 bg-card2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${max > 0 ? val / max * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-mono text-text-primary w-24 text-right">{fmtBRL(val)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Produtores sem visita recente */}
      <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={16} className="text-amber-300" />
          <p className="text-sm font-semibold text-amber-300">Produtores sem visita nos últimos 30 dias</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MOCK_PRODUTORES.filter(p => p.status === 'ativo').slice(2).map(p => (
            <span key={p.id} className="text-xs bg-amber-950/30 border border-amber-800/40 text-amber-200 px-3 py-1 rounded-full">{p.nome}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = ['Produtores', 'Visitas Técnicas', 'Pipeline', 'Análise de Crédito', 'Amostras e Demos', 'Campanhas', 'Dashboard']

export default function CRM() {
  const [tab, setTab] = useState('Produtores')

  return (
    <div className="p-6 max-w-screen-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">CRM Agrícola</h1>
        <p className="text-sm text-text-muted mt-1">Relacionamento com produtores, visitas técnicas, pipeline de vendas e crédito rural.</p>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Produtores'        && <TabProdutores />}
      {tab === 'Visitas Técnicas'  && <TabVisitas />}
      {tab === 'Pipeline'          && <TabPipeline />}
      {tab === 'Análise de Crédito' && <TabCredito />}
      {tab === 'Amostras e Demos'  && <TabAmostras />}
      {tab === 'Campanhas'         && <TabCampanhas />}
      {tab === 'Dashboard'         && <TabDashboard />}
    </div>
  )
}
