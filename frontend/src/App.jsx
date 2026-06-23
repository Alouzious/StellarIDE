import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import PublicLayout from './layouts/PublicLayout'
import AuthLayout from './layouts/AuthLayout'
import ProtectedLayout from './layouts/ProtectedLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import IdePage from './pages/IdePage'
import OAuthCallbackPage from './pages/OAuthCallbackPage'
import NotFoundPage from './pages/NotFoundPage'
import DocsLayout from './layouts/DocsLayout'
import DocsContentPage from './pages/docs/DocsContentPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages with Navbar + Footer */}
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
        </Route>

        {/* Documentation */}
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<DocsContentPage />} />
          <Route path="guide" element={<DocsContentPage />} />
          <Route path="guide/create-account" element={<DocsContentPage />} />
          <Route path="guide/first-contract" element={<DocsContentPage />} />
          <Route path="guide/using-editor" element={<DocsContentPage />} />
          <Route path="guide/compile-errors" element={<DocsContentPage />} />
          <Route path="guide/deploy-testnet" element={<DocsContentPage />} />
          <Route path="guide/connect-wallet" element={<DocsContentPage />} />
          <Route path="guide/invite-team" element={<DocsContentPage />} />
          <Route path="guide/import-github" element={<DocsContentPage />} />
          <Route path="guide/audit-contract" element={<DocsContentPage />} />
          <Route path="guide/faq" element={<DocsContentPage />} />
          <Route path="getting-started" element={<DocsContentPage />} />
          <Route path="editor" element={<DocsContentPage />} />
          <Route path="compile-test" element={<DocsContentPage />} />
          <Route path="deploy" element={<DocsContentPage />} />
          <Route path="wallet" element={<DocsContentPage />} />
          <Route path="github" element={<DocsContentPage />} />
          <Route path="collaboration" element={<DocsContentPage />} />
          <Route path="audit" element={<DocsContentPage />} />
          <Route path="ai-assistant" element={<DocsContentPage />} />
          <Route path="api" element={<DocsContentPage />} />
        </Route>

        {/* Auth pages (redirect to /dashboard if already logged in) */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* OAuth callback — public, handles token from provider redirect */}
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        {/* Protected pages (redirect to /login if not authenticated) */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ide/:id" element={<IdePage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  )
}
