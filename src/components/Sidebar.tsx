import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Sidebar() {
  const location = useLocation()
  const { user, signOut, isSubscriptionExpired } = useAuth()

  const isActive = (path: string) => location.pathname === path
  const isExpired = isSubscriptionExpired()

  // Admin-only navigation items
  const adminNavItems = [
    { path: '/packages', icon: '📦', label: 'Packages' },
    { path: '/transactions', icon: '💰', label: 'Transactions' },
    { path: '/user-register', icon: '👥', label: 'User Register' },
  ]

  // Regular user navigation items
  const userNavItems = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/device-settings', icon: '⚙️', label: 'Device Settings' },
    { path: '/prompts', icon: '📝', label: 'Prompts' },
    { path: '/chatbot-ai', icon: '🤖', label: 'Chatbot AI' },
    { path: '/sequences', icon: '📨', label: 'Sequences' },
    { path: '/bank-image', icon: '🏦', label: 'Bank Image' },
    { path: '/profile', icon: '👤', label: 'Profile' },
    { path: '/billings', icon: '💳', label: 'Billings' },
  ]

  // Determine which nav items to show based on user role
  const isAdmin = user?.role === 'admin'
  const navItems = isAdmin ? adminNavItems : userNavItems

  return (
    <div className="w-64 bg-white min-h-screen flex flex-col border-r border-gray-200">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🤖</span>
          <h1 className="text-xl font-black">
            <span className="text-gray-900">Pening</span>
            <span className="text-primary-600">Bot</span>
          </h1>
        </div>
        <p className="text-xs text-gray-500 mt-1">Navigation</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {/* Show subscription warning only for non-admin users */}
        {!isAdmin && isExpired && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-700 font-semibold">⚠️ Subscription Expired</p>
            <p className="text-xs text-red-600 mt-1">Please renew to access all features</p>
          </div>
        )}

        {navItems.map((item) => {
          // Admins are never disabled
          const isDisabled = !isAdmin && isExpired && item.path !== '/billings'

          return isDisabled ? (
            <div
              key={item.path}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-100 opacity-50 cursor-not-allowed"
              title="Subscription expired - Please renew to access this feature"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium text-sm text-gray-500">{item.label}</span>
              <span className="ml-auto text-xs">🔒</span>
            </div>
          ) : (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-200">
        <div className="mb-3 bg-primary-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <p className="text-sm text-gray-900 font-semibold">{user?.full_name || user?.email?.split('@')[0]}</p>
          </div>
          <p className="text-xs text-gray-600 truncate ml-10">{user?.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}
