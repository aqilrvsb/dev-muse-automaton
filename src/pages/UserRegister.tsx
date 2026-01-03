import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase, User, Package } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

// WhatsApp Center API config
const WHACENTER_API_URL = 'https://api.whacenter.com'
const WHACENTER_API_KEY = 'd44ac50f-0bd8-4ed0-b85f-55465e08d7cf'
const WEBHOOK_BASE_URL = 'https://pening-bot.deno.dev'

interface DeviceSetting {
  id: string
  device_id: string
  instance: string | null
  phone_number: string | null
  status: string
  user_id: string
}

export default function UserRegister() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loggingIn, setLoggingIn] = useState<string | null>(null)

  // Device modal state
  const [deviceModalOpen, setDeviceModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userDevices, setUserDevices] = useState<DeviceSetting[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [savingDevice, setSavingDevice] = useState<string | null>(null)
  const [editedInstances, setEditedInstances] = useState<Record<string, string>>({})

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
    loadPackages()
  }, [user, navigate])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('user')
        .select('*, packages(name)')
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

  const loadPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true })

      if (error) throw error
      setPackages(data || [])
    } catch (error) {
      console.error('Error loading packages:', error)
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

  const handlePackageChange = async (userId: string, packageId: string) => {
    try {
      const selectedPackage = packages.find(p => p.id === packageId)

      // Calculate new subscription end date based on package duration
      const subscriptionEnd = selectedPackage
        ? new Date(Date.now() + selectedPackage.duration_days * 24 * 60 * 60 * 1000).toISOString()
        : null

      const { error } = await supabase
        .from('user')
        .update({
          package_id: packageId || null,
          subscription_start: packageId ? new Date().toISOString() : null,
          subscription_end: subscriptionEnd,
          max_devices: selectedPackage?.max_devices || 1,
          status: packageId ? selectedPackage?.name : 'Trial'
        })
        .eq('id', userId)

      if (error) throw error

      await Swal.fire({
        icon: 'success',
        title: 'Package Updated',
        text: `User package changed to ${selectedPackage?.name || 'Trial'}`,
        timer: 1500,
        showConfirmButton: false
      })
      loadUsers()
    } catch (error) {
      console.error('Error updating package:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: 'Failed to update user package',
      })
    }
  }

  const editUser = async (targetUser: User) => {
    const { value: formValues } = await Swal.fire({
      title: 'Edit User',
      html: `
        <div style="text-align: left;">
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Phone</label>
            <input id="swal-phone" class="swal2-input" style="width: 100%; margin: 0;" placeholder="Phone number" value="${targetUser.phone || ''}">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Password</label>
            <input id="swal-password" class="swal2-input" style="width: 100%; margin: 0;" placeholder="New password" value="${targetUser.password || ''}">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Subscription End</label>
            <input id="swal-subend" type="date" class="swal2-input" style="width: 100%; margin: 0;" value="${targetUser.subscription_end ? new Date(targetUser.subscription_end).toISOString().split('T')[0] : ''}">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Max Devices</label>
            <input id="swal-maxdevices" type="number" class="swal2-input" style="width: 100%; margin: 0;" placeholder="Max devices" value="${targetUser.max_devices || 1}">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Save',
      confirmButtonColor: '#667eea',
      cancelButtonColor: '#6c757d',
      preConfirm: () => {
        return {
          phone: (document.getElementById('swal-phone') as HTMLInputElement).value,
          password: (document.getElementById('swal-password') as HTMLInputElement).value,
          subscription_end: (document.getElementById('swal-subend') as HTMLInputElement).value,
          max_devices: parseInt((document.getElementById('swal-maxdevices') as HTMLInputElement).value) || 1
        }
      }
    })

    if (formValues) {
      try {
        const updateData: Record<string, unknown> = {
          phone: formValues.phone || null,
          password: formValues.password || null,
          max_devices: formValues.max_devices,
          updated_at: new Date().toISOString()
        }

        if (formValues.subscription_end) {
          updateData.subscription_end = new Date(formValues.subscription_end).toISOString()
        }

        const { error } = await supabase
          .from('user')
          .update(updateData)
          .eq('id', targetUser.id)

        if (error) throw error

        await Swal.fire({
          icon: 'success',
          title: 'User Updated',
          text: 'User details have been updated successfully',
          timer: 1500,
          showConfirmButton: false
        })
        loadUsers()
      } catch (error) {
        console.error('Error updating user:', error)
        await Swal.fire({
          icon: 'error',
          title: 'Update Failed',
          text: 'Failed to update user details',
        })
      }
    }
  }

  const loginAsUser = async (targetUser: User) => {
    setLoggingIn(targetUser.id)

    try {
      // Call edge function to get session tokens
      const { data, error } = await supabase.functions.invoke('admin-login-as-user', {
        body: { userId: targetUser.id }
      })

      if (error) throw error

      if (data?.session) {
        // Sign out current admin first
        await supabase.auth.signOut()

        // Set the new session directly
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        })

        // Redirect to dashboard
        window.location.href = '/dashboard'
      } else {
        throw new Error('No session received')
      }
    } catch (error) {
      console.error('Error logging in as user:', error)
      setLoggingIn(null)
      await Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: 'Failed to login as user.',
      })
    }
  }

  const deleteUser = async (targetUser: User) => {
    // Check if admin user is loaded
    if (!user?.id) {
      await Swal.fire({
        title: 'Error!',
        text: 'Admin session not loaded. Please refresh the page.',
        icon: 'error',
        confirmButtonColor: '#d33',
      })
      return
    }

    const result = await Swal.fire({
      title: 'Delete User?',
      html: `
        <p>Are you sure you want to delete this user?</p>
        <p class="text-sm text-gray-500 mt-2"><strong>${targetUser.full_name || targetUser.email}</strong></p>
        <p class="text-xs text-red-500 mt-2">This will also delete all their devices, prompts, and conversations!</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    })

    if (!result.isConfirmed) return

    try {
      // Use edge function to delete user (bypasses RLS)
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: targetUser.id, adminId: user.id }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      await Swal.fire({
        title: 'Deleted!',
        text: 'User has been deleted successfully',
        icon: 'success',
        confirmButtonColor: '#667eea',
      })
      loadUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      await Swal.fire({
        title: 'Error!',
        text: error?.message || 'Failed to delete user.',
        icon: 'error',
        confirmButtonColor: '#d33',
      })
    }
  }

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

  // Open device modal and load user's devices
  const openDeviceModal = async (targetUser: User) => {
    setSelectedUser(targetUser)
    setDeviceModalOpen(true)
    setLoadingDevices(true)
    setEditedInstances({})

    try {
      const { data, error } = await supabase
        .from('device_setting')
        .select('id, device_id, instance, phone_number, status, user_id')
        .eq('user_id', targetUser.id)
        .order('created_at', { ascending: true })

      if (error) throw error

      setUserDevices(data || [])

      // Initialize edited instances with current values
      const instances: Record<string, string> = {}
      data?.forEach(d => {
        instances[d.id] = d.instance || ''
      })
      setEditedInstances(instances)
    } catch (error) {
      console.error('Error loading devices:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to load user devices',
      })
    } finally {
      setLoadingDevices(false)
    }
  }

  // Close device modal
  const closeDeviceModal = () => {
    setDeviceModalOpen(false)
    setSelectedUser(null)
    setUserDevices([])
    setEditedInstances({})
  }

  // Save device instance and register webhook
  const saveDeviceInstance = async (device: DeviceSetting) => {
    const newInstance = editedInstances[device.id]?.trim()

    if (!newInstance) {
      await Swal.fire({
        icon: 'warning',
        title: 'Instance Required',
        text: 'Please enter an instance ID',
      })
      return
    }

    setSavingDevice(device.id)

    try {
      // Step 1: Update instance in database
      const { error: updateError } = await supabase
        .from('device_setting')
        .update({
          instance: newInstance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', device.id)

      if (updateError) throw updateError

      // Step 2: Register new webhook with WhatsApp Center API
      const webhookUrl = `${WEBHOOK_BASE_URL}/${device.device_id}/${newInstance}`

      const registerResponse = await fetch(
        `${WHACENTER_API_URL}/api/${WHACENTER_API_KEY}/setWebhook/${newInstance}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl }),
        }
      )

      const registerData = await registerResponse.json()
      console.log('Webhook registration response:', registerData)

      // Step 3: Check device status
      const statusResponse = await fetch(
        `${WHACENTER_API_URL}/api/${WHACENTER_API_KEY}/statusDevice/${newInstance}`,
        { method: 'GET' }
      )
      const statusData = await statusResponse.json()

      // Update status in database
      const newStatus = statusData.status && statusData.data?.status === 'CONNECTED' ? 'CONNECTED' : 'NOT_CONNECTED'
      await supabase
        .from('device_setting')
        .update({ status: newStatus })
        .eq('id', device.id)

      // Refresh device list
      const { data: refreshedDevices } = await supabase
        .from('device_setting')
        .select('id, device_id, instance, phone_number, status, user_id')
        .eq('user_id', selectedUser?.id)
        .order('created_at', { ascending: true })

      setUserDevices(refreshedDevices || [])

      await Swal.fire({
        icon: 'success',
        title: 'Device Updated',
        html: `
          <p>Instance: <strong>${newInstance}</strong></p>
          <p>Webhook: <strong>${webhookUrl}</strong></p>
          <p>Status: <strong>${newStatus}</strong></p>
        `,
        timer: 3000,
        showConfirmButton: true,
      })
    } catch (error) {
      console.error('Error saving device:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: 'Failed to save device instance',
      })
    } finally {
      setSavingDevice(null)
    }
  }

  const viewUserDetails = (targetUser: User) => {
    Swal.fire({
      title: 'User Details',
      html: `
        <div style="text-align: left; font-family: monospace; font-size: 14px;">
          <p><strong>ID:</strong> ${targetUser.id}</p>
          <p><strong>Full Name:</strong> ${targetUser.full_name || '-'}</p>
          <p><strong>Email:</strong> ${targetUser.email}</p>
          <p><strong>Phone:</strong> ${targetUser.phone || '-'}</p>
          <p><strong>Password:</strong> ${targetUser.password || '-'}</p>
          <p><strong>Status:</strong> ${targetUser.status || '-'}</p>
          <p><strong>Active:</strong> ${targetUser.is_active ? 'Yes' : 'No'}</p>
          <p><strong>Role:</strong> ${targetUser.role || 'user'}</p>
          <p><strong>Package:</strong> ${targetUser.packages?.name || 'Trial'}</p>
          <p><strong>Subscription Status:</strong> ${targetUser.subscription_status || '-'}</p>
          <p><strong>Subscription Start:</strong> ${targetUser.subscription_start ? new Date(targetUser.subscription_start).toLocaleDateString() : '-'}</p>
          <p><strong>Subscription End:</strong> ${targetUser.subscription_end ? new Date(targetUser.subscription_end).toLocaleDateString() : '-'}</p>
          <p><strong>Max Devices:</strong> ${targetUser.max_devices}</p>
          <p><strong>Created At:</strong> ${new Date(targetUser.created_at).toLocaleString()}</p>
          <p><strong>Updated At:</strong> ${new Date(targetUser.updated_at).toLocaleString()}</p>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Full Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Password</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Package</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Sub End</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Active</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Max Dev</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((u, index) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-bold text-gray-900">{index + 1}</td>
                      <td className="px-4 py-4 text-sm text-gray-900">{u.full_name || '-'}</td>
                      <td className="px-4 py-4 text-sm">
                        <button
                          onClick={() => loginAsUser(u)}
                          className={`text-primary-600 hover:text-primary-800 hover:underline font-medium cursor-pointer ${loggingIn === u.id ? 'opacity-50' : ''}`}
                          title="Click to login as this user"
                          disabled={loggingIn === u.id}
                        >
                          {loggingIn === u.id ? 'Logging in...' : u.email}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{u.phone || '-'}</td>
                      <td className="px-4 py-4 text-sm text-gray-600 font-mono">{u.password || '-'}</td>
                      <td className="px-4 py-4 text-sm">
                        <select
                          value={u.package_id || ''}
                          onChange={(e) => handlePackageChange(u.id, e.target.value)}
                          className={`px-2 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                            u.packages?.name === 'Pro' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                            u.packages?.name === 'Starter' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                            'bg-gray-100 text-gray-800 border-gray-200'
                          }`}
                        >
                          <option value="">Trial</option>
                          {packages.map(pkg => (
                            <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {u.subscription_end ? new Date(u.subscription_end).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <button
                          onClick={() => openDeviceModal(u)}
                          className="text-primary-600 hover:text-primary-800 hover:underline font-semibold cursor-pointer"
                          title="Click to manage devices"
                        >
                          {u.max_devices}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => viewUserDetails(u)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                            title="View Details"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => editUser(u)}
                            className="text-yellow-600 hover:text-yellow-800 font-medium"
                            title="Edit User"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => toggleUserStatus(u.id, u.is_active)}
                            className={`${u.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'} font-medium`}
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {u.is_active ? '🔒' : '🔓'}
                          </button>
                          <button
                            onClick={() => deleteUser(u)}
                            className="text-red-600 hover:text-red-800 font-medium"
                            title="Delete User"
                          >
                            🗑️
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

      {/* Device Management Modal */}
      {deviceModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-primary-600 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Device Management</h3>
                <p className="text-sm text-primary-100">{selectedUser?.full_name || selectedUser?.email}</p>
              </div>
              <button
                onClick={closeDeviceModal}
                className="text-white hover:text-primary-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingDevices ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : userDevices.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No devices found for this user</p>
                  <p className="text-sm text-gray-400 mt-2">User needs to create a device in Device Settings first</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userDevices.map((device, index) => (
                    <div key={device.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            Device {index + 1}: {device.device_id}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Phone: {device.phone_number || '-'}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          device.status === 'CONNECTED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {device.status || 'UNKNOWN'}
                        </span>
                      </div>

                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Instance ID
                          </label>
                          <input
                            type="text"
                            value={editedInstances[device.id] || ''}
                            onChange={(e) => setEditedInstances({
                              ...editedInstances,
                              [device.id]: e.target.value
                            })}
                            placeholder="Enter instance ID from WhatsApp Center"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <button
                          onClick={() => saveDeviceInstance(device)}
                          disabled={savingDevice === device.id}
                          className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                            savingDevice === device.id
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-primary-600 hover:bg-primary-700'
                          }`}
                        >
                          {savingDevice === device.id ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Saving...
                            </span>
                          ) : (
                            'Save'
                          )}
                        </button>
                      </div>

                      {device.instance && (
                        <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                          <p><strong>Webhook URL:</strong></p>
                          <code className="text-primary-600 break-all">
                            {WEBHOOK_BASE_URL}/{device.device_id}/{device.instance}
                          </code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  Max Devices: <span className="font-semibold">{selectedUser?.max_devices}</span> |
                  Used: <span className="font-semibold">{userDevices.length}</span>
                </p>
                <button
                  onClick={closeDeviceModal}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
