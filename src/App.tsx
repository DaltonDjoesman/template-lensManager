import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { PedidosPage } from './pages/PedidosPage'
import { PedidoFormPage } from './pages/PedidoFormPage'
import { ClientesPage } from './pages/ClientesPage'
import { ClienteFormPage } from './pages/ClienteFormPage'
import { CatalogoPage } from './pages/CatalogoPage'
import { CatalogoFormPage } from './pages/CatalogoFormPage'
import { DefinicoesPage } from './pages/DefinicoesPage'
import { VendasPorSkuPage } from './pages/VendasPorSkuPage'
import './pages/pages.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/pedidos" replace />} />
          <Route path="/pedidos" element={<PedidosPage />} />
          <Route path="/pedidos/novo" element={<PedidoFormPage />} />
          <Route path="/pedidos/:id" element={<PedidoFormPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/clientes/novo" element={<ClienteFormPage />} />
          <Route path="/clientes/:id" element={<ClienteFormPage />} />
          <Route path="/catalogo" element={<CatalogoPage />} />
          <Route path="/catalogo/novo" element={<CatalogoFormPage />} />
          <Route path="/catalogo/:id" element={<CatalogoFormPage />} />
          <Route
            path="/relatorios/vendas-por-sku"
            element={<VendasPorSkuPage />}
          />
          <Route path="/definicoes" element={<DefinicoesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/pedidos" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
