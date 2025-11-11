import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase, Package } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'

export default function Packages() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPackage, setEditingPackage] = useState<Package | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'MYR',
    duration_days: '30',
    max_devices: '1',
    features: ''
  })

  useEffect(() => {
    // Check if user is admin
    if (user && user.role !== 'admin') {
      Swal.fire({
        icon: 'error',
        title: 'Access Denied!',
        text: 'Only administrators can access the Packages page',
      }).then(() => {
        navigate('/dashboard')
      })
      return
    }
    loadPackages()
  }, [user, navigate])

  const loadPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPackages(data || [])
    } catch (error) {
      console.error('Error loading packages:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Load Failed',
        text: 'Failed to load packages',
      })
    } finally {
      setLoading(false)
    }
  }

  const openModal = (pkg?: Package) => {
    if (pkg) {
      setEditingPackage(pkg)
      setFormData({
        name: pkg.name,
        description: pkg.description || '',
        price: pkg.price.toString(),
        currency: pkg.currency,
        duration_days: pkg.duration_days.toString(),
        max_devices: pkg.max_devices.toString(),
        features: Array.isArray(pkg.features) ? pkg.features.join('\n') : ''
      })
    } else {
      setEditingPackage(null)
      setFormData({
        name: '',
        description: '',
        price: '',
        currency: 'MYR',
        duration_days: '30',
        max_devices: '1',
        features: ''
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingPackage(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const featuresArray = formData.features
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0)

    const packageData = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      currency: formData.currency,
      duration_days: parseInt(formData.duration_days),
      max_devices: parseInt(formData.max_devices),
      features: featuresArray,
      is_active: true,
      updated_at: new Date().toISOString()
    }

    try {
      if (editingPackage) {
        const { data, error } = await supabase
          .from('packages')
          .update(packageData)
          .eq('id', editingPackage.id)
          .select()

        console.log('Update result:', { data, error })
        if (error) throw error

        closeModal()
        await loadPackages()
        await Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Package updated successfully!',
          timer: 2000,
          showConfirmButton: false,
        })
      } else {
        const { data, error } = await supabase
          .from('packages')
          .insert([packageData])
          .select()

        console.log('Insert result:', { data, error })
        if (error) throw error

        closeModal()
        await loadPackages()
        await Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Package created successfully!',
          timer: 2000,
          showConfirmButton: false,
        })
      }
    } catch (error: any) {
      console.error('Error saving package:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: error.message || 'Failed to save package',
      })
    }
  }

  const handleDelete = async (pkg: Package) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Package?',
      html: `Are you sure you want to delete "<strong>${pkg.name}</strong>"?<br>This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    })

    if (!result.isConfirmed) return

    try {
      const { error } = await supabase
        .from('packages')
        .delete()
        .eq('id', pkg.id)

      if (error) throw error

      await Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Package deleted successfully!',
        timer: 2000,
        showConfirmButton: false,
      })

      loadPackages()
    } catch (error: any) {
      console.error('Error deleting package:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: error.message || 'Failed to delete package',
      })
    }
  }

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('packages')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error
      loadPackages()
    } catch (error: any) {
      await Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: error.message || 'Failed to update package',
      })
    }
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Package Management</h2>
            <p className="text-gray-600">Manage subscription packages (Admin Only)</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            <span>New Package</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
          </div>
        ) : packages.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Packages Yet</h3>
            <p className="text-gray-600">Click "New Package" to add your first billing package</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Package Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Devices</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {packages.map((pkg, index) => (
                  <tr key={pkg.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pkg.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{pkg.currency} {pkg.price.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{pkg.duration_days} days</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{pkg.max_devices}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleActive(pkg.id, pkg.is_active)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          pkg.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {pkg.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModal(pkg)}
                          className="text-blue-600 hover:text-blue-800 text-lg"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(pkg)}
                          className="text-red-600 hover:text-red-800 text-lg"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={closeModal}>
          <div className="bg-white rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              {editingPackage ? 'Edit Package' : 'Add New Package'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Pro Plan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={2}
                  placeholder="Brief description of the package"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="MYR">MYR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
                  <input
                    type="number"
                    required
                    value={formData.duration_days}
                    onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Devices</label>
                  <input
                    type="number"
                    required
                    value={formData.max_devices}
                    onChange={(e) => setFormData({ ...formData, max_devices: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Features (one per line)</label>
                <textarea
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={5}
                  placeholder="Full system access&#10;All features unlocked&#10;24/7 support"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  {editingPackage ? 'Update Package' : 'Create Package'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
