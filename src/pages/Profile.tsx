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
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Profile Settings</h2>
          <p className="text-gray-600">Manage your account information</p>
        </div>

        {message.text && (
          <div className={`mb-6 px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 border border-green-300 text-green-700'
              : 'bg-red-100 border border-red-300 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Profile Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Personal Information</h3>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Edit Profile
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Full Name</label>
              {editing ? (
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              ) : (
                <p className="text-gray-900">{user?.full_name || 'Not set'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Email Address</label>
              <p className="text-gray-900">{user?.email}</p>
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Phone Number</label>
              {editing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="+60123456789"
                />
              ) : (
                <p className="text-gray-900">{user?.phone || 'Not set'}</p>
              )}
            </div>
          </div>

          {editing && (
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSave}
                disabled={loading}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
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
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Account Details */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Account Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Account Status</label>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                user?.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {user?.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Subscription Status</label>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                user?.subscription_status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {user?.subscription_status || 'None'}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Max Devices</label>
              <p className="text-gray-900">{user?.max_devices || 0}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Member Since</label>
              <p className="text-gray-900">{formatDate(user?.created_at)}</p>
            </div>

            {user?.subscription_end && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Subscription Expires</label>
                <p className="text-gray-900">{formatDate(user.subscription_end)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone - Hidden */}
        {/* <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-xl font-bold text-red-600 mb-4">Danger Zone</h3>
          <p className="text-gray-600 mb-4">
            Delete your account and all associated data. This action cannot be undone.
          </p>
          <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors">
            Delete Account
          </button>
        </div> */}
      </div>
    </Layout>
  )
}
