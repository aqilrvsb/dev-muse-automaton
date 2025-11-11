import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Stats = {
  totalConversations: number
  chatbotAI: number
  whatsappBot: number
  activeDevices: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    totalConversations: 0,
    chatbotAI: 0,
    whatsappBot: 0,
    activeDevices: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      // Fetch AI WhatsApp conversations
      const { data: aiConversations } = await supabase
        .from('ai_whatsapp')
        .select('id_prospect', { count: 'exact' })

      // Fetch WhatsApp Bot conversations
      const { data: botConversations } = await supabase
        .from('wasapbot')
        .select('id_prospect', { count: 'exact' })

      // Fetch active devices
      const { data: devices } = await supabase
        .from('device_setting')
        .select('id', { count: 'exact' })

      const aiCount = aiConversations?.length || 0
      const botCount = botConversations?.length || 0

      setStats({
        totalConversations: aiCount + botCount,
        chatbotAI: aiCount,
        whatsappBot: botCount,
        activeDevices: devices?.length || 0,
      })
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
            title="WhatsApp Bot"
            value={stats.whatsappBot}
            icon="📱"
            color="bg-green-100"
            subtitle="Bot conversations"
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
              <select className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option>All Devices</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stage</label>
              <select className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option>All Stages</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            <button className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg transition-colors font-medium">
              Apply Filters
            </button>
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg transition-colors font-medium">
              Reset Filters
            </button>
          </div>
        </div>

        {/* Charts Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Conversation Trends</h3>
            <div className="h-64 flex items-center justify-center text-gray-400">
              <p>Chart visualization coming soon</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Stage Distribution</h3>
            <div className="h-64 flex items-center justify-center text-gray-400">
              <p>Chart visualization coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
