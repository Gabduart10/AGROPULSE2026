import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Placeholder from './pages/Placeholder'
import Cadastros from './pages/Cadastros'
import Estoque from './pages/Estoque'
import Compras from './pages/Compras'
import MatrizConsolidado from './pages/MatrizConsolidado'
import SuperHost from './pages/SuperHost'
import Vendas from './pages/Vendas'
import Producao from './pages/Producao'
import Logistica from './pages/Logistica'
import RH from './pages/RH'
import Safras from './pages/Safras'
import Financeiro from './pages/Financeiro'
import FiscalPage from './pages/Fiscal'
import Manutencao from './pages/Manutencao'
import CRM from './pages/CRM'
import BI from './pages/BI'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index          element={<Dashboard />} />
            <Route path="matriz"  element={<MatrizConsolidado />} />
            <Route path="superhost" element={<SuperHost />} />

            <Route path="vendas"     element={<Vendas />} />
            <Route path="estoque"    element={<Estoque />} />
            <Route path="compras"    element={<Compras />} />
            <Route path="logistica"  element={<Logistica />} />
            <Route path="producao"   element={<Producao />} />
            <Route path="safras"     element={<Safras />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="fiscal"     element={<FiscalPage />} />
<Route path="contratos"  element={<Placeholder title="Contratos Agrícolas" />} />
            <Route path="crm"        element={<CRM />} />
            <Route path="rh"         element={<RH />} />
            <Route path="manutencao" element={<Manutencao />} />
            <Route path="bi"         element={<BI />} />
            <Route path="cadastros"  element={<Cadastros />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
