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
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrCode, setQrCode] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<string>('')
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null)
  const [isCheckingDeviceId, setIsCheckingDeviceId] = useState(false)
  const [deviceIdExists, setDeviceIdExists] = useState(false)
  const [deviceIdError, setDeviceIdError] = useState('')

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

  const checkDeviceIdExists = async (deviceId: string) => {
    if (!deviceId.trim()) {
      setDeviceIdExists(false)
      setDeviceIdError('')
      return
    }

    setIsCheckingDeviceId(true)
    setDeviceIdError('')

    try {
      const { data, error } = await supabase
        .from('device_setting')
        .select('device_id')
        .eq('device_id', deviceId.trim())
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means no rows returned (device ID is available)
        throw error
      }

      if (data) {
        setDeviceIdExists(true)
        setDeviceIdError('This Device ID is already in use. Please choose a different one.')
      } else {
        setDeviceIdExists(false)
        setDeviceIdError('')
      }
    } catch (error: any) {
      console.error('Error checking device ID:', error)
      setDeviceIdExists(false)
      setDeviceIdError('')
    } finally {
      setIsCheckingDeviceId(false)
    }
  }

  const handleDeviceIdChange = (value: string) => {
    setFormData({ ...formData, device_id: value })
    // Debounce the check
    const timer = setTimeout(() => {
      checkDeviceIdExists(value)
    }, 500)
    return () => clearTimeout(timer)
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

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device)
    setFormData({
      device_id: device.device_id,
      instance: device.instance || '',
      webhook_id: device.webhook_id || '',
      provider: device.provider as any,
      api_key_option: device.api_key_option || 'openai/gpt-4.1',
      api_key: device.api_key || '',
      phone_number: device.phone_number || '',
    })
    setShowEditModal(true)
  }

  const handleUpdateDevice = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingDevice) return

    try {
      const { error } = await supabase
        .from('device_setting')
        .update({
          instance: formData.instance,
          webhook_id: formData.webhook_id,
          provider: formData.provider,
          api_key_option: formData.api_key_option,
          api_key: formData.api_key,
          phone_number: formData.phone_number,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingDevice.id)

      if (error) throw error

      setShowEditModal(false)
      setEditingDevice(null)
      setFormData({
        device_id: '',
        instance: '',
        webhook_id: '',
        provider: 'waha',
        api_key_option: 'openai/gpt-4.1',
        api_key: '',
        phone_number: '',
      })

      await Swal.fire({
        icon: 'success',
        title: 'Device Updated!',
        text: 'Your device has been updated successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadDevices()
    } catch (error: any) {
      console.error('Error updating device:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Update Device',
        text: error.message || 'Failed to update device',
      })
    }
  }

  const handleGenerateWebhook = async (device: Device) => {
    try {
      const apiBase = 'https://waha-plus-production-705f.up.railway.app'
      const apiKey = 'dckr_pat_vxeqEu_CqRi5O3CBHnD7FxhnBz0'
      const sessionName = `UserChatBot_${device.device_id}`
      const webhook = `https://pening-bot.deno.dev/${device.device_id}/${sessionName}`

      // Delete old session if exists
      if (device.instance) {
        await fetch(`${apiBase}/api/sessions/${device.instance}`, {
          method: 'DELETE',
          headers: {
            'X-Api-Key': apiKey,
          },
        })
      }

      // Create new session
      const createResponse = await fetch(`${apiBase}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({
          name: sessionName,
          start: false,
          config: {
            debug: false,
            markSeen: false,
            noweb: {
              store: {
                enabled: true,
                fullSync: false,
              },
            },
            webhooks: [
              {
                url: webhook,
                events: ['message'],
                retries: {
                  attempts: 1,
                  delay: 3,
                  policy: 'constant',
                },
              },
            ],
          },
        }),
      })

      const createData = await createResponse.json()

      if (createData.name) {
        // Start session
        await fetch(`${apiBase}/api/sessions/${sessionName}/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
          },
        })

        // Update device in database
        const { error } = await supabase
          .from('device_setting')
          .update({
            instance: createData.name,
            webhook_id: webhook,
            updated_at: new Date().toISOString(),
          })
          .eq('id', device.id)

        if (error) throw error

        await Swal.fire({
          icon: 'success',
          title: 'Webhook Generated!',
          text: 'Session created successfully. You can now check status to scan QR code.',
          timer: 3000,
          showConfirmButton: false,
        })

        loadDevices()
      } else {
        throw new Error(createData.error || 'Failed to create session')
      }
    } catch (error: any) {
      console.error('Error generating webhook:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Generate Webhook',
        text: error.message || 'Failed to generate webhook',
      })
    }
  }

  const handleCheckStatus = async (device: Device) => {
    if (!device.instance) {
      await Swal.fire({
        icon: 'warning',
        title: 'No Instance',
        text: 'Please generate webhook first',
      })
      return
    }

    try {
      const apiBase = 'https://waha-plus-production-705f.up.railway.app'
      const apiKey = 'dckr_pat_vxeqEu_CqRi5O3CBHnD7FxhnBz0'

      const response = await fetch(`${apiBase}/api/sessions/${device.instance}`, {
        headers: {
          'X-Api-Key': apiKey,
        },
      })

      const data = await response.json()

      setCurrentDevice(device)

      if (data.status === 'SCAN_QR_CODE') {
        // Get QR code - WAHA returns PNG image directly, not JSON
        const qrResponse = await fetch(`${apiBase}/api/${device.instance}/auth/qr`, {
          headers: {
            'X-Api-Key': apiKey,
          },
        })

        // Check if response is an image
        const contentType = qrResponse.headers.get('content-type')

        if (contentType && contentType.includes('image')) {
          // Convert image to blob and create object URL
          const blob = await qrResponse.blob()
          const imageUrl = URL.createObjectURL(blob)

          setQrCode(imageUrl)
          setConnectionStatus('SCAN_QR_CODE')
          setShowQRModal(true)
        } else {
          // Try parsing as JSON (fallback for other formats)
          const qrData = await qrResponse.json()
          if (qrData.qr) {
            setQrCode(qrData.qr)
            setConnectionStatus('SCAN_QR_CODE')
            setShowQRModal(true)
          }
        }
      } else if (data.status === 'WORKING') {
        setConnectionStatus('WORKING')
        setQrCode('')
        await Swal.fire({
          icon: 'success',
          title: 'Connected!',
          text: 'Your WhatsApp device is connected and working.',
          timer: 2000,
          showConfirmButton: false,
        })
      } else {
        setConnectionStatus(data.status || 'UNKNOWN')
        await Swal.fire({
          icon: 'info',
          title: 'Status',
          text: `Current status: ${data.status || 'Unknown'}`,
        })
      }
    } catch (error: any) {
      console.error('Error checking status:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Check Status',
        text: error.message || 'Failed to check status',
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
      <div className="p-8 animate-fade-in-up">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Device Settings</h2>
            <p className="text-gray-600 font-medium">Manage your WhatsApp devices and configurations</p>
            {!loading && (
              <div className="mt-2 inline-flex items-center gap-2 bg-gradient-subtle text-primary-700 px-3 py-1 rounded-xl text-sm font-semibold">
                <span>📱</span>
                <span>Devices: {devices.length}/{user?.max_devices || 1}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-smooth shadow-sm"
          >
            + Add New Device
          </button>
        </div>

        {/* Devices List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="card-soft rounded-xl p-12 text-center">
            <p className="text-gray-600 text-lg font-medium">No devices configured yet</p>
            <p className="text-gray-500 mt-2">Click "Add New Device" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <div key={device.id} className="card-soft card-hover rounded-xl p-6 transition-smooth">
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
                    <p className="text-gray-600 text-sm font-semibold">Instance</p>
                    <p className="text-gray-900 font-medium text-xs break-all">{device.instance || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm font-semibold">Phone Number</p>
                    <p className="text-gray-900 font-medium">{device.phone_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm font-semibold">AI Model</p>
                    <p className="text-gray-900 font-medium">{device.api_key_option}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleGenerateWebhook(device)}
                      className="bg-green-50 hover:bg-green-600 border border-green-200 hover:border-green-600 text-green-600 hover:text-white px-3 py-2 rounded-xl transition-smooth font-semibold text-sm"
                    >
                      Generate
                    </button>
                    <button
                      onClick={() => handleCheckStatus(device)}
                      className="bg-blue-50 hover:bg-blue-600 border border-blue-200 hover:border-blue-600 text-blue-600 hover:text-white px-3 py-2 rounded-xl transition-smooth font-semibold text-sm"
                    >
                      Status
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleEditDevice(device)}
                      className="bg-primary-50 hover:bg-primary-600 border border-primary-200 hover:border-primary-600 text-primary-600 hover:text-white px-3 py-2 rounded-xl transition-smooth font-semibold text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(device.id)}
                      className="bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white px-3 py-2 rounded-xl transition-smooth font-semibold text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Device Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl animate-fade-in-up">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-6">Add New Device</h3>

              <form onSubmit={handleAddDevice} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Device ID *</label>
                    <input
                      type="text"
                      value={formData.device_id}
                      onChange={(e) => handleDeviceIdChange(e.target.value)}
                      className={`w-full bg-white rounded-xl px-4 py-2 transition-smooth ${
                        deviceIdError
                          ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                          : 'border-2 border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500'
                      } text-gray-900 focus:outline-none`}
                      required
                    />
                    {isCheckingDeviceId && (
                      <p className="text-xs text-gray-500 mt-1">Checking availability...</p>
                    )}
                    {deviceIdError && (
                      <p className="text-xs text-red-600 mt-1">{deviceIdError}</p>
                    )}
                    {formData.device_id && !deviceIdError && !isCheckingDeviceId && (
                      <p className="text-xs text-green-600 mt-1">✓ Device ID is available</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Instance</label>
                    <input
                      type="text"
                      value={formData.instance}
                      onChange={(e) => setFormData({ ...formData, instance: e.target.value })}
                      className="w-full bg-gray-100 border-2 border-gray-200 text-gray-600 rounded-xl px-4 py-2 cursor-not-allowed"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Webhook ID</label>
                    <input
                      type="text"
                      value={formData.webhook_id}
                      onChange={(e) => setFormData({ ...formData, webhook_id: e.target.value })}
                      className="w-full bg-gray-100 border-2 border-gray-200 text-gray-600 rounded-xl px-4 py-2 cursor-not-allowed"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Provider *</label>
                    <select
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                      className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth"
                    >
                      <option value="waha">WAHA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">AI Model</label>
                    <select
                      value={formData.api_key_option}
                      onChange={(e) => setFormData({ ...formData, api_key_option: e.target.value })}
                      className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth"
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                    <input
                      type="text"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">API Key (OpenRouter)</label>
                  <textarea
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth"
                    rows={3}
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    disabled={deviceIdExists || isCheckingDeviceId || !formData.device_id}
                    className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-smooth ${
                      deviceIdExists || isCheckingDeviceId || !formData.device_id
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white'
                    }`}
                  >
                    Add Device
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setFormData({
                        device_id: '',
                        instance: '',
                        webhook_id: '',
                        provider: 'waha',
                        api_key_option: 'openai/gpt-4.1',
                        api_key: '',
                        phone_number: '',
                      })
                      setDeviceIdExists(false)
                      setDeviceIdError('')
                      setIsCheckingDeviceId(false)
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition-smooth"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Device Modal */}
        {showEditModal && editingDevice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl animate-fade-in-up">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-6">Edit Device</h3>

              <form onSubmit={handleUpdateDevice} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Device ID *</label>
                    <input
                      type="text"
                      value={formData.device_id}
                      className="w-full bg-gray-100 border-2 border-gray-200 text-gray-600 rounded-xl px-4 py-2 cursor-not-allowed"
                      readOnly
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Instance</label>
                    <input
                      type="text"
                      value={formData.instance}
                      className="w-full bg-gray-100 border-2 border-gray-200 text-gray-600 rounded-xl px-4 py-2 cursor-not-allowed"
                      readOnly
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Webhook ID</label>
                    <input
                      type="text"
                      value={formData.webhook_id}
                      className="w-full bg-gray-100 border-2 border-gray-200 text-gray-600 rounded-xl px-4 py-2 cursor-not-allowed"
                      readOnly
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Provider *</label>
                    <select
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                      className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth"
                    >
                      <option value="waha">WAHA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">AI Model</label>
                    <select
                      value={formData.api_key_option}
                      onChange={(e) => setFormData({ ...formData, api_key_option: e.target.value })}
                      className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth"
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                    <input
                      type="text"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">API Key (OpenRouter)</label>
                  <textarea
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth"
                    rows={3}
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-smooth"
                  >
                    Update Device
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingDevice(null)
                      setFormData({
                        device_id: '',
                        instance: '',
                        webhook_id: '',
                        provider: 'waha',
                        api_key_option: 'openai/gpt-4.1',
                        api_key: '',
                        phone_number: '',
                      })
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition-smooth"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QR Code Modal */}
        {showQRModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl animate-fade-in-up">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4 text-center">Scan QR Code</h3>

              <div className="mb-4">
                <p className="text-gray-600 text-center mb-2 font-medium">
                  Device: <span className="font-semibold text-gray-900">{currentDevice?.device_id}</span>
                </p>
                <div className={`px-4 py-2 rounded-xl text-center font-semibold ${
                  connectionStatus === 'SCAN_QR_CODE'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {connectionStatus === 'SCAN_QR_CODE' ? 'Waiting for Scan' : 'Connected'}
                </div>
              </div>

              {qrCode && (
                <div className="flex justify-center mb-4 bg-white p-4 rounded-xl border-2 border-gray-200">
                  <img
                    src={qrCode}
                    alt="QR Code"
                    className="w-64 h-64 object-contain"
                  />
                </div>
              )}

              <div className="bg-gradient-subtle border-2 border-blue-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong className="font-semibold">Instructions:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1 font-medium">
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap Menu or Settings → Linked Devices</li>
                    <li>Tap "Link a Device"</li>
                    <li>Point your phone at this screen to scan the QR code</li>
                  </ol>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleCheckStatus(currentDevice!)}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-smooth"
                >
                  Refresh Status
                </button>
                <button
                  onClick={() => {
                    setShowQRModal(false)
                    setQrCode('')
                    setConnectionStatus('')
                    setCurrentDevice(null)
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition-smooth"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
