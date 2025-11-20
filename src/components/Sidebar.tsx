import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Sidebar() {
  const location = useLocation()
  const { user, signOut } = useAuth()

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/device-settings', icon: '⚙️', label: 'Device Settings' },
    { path: '/prompts', icon: '📝', label: 'Prompts' },
    { path: '/chatbot-ai', icon: '🤖', label: 'Chatbot AI' },
    { path: '/sequences', icon: '📨', label: 'Sequences' },
    { path: '/bank-image', icon: '🏦', label: 'Bank Image' },
    { path: '/profile', icon: '👤', label: 'Profile' },
    { path: '/billings', icon: '💳', label: 'Billings' },
  ]

  // Show packages tab for admin
  const showPackages = user?.role === 'admin'

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
        {navItems.map((item) => (
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
        ))}

        {showPackages && (
          <>
            <Link
              to="/packages"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive('/packages')
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">📦</span>
              <span className="font-medium text-sm">Packages</span>
            </Link>
            <Link
              to="/transactions"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive('/transactions')
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">💰</span>
              <span className="font-medium text-sm">Transactions</span>
            </Link>
            <Link
              to="/user-register"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive('/user-register')
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">👥</span>
              <span className="font-medium text-sm">User Register</span>
            </Link>
          </>
        )}
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
