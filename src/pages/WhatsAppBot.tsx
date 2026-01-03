import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

type BotConversation = {
  id_prospect: number
  id_device: string
  prospect_name: string
  prospect_num: string
  stage: string
  status: string
  execution_status: string
  created_at: string
}

export default function WhatsAppBot() {
  const [conversations, setConversations] = useState<BotConversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('wasapbot')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setConversations(data || [])
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">WhatsApp Bot Conversations</h2>
          <p className="text-gray-600">View and manage WhatsApp bot conversations</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-600">No WhatsApp conversations yet</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Device</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Stage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {conversations.map((conv) => (
                  <tr key={conv.id_prospect} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{conv.prospect_name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{conv.prospect_num}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{conv.id_device}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{conv.stage || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        conv.status === 'Prospek'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {conv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
