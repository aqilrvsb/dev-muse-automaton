import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'
import { MessageSquare, UserCheck, XCircle, DollarSign, TrendingUp } from 'lucide-react'

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
  const [totalLead, setTotalLead] = useState(0)
  const [totalStuckIntro, setTotalStuckIntro] = useState(0)
  const [totalResponse, setTotalResponse] = useState(0)
  const [totalClose, setTotalClose] = useState(0)
  const [totalSales, setTotalSales] = useState(0)
  const [closingRate, setClosingRate] = useState(0)
  const [stageAnalytics, setStageAnalytics] = useState<StageAnalytics[]>([])

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

    // Stage filter (dropdown)
    if (stageFilter) {
      if (stageFilter === 'Welcome Message') {
        filtered = filtered.filter(c => !c.stage || c.stage === null)
      } else {
        filtered = filtered.filter(c => c.stage === stageFilter)
      }
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
    // Total Lead - all conversations
    const lead = data.length

    // Total Stuck Intro - stage is null
    const stuckIntro = data.filter(c => !c.stage || c.stage === null).length

    // Total Response - stage is not null
    const response = data.filter(c => c.stage !== null && c.stage !== undefined && c.stage !== '').length

    // Total Close - detail is not null
    const close = data.filter(c => c.detail !== null && c.detail !== undefined && c.detail !== '').length

    // Total Sales - detail is not null and has Value RM**
    const sales = data.filter(c => {
      if (!c.detail) return false
      const detail = c.detail.toLowerCase()
      return detail.includes('rm') && /rm\s*\d+/.test(detail)
    }).length

    // Closing Rate - Total Close / Total Lead * 100
    const rate = lead > 0 ? parseFloat(((close / lead) * 100).toFixed(2)) : 0

    setTotalLead(lead)
    setTotalStuckIntro(stuckIntro)
    setTotalResponse(response)
    setTotalClose(close)
    setTotalSales(sales)
    setClosingRate(rate)

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

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto animate-fade-in-up">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl card-soft">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">WhatsApp Log</h1>
          </div>
          <p className="text-gray-600 font-medium">List All Conversation WhatsApp AI</p>
        </div>

        {/* Top Stats Cards - 6 cards in a row */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          {/* Total Lead */}
          <div className="bg-white rounded-xl p-4 card-soft card-hover transition-smooth border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Lead</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalLead}</div>
          </div>

          {/* Total Stuck Intro */}
          <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Stuck Intro</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{totalStuckIntro}</div>
          </div>

          {/* Total Response */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Response</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{totalResponse}</div>
          </div>

          {/* Total Close */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-green-100">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Close</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{totalClose}</div>
          </div>

          {/* Total Sales */}
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Sales</span>
            </div>
            <div className="text-2xl font-bold text-amber-600">{totalSales}</div>
          </div>

          {/* Closing Rate */}
          <div className="bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl p-4 card-medium card-hover transition-smooth">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-white" />
              <span className="text-xs font-semibold text-purple-100 uppercase tracking-wide">Closing Rate</span>
            </div>
            <div className="text-2xl font-bold text-white">{closingRate}%</div>
          </div>
        </div>


        {/* Dynamic Stage Analytics */}
        <div className="bg-white rounded-xl p-6 card-soft mb-6 transition-smooth">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl card-soft">
              <span className="text-white text-xl">📊</span>
            </div>
            <div>
              <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Dynamic Stage Analytics</h3>
              <p className="text-sm text-gray-600 font-medium">Distribution of answered calls by conversation stage</p>
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
                    <p className="text-xs text-gray-600 font-medium">{stage.count} calls</p>
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

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-xl card-soft mb-6 transition-smooth overflow-hidden">
          <div className="p-5 flex items-center gap-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, caller, or prompt..."
              className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-smooth flex items-center gap-2 font-medium card-soft"
            >
              <span>🔍</span>
              <span>Filters</span>
            </button>
          </div>

          {/* Collapsible Filter Section */}
          {showFilters && (
            <div className="border-t border-gray-200 p-5 bg-gradient-subtle">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* From Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📅 From Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                  />
                </div>

                {/* To Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📅 To Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                  />
                </div>

                {/* Device Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📱 Device Filter
                  </label>
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

                {/* Stage */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🔍 Stage
                  </label>
                  <select
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
                  >
                    <option value="">All Stages</option>
                    {stages.map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-5">
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
          )}
        </div>

        {/* Total Count */}
        <div className="mb-5">
          <p className="text-sm text-gray-600 font-medium">
            Total: <span className="font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">{filteredConversations.length} call logs</span>
          </p>
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
                        <td className="px-6 py-4">
                          <button
                            onClick={() => viewConversation(conv)}
                            className="text-blue-600 hover:text-blue-800 transition-smooth hover:scale-110 inline-block"
                            title="View Conversation"
                          >
                            👁️
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
                            conv.human === 1
                              ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-700 border border-yellow-200'
                              : 'bg-gradient-to-r from-green-50 to-green-100 text-green-700 border border-green-200'
                          }`}>
                            {conv.human === 1 ? 'Human' : 'AI'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => deleteConversation(conv.prospect_num)}
                            className="text-red-600 hover:text-red-800 transition-smooth hover:scale-110 inline-block"
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
