import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Chart, registerables } from 'chart.js'
import { MessageSquare, UserCheck, XCircle, DollarSign, TrendingUp } from 'lucide-react'

Chart.register(...registerables)

type Stats = {
  totalDevices: number
  activeDevices: number
  offlineDevices: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    totalDevices: 0,
    activeDevices: 0,
    offlineDevices: 0,
  })
  const [loading, setLoading] = useState(true)

  // Filter states
  const [deviceFilter, setDeviceFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [devices, setDevices] = useState<string[]>([])
  const [stages, setStages] = useState<string[]>([])

  // Analytics states
  const [totalLead, setTotalLead] = useState(0)
  const [totalStuckIntro, setTotalStuckIntro] = useState(0)
  const [totalResponse, setTotalResponse] = useState(0)
  const [totalClose, setTotalClose] = useState(0)
  const [totalSales, setTotalSales] = useState(0)
  const [closingRate, setClosingRate] = useState(0)

  // Chart refs and state
  const dailyTrendsChartRef = useRef<HTMLCanvasElement>(null)
  const dailyTrendsChartInstance = useRef<Chart | null>(null)
  const [stageDistribution, setStageDistribution] = useState<Array<{ stage: string; count: number; percentage: number }>>([])

  useEffect(() => {
    setDefaultDates()
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      loadDashboardData()
    }
  }, [deviceFilter, stageFilter, startDate, endDate])

  const setDefaultDates = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')

    setStartDate(`${year}-${month}-01`)
    setEndDate(`${year}-${month}-${day}`)
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      const isAdmin = user?.role === 'admin'

      // Query 1: Device settings (needed for user filtering and stats)
      let deviceSettingsQuery = supabase
        .from('device_setting')
        .select('device_id, status')

      if (!isAdmin) {
        deviceSettingsQuery = deviceSettingsQuery.eq('user_id', user?.id)
      }

      // Get devices first (fast query)
      const { data: devicesData } = await deviceSettingsQuery
      const userDeviceIds = devicesData?.map(d => d.device_id).filter(Boolean) || []

      // Query 2: AI WhatsApp conversations - only needed columns
      let conversationsQuery = supabase
        .from('ai_whatsapp')
        .select('stage, date_insert, detail, device_id')

      if (!isAdmin && userDeviceIds.length > 0) {
        conversationsQuery = conversationsQuery.in('device_id', userDeviceIds)
      }
      if (deviceFilter) {
        conversationsQuery = conversationsQuery.eq('device_id', deviceFilter)
      }
      if (stageFilter) {
        if (stageFilter === 'Welcome Message') {
          conversationsQuery = conversationsQuery.is('stage', null)
        } else {
          conversationsQuery = conversationsQuery.eq('stage', stageFilter)
        }
      }
      if (startDate) {
        conversationsQuery = conversationsQuery.gte('date_insert', startDate)
      }
      if (endDate) {
        conversationsQuery = conversationsQuery.lte('date_insert', endDate)
      }

      const { data: aiConversations } = await conversationsQuery

      // Set devices for dropdown
      setDevices(userDeviceIds)

      // Get unique stages from conversations (no extra query needed)
      const uniqueStages = [...new Set((aiConversations || []).map(c => c.stage || 'Welcome Message'))]
      setStages(uniqueStages)

      // Calculate device stats from database status column (no API calls)
      const totalDevices = devicesData?.length || 0
      const activeDevices = devicesData?.filter(d => d.status === 'CONNECTED').length || 0
      setStats({
        totalDevices,
        activeDevices,
        offlineDevices: totalDevices - activeDevices,
      })

      // Calculate analytics immediately
      calculateAnalytics(aiConversations || [])

      // Render charts with filtered data
      if (aiConversations && aiConversations.length > 0) {
        renderDailyTrendsChart(aiConversations)
        renderStageDistribution(aiConversations)
      } else {
        if (dailyTrendsChartInstance.current) {
          dailyTrendsChartInstance.current.destroy()
          dailyTrendsChartInstance.current = null
        }
        setStageDistribution([])
      }

      // Set loading to false - all data is ready
      setLoading(false)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      setLoading(false)
    }
  }

  const calculateAnalytics = (data: any[]) => {
    // Total Lead - all conversations
    const lead = data.length

    // Total Stuck Intro - stage is "Introduction"
    const stuckIntro = data.filter(c => c.stage === 'Introduction').length

    // Total Response - stage is not null and not "Introduction"
    const response = data.filter(c =>
      c.stage !== null &&
      c.stage !== undefined &&
      c.stage !== '' &&
      c.stage !== 'Introduction'
    ).length

    // Total Close - detail is not null
    const close = data.filter(c => c.detail !== null && c.detail !== undefined && c.detail !== '').length

    // Total Sales - sum of all RM values from HARGA field in details
    const totalSales = data.reduce((sum, c) => {
      if (!c.detail) return sum

      // Look for HARGA: RM{number} pattern (case insensitive)
      const hargaMatch = c.detail.match(/HARGA:\s*RM\s*(\d+)/i)

      if (hargaMatch && hargaMatch[1]) {
        const price = parseInt(hargaMatch[1], 10)
        return sum + price
      }

      return sum
    }, 0)

    // Closing Rate - Total Close / Total Lead * 100
    const rate = lead > 0 ? parseFloat(((close / lead) * 100).toFixed(2)) : 0

    setTotalLead(lead)
    setTotalStuckIntro(stuckIntro)
    setTotalResponse(response)
    setTotalClose(close)
    setTotalSales(totalSales)
    setClosingRate(rate)
  }

  const resetFilters = () => {
    setDeviceFilter('')
    setStageFilter('')
    setDefaultDates()
  }

  const renderDailyTrendsChart = (conversations: any[]) => {
    if (!dailyTrendsChartRef.current) return

    // Group conversations by date
    const dateGroups: Record<string, number> = {}
    conversations.forEach(conv => {
      if (conv.date_insert) {
        const date = new Date(conv.date_insert)
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
        dateGroups[dateStr] = (dateGroups[dateStr] || 0) + 1
      }
    })

    // Get last 7 days
    const labels: string[] = []
    const data: number[] = []
    const today = new Date()

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
      labels.push(dateStr)
      data.push(dateGroups[dateStr] || 0)
    }

    // Destroy previous chart if exists
    if (dailyTrendsChartInstance.current) {
      dailyTrendsChartInstance.current.destroy()
    }

    // Create new chart
    const ctx = dailyTrendsChartRef.current.getContext('2d')
    if (!ctx) return

    dailyTrendsChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Conversations',
          data: data,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    })
  }

  const renderStageDistribution = (conversations: any[]) => {
    // Count conversations by stage
    const stageCounts: Record<string, number> = {}
    conversations.forEach(conv => {
      const stage = conv.stage || 'Welcome Message'
      stageCounts[stage] = (stageCounts[stage] || 0) + 1
    })

    // Sort by count and get top 5 stages
    const sortedStages = Object.entries(stageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const total = conversations.length

    const distribution = sortedStages.map(([stage, count]) => ({
      stage,
      count,
      percentage: parseFloat(((count / total) * 100).toFixed(1))
    }))

    setStageDistribution(distribution)
  }

  const StatCard = ({ title, value, icon, color, subtitle }: { title: string; value: number; icon: string; color: string; subtitle: string }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900">
        {loading ? (
          <div className="h-9 w-20 bg-gray-200 animate-pulse rounded"></div>
        ) : (
          value
        )}
      </div>
      <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
    </div>
  )

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-primary-600 mb-2">Welcome back, {user?.full_name || 'User'}!</h2>
          <p className="text-gray-600">Here's an overview of your system and performance.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Devices"
            value={stats.totalDevices}
            icon="📱"
            color="bg-blue-100"
            subtitle="All registered devices"
          />
          <StatCard
            title="Active Devices"
            value={stats.activeDevices}
            icon="✅"
            color="bg-green-100"
            subtitle="Currently active"
          />
          <StatCard
            title="Offline Devices"
            value={stats.offlineDevices}
            icon="❌"
            color="bg-red-100"
            subtitle="Currently offline"
          />
        </div>

        {/* Analytics Cards - 6 cards in a row */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
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
            <div className="text-2xl font-bold text-amber-600">RM {totalSales.toLocaleString()}</div>
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

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 mb-8 card-soft transition-smooth">
          <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">Filter by Date Range</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Device</label>
              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Devices</option>
                {devices.map(device => (
                  <option key={device} value={device}>{device}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stage</label>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Stages</option>
                {stages.map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            <button
              onClick={resetFilters}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg transition-colors font-medium"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Conversation Trends</h3>
            <div className="h-64">
              <canvas ref={dailyTrendsChartRef}></canvas>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 card-soft transition-smooth">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl card-soft">
                <span className="text-white text-xl">📊</span>
              </div>
              <div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Stage Distribution</h3>
                <p className="text-sm text-gray-600 font-medium">Conversation stages breakdown</p>
              </div>
            </div>
            <div className="h-64 overflow-y-auto">
              {stageDistribution.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 bg-gradient-subtle rounded-lg">
                  <p className="font-medium">No data available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stageDistribution.map((item, index) => (
                    <div key={index} className="gradient-card rounded-xl p-4 card-soft card-hover transition-smooth border border-purple-100">
                      <div className="mb-3">
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Stage</span>
                        <div className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mt-1">
                          {item.percentage}%
                        </div>
                      </div>
                      <div className="mb-3">
                        <h4 className="font-bold text-gray-900 text-sm mb-1">{item.stage}</h4>
                        <p className="text-xs text-gray-600 font-medium">{item.count} conversations</p>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
