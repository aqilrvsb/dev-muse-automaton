import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

type Sequence = {
  id: string
  user_id: string
  name: string
  niche: string
  trigger: string
  description: string
  schedule_time: string
  min_delay: number
  max_delay: number
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  contact_count?: number
}

type SequenceFlow = {
  id: string
  sequence_id: string
  flow_number: number
  step_trigger: string
  next_trigger: string | null
  delay_hours: number
  message: string
  image_url: string | null
  is_end: boolean
  created_at: string
  updated_at: string
}

export default function Sequences() {
  const { user } = useAuth()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showFlowModal, setShowFlowModal] = useState(false)
  const [currentSequence, setCurrentSequence] = useState<Sequence | null>(null)
  const [currentFlow, setCurrentFlow] = useState<number>(1)
  const [sequenceFlows, setSequenceFlows] = useState<SequenceFlow[]>([])

  // Form state for creating/editing sequences
  const [formData, setFormData] = useState({
    name: '',
    niche: '',
    trigger: '',
    description: '',
    schedule_time: '09:00',
    min_delay: 5,
    max_delay: 15,
    status: 'inactive' as 'active' | 'inactive',
  })

  // Flow message form state
  const [flowFormData, setFlowFormData] = useState({
    flow_number: 1,
    step_trigger: '',
    next_trigger: '',
    delay_hours: 24,
    message: '',
    image_url: '',
    is_end: false,
  })

  useEffect(() => {
    loadSequences()
  }, [])

  const loadSequences = async () => {
    try {
      setLoading(true)

      if (!user?.id) return

      // Fetch sequences for this user
      const { data: sequencesData, error } = await supabase
        .from('sequences')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Fetch contact counts for each sequence
      if (sequencesData) {
        const sequencesWithCounts = await Promise.all(
          sequencesData.map(async (seq) => {
            const { count } = await supabase
              .from('sequence_enrollments')
              .select('*', { count: 'exact', head: true })
              .eq('sequence_id', seq.id)

            return {
              ...seq,
              contact_count: count || 0,
            }
          })
        )

        setSequences(sequencesWithCounts)
      }
    } catch (error) {
      console.error('Error loading sequences:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error Loading Sequences',
        text: 'Failed to load sequences',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSequence = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) return

    try {
      const { error } = await supabase
        .from('sequences')
        .insert({
          user_id: user.id,
          ...formData,
        })
        .select()
        .single()

      if (error) throw error

      await Swal.fire({
        icon: 'success',
        title: 'Sequence Created!',
        text: 'Your sequence has been created successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      setShowCreateModal(false)
      resetForm()
      loadSequences()
    } catch (error: any) {
      console.error('Error creating sequence:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Create Sequence',
        text: error.message || 'Failed to create sequence',
      })
    }
  }

  const handleEditSequence = (sequence: Sequence) => {
    setCurrentSequence(sequence)
    setFormData({
      name: sequence.name,
      niche: sequence.niche,
      trigger: sequence.trigger,
      description: sequence.description,
      schedule_time: sequence.schedule_time,
      min_delay: sequence.min_delay,
      max_delay: sequence.max_delay,
      status: sequence.status,
    })
    setShowEditModal(true)
  }

  const handleUpdateSequence = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentSequence) return

    try {
      const { error } = await supabase
        .from('sequences')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentSequence.id)

      if (error) throw error

      await Swal.fire({
        icon: 'success',
        title: 'Sequence Updated!',
        text: 'Your sequence has been updated successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      setShowEditModal(false)
      setCurrentSequence(null)
      resetForm()
      loadSequences()
    } catch (error: any) {
      console.error('Error updating sequence:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Update Sequence',
        text: error.message || 'Failed to update sequence',
      })
    }
  }

  const handleDeleteSequence = async (id: string) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Sequence?',
      text: 'This will also delete all flows and enrollments for this sequence. This action cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    })

    if (!result.isConfirmed) return

    try {
      const { error } = await supabase
        .from('sequences')
        .delete()
        .eq('id', id)

      if (error) throw error

      await Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Sequence has been deleted successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadSequences()
    } catch (error: any) {
      console.error('Error deleting sequence:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Delete',
        text: error.message || 'Failed to delete sequence',
      })
    }
  }

  const handleToggleStatus = async (sequence: Sequence) => {
    try {
      const newStatus = sequence.status === 'active' ? 'inactive' : 'active'

      const { error } = await supabase
        .from('sequences')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sequence.id)

      if (error) throw error

      loadSequences()
    } catch (error: any) {
      console.error('Error toggling status:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Update Status',
        text: error.message || 'Failed to update status',
      })
    }
  }

  const handleManageFlows = async (sequence: Sequence) => {
    setCurrentSequence(sequence)

    try {
      // Load flows for this sequence
      const { data: flowsData, error } = await supabase
        .from('sequence_flows')
        .select('*')
        .eq('sequence_id', sequence.id)
        .order('flow_number', { ascending: true })

      if (error) throw error

      setSequenceFlows(flowsData || [])
      setShowFlowModal(true)
    } catch (error) {
      console.error('Error loading flows:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error Loading Flows',
        text: 'Failed to load sequence flows',
      })
    }
  }

  const handleSaveFlow = async (flowNumber: number) => {
    if (!currentSequence) return

    try {
      // Check if flow already exists
      const existingFlow = sequenceFlows.find(f => f.flow_number === flowNumber)

      if (existingFlow) {
        // Update existing flow
        const { error } = await supabase
          .from('sequence_flows')
          .update({
            step_trigger: flowFormData.step_trigger,
            next_trigger: flowFormData.next_trigger || null,
            delay_hours: flowFormData.delay_hours,
            message: flowFormData.message,
            image_url: flowFormData.image_url || null,
            is_end: flowFormData.is_end,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingFlow.id)

        if (error) throw error
      } else {
        // Create new flow
        const { error } = await supabase
          .from('sequence_flows')
          .insert({
            sequence_id: currentSequence.id,
            flow_number: flowNumber,
            step_trigger: flowFormData.step_trigger,
            next_trigger: flowFormData.next_trigger || null,
            delay_hours: flowFormData.delay_hours,
            message: flowFormData.message,
            image_url: flowFormData.image_url || null,
            is_end: flowFormData.is_end,
          })

        if (error) throw error
      }

      await Swal.fire({
        icon: 'success',
        title: 'Flow Saved!',
        text: `Flow ${flowNumber} has been saved successfully.`,
        timer: 2000,
        showConfirmButton: false,
      })

      // Reload flows
      const { data: flowsData } = await supabase
        .from('sequence_flows')
        .select('*')
        .eq('sequence_id', currentSequence.id)
        .order('flow_number', { ascending: true })

      setSequenceFlows(flowsData || [])
      resetFlowForm()
    } catch (error: any) {
      console.error('Error saving flow:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Save Flow',
        text: error.message || 'Failed to save flow',
      })
    }
  }

  const handleDeleteFlow = async (flowId: string, flowNumber: number) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Flow?',
      text: `Are you sure you want to delete Flow ${flowNumber}?`,
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    })

    if (!result.isConfirmed) return

    try {
      const { error } = await supabase
        .from('sequence_flows')
        .delete()
        .eq('id', flowId)

      if (error) throw error

      // Reload flows
      if (currentSequence) {
        const { data: flowsData } = await supabase
          .from('sequence_flows')
          .select('*')
          .eq('sequence_id', currentSequence.id)
          .order('flow_number', { ascending: true })

        setSequenceFlows(flowsData || [])
      }

      await Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Flow has been deleted successfully.',
        timer: 2000,
        showConfirmButton: false,
      })
    } catch (error: any) {
      console.error('Error deleting flow:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Delete',
        text: error.message || 'Failed to delete flow',
      })
    }
  }

  const loadFlowForEdit = (flowNumber: number) => {
    const flow = sequenceFlows.find(f => f.flow_number === flowNumber)

    if (flow) {
      setFlowFormData({
        flow_number: flow.flow_number,
        step_trigger: flow.step_trigger,
        next_trigger: flow.next_trigger || '',
        delay_hours: flow.delay_hours,
        message: flow.message,
        image_url: flow.image_url || '',
        is_end: flow.is_end,
      })
    } else {
      setFlowFormData({
        flow_number: flowNumber,
        step_trigger: '',
        next_trigger: '',
        delay_hours: 24,
        message: '',
        image_url: '',
        is_end: false,
      })
    }

    setCurrentFlow(flowNumber)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      niche: '',
      trigger: '',
      description: '',
      schedule_time: '09:00',
      min_delay: 5,
      max_delay: 15,
      status: 'inactive',
    })
  }

  const resetFlowForm = () => {
    setFlowFormData({
      flow_number: 1,
      step_trigger: '',
      next_trigger: '',
      delay_hours: 24,
      message: '',
      image_url: '',
      is_end: false,
    })
  }

  // WhatsApp text formatting helpers
  const insertFormatting = (format: string) => {
    const textarea = document.getElementById('flow-message') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = flowFormData.message.substring(start, end)

    let formattedText = ''
    switch (format) {
      case 'bold':
        formattedText = `*${selectedText}*`
        break
      case 'italic':
        formattedText = `_${selectedText}_`
        break
      case 'strike':
        formattedText = `~${selectedText}~`
        break
      case 'mono':
        formattedText = `\`\`\`${selectedText}\`\`\``
        break
    }

    const newMessage =
      flowFormData.message.substring(0, start) +
      formattedText +
      flowFormData.message.substring(end)

    setFlowFormData({ ...flowFormData, message: newMessage })
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Message Sequences</h2>
            <p className="text-gray-600">Create and manage automated message sequences</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
          >
            + Create New Sequence
          </button>
        </div>

        {/* Sequences List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading sequences...</p>
          </div>
        ) : sequences.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-600 text-lg">No sequences created yet</p>
            <p className="text-gray-500 mt-2">Click "Create New Sequence" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sequences.map((sequence) => (
              <div key={sequence.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{sequence.name}</h3>
                  <button
                    onClick={() => handleToggleStatus(sequence)}
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-colors ${
                      sequence.status === 'active'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {sequence.status === 'active' ? '✓ Active' : 'Inactive'}
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Niche</p>
                    <p className="text-gray-900">{sequence.niche}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Trigger</p>
                    <p className="text-primary-600 font-mono text-sm">{sequence.trigger}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Schedule Time</p>
                    <p className="text-gray-900">{sequence.schedule_time}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Contacts</p>
                    <p className="text-gray-900 font-bold">{sequence.contact_count || 0}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleEditSequence(sequence)}
                    className="bg-blue-50 hover:bg-blue-600 border border-blue-200 hover:border-blue-600 text-blue-600 hover:text-white px-3 py-2 rounded-lg transition-colors font-medium text-sm"
                  >
                    Update
                  </button>
                  <button
                    onClick={() => handleManageFlows(sequence)}
                    className="bg-purple-50 hover:bg-purple-600 border border-purple-200 hover:border-purple-600 text-purple-600 hover:text-white px-3 py-2 rounded-lg transition-colors font-medium text-sm"
                  >
                    Flows
                  </button>
                  <button
                    onClick={() => handleDeleteSequence(sequence.id)}
                    className="bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white px-3 py-2 rounded-lg transition-colors font-medium text-sm col-span-2"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Sequence Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Create New Sequence</h3>

              <form onSubmit={handleCreateSequence} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sequence Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Trigger *</label>
                    <input
                      type="text"
                      value={formData.trigger}
                      onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Time *</label>
                    <input
                      type="time"
                      value={formData.schedule_time}
                      onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Delay (seconds) *</label>
                    <input
                      type="number"
                      value={formData.min_delay}
                      onChange={(e) => setFormData({ ...formData, min_delay: parseInt(e.target.value) })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Delay (seconds) *</label>
                    <input
                      type="number"
                      value={formData.max_delay}
                      onChange={(e) => setFormData({ ...formData, max_delay: parseInt(e.target.value) })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={3}
                    required
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Create Sequence
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      resetForm()
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

        {/* Edit Sequence Modal */}
        {showEditModal && currentSequence && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Edit Sequence</h3>

              <form onSubmit={handleUpdateSequence} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sequence Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Trigger *</label>
                    <input
                      type="text"
                      value={formData.trigger}
                      onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Time *</label>
                    <input
                      type="time"
                      value={formData.schedule_time}
                      onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Delay (seconds) *</label>
                    <input
                      type="number"
                      value={formData.min_delay}
                      onChange={(e) => setFormData({ ...formData, min_delay: parseInt(e.target.value) })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Delay (seconds) *</label>
                    <input
                      type="number"
                      value={formData.max_delay}
                      onChange={(e) => setFormData({ ...formData, max_delay: parseInt(e.target.value) })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={3}
                    required
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Update Sequence
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setCurrentSequence(null)
                      resetForm()
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

        {/* Flow Management Modal */}
        {showFlowModal && currentSequence && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 w-full max-w-6xl my-8 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Manage Sequence Flows</h3>
                  <p className="text-gray-600">Sequence: {currentSequence.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowFlowModal(false)
                    setCurrentSequence(null)
                    setSequenceFlows([])
                    resetFlowForm()
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Flow Selector */}
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Select Flow to Edit (1-31)</h4>
                  <div className="grid grid-cols-7 gap-2 mb-6">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((flowNum) => {
                      const flowExists = sequenceFlows.find(f => f.flow_number === flowNum)
                      return (
                        <button
                          key={flowNum}
                          onClick={() => loadFlowForEdit(flowNum)}
                          className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                            currentFlow === flowNum
                              ? 'bg-primary-600 text-white'
                              : flowExists
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {flowNum}
                        </button>
                      )
                    })}
                  </div>

                  {/* Flow Form */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <h5 className="font-bold text-gray-900">Flow {currentFlow} Settings</h5>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Step Trigger *</label>
                      <input
                        type="text"
                        value={flowFormData.step_trigger}
                        onChange={(e) => setFlowFormData({ ...flowFormData, step_trigger: e.target.value })}
                        className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g., FLOW1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Next Trigger</label>
                      <input
                        type="text"
                        value={flowFormData.next_trigger}
                        onChange={(e) => setFlowFormData({ ...flowFormData, next_trigger: e.target.value })}
                        className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g., FLOW2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Delay Hours *</label>
                      <input
                        type="number"
                        value={flowFormData.delay_hours}
                        onChange={(e) => setFlowFormData({ ...flowFormData, delay_hours: parseInt(e.target.value) })}
                        className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
                      <input
                        type="text"
                        value={flowFormData.image_url}
                        onChange={(e) => setFlowFormData({ ...flowFormData, image_url: e.target.value })}
                        className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is-end"
                        checked={flowFormData.is_end}
                        onChange={(e) => setFlowFormData({ ...flowFormData, is_end: e.target.checked })}
                        className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="is-end" className="text-sm font-medium text-gray-700">
                        This is the last flow in the sequence
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveFlow(currentFlow)}
                        disabled={!flowFormData.step_trigger || !flowFormData.message}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          !flowFormData.step_trigger || !flowFormData.message
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-primary-600 hover:bg-primary-700 text-white'
                        }`}
                      >
                        Save Flow {currentFlow}
                      </button>
                      {sequenceFlows.find(f => f.flow_number === currentFlow) && (
                        <button
                          onClick={() => {
                            const flow = sequenceFlows.find(f => f.flow_number === currentFlow)
                            if (flow) handleDeleteFlow(flow.id, currentFlow)
                          }}
                          className="px-4 py-2 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white rounded-lg font-medium transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Message Editor */}
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Flow {currentFlow} Message</h4>

                  {/* Formatting Toolbar */}
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => insertFormatting('bold')}
                      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-bold"
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('italic')}
                      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm italic"
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('strike')}
                      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm line-through"
                      title="Strikethrough"
                    >
                      S
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('mono')}
                      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-mono"
                      title="Monospace"
                    >
                      M
                    </button>
                  </div>

                  <textarea
                    id="flow-message"
                    value={flowFormData.message}
                    onChange={(e) => setFlowFormData({ ...flowFormData, message: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                    rows={20}
                    placeholder="Type your message here...

Use WhatsApp formatting:
*bold*
_italic_
~strikethrough~
```monospace```"
                  />

                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>WhatsApp Formatting Tips:</strong>
                    </p>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1">
                      <li>• Select text and use toolbar buttons to format</li>
                      <li>• *text* for <strong>bold</strong></li>
                      <li>• _text_ for <em>italic</em></li>
                      <li>• ~text~ for <s>strikethrough</s></li>
                      <li>• ```text``` for monospace</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
