import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { PageLoader } from '@/components/shared/PageLoader'
import { AppLayout } from './layouts/AppLayout'
import { AuthLayout } from './layouts/AuthLayout'
import { CapabilityGuard } from './guards/CapabilityGuard'
import { ProtectedRoute, PublicOnlyRoute } from './guards/RouteGuards'

/*
 * Route-level code splitting keeps the signed-out entry bundle small. Every
 * screen is loaded on demand and shares the chunks produced by Rollup.
 */
const LandingPage = lazy(() =>
  import('@/features/landing/pages/LandingPage').then((module) => ({
    default: module.LandingPage,
  }))
)
const LoginPage = lazy(() =>
  import('@/features/auth/pages/LoginPage').then((module) => ({ default: module.LoginPage }))
)
const RegisterPage = lazy(() =>
  import('@/features/auth/pages/RegisterPage').then((module) => ({
    default: module.RegisterPage,
  }))
)
const OnboardingPage = lazy(() =>
  import('@/features/organizations/pages/OnboardingPage').then((module) => ({
    default: module.OnboardingPage,
  }))
)
const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  }))
)
const DocumentsPage = lazy(() =>
  import('@/features/documents/pages/DocumentsPage').then((module) => ({
    default: module.DocumentsPage,
  }))
)
const DocumentDetailPage = lazy(() =>
  import('@/features/documents/pages/DocumentDetailPage').then((module) => ({
    default: module.DocumentDetailPage,
  }))
)
const AskAiPage = lazy(() =>
  import('@/features/ask/pages/AskAiPage').then((module) => ({ default: module.AskAiPage }))
)
const AuditPage = lazy(() =>
  import('@/features/audit/pages/AuditPage').then((module) => ({ default: module.AuditPage }))
)
const ArchivedDocumentsPage = lazy(() =>
  import('@/features/archive/pages/ArchivedDocumentsPage').then((module) => ({
    default: module.ArchivedDocumentsPage,
  }))
)
const TeamPage = lazy(() =>
  import('@/features/team/pages/TeamPage').then((module) => ({ default: module.TeamPage }))
)
const InvitePage = lazy(() =>
  import('@/features/team/pages/InvitePage').then((module) => ({ default: module.InvitePage }))
)
const SettingsPage = lazy(() =>
  import('@/features/settings/pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  }))
)
const NotFoundPage = lazy(() =>
  import('@/features/misc/pages/NotFoundPage').then((module) => ({
    default: module.NotFoundPage,
  }))
)

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <PageLoader label="Loading page" />
    </div>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          <Route element={<PublicOnlyRoute />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/app/onboarding" element={<OnboardingPage />} />
            <Route path="/invite/:token" element={<InvitePage />} />

            <Route path="/app" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="documents/:documentId" element={<DocumentDetailPage />} />
              <Route path="archive" element={<ArchivedDocumentsPage />} />
              <Route path="ask" element={<AskAiPage />} />
              <Route
                path="audit"
                element={
                  <CapabilityGuard capability="audit:read">
                    <AuditPage />
                  </CapabilityGuard>
                }
              />
              <Route path="team" element={<TeamPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
