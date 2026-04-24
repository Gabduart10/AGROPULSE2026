import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, Truck, Factory, Leaf,
  DollarSign, FileText, CreditCard, FileSignature, Users,
  UserCheck, Wrench, BarChart2, BookOpen, ChevronLeft, ChevronRight,
  Building2, Shield,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  badge?: string
  industria_only?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    label: 'Operacional',
    items: [
      { id: 'vendas',    label: 'Vendas e Pedidos',       icon: <ShoppingCart size={18} />, path: '/vendas' },
      { id: 'estoque',   label: 'Estoque',                icon: <Package size={18} />,      path: '/estoque' },
      { id: 'compras',   label: 'Compras e Fornecedores', icon: <Truck size={18} />,        path: '/compras' },
      { id: 'logistica', label: 'Logística e Transporte', icon: <Truck size={18} />,        path: '/logistica' },
    ],
  },
  {
    label: 'Produção',
    items: [
      { id: 'producao', label: 'Produção e Beneficiamento', icon: <Factory size={18} />, path: '/producao', industria_only: true },
      { id: 'safras',   label: 'Gestão de Safras',          icon: <Leaf size={18} />,    path: '/safras' },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { id: 'financeiro', label: 'Financeiro',          icon: <DollarSign size={18} />,    path: '/financeiro' },
      { id: 'fiscal',     label: 'Fiscal e Tributário', icon: <FileText size={18} />,      path: '/fiscal' },
      { id: 'contratos',  label: 'Contratos Agrícolas', icon: <FileSignature size={18} />, path: '/contratos' },
    ],
  },
  {
    label: 'Relacionamento',
    items: [
      { id: 'crm', label: 'CRM Agrícola', icon: <UserCheck size={18} />, path: '/crm' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { id: 'rh',         label: 'RH e Folha',           icon: <Users size={18} />,     path: '/rh' },
      { id: 'manutencao', label: 'Manutenção e Ativos',  icon: <Wrench size={18} />,    path: '/manutencao' },
      { id: 'bi',         label: 'BI e Relatórios',      icon: <BarChart2 size={18} />, path: '/bi' },
    ],
  },
  {
    label: 'Base',
    items: [
      { id: 'cadastros', label: 'Cadastros Gerais', icon: <BookOpen size={18} />, path: '/cadastros' },
    ],
  },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()

  const isIndustria  = user?.tipo_negocio === 'industria'
  const isMatriz     = user?.is_matriz
  const isSuperhost  = user?.is_superhost

  return (
    <aside
      className="flex flex-col h-screen bg-sidebar border-r border-white/10 transition-all duration-200 flex-shrink-0"
      style={{ width: collapsed ? 72 : 256 }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/10 gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <span className="text-[#F5F2EB] font-bold text-sm">A</span>
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-base tracking-tight">AgroPulse</span>
        )}
      </div>

      {/* Tenant type badge */}
      {!collapsed && user?.tipo_negocio && (
        <div className="mx-3 mt-2">
          <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
            isIndustria ? 'bg-blue-900/40 text-blue-300' : 'bg-accent/20 text-accent'
          }`}>
            {isIndustria ? '⚙ Indústria' : '🌾 Revenda'}
          </span>
        </div>
      )}

      {/* Dashboard */}
      <NavLink to="/" end
        className={({ isActive }) =>
          `flex items-center gap-3 px-4 py-3 mx-2 mt-2 rounded-lg text-sm transition-colors ${
            isActive ? 'bg-accent/20 text-accent font-medium' : 'text-white/60 hover:bg-white/10 hover:text-white'
          }`
        }
        title={collapsed ? 'Dashboard' : undefined}
      >
        <LayoutDashboard size={18} className="flex-shrink-0" />
        {!collapsed && <span>Dashboard</span>}
      </NavLink>

      {/* Consolidado — só para matriz */}
      {isMatriz && (
        <NavLink to="/matriz"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-accent/20 text-accent font-medium' : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`
          }
          title={collapsed ? 'Visão Consolidada' : undefined}
        >
          <Building2 size={18} className="flex-shrink-0" />
          {!collapsed && <span>Visão Consolidada</span>}
        </NavLink>
      )}

      {/* SuperHost — só para is_staff */}
      {isSuperhost && (
        <NavLink to="/superhost"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-blue-500/20 text-blue-300 font-medium' : 'text-blue-400/70 hover:bg-blue-900/20 hover:text-blue-300'
            }`
          }
          title={collapsed ? 'SuperHost' : undefined}
        >
          <Shield size={18} className="flex-shrink-0" />
          {!collapsed && <span>Painel SuperHost</span>}
        </NavLink>
      )}

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4 mt-1">
        {NAV.map((group) => {
          const visibleItems = group.items.filter(item =>
            item.industria_only ? isIndustria : true
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={group.label}>
              {!collapsed && (
                <p className="text-xs font-semibold text-white/30 uppercase tracking-wider px-2 mb-1">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavLink key={item.id} to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors relative group ${
                        isActive ? 'bg-accent/20 text-accent font-medium' : 'text-white/60 hover:bg-white/10 hover:text-white'
                      }`
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="text-xs bg-white/10 text-white/40 px-1.5 py-0.5 rounded">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && (
                      <span className="absolute left-full ml-2 px-2 py-1 bg-card border border-border rounded text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-white/10 text-white/40 hover:text-accent transition-colors"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  )
}
