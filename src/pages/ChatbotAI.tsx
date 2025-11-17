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

  // Analytics states
  const [totalConversations, setTotalConversations] = useState(0)
  const [aiConversations, setAiConversations] = useState(0)
  const [humanConversations, setHumanConversations] = useState(0)
  const [activeDevices, setActiveDevices] = useState(0)
  const [totalMinutes, setTotalMinutes] = useState(0)

  // Stage analytics state
  const [stageAnalytics, setStageAnalytics] = useState<Array<{ stage: string; count: number; percentage: number }>>([])

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

    // Calculate total minutes (mock data - can be updated with real data)
    setTotalMinutes(Math.floor(total * 2.5)) // Assuming avg 2.5 min per conversation

    // Calculate stage distribution
    const stageCounts: Record<string, number> = {}
    data.forEach(conv => {
      const stage = conv.stage || 'Welcome Message'
      stageCounts[stage] = (stageCounts[stage] || 0) + 1
    })

    const sortedStages = Object.entries(stageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6) // Top 6 stages

    const analytics = sortedStages.map(([stage, count]) => ({
      stage,
      count,
      percentage: parseFloat(((count / total) * 100).toFixed(1))
    }))

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

    // CSV header with conversation history and details column
    let csv = 'No,ID Device,Date,Name,Phone Number,Niche,Stage,Details,Reply Status,Conversation History\n'

    filteredConversations.forEach((conv, index) => {
      const dateFormatted = conv.date_insert ? new Date(conv.date_insert).toLocaleDateString() : '-'
      const replyStatus = conv.human === 1 ? 'Human' : 'AI'

      // Escape conversation history for CSV while preserving newlines
      const convHistory = (conv.conv_last || 'No conversation history')
        .replace(/"/g, '""') // Escape double quotes

      // Escape details for CSV
      const details = (conv.detail || '-')
        .replace(/"/g, '""') // Escape double quotes

      csv += `${index + 1},"${conv.device_id || '-'}","${dateFormatted}","${conv.prospect_name || '-'}","${conv.prospect_num || '-'}","${conv.niche || '-'}","${conv.stage || 'Welcome Message'}","${details}","${replyStatus}","${convHistory}"\n`
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
      title: 'Conversation Details',
      html: `
        <div style="text-align: left; font-family: monospace; font-size: 14px;">
          <p><strong>Phone:</strong> ${conv.prospect_num || '-'}</p>
          <p><strong>Name:</strong> ${conv.prospect_name || '-'}</p>
          <p><strong>Device:</strong> ${conv.device_id || '-'}</p>
          <p><strong>Niche:</strong> ${conv.niche || '-'}</p>
          <p><strong>Stage:</strong> ${conv.stage || 'Welcome Message'}</p>
          <hr style="margin: 15px 0;">
          ${conv.detail ? `
          <p><strong>Customer Details:</strong></p>
          <div style="background: #e8f4fd; padding: 10px; border-radius: 5px; margin-bottom: 15px; white-space: pre-wrap; text-align: left; border-left: 3px solid #667eea;">
${conv.detail}
          </div>
          <hr style="margin: 15px 0;">
          ` : ''}
          <p><strong>Conversation History:</strong></p>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 5px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; text-align: left;">
${conv.conv_last || 'No conversation history'}
          </div>
        </div>
      `,
      width: '700px',
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
      <div className="p-6 max-w-7xl mx-auto animate-fade-in-up">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl card-soft">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Chatbot AI Conversations</h1>
          </div>
          <p className="text-gray-600 font-medium">Monitor and manage your AI-powered chatbot interactions</p>
        </div>

        {/* Top Stats Cards - 4 cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Total Conversations */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 card-medium card-hover transition-smooth text-white">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-5 h-5 text-white" />
              <span className="text-xs font-semibold text-purple-100 uppercase tracking-wide">Total</span>
            </div>
            <div className="text-3xl font-bold mb-1">{totalConversations}</div>
            <div className="text-sm text-purple-100 font-medium">Total Conversations</div>
          </div>

          {/* AI Conversations */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 card-medium card-hover transition-smooth text-white">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-white" />
              <span className="text-xs font-semibold text-blue-100 uppercase tracking-wide">AI</span>
            </div>
            <div className="text-3xl font-bold mb-1">{aiConversations}</div>
            <div className="text-sm text-blue-100 font-medium">AI Conversations</div>
            <div className="text-xs text-blue-200 mt-1">{aiPercent}% of total</div>
          </div>

          {/* Human Takeovers */}
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-6 card-medium card-hover transition-smooth text-white">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-white" />
              <span className="text-xs font-semibold text-pink-100 uppercase tracking-wide">Human</span>
            </div>
            <div className="text-3xl font-bold mb-1">{humanConversations}</div>
            <div className="text-sm text-pink-100 font-medium">Human Takeovers</div>
            <div className="text-xs text-pink-200 mt-1">{humanPercent}% of total</div>
          </div>

          {/* Active Devices */}
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-6 card-medium card-hover transition-smooth text-white">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-5 h-5 text-white" />
              <span className="text-xs font-semibold text-cyan-100 uppercase tracking-wide">Devices</span>
            </div>
            <div className="text-3xl font-bold mb-1">{activeDevices}</div>
            <div className="text-sm text-cyan-100 font-medium">Active Devices</div>
          </div>
        </div>

        {/* Total Minutes Card - Separate */}
        <div className="bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl p-6 card-medium card-hover transition-smooth mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Timer className="w-6 h-6 text-white" />
            <span className="text-sm font-semibold text-purple-100 uppercase tracking-wide">Total Minutes</span>
          </div>
          <div className="text-4xl font-bold text-white">{totalMinutes} <span className="text-2xl text-purple-100">min</span></div>
        </div>

        {/* Dynamic Stage Analytics */}
        <div className="bg-white rounded-xl p-6 card-soft mb-6 transition-smooth">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl card-soft">
              <span className="text-white text-xl">📊</span>
            </div>
            <div>
              <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Dynamic Stage Analytics</h3>
              <p className="text-sm text-gray-600 font-medium">Distribution of conversations by stage</p>
            </div>
          </div>

          {stageAnalytics.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gradient-subtle rounded-lg">
              No stage analytics available
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {stageAnalytics.map((stage, index) => (
                <div key={index} className="gradient-card rounded-xl p-4 card-soft card-hover transition-smooth border border-purple-100">
                  <div className="mb-3">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Stage</span>
                    <div className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mt-1">
                      {stage.percentage}%
                    </div>
                  </div>
                  <div className="mb-3">
                    <h4 className="font-bold text-gray-900 text-sm mb-1">{stage.stage}</h4>
                    <p className="text-xs text-gray-600 font-medium">{stage.count} conversations</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${stage.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 card-soft mb-6 transition-smooth">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Device</label>
              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
              >
                <option value="">All Devices</option>
                {devices.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Stage</label>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
              >
                <option value="">All Stages</option>
                {stages.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, phone, niche..."
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={resetFilters}
              className="px-5 py-2.5 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-smooth flex items-center gap-2 font-medium card-soft border border-gray-200"
            >
              🔄 Reset Filters
            </button>
            <button
              onClick={exportToCSV}
              className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-smooth flex items-center gap-2 font-medium card-soft"
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 bg-white rounded-xl card-soft">
            <div className="inline-block h-14 w-14 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center card-soft">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 font-medium text-lg">No conversations found matching your filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden card-soft transition-smooth">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-subtle">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">No</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Device</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Phone</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Niche</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Stage</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Detail</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">History</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredConversations.map((conv, index) => {
                    const dateFormatted = conv.date_insert
                      ? new Date(conv.date_insert).toLocaleDateString('en-GB')
                      : '-'

                    return (
                      <tr key={conv.id_prospect} className="hover:bg-gradient-subtle transition-smooth">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{index + 1}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-medium">{conv.device_id || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-medium">{dateFormatted}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-semibold">{conv.prospect_name || '-'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{conv.prospect_num}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200">
                            {conv.niche || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border border-purple-200">
                            {conv.stage || 'Welcome Message'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                          {conv.detail ? (
                            <div className="truncate" title={conv.detail}>
                              {conv.detail}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => viewConversation(conv)}
                            className="text-blue-600 hover:text-blue-800 transition-smooth text-lg"
                            title="View Conversation"
                          >
                            👁️
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${
                            conv.human === 1
                              ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-700 border-yellow-200'
                              : 'bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200'
                          }`}>
                            {conv.human === 1 ? 'Human' : 'AI'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => deleteConversation(conv.prospect_num)}
                            className="text-red-600 hover:text-red-800 transition-smooth text-lg"
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
