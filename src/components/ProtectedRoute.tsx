import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, isSubscriptionExpired } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" replace />
  }

  // Check if subscription is expired and user is trying to access non-billing pages
  const isExpired = isSubscriptionExpired()
  const allowedPaths = ['/billings', '/profile'] // Allow billing and profile pages

  if (isExpired && !allowedPaths.includes(location.pathname)) {
    return <Navigate to="/billings" replace />
  }

  return <>{children}</>
}
