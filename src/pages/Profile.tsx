import { useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
  })

  const handleSave = async () => {
    if (!user?.id) return

    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const { error } = await supabase
        .from('user')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshUser()
      setEditing(false)
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <Layout>
      <div className="p-8 max-w-4xl animate-fade-in-up">
        <div className="mb-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Profile Settings</h2>
          <p className="text-gray-600 font-medium">Manage your account information</p>
        </div>

        {message.text && (
          <div className={`mb-6 px-4 py-3 rounded-xl font-medium ${
            message.type === 'success'
              ? 'bg-green-100 border-2 border-green-300 text-green-700'
              : 'bg-red-100 border-2 border-red-300 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Profile Info */}
        <div className="card-soft card-hover rounded-xl p-6 mb-6 transition-smooth">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Personal Information</h3>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-2 rounded-xl transition-smooth font-semibold"
              >
                Edit Profile
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">Full Name</label>
              {editing ? (
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth"
                />
              ) : (
                <p className="text-gray-900 font-medium">{user?.full_name || 'Not set'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">Email Address</label>
              <p className="text-gray-900 font-medium">{user?.email}</p>
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">Phone Number</label>
              {editing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth"
                  placeholder="+60123456789"
                />
              ) : (
                <p className="text-gray-900 font-medium">{user?.phone || 'Not set'}</p>
              )}
            </div>
          </div>

          {editing && (
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSave}
                disabled={loading}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-2 rounded-xl transition-smooth disabled:opacity-50 font-semibold"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setFormData({
                    full_name: user?.full_name || '',
                    phone: user?.phone || '',
                  })
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-xl transition-smooth font-semibold"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Account Details */}
        <div className="card-soft card-hover rounded-xl p-6 mb-6 transition-smooth">
          <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-6">Account Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">Account Status</label>
              <span className={`inline-block px-3 py-1 rounded-xl text-sm font-semibold ${
                user?.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {user?.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">Subscription Status</label>
              <span className={`inline-block px-3 py-1 rounded-xl text-sm font-semibold ${
                user?.subscription_status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {user?.subscription_status || 'None'}
              </span>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">Max Devices</label>
              <p className="text-gray-900 font-medium">{user?.max_devices || 1}</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">Member Since</label>
              <p className="text-gray-900 font-medium">{formatDate(user?.created_at)}</p>
            </div>

            {user?.subscription_end && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Subscription Expires</label>
                <p className="text-gray-900 font-medium">{formatDate(user.subscription_end)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 card-soft">
          <h3 className="text-xl font-bold text-red-600 mb-4">Danger Zone</h3>
          <p className="text-gray-600 mb-4 font-medium">
            Delete your account and all associated data. This action cannot be undone.
          </p>
          <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl transition-smooth font-semibold">
            Delete Account
          </button>
        </div>
      </div>
    </Layout>
  )
}
