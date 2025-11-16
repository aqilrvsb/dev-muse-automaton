import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase, Prompt, Device } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

export default function Prompts() {
  const { user } = useAuth()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [availableDevices, setAvailableDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    device_id: '',
    niche: '',
    prompts_name: '',
    prompts_data: '',
  })

  useEffect(() => {
    loadPrompts()
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('device_setting')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDevices(data || [])
    } catch (error) {
      console.error('Error loading devices:', error)
    }
  }

  const loadPrompts = async () => {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPrompts(data || [])
    } catch (error) {
      console.error('Error loading prompts:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAvailableDevices = () => {
    // Filter out devices that already have prompts
    const usedDeviceIds = prompts.map(p => p.device_id)
    return devices.filter(d => !usedDeviceIds.includes(d.device_id))
  }

  const handleAddPrompt = async (e: React.FormEvent) => {
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
      const now = new Date().toISOString().split('T')[0] // Format: Y-m-d

      const { error } = await supabase.from('prompts').insert([
        {
          device_id: formData.device_id,
          niche: formData.niche,
          prompts_name: formData.prompts_name,
          prompts_data: formData.prompts_data,
          user_id: user.id,
          created_at: now,
          updated_at: now,
        },
      ])

      if (error) throw error

      setShowAddModal(false)
      setFormData({
        device_id: '',
        niche: '',
        prompts_name: '',
        prompts_data: '',
      })

      await Swal.fire({
        icon: 'success',
        title: 'Prompt Added!',
        text: 'Your prompt has been saved successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadPrompts()
    } catch (error: any) {
      console.error('Error adding prompt:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Add Prompt',
        text: error.message || 'Failed to add prompt',
      })
    }
  }

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    setFormData({
      device_id: prompt.device_id,
      niche: prompt.niche,
      prompts_name: prompt.prompts_name,
      prompts_data: prompt.prompts_data,
    })
    setShowEditModal(true)
  }

  const handleUpdatePrompt = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingPrompt) return

    try {
      const now = new Date().toISOString().split('T')[0] // Format: Y-m-d

      const { error } = await supabase
        .from('prompts')
        .update({
          niche: formData.niche,
          prompts_name: formData.prompts_name,
          prompts_data: formData.prompts_data,
          updated_at: now,
        })
        .eq('id', editingPrompt.id)

      if (error) throw error

      setShowEditModal(false)
      setEditingPrompt(null)
      setFormData({
        device_id: '',
        niche: '',
        prompts_name: '',
        prompts_data: '',
      })

      await Swal.fire({
        icon: 'success',
        title: 'Prompt Updated!',
        text: 'Your prompt has been updated successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadPrompts()
    } catch (error: any) {
      console.error('Error updating prompt:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Update Prompt',
        text: error.message || 'Failed to update prompt',
      })
    }
  }

  const handleDeletePrompt = async (prompt: Prompt) => {
    try {
      // Check if device_id exists in ai_whatsapp table
      const { data: aiWhatsappData, error: checkError } = await supabase
        .from('ai_whatsapp')
        .select('device_id')
        .eq('device_id', prompt.device_id)
        .limit(1)

      if (checkError) throw checkError

      if (aiWhatsappData && aiWhatsappData.length > 0) {
        await Swal.fire({
          icon: 'warning',
          title: 'Cannot Delete',
          text: 'This prompt is being used in AI WhatsApp conversations and cannot be deleted. You can only edit it.',
        })
        return
      }

      const result = await Swal.fire({
        icon: 'warning',
        title: 'Delete Prompt?',
        text: 'Are you sure you want to delete this prompt?',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc2626',
      })

      if (result.isConfirmed) {
        const { error } = await supabase.from('prompts').delete().eq('id', prompt.id)

        if (error) throw error

        await Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Prompt has been deleted.',
          timer: 2000,
          showConfirmButton: false,
        })

        loadPrompts()
      }
    } catch (error: any) {
      console.error('Error deleting prompt:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Delete',
        text: error.message || 'Failed to delete prompt',
      })
    }
  }

  const openAddModal = () => {
    const available = getAvailableDevices()
    setAvailableDevices(available)
    setShowAddModal(true)
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-primary-600 mb-2">Prompts</h2>
            <p className="text-gray-600">Manage your AI prompts for each device</p>
          </div>
          <button
            onClick={openAddModal}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            <span>Add Prompt</span>
          </button>
        </div>

        {/* Prompts List */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading prompts...</div>
          </div>
        ) : prompts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Prompts Yet</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first prompt</p>
            <button
              onClick={openAddModal}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Add Your First Prompt
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {prompts.map((prompt) => (
              <div
                key={prompt.id}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{prompt.prompts_name}</h3>
                    <span className="inline-block bg-primary-100 text-primary-800 text-xs px-2 py-1 rounded">
                      {prompt.device_id}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <p className="text-gray-600 text-sm">Niche</p>
                    <p className="text-gray-900 font-medium">{prompt.niche}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Prompt Data</p>
                    <p className="text-gray-900 text-sm line-clamp-3">{prompt.prompts_data}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>
                      <p>Created: {prompt.created_at}</p>
                    </div>
                    <div>
                      <p>Updated: {prompt.updated_at}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditPrompt(prompt)}
                    className="flex-1 bg-primary-50 hover:bg-primary-600 border border-primary-200 hover:border-primary-600 text-primary-600 hover:text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeletePrompt(prompt)}
                    className="flex-1 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Prompt Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Add New Prompt</h3>

              <form onSubmit={handleAddPrompt} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Device ID *</label>
                  <select
                    value={formData.device_id}
                    onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Select a device</option>
                    {availableDevices.map((device) => (
                      <option key={device.id} value={device.device_id}>
                        {device.device_id} - {device.phone_number || 'No phone'}
                      </option>
                    ))}
                  </select>
                  {availableDevices.length === 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      All devices already have prompts assigned. Please add more devices first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Niche *</label>
                  <input
                    type="text"
                    value={formData.niche}
                    onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prompt Name *</label>
                  <input
                    type="text"
                    value={formData.prompts_name}
                    onChange={(e) => setFormData({ ...formData, prompts_name: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prompt Data *</label>
                  <textarea
                    value={formData.prompts_data}
                    onChange={(e) => setFormData({ ...formData, prompts_data: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={8}
                    required
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    disabled={availableDevices.length === 0}
                    className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                      availableDevices.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700 text-white'
                    }`}
                  >
                    Add Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setFormData({
                        device_id: '',
                        niche: '',
                        prompts_name: '',
                        prompts_data: '',
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

        {/* Edit Prompt Modal */}
        {showEditModal && editingPrompt && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Edit Prompt</h3>

              <form onSubmit={handleUpdatePrompt} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Device ID</label>
                  <input
                    type="text"
                    value={formData.device_id}
                    className="w-full bg-gray-100 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 cursor-not-allowed"
                    readOnly
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Niche *</label>
                  <input
                    type="text"
                    value={formData.niche}
                    onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prompt Name *</label>
                  <input
                    type="text"
                    value={formData.prompts_name}
                    onChange={(e) => setFormData({ ...formData, prompts_name: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prompt Data *</label>
                  <textarea
                    value={formData.prompts_data}
                    onChange={(e) => setFormData({ ...formData, prompts_data: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={8}
                    required
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Update Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingPrompt(null)
                      setFormData({
                        device_id: '',
                        niche: '',
                        prompts_name: '',
                        prompts_data: '',
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
      </div>
    </Layout>
  )
}
