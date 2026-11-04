import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PageLoader } from '@/components/shared/PageLoader'
import { useAuthStore } from '@/store/auth'

/** Blocks /app/* for signed-out visitors and remembers the intended destination. */
export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'loading') return <PageLoader label="Restoring your session" />
  if (status === 'anonymous') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    )
  }
  return <Outlet />
}

/** Keeps signed-in users away from /login and /register. */
export function PublicOnlyRoute() {
  const status = useAuthStore((state) => state.status)

  if (status === 'loading') return <PageLoader label="Checking your session" />
  if (status === 'authenticated') return <Navigate to="/app" replace />
  return <Outlet />
}
