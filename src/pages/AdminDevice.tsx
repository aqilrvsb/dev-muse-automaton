import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

type AdminDevice = {
  id: string
  device_id: string
  instance: string
  phone_number: string
  status: string
  created_at: string
  updated_at: string
}

export default function AdminDevice() {
  const { user } = useAuth()
  const [device, setDevice] = useState<AdminDevice | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrCode, setQrCode] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [countdown, setCountdown] = useState<number>(10)
  const [isValidQR, setIsValidQR] = useState<boolean>(false)
  const qrRefreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    device_id: '',
    phone_number: '',
  })

  useEffect(() => {
    loadDevice()
  }, [])

  // QR Modal countdown effect
  useEffect(() => {
    if (showQRModal && device && isValidQR) {
      setCountdown(10)

      if (qrRefreshTimerRef.current) {
        clearTimeout(qrRefreshTimerRef.current)
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }

      let currentCount = 10
      countdownIntervalRef.current = setInterval(() => {
        currentCount--
        setCountdown(currentCount)

        if (currentCount <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
          }
        }
      }, 1000)

      qrRefreshTimerRef.current = setTimeout(() => {
        window.location.reload()
      }, 10000)
    }

    return () => {
      if (qrRefreshTimerRef.current) {
        clearTimeout(qrRefreshTimerRef.current)
        qrRefreshTimerRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [showQRModal, device, isValidQR])

  const loadDevice = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_device')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found (which is expected if no device exists)
        throw error
      }

      setDevice(data || null)

      // If device exists, check status
      if (data?.instance) {
        await checkDeviceStatus(data)
      }
    } catch (error) {
      console.error('Error loading admin device:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkDeviceStatus = async (deviceData: AdminDevice) => {
    const apiBase = '/api/whacenter'

    try {
      const response = await fetch(`${apiBase}?endpoint=statusDevice&device_id=${encodeURIComponent(deviceData.instance)}`, {
        method: 'GET'
      })
      const result = await response.json()

      if (result.status && result.data) {
        const status = result.data.status === 'CONNECTED' ? 'CONNECTED' :
                      result.data.status === 'NOT CONNECTED' ? 'NOT_CONNECTED' : 'UNKNOWN'

        setConnectionStatus(status)

        // Update status in database
        await supabase
          .from('admin_device')
          .update({ status })
          .eq('id', deviceData.id)
      }
    } catch (error) {
      console.error('Error checking device status:', error)
      setConnectionStatus('UNKNOWN')
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

    // Check if device already exists
    if (device) {
      await Swal.fire({
        icon: 'warning',
        title: 'Device Already Exists',
        text: 'Only one admin device is allowed. Please delete the existing one first.',
      })
      return
    }

    try {
      setIsProcessing(true)
      setLoadingMessage('Creating device...')

      const deviceId = crypto.randomUUID()

      // First, add to WhatsApp Center
      setLoadingMessage('Adding device to WhatsApp Center...')

      const apiBase = '/api/whacenter'
      const deviceName = formData.device_id
      const phoneNumber = formData.phone_number || ''

      const addDeviceResponse = await fetch(
        `${apiBase}?endpoint=addDevice&name=${encodeURIComponent(deviceName)}&number=${encodeURIComponent(phoneNumber)}`,
        { method: 'GET' }
      )

      const addDeviceData = await addDeviceResponse.json()

      console.log('Add device response:', addDeviceData)

      if (addDeviceData.success && addDeviceData.data?.device?.device_id) {
        const whatsappCenterDeviceId = addDeviceData.data.device.device_id

        // NO webhook registration for admin device - only for sending notifications

        // Save to database
        const { error } = await supabase
          .from('admin_device')
          .insert({
            id: deviceId,
            device_id: formData.device_id,
            instance: whatsappCenterDeviceId,
            phone_number: formData.phone_number,
            status: 'NOT_CONNECTED',
          })

        if (error) throw error

        setIsProcessing(false)
        setFormData({ device_id: '', phone_number: '' })
        setShowAddModal(false)

        await Swal.fire({
          icon: 'success',
          title: 'Admin Device Created!',
          text: 'Device added to WhatsApp Center. Please scan QR code to connect.',
          timer: 3000,
          showConfirmButton: false,
        })

        loadDevice()
      } else {
        throw new Error(`Failed to add device to WhatsApp Center: ${JSON.stringify(addDeviceData)}`)
      }
    } catch (error: any) {
      console.error('Error adding device:', error)
      setIsProcessing(false)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Add Device',
        text: error.message || 'Failed to add device',
      })
    }
  }

  const handleScanQR = async () => {
    if (!device) return

    const apiBase = '/api/whacenter'

    setIsProcessing(true)
    setLoadingMessage('Getting QR code...')

    try {
      const qrResponse = await fetch(`${apiBase}?endpoint=qr&device_id=${encodeURIComponent(device.instance)}`, {
        method: 'GET'
      })

      const qrData = await qrResponse.json()

      if (qrData.success && qrData.data?.image) {
        const isValid = qrData.data.image.startsWith('iVBORw0KG') && qrData.data.image.length > 2000

        const qrImageUrl = `data:image/png;base64,${qrData.data.image}`
        setQrCode(qrImageUrl)
        setIsValidQR(isValid)
        setIsProcessing(false)
        setShowQRModal(true)
      } else {
        throw new Error('Failed to get QR code')
      }
    } catch (error: any) {
      console.error('Error getting QR:', error)
      setIsProcessing(false)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Get QR',
        text: error.message || 'Failed to get QR code',
      })
    }
  }

  const handleRefreshDevice = async () => {
    if (!device) return

    const apiBase = '/api/whacenter'

    setIsProcessing(true)
    setLoadingMessage('Refreshing device...')

    try {
      // Delete old device from WhatsApp Center
      if (device.instance) {
        setLoadingMessage('Deleting old device...')
        await fetch(`${apiBase}?endpoint=deleteDevice&device_id=${encodeURIComponent(device.instance)}`, {
          method: 'GET'
        })
      }

      setLoadingMessage('Creating new device...')

      const addDeviceResponse = await fetch(
        `${apiBase}?endpoint=addDevice&name=${encodeURIComponent(device.device_id)}&number=${encodeURIComponent(device.phone_number || '')}`,
        { method: 'GET' }
      )

      const addDeviceData = await addDeviceResponse.json()

      if (addDeviceData.success && addDeviceData.data?.device?.device_id) {
        const newInstanceId = addDeviceData.data.device.device_id

        // Update database
        await supabase
          .from('admin_device')
          .update({
            instance: newInstanceId,
            status: 'NOT_CONNECTED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', device.id)

        // Get QR code
        setLoadingMessage('Generating QR code...')

        const qrResponse = await fetch(`${apiBase}?endpoint=qr&device_id=${encodeURIComponent(newInstanceId)}`, {
          method: 'GET'
        })

        const qrData = await qrResponse.json()

        if (qrData.success && qrData.data?.image) {
          const isValid = qrData.data.image.startsWith('iVBORw0KG') && qrData.data.image.length > 2000

          const qrImageUrl = `data:image/png;base64,${qrData.data.image}`
          setQrCode(qrImageUrl)
          setIsValidQR(isValid)
          setIsProcessing(false)
          setShowQRModal(true)

          loadDevice()
        } else {
          throw new Error('Failed to get QR code')
        }
      } else {
        throw new Error(`Failed to create new device: ${JSON.stringify(addDeviceData)}`)
      }
    } catch (error: any) {
      console.error('Error refreshing device:', error)
      setIsProcessing(false)
      await Swal.fire({
        icon: 'error',
        title: 'Refresh Failed',
        text: error.message || 'Failed to refresh device',
      })
    }
  }

  const handleDeleteDevice = async () => {
    if (!device) return

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Admin Device?',
      text: 'This will remove the admin notification device. You will need to set up a new one.',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
    })

    if (!result.isConfirmed) return

    try {
      setIsProcessing(true)
      setLoadingMessage('Deleting device...')

      const apiBase = '/api/whacenter'

      // Delete from WhatsApp Center
      if (device.instance) {
        await fetch(`${apiBase}?endpoint=deleteDevice&device_id=${encodeURIComponent(device.instance)}`, {
          method: 'GET'
        })
      }

      // Delete from database
      const { error } = await supabase
        .from('admin_device')
        .delete()
        .eq('id', device.id)

      if (error) throw error

      setIsProcessing(false)
      setDevice(null)

      await Swal.fire({
        icon: 'success',
        title: 'Device Deleted',
        text: 'Admin device has been removed.',
        timer: 2000,
        showConfirmButton: false,
      })
    } catch (error: any) {
      console.error('Error deleting device:', error)
      setIsProcessing(false)
      await Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: error.message || 'Failed to delete device',
      })
    }
  }

  const handleCheckStatus = async () => {
    if (!device) return

    setIsProcessing(true)
    setLoadingMessage('Checking device status...')

    try {
      await checkDeviceStatus(device)
      setIsProcessing(false)

      // Show result
      await Swal.fire({
        icon: connectionStatus === 'CONNECTED' ? 'success' : 'warning',
        title: connectionStatus === 'CONNECTED' ? 'Device Connected!' : 'Device Not Connected',
        text: connectionStatus === 'CONNECTED'
          ? 'Admin device is online and ready to send notifications.'
          : 'Please scan QR code to connect the device.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadDevice()
    } catch (error: any) {
      setIsProcessing(false)
      await Swal.fire({
        icon: 'error',
        title: 'Check Failed',
        text: error.message || 'Failed to check status',
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">Connected</span>
      case 'NOT_CONNECTED':
        return <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">Scan QR</span>
      default:
        return <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">Unknown</span>
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary-600">Admin Device</h1>
          <p className="text-gray-600">Manage admin WhatsApp device for sending notifications</p>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 mb-2">Admin Device Purpose</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>- Send notifications when user's device goes offline</li>
            <li>- Send notifications when user gets a closing (detail captured)</li>
            <li>- Only one admin device allowed (no webhook needed)</li>
          </ul>
        </div>

        {/* Device Card or Add Button */}
        {device ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{device.device_id}</h3>
                <p className="text-sm text-gray-500">Instance: {device.instance}</p>
                {device.phone_number && (
                  <p className="text-sm text-gray-500">Phone: {device.phone_number}</p>
                )}
              </div>
              {getStatusBadge(connectionStatus || device.status)}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCheckStatus}
                disabled={isProcessing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Check Status
              </button>
              <button
                onClick={handleScanQR}
                disabled={isProcessing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Scan QR
              </button>
              <button
                onClick={handleRefreshDevice}
                disabled={isProcessing}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                Refresh Device
              </button>
              <button
                onClick={handleDeleteDevice}
                disabled={isProcessing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <p className="text-gray-600 mb-4">No admin device configured yet.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              + Add Admin Device
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {isProcessing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">{loadingMessage}</p>
            </div>
          </div>
        )}

        {/* Add Device Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Add Admin Device</h2>
              <form onSubmit={handleAddDevice}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Device Name *
                    </label>
                    <input
                      type="text"
                      value={formData.device_id}
                      onChange={(e) => setFormData({ ...formData, device_id: e.target.value.replace(/\s/g, '') })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="admin-notification"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="60123456789"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Add Device
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QR Code Modal */}
        {showQRModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md text-center">
              <h2 className="text-xl font-bold mb-4">Scan QR Code</h2>
              <p className="text-gray-600 mb-4">Open WhatsApp on your phone and scan this QR code</p>

              {qrCode && (
                <div className="flex justify-center mb-4">
                  <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                </div>
              )}

              {isValidQR && (
                <p className="text-sm text-gray-500 mb-4">
                  Page will refresh in {countdown} seconds...
                </p>
              )}

              <button
                onClick={() => setShowQRModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
