import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase, Flow } from '../lib/supabase'

export default function FlowManager() {
  const navigate = useNavigate()
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFlows()
  }, [])

  const loadFlows = async () => {
    try {
      const { data, error } = await supabase
        .from('chatbot_flows')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setFlows(data || [])
    } catch (error) {
      console.error('Error loading flows:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this flow?')) return

    try {
      const { error } = await supabase
        .from('chatbot_flows')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadFlows()
    } catch (error: any) {
      alert(error.message || 'Failed to delete flow')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Flow Manager</h2>
            <p className="text-gray-600">Manage your chatbot flows</p>
          </div>
          <button
            onClick={() => navigate('/flow-builder')}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
          >
            + Create New Flow
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
          </div>
        ) : flows.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-600 text-lg">No flows created yet</p>
            <p className="text-gray-500 mt-2">Click "Create New Flow" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {flows.map((flow) => (
              <div key={flow.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:border-primary-500 hover:shadow-md transition-all shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{flow.name}</h3>
                  <span className="text-2xl">🔄</span>
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <p className="text-gray-600 text-sm">Device</p>
                    <p className="text-gray-900 font-medium">{flow.id_device || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Niche</p>
                    <p className="text-gray-900 font-medium">{flow.niche || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Created</p>
                    <p className="text-gray-900 font-medium text-sm">{formatDate(flow.created_at)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/flow-builder?id=${flow.id}`)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(flow.id)}
                    className="flex-1 bg-red-50 hover:bg-red-600 border border-red-300 hover:border-transparent text-red-600 hover:text-white px-4 py-2 rounded-lg transition-colors text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
