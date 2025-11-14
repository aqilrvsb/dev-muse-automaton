import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'

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

export default function ChatbotAI() {
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<AIConversation[]>([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [deviceFilter, setDeviceFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Analytics states
  const [totalConversations, setTotalConversations] = useState(0)
  const [aiConversations, setAiConversations] = useState(0)
  const [humanConversations, setHumanConversations] = useState(0)
  const [activeDevices, setActiveDevices] = useState(0)

  // Unique values for filters
  const [devices, setDevices] = useState<string[]>([])
  const [stages, setStages] = useState<string[]>([])

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
      const { data, error } = await supabase
        .from('ai_whatsapp')
        .select('*')
        .order('date_insert', { ascending: false })

      if (error) throw error

      const convData = data || []
      setConversations(convData)

      // Extract unique devices and stages for filters
      const uniqueDevices = [...new Set(convData.map(c => c.device_id).filter(Boolean))]
      const uniqueStages = [...new Set(convData.map(c => c.stage || 'Welcome Message'))]
      setDevices(uniqueDevices)
      setStages(uniqueStages)

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

    // Stage filter
    if (stageFilter) {
      filtered = filtered.filter(c => (c.stage || 'Welcome Message') === stageFilter)
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
    const humanCount = data.filter(c => c.human === 1).length
    const deviceCount = [...new Set(data.map(c => c.device_id))].length

    setTotalConversations(total)
    setAiConversations(aiCount)
    setHumanConversations(humanCount)
    setActiveDevices(deviceCount)
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

      // Clean and escape conversation history for CSV
      const convHistory = (conv.conv_last || 'No conversation history')
        .replace(/"/g, '""') // Escape double quotes
        .replace(/\n/g, ' | ') // Replace newlines with pipe separator for readability

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

  const aiPercent = totalConversations > 0 ? ((aiConversations / totalConversations) * 100).toFixed(1) : '0'
  const humanPercent = totalConversations > 0 ? ((humanConversations / totalConversations) * 100).toFixed(1) : '0'

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Chatbot AI Conversations</h2>
          <p className="text-gray-600">Monitor and manage your AI-powered chatbot interactions</p>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-6 text-white">
            <div className="text-3xl font-bold mb-2">{totalConversations}</div>
            <div className="text-purple-100">Total Conversations</div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 text-white">
            <div className="text-3xl font-bold mb-2">{aiConversations}</div>
            <div className="text-blue-100">AI Conversations</div>
            <div className="text-sm text-blue-200 mt-1">{aiPercent}% of total</div>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-pink-700 rounded-xl p-6 text-white">
            <div className="text-3xl font-bold mb-2">{humanConversations}</div>
            <div className="text-pink-100">Human Takeovers</div>
            <div className="text-sm text-pink-200 mt-1">{humanPercent}% of total</div>
          </div>

          <div className="bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-xl p-6 text-white">
            <div className="text-3xl font-bold mb-2">{activeDevices}</div>
            <div className="text-cyan-100">Active Devices</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Device</label>
              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Devices</option>
                {devices.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stage</label>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Stages</option>
                {stages.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, phone, niche..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="flex gap-3">
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
