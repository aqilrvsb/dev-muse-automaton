import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase, Device } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

export default function DeviceSettings() {
  const { user } = useAuth()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    device_id: '',
    instance: '',
    webhook_id: '',
    provider: 'waha' as 'waha' | 'wablas' | 'whacenter',
    api_key_option: 'openai/gpt-4.1',
    api_key: '',
    phone_number: '',
  })

  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('device_setting')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDevices(data || [])
    } catch (error) {
      console.error('Error loading devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) {
      await Swal.fire({
        icon: 'error',
        title: 'Not Logged In',
        text: 'User not logged in',
      })
      return
    }

    try {
      // Check device limit before adding
      const { data: existingDevices, error: countError } = await supabase
        .from('device_setting')
        .select('id')
        .eq('user_id', user.id)

      if (countError) throw countError

      const currentDeviceCount = existingDevices?.length || 0
      const maxDevices = user?.max_devices || 1

      if (currentDeviceCount >= maxDevices) {
        await Swal.fire({
          icon: 'warning',
          title: 'Device Limit Reached!',
          html: `Your current plan allows <strong>${maxDevices} device(s)</strong> and you already have <strong>${currentDeviceCount} device(s)</strong>.<br><br>Please upgrade your plan to add more devices.`,
          confirmButtonText: 'OK',
        })
        return
      }

      const { error } = await supabase.from('device_setting').insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        ...formData,
      })

      if (error) throw error

      // Reset form and close modal
      setFormData({
        device_id: '',
        instance: '',
        webhook_id: '',
        provider: 'waha',
        api_key_option: 'openai/gpt-4.1',
        api_key: '',
        phone_number: '',
      })
      setShowAddModal(false)

      await Swal.fire({
        icon: 'success',
        title: 'Device Added!',
        text: 'Your device has been added successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadDevices()
    } catch (error: any) {
      console.error('Error adding device:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Add Device',
        text: error.message || 'Failed to add device',
      })
    }
  }

  const handleDeleteDevice = async (id: string) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Device?',
      text: 'Are you sure you want to delete this device?',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    })

    if (!result.isConfirmed) return

    try {
      const { error } = await supabase.from('device_setting').delete().eq('id', id)

      if (error) throw error

      await Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Device has been deleted successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadDevices()
    } catch (error: any) {
      console.error('Error deleting device:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Delete',
        text: error.message || 'Failed to delete device',
      })
    }
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Device Settings</h2>
            <p className="text-gray-600">Manage your WhatsApp devices and configurations</p>
            {!loading && (
              <div className="mt-2 inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1 rounded-lg text-sm font-medium">
                <span>📱</span>
                <span>Devices: {devices.length}/{user?.max_devices || 1}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
          >
            + Add New Device
          </button>
        </div>

        {/* Devices List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-600 text-lg">No devices configured yet</p>
            <p className="text-gray-500 mt-2">Click "Add New Device" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <div key={device.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{device.device_id}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    device.provider === 'waha' ? 'bg-blue-100 text-blue-700' :
                    device.provider === 'wablas' ? 'bg-purple-100 text-purple-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {device.provider.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <p className="text-gray-600 text-sm">Instance</p>
                    <p className="text-gray-900 font-medium">{device.instance || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Phone Number</p>
                    <p className="text-gray-900 font-medium">{device.phone_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">AI Model</p>
                    <p className="text-gray-900 font-medium">{device.api_key_option}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteDevice(device.id)}
                  className="w-full bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Delete Device
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Device Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Add New Device</h3>

              <form onSubmit={handleAddDevice} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Device ID *</label>
                    <input
                      type="text"
                      value={formData.device_id}
                      onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Instance</label>
                    <input
                      type="text"
                      value={formData.instance}
                      onChange={(e) => setFormData({ ...formData, instance: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Webhook ID</label>
                    <input
                      type="text"
                      value={formData.webhook_id}
                      onChange={(e) => setFormData({ ...formData, webhook_id: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Provider *</label>
                    <select
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="waha">WAHA</option>
                      <option value="wablas">Wablas</option>
                      <option value="whacenter">WhaCenter</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">AI Model</label>
                    <select
                      value={formData.api_key_option}
                      onChange={(e) => setFormData({ ...formData, api_key_option: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="openai/gpt-5-chat">GPT-5 Chat</option>
                      <option value="openai/gpt-5-mini">GPT-5 Mini</option>
                      <option value="openai/chatgpt-4o-latest">GPT-4o Latest</option>
                      <option value="openai/gpt-4.1">GPT-4.1</option>
                      <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                      <option value="google/gemini-pro-1.5">Gemini Pro 1.5</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                    <input
                      type="text"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">API Key (OpenRouter)</label>
                  <textarea
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={3}
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Add Device
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
