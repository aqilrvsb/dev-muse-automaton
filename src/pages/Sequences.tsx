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

type Prompt = {
  id: string
  niche: string
  prompts_name: string
}

type BankImage = {
  id: string
  name: string
  image_url: string
}

export default function Sequences() {
  const { user } = useAuth()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [bankImages, setBankImages] = useState<BankImage[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showFlowEditModal, setShowFlowEditModal] = useState(false)
  const [currentSequence, setCurrentSequence] = useState<Sequence | null>(null)
  const [currentFlowNumber, setCurrentFlowNumber] = useState<number>(1)
  const [sequenceFlows, setSequenceFlows] = useState<SequenceFlow[]>([])
  const [tempFlows, setTempFlows] = useState<SequenceFlow[]>([]) // For create modal

  // Form state for creating/editing sequences
  const [formData, setFormData] = useState({
    name: '',
    niche: '',
    trigger: '',
    description: '',
    schedule_time: '09:00', // Keep in state for backward compatibility but won't show in UI
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
    loadPrompts()
    loadBankImages()
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

  const loadPrompts = async () => {
    try {
      if (!user?.id) return

      const { data, error } = await supabase
        .from('prompts')
        .select('id, niche, prompts_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPrompts(data || [])
    } catch (error) {
      console.error('Error loading prompts:', error)
    }
  }

  const loadBankImages = async () => {
    try {
      if (!user?.id) return

      const { data, error } = await supabase
        .from('bank_images')
        .select('id, name, image_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setBankImages(data || [])
    } catch (error) {
      console.error('Error loading bank images:', error)
    }
  }

  const handleCreateSequence = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) return

    try {
      // Create sequence first
      const { data: sequenceData, error: sequenceError } = await supabase
        .from('sequences')
        .insert({
          user_id: user.id,
          ...formData,
        })
        .select()
        .single()

      if (sequenceError) throw sequenceError

      // Insert all flows that were created in the modal
      if (tempFlows.length > 0 && sequenceData) {
        const flowsToInsert = tempFlows.map(flow => ({
          sequence_id: sequenceData.id,
          flow_number: flow.flow_number,
          step_trigger: flow.step_trigger,
          next_trigger: flow.next_trigger,
          delay_hours: flow.delay_hours,
          message: flow.message,
          image_url: flow.image_url,
          is_end: flow.is_end,
        }))

        const { error: flowsError } = await supabase
          .from('sequence_flows')
          .insert(flowsToInsert)

        if (flowsError) throw flowsError
      }

      await Swal.fire({
        icon: 'success',
        title: 'Sequence Created!',
        text: 'Your sequence has been created successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      setShowCreateModal(false)
      resetForm()
      setTempFlows([])
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

  const handleEditSequence = async (sequence: Sequence) => {
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

    // Load flows for this sequence
    try {
      const { data: flowsData, error } = await supabase
        .from('sequence_flows')
        .select('*')
        .eq('sequence_id', sequence.id)
        .order('flow_number', { ascending: true })

      if (error) throw error
      setSequenceFlows(flowsData || [])
      setShowEditModal(true)
    } catch (error) {
      console.error('Error loading flows:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error Loading Flows',
        text: 'Failed to load sequence flows',
      })
    }
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
      setSequenceFlows([])
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

  const handleOpenFlowEdit = (flowNumber: number, isCreateMode: boolean = false) => {
    setCurrentFlowNumber(flowNumber)

    if (isCreateMode) {
      // Load from tempFlows
      const existingFlow = tempFlows.find(f => f.flow_number === flowNumber)
      if (existingFlow) {
        setFlowFormData({
          flow_number: existingFlow.flow_number,
          step_trigger: existingFlow.step_trigger,
          next_trigger: existingFlow.next_trigger || '',
          delay_hours: existingFlow.delay_hours,
          message: existingFlow.message,
          image_url: existingFlow.image_url || '',
          is_end: existingFlow.is_end,
        })
      } else {
        resetFlowForm()
        setFlowFormData({ ...flowFormData, flow_number: flowNumber })
      }
    } else {
      // Load from sequenceFlows
      const existingFlow = sequenceFlows.find(f => f.flow_number === flowNumber)
      if (existingFlow) {
        setFlowFormData({
          flow_number: existingFlow.flow_number,
          step_trigger: existingFlow.step_trigger,
          next_trigger: existingFlow.next_trigger || '',
          delay_hours: existingFlow.delay_hours,
          message: existingFlow.message,
          image_url: existingFlow.image_url || '',
          is_end: existingFlow.is_end,
        })
      } else {
        resetFlowForm()
        setFlowFormData({ ...flowFormData, flow_number: flowNumber })
      }
    }

    setShowFlowEditModal(true)
  }

  const handleSaveFlowInCreate = () => {
    // Auto-generate step_trigger from sequence trigger and flow number
    const stepTrigger = `${formData.trigger}_flow${currentFlowNumber}`
    const nextTrigger = `${formData.trigger}_flow${currentFlowNumber + 1}`

    // Save to tempFlows for create modal
    const newFlow: SequenceFlow = {
      id: `temp-${currentFlowNumber}`,
      sequence_id: '',
      flow_number: currentFlowNumber,
      step_trigger: stepTrigger,
      next_trigger: nextTrigger,
      delay_hours: flowFormData.delay_hours,
      message: flowFormData.message,
      image_url: flowFormData.image_url || null,
      is_end: false, // Auto-set to false
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const updatedFlows = tempFlows.filter(f => f.flow_number !== currentFlowNumber)
    setTempFlows([...updatedFlows, newFlow])
    setShowFlowEditModal(false)
    resetFlowForm()
  }

  const handleSaveFlowInEdit = async () => {
    if (!currentSequence) return

    try {
      // Auto-generate step_trigger from sequence trigger and flow number
      const stepTrigger = `${currentSequence.trigger}_flow${currentFlowNumber}`
      const nextTrigger = `${currentSequence.trigger}_flow${currentFlowNumber + 1}`

      // Check if flow already exists
      const existingFlow = sequenceFlows.find(f => f.flow_number === currentFlowNumber)

      if (existingFlow) {
        // Update existing flow
        const { error } = await supabase
          .from('sequence_flows')
          .update({
            step_trigger: stepTrigger,
            next_trigger: nextTrigger,
            delay_hours: flowFormData.delay_hours,
            message: flowFormData.message,
            image_url: flowFormData.image_url || null,
            is_end: false, // Auto-set to false
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
            flow_number: currentFlowNumber,
            step_trigger: stepTrigger,
            next_trigger: nextTrigger,
            delay_hours: flowFormData.delay_hours,
            message: flowFormData.message,
            image_url: flowFormData.image_url || null,
            is_end: false, // Auto-set to false
          })

        if (error) throw error
      }

      // Reload flows
      const { data: flowsData } = await supabase
        .from('sequence_flows')
        .select('*')
        .eq('sequence_id', currentSequence.id)
        .order('flow_number', { ascending: true })

      setSequenceFlows(flowsData || [])
      setShowFlowEditModal(false)
      resetFlowForm()

      await Swal.fire({
        icon: 'success',
        title: 'Flow Saved!',
        text: `Flow ${currentFlowNumber} has been saved successfully.`,
        timer: 2000,
        showConfirmButton: false,
      })
    } catch (error: any) {
      console.error('Error saving flow:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Save Flow',
        text: error.message || 'Failed to save flow',
      })
    }
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


  const isFlowSet = (flowNumber: number, isCreateMode: boolean = false) => {
    if (isCreateMode) {
      return tempFlows.some(f => f.flow_number === flowNumber)
    } else {
      return sequenceFlows.some(f => f.flow_number === flowNumber)
    }
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Message Sequences</h2>
            <p className="text-gray-600">Create automated drip campaigns for your contacts</p>
          </div>
          <button
            onClick={() => {
              setShowCreateModal(true)
              setTempFlows([])
            }}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
          >
            <span>⊕</span>
            <span>Create Sequence</span>
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
            <p className="text-gray-500 mt-2">Click "Create Sequence" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sequences.map((sequence) => (
              <div key={sequence.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{sequence.name}</h3>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        sequence.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {sequence.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500">Niche: {sequence.niche}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Trigger: {sequence.trigger}</p>
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium">{sequence.description}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditSequence(sequence)}
                      className="flex-1 bg-white border border-green-400 text-green-600 px-3 py-2 rounded-md transition-colors font-medium text-sm hover:bg-green-50"
                    >
                      ✎ Update
                    </button>
                    <button
                      onClick={() => handleDeleteSequence(sequence.id)}
                      className="flex-1 bg-white border border-red-400 text-red-600 px-3 py-2 rounded-md transition-colors font-medium text-sm hover:bg-red-50"
                    >
                      🗑 Delete
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-gray-600">Status:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sequence.status === 'active'}
                        onChange={() => handleToggleStatus(sequence)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      <span className="ml-2 text-sm font-medium text-gray-700">
                        {sequence.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Sequence Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 w-full max-w-5xl my-8 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Create New Sequence</h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    resetForm()
                    setTempFlows([])
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateSequence} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sequence Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Niche <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.niche}
                      onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      <option value="">Select Niche from Prompts</option>
                      {prompts.map((prompt) => (
                        <option key={prompt.id} value={prompt.niche}>
                          {prompt.niche} ({prompt.prompts_name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stage Trigger</label>
                  <input
                    type="text"
                    value={formData.trigger}
                    onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., fitness_start, onboarding_begin"
                  />
                  <p className="text-xs text-gray-500 mt-1">This trigger will be used to identify and enroll leads into this sequence</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sequence Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Delay (seconds)</label>
                    <input
                      type="number"
                      value={formData.min_delay}
                      onChange={(e) => setFormData({ ...formData, min_delay: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Delay (seconds)</label>
                    <input
                      type="number"
                      value={formData.max_delay}
                      onChange={(e) => setFormData({ ...formData, max_delay: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>
                </div>

                {/* Sequence Flow Grid */}
                <div className="mt-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Sequence Flow</h4>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((flowNum) => (
                      <button
                        key={flowNum}
                        type="button"
                        onClick={() => handleOpenFlowEdit(flowNum, true)}
                        className={`px-3 py-6 rounded-lg border-2 font-medium text-sm transition-colors ${
                          isFlowSet(flowNum, true)
                            ? 'bg-green-50 border-green-400 text-green-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        <div className="text-center">
                          <div className="font-bold mb-1">Flow {flowNum}</div>
                          <div className="text-xs">
                            {isFlowSet(flowNum, true) ? (
                              <span className="text-green-600">✓ Set</span>
                            ) : (
                              <span className="text-gray-500">⊕ Add</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      resetForm()
                      setTempFlows([])
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Create Sequence
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Sequence Modal */}
        {showEditModal && currentSequence && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 w-full max-w-5xl my-8 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Edit Sequence</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setCurrentSequence(null)
                    setSequenceFlows([])
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleUpdateSequence} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sequence Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Niche <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.niche}
                      onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      <option value="">Select Niche from Prompts</option>
                      {prompts.map((prompt) => (
                        <option key={prompt.id} value={prompt.niche}>
                          {prompt.niche} ({prompt.prompts_name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stage Trigger</label>
                  <input
                    type="text"
                    value={formData.trigger}
                    onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sequence Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Delay (seconds)</label>
                    <input
                      type="number"
                      value={formData.min_delay}
                      onChange={(e) => setFormData({ ...formData, min_delay: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Delay (seconds)</label>
                    <input
                      type="number"
                      value={formData.max_delay}
                      onChange={(e) => setFormData({ ...formData, max_delay: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>
                </div>

                {/* Sequence Flow Grid */}
                <div className="mt-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Sequence Flow</h4>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((flowNum) => (
                      <button
                        key={flowNum}
                        type="button"
                        onClick={() => handleOpenFlowEdit(flowNum, false)}
                        className={`px-3 py-6 rounded-lg border-2 font-medium text-sm transition-colors ${
                          isFlowSet(flowNum, false)
                            ? 'bg-green-50 border-green-400 text-green-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        <div className="text-center">
                          <div className="font-bold mb-1">Flow {flowNum}</div>
                          <div className="text-xs">
                            {isFlowSet(flowNum, false) ? (
                              <span className="text-green-600">✓ Set</span>
                            ) : (
                              <span className="text-gray-500">⊕ Add</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setCurrentSequence(null)
                      setSequenceFlows([])
                      resetForm()
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Update Sequence
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Flow Edit Modal */}
        {showFlowEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Flow {currentFlowNumber} Message</h3>
                <button
                  onClick={() => {
                    setShowFlowEditModal(false)
                    resetFlowForm()
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delay Hours</label>
                  <input
                    type="number"
                    value={flowFormData.delay_hours}
                    onChange={(e) => setFlowFormData({ ...flowFormData, delay_hours: parseInt(e.target.value) || 0 })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Hours to wait before next step</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                  <textarea
                    id="flow-message"
                    value={flowFormData.message}
                    onChange={(e) => setFlowFormData({ ...flowFormData, message: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={6}
                    placeholder="Enter your message..."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>WhatsApp Formatting:</strong> *bold* | _italic_ | ~strikethrough~ | ```monospace``` | 😊 Emojis supported
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Live Preview</h4>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap min-h-[60px]">
                    {flowFormData.message || 'Your formatted message will appear here...'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Image (Optional)</label>
                  <select
                    value={flowFormData.image_url}
                    onChange={(e) => setFlowFormData({ ...flowFormData, image_url: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select Image from Bank</option>
                    {bankImages.map((image) => (
                      <option key={image.id} value={image.image_url}>
                        {image.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Select an image from your bank images</p>
                </div>

                <div className="flex gap-4 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFlowEditModal(false)
                      resetFlowForm()
                    }}
                    className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!flowFormData.message) {
                        Swal.fire({
                          icon: 'warning',
                          title: 'Missing Required Fields',
                          text: 'Please fill in the Message field',
                        })
                        return
                      }

                      if (currentSequence) {
                        handleSaveFlowInEdit()
                      } else {
                        handleSaveFlowInCreate()
                      }
                    }}
                    className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Finish
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
