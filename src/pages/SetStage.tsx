import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

type StageValue = {
  stagesetvalue_id: number
  id_device: string
  stage: string
  type_inputdata: string
  columnsdata: string
  inputhardcode: string
}

export default function SetStage() {
  const [stageValues, setStageValues] = useState<StageValue[]>([])
  const [devices, setDevices] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  const [formData, setFormData] = useState({
    id_device: '',
    stage: '',
    type_inputdata: '',
    columnsdata: '',
    inputhardcode: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load stage values
      const { data: stageData } = await supabase
        .from('stagesetvalue')
        .select('*')
        .order('stagesetvalue_id', { ascending: false })

      // Load unique devices
      const { data: deviceData } = await supabase
        .from('device_setting')
        .select('device_id')

      setStageValues(stageData || [])
      setDevices(deviceData?.map(d => d.device_id) || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { error } = await supabase
        .from('stagesetvalue')
        .insert(formData)

      if (error) throw error

      setShowAddModal(false)
      setFormData({
        id_device: '',
        stage: '',
        type_inputdata: '',
        columnsdata: '',
        inputhardcode: '',
      })
      loadData()
    } catch (error: any) {
      alert(error.message || 'Failed to add stage value')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this stage value?')) return

    try {
      const { error } = await supabase
        .from('stagesetvalue')
        .delete()
        .eq('stagesetvalue_id', id)

      if (error) throw error
      loadData()
    } catch (error: any) {
      alert(error.message || 'Failed to delete')
    }
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Set Stage</h2>
            <p className="text-gray-600">Configure stage values for your devices</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
          >
            + Add Stage Value
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
          </div>
        ) : stageValues.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-600">No stage values configured</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Device</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Stage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Column</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stageValues.map((sv) => (
                  <tr key={sv.stagesetvalue_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{sv.id_device}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{sv.stage}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{sv.type_inputdata}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{sv.columnsdata}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{sv.inputhardcode}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleDelete(sv.stagesetvalue_id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-md shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Add Stage Value</h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Device</label>
                  <select
                    value={formData.id_device}
                    onChange={(e) => setFormData({ ...formData, id_device: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Select device</option>
                    {devices.map(device => (
                      <option key={device} value={device}>{device}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Stage</label>
                  <input
                    type="text"
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Input Type</label>
                  <input
                    type="text"
                    value={formData.type_inputdata}
                    onChange={(e) => setFormData({ ...formData, type_inputdata: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Column</label>
                  <input
                    type="text"
                    value={formData.columnsdata}
                    onChange={(e) => setFormData({ ...formData, columnsdata: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Hardcoded Value</label>
                  <input
                    type="text"
                    value={formData.inputhardcode}
                    onChange={(e) => setFormData({ ...formData, inputhardcode: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
