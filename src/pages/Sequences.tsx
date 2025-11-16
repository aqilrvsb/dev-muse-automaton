import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'
import { Plus, Eye, Edit, Trash2, PlayCircle } from 'lucide-react'

type Sequence = {
  id: string
  name: string
  niche: string
  trigger: string
  description: string
  schedule_time: string
  min_delay: number
  max_delay: number
  status: 'active' | 'inactive'
  flows: SequenceFlow[]
  contacts_count: number
  created_at: string
}

type SequenceFlow = {
  flow_number: number
  step_trigger: string
  next_trigger: string
  delay_hours: number
  message: string
  image_url?: string
  is_end: boolean
}

export default function Sequences() {
  const { user } = useAuth()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showFlowModal, setShowFlowModal] = useState(false)
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
  const [currentFlowNumber, setCurrentFlowNumber] = useState(1)

  // Form states for creating sequence
  const [formData, setFormData] = useState({
    name: '',
    niche: '',
    trigger: '',
    description: '',
    schedule_time: '09:00',
    min_delay: 5,
    max_delay: 15,
  })

  // Form states for flow message
  const [flowData, setFlowData] = useState({
    step_trigger: '',
    next_trigger: '',
    delay_hours: 24,
    message: '',
    image_url: '',
    is_end: false,
  })

  const [tempFlows, setTempFlows] = useState<SequenceFlow[]>([])

  useEffect(() => {
    loadSequences()
  }, [])

  const loadSequences = async () => {
    try {
      setLoading(true)
      // For now, we'll use mock data since the table doesn't exist yet
      // In production, this would query the sequences table
      setSequences([])
    } catch (error) {
      console.error('Error loading sequences:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSequence = () => {
    setFormData({
      name: '',
      niche: '',
      trigger: '',
      description: '',
      schedule_time: '09:00',
      min_delay: 5,
      max_delay: 15,
    })
    setTempFlows([])
    setShowCreateModal(true)
  }

  const handleAddFlow = (flowNumber: number) => {
    setCurrentFlowNumber(flowNumber)
    setFlowData({
      step_trigger: '',
      next_trigger: '',
      delay_hours: 24,
      message: '',
      image_url: '',
      is_end: false,
    })
    setShowFlowModal(true)
  }

  const handleSaveFlow = () => {
    const newFlow: SequenceFlow = {
      flow_number: currentFlowNumber,
      ...flowData,
    }

    setTempFlows([...tempFlows, newFlow])
    setShowFlowModal(false)

    Swal.fire({
      title: 'Success!',
      text: `Flow ${currentFlowNumber} added successfully`,
      icon: 'success',
      confirmButtonColor: '#667eea',
    })
  }

  const handleSaveSequence = async () => {
    if (!formData.name || !formData.niche || !formData.trigger || !formData.description) {
      Swal.fire({
        title: 'Error!',
        text: 'Please fill in all required fields',
        icon: 'error',
        confirmButtonColor: '#d33',
      })
      return
    }

    try {
      // In production, save to database
      const newSequence: Sequence = {
        id: Date.now().toString(),
        ...formData,
        flows: tempFlows,
        contacts_count: 0,
        status: 'inactive',
        created_at: new Date().toISOString(),
      }

      setSequences([...sequences, newSequence])
      setShowCreateModal(false)

      Swal.fire({
        title: 'Success!',
        text: 'Sequence created successfully',
        icon: 'success',
        confirmButtonColor: '#667eea',
      })
    } catch (error) {
      Swal.fire({
        title: 'Error!',
        text: 'Failed to create sequence',
        icon: 'error',
        confirmButtonColor: '#d33',
      })
    }
  }

  const handleToggleStatus = async (sequenceId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

    setSequences(sequences.map(seq =>
      seq.id === sequenceId ? { ...seq, status: newStatus as 'active' | 'inactive' } : seq
    ))

    Swal.fire({
      title: 'Success!',
      text: `Sequence ${newStatus === 'active' ? 'activated' : 'deactivated'}`,
      icon: 'success',
      confirmButtonColor: '#667eea',
    })
  }

  const handleDeleteSequence = async (sequenceId: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the sequence',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#667eea',
      confirmButtonText: 'Yes, delete it!',
    })

    if (result.isConfirmed) {
      setSequences(sequences.filter(seq => seq.id !== sequenceId))

      Swal.fire({
        title: 'Deleted!',
        text: 'Sequence has been deleted',
        icon: 'success',
        confirmButtonColor: '#667eea',
      })
    }
  }

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto animate-fade-in-up">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                Message Sequences
              </h1>
              <p className="text-gray-600 font-medium">Create automated drip campaigns for your contacts</p>
            </div>
            <button
              onClick={handleCreateSequence}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl hover:from-purple-600 hover:to-blue-700 transition-smooth font-medium card-soft"
            >
              <Plus className="w-5 h-5" />
              Create Sequence
            </button>
          </div>
        </div>

        {/* Sequences Grid */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block h-14 w-14 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading sequences...</p>
          </div>
        ) : sequences.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center card-soft">
            <div className="text-6xl mb-4">📨</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No sequences yet</h3>
            <p className="text-gray-600 font-medium mb-6">Create your first automated message sequence</p>
            <button
              onClick={handleCreateSequence}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl hover:from-purple-600 hover:to-blue-700 transition-smooth font-medium card-soft"
            >
              <Plus className="w-5 h-5" />
              Create Sequence
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sequences.map((sequence) => (
              <div key={sequence.id} className="bg-white rounded-xl p-6 card-soft card-hover transition-smooth">
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`px-3 py-1 text-xs font-bold rounded-full ${
                      sequence.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {sequence.status}
                  </span>
                </div>

                {/* Sequence Info */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{sequence.name}</h3>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">Niche:</span> {sequence.niche} | <span className="font-semibold">Time:</span> {sequence.schedule_time}
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  <span className="font-semibold">Trigger:</span> {sequence.trigger}
                </p>
                <p className="text-gray-700 text-sm mb-4">{sequence.description}</p>

                {/* Contacts Count */}
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <span className="font-bold">👥 {sequence.contacts_count}</span>
                  <span>contacts</span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-smooth">
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-smooth">
                    <Edit className="w-4 h-4" />
                    Update
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-yellow-600 border border-yellow-200 rounded-lg hover:bg-yellow-50 transition-smooth">
                    <PlayCircle className="w-4 h-4" />
                    Flow Update
                  </button>
                  <button
                    onClick={() => handleDeleteSequence(sequence.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-smooth"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>

                {/* Toggle Status */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Status</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sequence.status === 'active'}
                        onChange={() => handleToggleStatus(sequence.id, sequence.status)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Sequence Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Create New Sequence</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-smooth"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sequence Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Niche <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Sales, Onboarding"
                      value={formData.niche}
                      onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sequence Trigger</label>
                  <input
                    type="text"
                    placeholder="e.g., fitness_start, onboarding_begin"
                    value={formData.trigger}
                    onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                  />
                  <p className="text-xs text-gray-500 mt-1">This trigger will be used to identify and enroll leads into this sequence</p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sequence Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Min Delay (seconds)</label>
                    <input
                      type="number"
                      value={formData.min_delay}
                      onChange={(e) => setFormData({ ...formData, min_delay: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Max Delay (seconds)</label>
                    <input
                      type="number"
                      value={formData.max_delay}
                      onChange={(e) => setFormData({ ...formData, max_delay: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Schedule Time</label>
                    <input
                      type="time"
                      value={formData.schedule_time}
                      onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                    />
                  </div>
                </div>

                {/* Sequence Flow */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Sequence Flow</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[...Array(31)].map((_, i) => {
                      const flowNumber = i + 1
                      const hasFlow = tempFlows.some(f => f.flow_number === flowNumber)

                      return (
                        <button
                          key={flowNumber}
                          onClick={() => handleAddFlow(flowNumber)}
                          className={`p-4 rounded-xl border-2 transition-smooth ${
                            hasFlow
                              ? 'bg-green-50 border-green-500 text-green-700'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-purple-500'
                          }`}
                        >
                          <div className="text-sm font-bold mb-1">Flow {flowNumber}</div>
                          <div className="text-xs">{hasFlow ? '✓ Set' : '+ Add'}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-2.5 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-smooth font-medium card-soft border border-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSequence}
                    className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl hover:from-purple-600 hover:to-blue-700 transition-smooth font-medium card-soft"
                  >
                    Create Sequence
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Flow Message Modal */}
        {showFlowModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Flow {currentFlowNumber} Message</h2>
                <button
                  onClick={() => setShowFlowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-smooth"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Step Trigger <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., fitness_day1, welcome_message"
                    value={flowData.step_trigger}
                    onChange={(e) => setFlowData({ ...flowData, step_trigger: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                  />
                  <p className="text-xs text-gray-500 mt-1">Unique identifier for this step</p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Next Trigger</label>
                  <input
                    type="text"
                    placeholder="e.g., fitness_day2"
                    value={flowData.next_trigger}
                    onChange={(e) => setFlowData({ ...flowData, next_trigger: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty for last step</p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Delay Hours</label>
                  <input
                    type="number"
                    value={flowData.delay_hours}
                    onChange={(e) => setFlowData({ ...flowData, delay_hours: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                  />
                  <p className="text-xs text-gray-500 mt-1">Hours to wait before next step</p>
                </div>

                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={flowData.is_end}
                      onChange={(e) => setFlowData({ ...flowData, is_end: e.target.checked })}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm font-semibold text-gray-700">This is the end of sequence</span>
                  </label>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Message</label>
                  <textarea
                    placeholder="Enter your message..."
                    value={flowData.message}
                    onChange={(e) => setFlowData({ ...flowData, message: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="font-semibold">WhatsApp Formatting:</span> *bold* | _italic_ | ~strikethrough~ | ```monospace``` | 😀 Emojis supported
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Live Preview</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 min-h-[100px]">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {flowData.message || 'Your formatted message will appear here...'}
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Image URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://example.com/image.jpg"
                    value={flowData.image_url}
                    onChange={(e) => setFlowData({ ...flowData, image_url: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter the full URL of your image</p>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowFlowModal(false)}
                    className="px-6 py-2.5 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-smooth font-medium card-soft border border-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveFlow}
                    className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl hover:from-purple-600 hover:to-blue-700 transition-smooth font-medium card-soft"
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
