import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

type Stats = {
  totalConversations: number
  chatbotAI: number
  activeDevices: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    totalConversations: 0,
    chatbotAI: 0,
    activeDevices: 0,
  })
  const [loading, setLoading] = useState(true)

  // Filter states
  const [deviceFilter, setDeviceFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [devices, setDevices] = useState<string[]>([])
  const [stages, setStages] = useState<string[]>([])

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

      // Fetch user's devices first (for non-admin users)
      let userDeviceIds: string[] = []
      if (user && user.role !== 'admin') {
        const { data: userDevices } = await supabase
          .from('device_setting')
          .select('device_id')
          .eq('user_id', user.id)

        userDeviceIds = userDevices?.map(d => d.device_id) || []
      }

      // Build query for AI WhatsApp conversations with filters
      let query = supabase
        .from('ai_whatsapp')
        .select('*')

      // For non-admin users, filter by their device IDs
      if (user && user.role !== 'admin' && userDeviceIds.length > 0) {
        query = query.in('device_id', userDeviceIds)
      }

      // Apply device filter
      if (deviceFilter) {
        query = query.eq('device_id', deviceFilter)
      }

      // Apply stage filter
      if (stageFilter) {
        if (stageFilter === 'Welcome Message') {
          query = query.is('stage', null)
        } else {
          query = query.eq('stage', stageFilter)
        }
      }

      // Apply date range filter using date_insert
      if (startDate) {
        query = query.gte('date_insert', startDate)
      }
      if (endDate) {
        query = query.lte('date_insert', endDate)
      }

      const { data: aiConversations } = await query

      // Extract unique devices and stages for filter dropdowns
      let allConversationsQuery = supabase
        .from('ai_whatsapp')
        .select('device_id, stage')

      // For non-admin users, filter dropdown options by their devices
      if (user && user.role !== 'admin' && userDeviceIds.length > 0) {
        allConversationsQuery = allConversationsQuery.in('device_id', userDeviceIds)
      }

      const { data: allConversations } = await allConversationsQuery

      if (allConversations) {
        const uniqueDevices = [...new Set(allConversations.map(c => c.device_id).filter(Boolean))]
        const uniqueStages = [...new Set(allConversations.map(c => c.stage || 'Welcome Message'))]
        setDevices(uniqueDevices)
        setStages(uniqueStages)
      }

      // Fetch active devices (admin sees all, users see only their own)
      let devicesQuery = supabase
        .from('device_setting')
        .select('id', { count: 'exact' })

      if (user && user.role !== 'admin') {
        devicesQuery = devicesQuery.eq('user_id', user.id)
      }

      const { data: devicesData } = await devicesQuery

      const aiCount = aiConversations?.length || 0

      setStats({
        totalConversations: aiCount,
        chatbotAI: aiCount,
        activeDevices: devicesData?.length || 0,
      })

      // Render charts with filtered data
      if (aiConversations && aiConversations.length > 0) {
        renderDailyTrendsChart(aiConversations)
        renderStageDistribution(aiConversations)
      } else {
        // Clear charts if no data
        if (dailyTrendsChartInstance.current) {
          dailyTrendsChartInstance.current.destroy()
          dailyTrendsChartInstance.current = null
        }
        setStageDistribution([])
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
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
            title="Total Conversations"
            value={stats.totalConversations}
            icon="💬"
            color="bg-blue-100"
            subtitle="All conversations"
          />
          <StatCard
            title="Chatbot AI"
            value={stats.chatbotAI}
            icon="🤖"
            color="bg-purple-100"
            subtitle="AI conversations"
          />
          <StatCard
            title="Active Devices"
            value={stats.activeDevices}
            icon="📟"
            color="bg-orange-100"
            subtitle="Connected devices"
          />
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter by Date Range</h3>
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
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Stage Distribution</h3>
            <div className="h-64 overflow-y-auto">
              {stageDistribution.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <p>No data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stageDistribution.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">{item.stage}</span>
                        <span className="text-sm text-gray-500">{item.count} conversations</span>
                      </div>
                      <div className="relative w-full h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-end pr-3"
                          style={{ width: `${item.percentage}%` }}
                        >
                          <span className="text-xs font-semibold text-white">{item.percentage}%</span>
                        </div>
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
