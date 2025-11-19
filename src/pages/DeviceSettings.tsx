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
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, string>>({})
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    device_id: '',
    instance: '',
    webhook_id: '',
    provider: 'waha' as 'waha',
    api_key_option: 'openai/gpt-4.1',
    api_key: '',
    phone_number: '',
  })

  useEffect(() => {
    const initializePage = async () => {
      await loadDevices()
    }
    initializePage()
  }, [])

  const loadDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('device_setting')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDevices(data || [])

      // Fetch statuses immediately after loading devices
      if (data && data.length > 0) {
        await fetchAllDeviceStatusesWithData(data)
      }
    } catch (error) {
      console.error('Error loading devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllDeviceStatusesWithData = async (deviceList: Device[]) => {
    const apiBase = 'https://waha-plus-production-705f.up.railway.app'
    const apiKey = 'dckr_pat_vxeqEu_CqRi5O3CBHnD7FxhnBz0'

    const statuses: Record<string, string> = {}

    for (const device of deviceList) {
      if (device.instance) {
        try {
          const response = await fetch(`${apiBase}/api/sessions/${device.instance}`, {
            headers: { 'X-Api-Key': apiKey }
          })
          const data = await response.json()
          // Just set the status, don't auto-restart on page load
          statuses[device.id] = data.status || 'UNKNOWN'
        } catch (error) {
          statuses[device.id] = 'FAILED'
        }
      } else {
        statuses[device.id] = 'NOT_SETUP'
      }
    }

    setDeviceStatuses(statuses)
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

      // Show loading state
      setIsCheckingStatus(true)
      setLoadingMessage('Creating device...')

      const deviceId = crypto.randomUUID()
      const { error } = await supabase
        .from('device_setting')
        .insert({
          id: deviceId,
          user_id: user.id,
          ...formData,
        })

      if (error) throw error

      // Automatically generate webhook and register with WAHA
      setLoadingMessage('Generating webhook and registering with WAHA...')

      const apiBase = 'https://waha-plus-production-705f.up.railway.app'
      const apiKey = 'dckr_pat_vxeqEu_CqRi5O3CBHnD7FxhnBz0'
      const sessionName = `UserChatBot_${formData.device_id}`
      const webhook = `https://pening-bot.deno.dev/${formData.device_id}/${sessionName}`

      // Create new session with webhook
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
        // Update device with instance and webhook_id
        await supabase
          .from('device_setting')
          .update({
            instance: createData.name,
            webhook_id: webhook,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deviceId)

        setIsCheckingStatus(false)

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
          title: 'Device Created Successfully!',
          text: 'Device added and webhook registered with WAHA.',
          timer: 3000,
          showConfirmButton: false,
        })

        loadDevices()
      } else {
        throw new Error('Failed to create WAHA session')
      }
    } catch (error: any) {
      console.error('Error adding device:', error)
      setIsCheckingStatus(false)
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

        // Update device status to SCAN_QR_CODE
        setDeviceStatuses(prev => ({ ...prev, [device.id]: 'SCAN_QR_CODE' }))

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
    const apiBase = 'https://waha-plus-production-705f.up.railway.app'
    const apiKey = 'dckr_pat_vxeqEu_CqRi5O3CBHnD7FxhnBz0'

    setIsCheckingStatus(true)
    setLoadingMessage('Checking device status...')

    try {
      // If no instance, auto-generate webhook first
      if (!device.instance) {
        setLoadingMessage('Generating webhook...')
        await handleGenerateWebhook(device)
        // Reload devices to get updated instance
        await loadDevices()
        // Get the updated device
        const { data: updatedDevices } = await supabase
          .from('device_setting')
          .select('*')
          .eq('id', device.id)
          .single()

        if (updatedDevices && updatedDevices.instance) {
          device = updatedDevices
        } else {
          return
        }
      }

      const response = await fetch(`${apiBase}/api/sessions/${device.instance}`, {
        headers: {
          'X-Api-Key': apiKey,
        },
      })

      const data = await response.json()

      setCurrentDevice(device)

      // Check if status is FAILED first, before updating state
      if (data.status === 'FAILED' || data.status === 'STOPPED') {
        // Session failed or stopped - stop it first, then start fresh
        setLoadingMessage('Stopping session...')

        // Step 1: Stop the session first
        try {
          await fetch(`${apiBase}/api/sessions/${device.instance}/stop`, {
            method: 'POST',
            headers: {
              'X-Api-Key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: device.instance,
            }),
          })
        } catch (stopError) {
          console.log('Stop session error (may already be stopped):', stopError)
        }

        // Wait a moment after stopping
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Step 2: Start the session
        setLoadingMessage('Starting session...')
        const startResponse = await fetch(`${apiBase}/api/sessions/${device.instance}/start`, {
          method: 'POST',
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: device.instance,
          }),
        })

        if (!startResponse.ok) {
          const errorText = await startResponse.text()
          console.error('Session start failed:', errorText)
          throw new Error(`Failed to start session: ${errorText}`)
        }

        // Wait for session to initialize
        setLoadingMessage('Waiting for QR code...')
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Step 3: Get QR code
        const qrResponse = await fetch(`${apiBase}/api/${device.instance}/auth/qr`, {
          headers: {
            'X-Api-Key': apiKey,
          },
        })

        if (qrResponse.ok) {
          const contentType = qrResponse.headers.get('content-type')

          if (contentType && contentType.includes('image')) {
            const blob = await qrResponse.blob()
            const imageUrl = URL.createObjectURL(blob)

            setQrCode(imageUrl)
            setConnectionStatus('SCAN_QR_CODE')
            setDeviceStatuses(prev => ({ ...prev, [device.id]: 'SCAN_QR_CODE' }))
            setIsCheckingStatus(false)
            setShowQRModal(true)
          } else {
            const qrData = await qrResponse.json()
            if (qrData.qr) {
              setQrCode(qrData.qr)
              setConnectionStatus('SCAN_QR_CODE')
              setDeviceStatuses(prev => ({ ...prev, [device.id]: 'SCAN_QR_CODE' }))
              setIsCheckingStatus(false)
              setShowQRModal(true)
            }
          }
        } else {
          throw new Error('Failed to get QR code after restart')
        }
        return
      }

      // Update device status in state
      setDeviceStatuses(prev => ({ ...prev, [device.id]: data.status || 'UNKNOWN' }))

      if (data.status === 'SCAN_QR_CODE') {
        // Get QR code - WAHA returns PNG image directly, not JSON
        setLoadingMessage('Generating QR code...')
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
          setIsCheckingStatus(false)
          setShowQRModal(true)
        } else {
          // Try parsing as JSON (fallback for other formats)
          const qrData = await qrResponse.json()
          if (qrData.qr) {
            setQrCode(qrData.qr)
            setConnectionStatus('SCAN_QR_CODE')
            setIsCheckingStatus(false)
            setShowQRModal(true)
          }
        }
      } else if (data.status === 'WORKING') {
        setConnectionStatus('WORKING')
        setQrCode('')
        setIsCheckingStatus(false)
        await Swal.fire({
          icon: 'success',
          title: 'Connected!',
          text: 'Your WhatsApp device is connected and working.',
          timer: 2000,
          showConfirmButton: false,
        })
      } else {
        setConnectionStatus(data.status || 'UNKNOWN')
        setIsCheckingStatus(false)
        await Swal.fire({
          icon: 'info',
          title: 'Status',
          text: `Current status: ${data.status || 'Unknown'}`,
        })
      }
    } catch (error: any) {
      console.error('Error checking status:', error)
      setDeviceStatuses(prev => ({ ...prev, [device.id]: 'FAILED' }))
      setIsCheckingStatus(false)
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
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    deviceStatuses[device.id] === 'WORKING' ? 'bg-green-100 text-green-700' :
                    deviceStatuses[device.id] === 'SCAN_QR_CODE' ? 'bg-yellow-100 text-yellow-700' :
                    deviceStatuses[device.id] === 'NOT_SETUP' ? 'bg-gray-100 text-gray-600' :
                    deviceStatuses[device.id] === 'FAILED' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {deviceStatuses[device.id] === 'WORKING' ? '✓ Connected' :
                     deviceStatuses[device.id] === 'SCAN_QR_CODE' ? 'Scan QR' :
                     deviceStatuses[device.id] === 'NOT_SETUP' ? 'Not Setup' :
                     deviceStatuses[device.id] === 'FAILED' ? '✗ Failed' :
                     deviceStatuses[device.id] || 'Loading...'}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <p className="text-gray-600 text-sm">Instance</p>
                    <p className="text-gray-900 font-medium text-xs break-all">{device.instance || '-'}</p>
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

                <div className="space-y-2">
                  <button
                    onClick={() => handleCheckStatus(device)}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-2.5 rounded-lg transition-colors font-semibold text-sm shadow-sm"
                  >
                    {deviceStatuses[device.id] === 'WORKING' ? 'View Status' :
                     deviceStatuses[device.id] === 'SCAN_QR_CODE' ? 'Scan QR Code' :
                     deviceStatuses[device.id] === 'NOT_SETUP' ? 'Setup Device' :
                     'Check Status'}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleEditDevice(device)}
                      className="bg-primary-50 hover:bg-primary-600 border border-primary-200 hover:border-primary-600 text-primary-600 hover:text-white px-3 py-2 rounded-lg transition-colors font-medium text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(device.id)}
                      className="bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white px-3 py-2 rounded-lg transition-colors font-medium text-sm"
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
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Add New Device</h3>

              <form onSubmit={handleAddDevice} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Device ID *</label>
                    <input
                      type="text"
                      value={formData.device_id}
                      onChange={(e) => handleDeviceIdChange(e.target.value)}
                      className={`w-full bg-white border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 ${
                        deviceIdError
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-primary-500'
                      } text-gray-900`}
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Instance</label>
                    <input
                      type="text"
                      value={formData.instance}
                      onChange={(e) => setFormData({ ...formData, instance: e.target.value })}
                      className="w-full bg-gray-100 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 cursor-not-allowed"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Webhook ID</label>
                    <input
                      type="text"
                      value={formData.webhook_id}
                      onChange={(e) => setFormData({ ...formData, webhook_id: e.target.value })}
                      className="w-full bg-gray-100 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 cursor-not-allowed"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">AI Model *</label>
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
                    disabled={deviceIdExists || isCheckingDeviceId || !formData.device_id}
                    className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                      deviceIdExists || isCheckingDeviceId || !formData.device_id
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700 text-white'
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
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
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
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Edit Device</h3>

              <form onSubmit={handleUpdateDevice} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Device ID *</label>
                    <input
                      type="text"
                      value={formData.device_id}
                      className="w-full bg-gray-100 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 cursor-not-allowed"
                      readOnly
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Instance</label>
                    <input
                      type="text"
                      value={formData.instance}
                      className="w-full bg-gray-100 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 cursor-not-allowed"
                      readOnly
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Webhook ID</label>
                    <input
                      type="text"
                      value={formData.webhook_id}
                      className="w-full bg-gray-100 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 cursor-not-allowed"
                      readOnly
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">AI Model *</label>
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
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Loading Modal */}
        {isCheckingStatus && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-8 w-full max-w-sm shadow-xl text-center">
              <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent mb-4"></div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{loadingMessage}</h3>
              <p className="text-gray-600 text-sm">Please wait...</p>
            </div>
          </div>
        )}

        {/* QR Code Modal */}
        {showQRModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">Scan QR Code</h3>

              <div className="mb-4">
                <p className="text-gray-600 text-center mb-2">
                  Device: <span className="font-semibold text-gray-900">{currentDevice?.device_id}</span>
                </p>
                <div className={`px-4 py-2 rounded-lg text-center font-medium ${
                  connectionStatus === 'SCAN_QR_CODE'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {connectionStatus === 'SCAN_QR_CODE' ? 'Waiting for Scan' : 'Connected'}
                </div>
              </div>

              {qrCode && (
                <div className="flex justify-center mb-4 bg-white p-4 rounded-lg border border-gray-200">
                  <img
                    src={qrCode}
                    alt="QR Code"
                    className="w-64 h-64 object-contain"
                  />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Instructions:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
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
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
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
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
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
