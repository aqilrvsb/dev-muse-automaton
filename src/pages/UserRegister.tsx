import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase, User } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

export default function UserRegister() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    // Check if user is admin
    if (user && user.role !== 'admin') {
      Swal.fire({
        icon: 'error',
        title: 'Access Denied!',
        text: 'Only administrators can access the User Register page',
      }).then(() => {
        navigate('/dashboard')
      })
      return
    }
    loadUsers()
  }, [user, navigate])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('user')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Filter out admin users on client side (handles both role='admin' and null cases)
      const filteredData = (data || []).filter(u => u.role !== 'admin')
      setUsers(filteredData)
    } catch (error) {
      console.error('Error loading users:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Load Failed',
        text: 'Failed to load users',
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(u => {
    // Search filter
    const matchesSearch = searchQuery === '' ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone?.toLowerCase().includes(searchQuery.toLowerCase())

    // Status filter
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'inactive' && !u.is_active)

    return matchesSearch && matchesStatus
  })

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: currentStatus ? '#d33' : '#10b981',
      cancelButtonColor: '#6c757d',
      confirmButtonText: `Yes, ${currentStatus ? 'deactivate' : 'activate'} it!`,
      cancelButtonText: 'Cancel'
    })

    if (!result.isConfirmed) return

    try {
      const { error } = await supabase
        .from('user')
        .update({ is_active: !currentStatus })
        .eq('id', userId)

      if (error) throw error

      await Swal.fire({
        title: 'Success!',
        text: `User ${currentStatus ? 'deactivated' : 'activated'} successfully`,
        icon: 'success',
        confirmButtonColor: '#667eea',
      })
      loadUsers()
    } catch (error) {
      console.error('Error updating user status:', error)
      await Swal.fire({
        title: 'Error!',
        text: 'Failed to update user status',
        icon: 'error',
        confirmButtonColor: '#d33',
      })
    }
  }

  const viewUserDetails = (user: User) => {
    Swal.fire({
      title: 'User Details',
      html: `
        <div style="text-align: left; font-family: monospace; font-size: 14px;">
          <p><strong>ID:</strong> ${user.id}</p>
          <p><strong>Full Name:</strong> ${user.full_name || '-'}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Phone:</strong> ${user.phone || '-'}</p>
          <p><strong>Status:</strong> ${user.status || '-'}</p>
          <p><strong>Active:</strong> ${user.is_active ? 'Yes' : 'No'}</p>
          <p><strong>Role:</strong> ${user.role || 'user'}</p>
          <p><strong>Package ID:</strong> ${user.package_id || '-'}</p>
          <p><strong>Subscription Status:</strong> ${user.subscription_status || '-'}</p>
          <p><strong>Subscription Start:</strong> ${user.subscription_start ? new Date(user.subscription_start).toLocaleDateString() : '-'}</p>
          <p><strong>Subscription End:</strong> ${user.subscription_end ? new Date(user.subscription_end).toLocaleDateString() : '-'}</p>
          <p><strong>Max Devices:</strong> ${user.max_devices}</p>
          <p><strong>Expired:</strong> ${user.expired || '-'}</p>
          <p><strong>Created At:</strong> ${new Date(user.created_at).toLocaleString()}</p>
          <p><strong>Updated At:</strong> ${new Date(user.updated_at).toLocaleString()}</p>
        </div>
      `,
      width: '600px',
      confirmButtonText: 'OK',
      confirmButtonColor: '#667eea',
    })
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-primary-600 mb-2">User Register</h2>
          <p className="text-gray-600">Manage all registered users in the system</p>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or phone..."
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-gray-600 text-sm font-medium mb-2">Total Users</h3>
            <p className="text-3xl font-bold text-gray-900">{users.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-gray-600 text-sm font-medium mb-2">Active Users</h3>
            <p className="text-3xl font-bold text-green-600">{users.filter(u => u.is_active).length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-gray-600 text-sm font-medium mb-2">Inactive Users</h3>
            <p className="text-3xl font-bold text-red-600">{users.filter(u => !u.is_active).length}</p>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <p className="text-gray-400 text-lg">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Full Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Active</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Max Devices</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((u, index) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{u.full_name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{u.phone || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.status === 'Premium' ? 'bg-purple-100 text-purple-800' :
                          u.status === 'Trial' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {u.status || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{u.max_devices}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => viewUserDetails(u)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                            title="View Details"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => toggleUserStatus(u.id, u.is_active)}
                            className={`${u.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'} font-medium`}
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {u.is_active ? '🔒' : '🔓'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
