import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'
import { Phone, CheckCircle, XCircle, Volume2, Timer } from 'lucide-react'

type AIConversation = {
  id_prospect: number
  device_id: string
  prospect_name: string
  prospect_num: string
  niche: string
  stage: string
  human: number
  date_insert: string
  conv_last: string
  detail: string
}

type StageAnalytics = {
  stage: string
  count: number
  percentage: number
}

export default function ChatbotAI() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<AIConversation[]>([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [deviceFilter, setDeviceFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Analytics states
  const [totalConversations, setTotalConversations] = useState(0)
  const [aiConversations, setAiConversations] = useState(0)
  const [activeDevices, setActiveDevices] = useState(0)
  const [stageAnalytics, setStageAnalytics] = useState<StageAnalytics[]>([])

  // Unique values for filters
  const [devices, setDevices] = useState<string[]>([])

  useEffect(() => {
    loadConversations()
    setDefaultDates()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [conversations, deviceFilter, stageFilter, startDate, endDate, searchQuery])

  const setDefaultDates = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')

    setStartDate(`${year}-${month}-01`)
    setEndDate(`${year}-${month}-${day}`)
  }

  const loadConversations = async () => {
    try {
      // Fetch user's devices first (for non-admin users)
      let userDeviceIds: string[] = []
      if (user && user.role !== 'admin') {
        const { data: userDevices } = await supabase
          .from('device_setting')
          .select('device_id')
          .eq('user_id', user.id)

        userDeviceIds = userDevices?.map(d => d.device_id) || []
      }

      // Build query for AI WhatsApp conversations
      let query = supabase
        .from('ai_whatsapp')
        .select('*')
        .order('date_insert', { ascending: false })

      // For non-admin users, filter by their device IDs
      if (user && user.role !== 'admin' && userDeviceIds.length > 0) {
        query = query.in('device_id', userDeviceIds)
      }

      const { data, error } = await query

      if (error) throw error

      const convData = data || []
      setConversations(convData)

      // Extract unique devices for filters
      const uniqueDevices = [...new Set(convData.map(c => c.device_id).filter(Boolean))]
      setDevices(uniqueDevices)

    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...conversations]

    // Device filter
    if (deviceFilter) {
      filtered = filtered.filter(c => c.device_id === deviceFilter)
    }

    // Stage filter (text search)
    if (stageFilter) {
      const stageQuery = stageFilter.toLowerCase()
      filtered = filtered.filter(c => {
        const stage = (c.stage || 'Welcome Message').toLowerCase()
        return stage.includes(stageQuery)
      })
    }

    // Date range filter
    if (startDate || endDate) {
      filtered = filtered.filter(c => {
        if (!c.date_insert) return false
        const convDate = new Date(c.date_insert)
        const dateStr = convDate.toISOString().split('T')[0]

        if (startDate && dateStr < startDate) return false
        if (endDate && dateStr > endDate) return false
        return true
      })
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c =>
        (c.prospect_name && c.prospect_name.toLowerCase().includes(query)) ||
        (c.prospect_num && c.prospect_num.toLowerCase().includes(query)) ||
        (c.niche && c.niche.toLowerCase().includes(query))
      )
    }

    setFilteredConversations(filtered)
    calculateAnalytics(filtered)
  }

  const calculateAnalytics = (data: AIConversation[]) => {
    const total = data.length
    const aiCount = data.filter(c => !c.human || c.human === 0).length
    const deviceCount = [...new Set(data.map(c => c.device_id))].length

    setTotalConversations(total)
    setAiConversations(aiCount)
    setActiveDevices(deviceCount)

    // Calculate stage analytics for AI conversations
    const aiOnlyConversations = data.filter(c => !c.human || c.human === 0)
    const stageCounts: { [key: string]: number } = {}

    aiOnlyConversations.forEach(conv => {
      const stage = conv.stage || 'Welcome Message'
      stageCounts[stage] = (stageCounts[stage] || 0) + 1
    })

    const analytics: StageAnalytics[] = Object.entries(stageCounts)
      .map(([stage, count]) => ({
        stage,
        count,
        percentage: aiOnlyConversations.length > 0
          ? Math.round((count / aiOnlyConversations.length) * 100)
          : 0
      }))
      .sort((a, b) => b.count - a.count)

    setStageAnalytics(analytics)
  }

  const resetFilters = () => {
    setDeviceFilter('')
    setStageFilter('')
    setSearchQuery('')
    setDefaultDates()
  }

  const exportToCSV = () => {
    if (filteredConversations.length === 0) {
      Swal.fire({
        title: 'No Data',
        text: 'No conversations to export',
        icon: 'warning',
        confirmButtonColor: '#667eea',
      })
      return
    }

    // CSV header with conversation history column
    let csv = 'No,ID Device,Date,Name,Phone Number,Niche,Stage,Reply Status,Conversation History\n'

    filteredConversations.forEach((conv, index) => {
      const dateFormatted = conv.date_insert ? new Date(conv.date_insert).toLocaleDateString() : '-'
      const replyStatus = conv.human === 1 ? 'Human' : 'AI'

      // Escape conversation history for CSV while preserving newlines
      const convHistory = (conv.conv_last || 'No conversation history')
        .replace(/"/g, '""') // Escape double quotes

      csv += `${index + 1},"${conv.device_id || '-'}","${dateFormatted}","${conv.prospect_name || '-'}","${conv.prospect_num || '-'}","${conv.niche || '-'}","${conv.stage || 'Welcome Message'}","${replyStatus}","${convHistory}"\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chatbot-ai-conversations-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    Swal.fire({
      title: 'Success!',
      text: `Exported ${filteredConversations.length} conversations to CSV`,
      icon: 'success',
      confirmButtonColor: '#667eea',
    })
  }

  const viewConversation = (conv: AIConversation) => {
    Swal.fire({
      title: 'Conversation History',
      html: `
        <div style="text-align: left; font-family: monospace; font-size: 14px;">
          <p><strong>Phone:</strong> ${conv.prospect_num || '-'}</p>
          <p><strong>Name:</strong> ${conv.prospect_name || '-'}</p>
          <p><strong>Device:</strong> ${conv.device_id || '-'}</p>
          <p><strong>Niche:</strong> ${conv.niche || '-'}</p>
          <p><strong>Stage:</strong> ${conv.stage || 'Welcome Message'}</p>
          <hr style="margin: 15px 0;">
          <p><strong>Conversation History:</strong></p>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 5px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; text-align: left;">
${conv.conv_last || 'No conversation history'}
          </div>
        </div>
      `,
      width: '600px',
      confirmButtonText: 'OK',
      confirmButtonColor: '#667eea',
    })
  }

  const deleteConversation = async (prospectNum: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this conversation?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    })

    if (!result.isConfirmed) return

    try {
      const { error } = await supabase
        .from('ai_whatsapp')
        .delete()
        .eq('prospect_num', prospectNum)

      if (error) throw error

      Swal.fire({
        title: 'Deleted!',
        text: 'Conversation deleted successfully',
        icon: 'success',
        confirmButtonColor: '#667eea',
      })
      loadConversations()
    } catch (error) {
      console.error('Error deleting conversation:', error)
      Swal.fire({
        title: 'Error!',
        text: 'Failed to delete conversation',
        icon: 'error',
        confirmButtonColor: '#d33',
      })
    }
  }

  // Calculate total minutes (estimate: 1 conversation = ~2 minutes average)
  const totalMinutes = (aiConversations * 2).toFixed(1)

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Phone className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">Call Logs</h1>
          </div>
          <p className="text-gray-600">Lihat semua rekod panggilan dari voice agent</p>
        </div>

        {/* Top Stats Cards - 6 cards in a row */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          {/* Total Contacts */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600">Total Contacts</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{activeDevices}</div>
          </div>

          {/* Total Calls */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Total Calls</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalConversations}</div>
          </div>

          {/* Answered */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">Answered</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{aiConversations}</div>
          </div>

          {/* Unanswered */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-orange-600" />
              <span className="text-sm text-gray-600">Unanswered</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">0</div>
          </div>

          {/* Failed */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm text-gray-600">Failed</span>
            </div>
            <div className="text-2xl font-bold text-red-600">0</div>
          </div>

          {/* Voicemail */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600">Voicemail</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">0</div>
          </div>
        </div>

        {/* Total Minutes Card - Separate */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-gray-600">Total Minutes</span>
          </div>
          <div className="text-3xl font-bold text-purple-600">{totalMinutes} min</div>
        </div>


        {/* Dynamic Stage Analytics */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 text-xl">📊</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Dynamic Stage Analytics</h3>
              <p className="text-sm text-gray-600">Distribution of answered calls by conversation stage</p>
            </div>
          </div>

          {stageAnalytics.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No stage analytics available
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {stageAnalytics.map((stage, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="mb-2">
                    <span className="text-xs text-gray-600">Stage</span>
                    <div className="text-sm font-semibold text-purple-600 mb-1">
                      {stage.percentage}%
                    </div>
                  </div>
                  <div className="mb-2">
                    <h4 className="font-bold text-gray-900 text-sm">{stage.stage}</h4>
                    <p className="text-xs text-gray-600">{stage.count} calls</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${stage.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="p-4 flex items-center gap-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, caller, or prompt..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition flex items-center gap-2"
            >
              <span>🔍</span>
              <span>Filters</span>
            </button>
          </div>

          {/* Collapsible Filter Section */}
          {showFilters && (
            <div className="border-t border-gray-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* From Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 From Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* To Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 To Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Call Status (Device Filter) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📞 Call Status
                  </label>
                  <select
                    value={deviceFilter}
                    onChange={(e) => setDeviceFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Semua Panggilan</option>
                    {devices.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Stage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔍 Stage
                  </label>
                  <input
                    type="text"
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value)}
                    placeholder="e.g. confirmation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  🔄 Reset Filters
                </button>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  📥 Export CSV
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Total Count */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Total: <span className="font-bold text-purple-600">{filteredConversations.length} call logs</span>
          </p>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-600">No conversations found matching your filters</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Device</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Niche</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Stage</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">History</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredConversations.map((conv, index) => {
                    const dateFormatted = conv.date_insert
                      ? new Date(conv.date_insert).toLocaleDateString('en-GB')
                      : '-'

                    return (
                      <tr key={conv.id_prospect} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{index + 1}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{conv.device_id || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{dateFormatted}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{conv.prospect_name || '-'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{conv.prospect_num}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                            {conv.niche || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">
                            {conv.stage || 'Welcome Message'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => viewConversation(conv)}
                            className="text-blue-600 hover:text-blue-800"
                            title="View Conversation"
                          >
                            👁️
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            conv.human === 1
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {conv.human === 1 ? 'Human' : 'AI'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => deleteConversation(conv.prospect_num)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
