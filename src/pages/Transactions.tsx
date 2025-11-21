import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

type Payment = {
  id: string
  user_id: string
  package_id: string
  amount: number
  currency: string
  status: string
  chip_purchase_id?: string
  chip_transaction_id?: string
  paid_at?: string
  created_at: string
  user?: {
    id: string
    email: string
    full_name: string
  }
  packages?: {
    id: string
    name: string
  }
}

export default function Transactions() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [recheckingPayments, setRecheckingPayments] = useState<Set<string>>(new Set())

  useEffect(() => {
    setDefaultDates()
  }, [])

  useEffect(() => {
    // Check if user is admin
    if (user && user.role !== 'admin') {
      Swal.fire({
        icon: 'error',
        title: 'Access Denied!',
        text: 'Only administrators can access the Transactions page',
      }).then(() => {
        navigate('/dashboard')
      })
      return
    }
    if (startDate && endDate) {
      loadPayments()
    }
  }, [user, navigate, startDate, endDate, statusFilter])

  const setDefaultDates = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')

    setStartDate(`${year}-${month}-01`)
    setEndDate(`${year}-${month}-${day}`)
  }

  const loadPayments = async () => {
    try {
      // First, get all payments without date filter
      let query = supabase
        .from('payments')
        .select('*, user(*), packages(*)')
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error

      // Filter by date on the client side using Y-m-d format
      let filteredData = data || []
      if (startDate || endDate) {
        filteredData = filteredData.filter(payment => {
          if (!payment.created_at) return false

          // Extract Y-m-d from created_at (handles both date strings and timestamps)
          const paymentDate = payment.created_at.split('T')[0]

          if (startDate && paymentDate < startDate) return false
          if (endDate && paymentDate > endDate) return false
          return true
        })
      }

      setPayments(filteredData)
    } catch (error) {
      console.error('Error loading payments:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Load Failed',
        text: 'Failed to load payments',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRecheck = async (paymentId: string) => {
    setRecheckingPayments(prev => new Set(prev).add(paymentId))

    try {
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { payment_id: paymentId }
      })

      if (error) throw error

      if (data.new_status === 'paid') {
        await Swal.fire({
          icon: 'success',
          title: 'Payment Verified!',
          text: 'Subscription activated.',
        })
        await loadPayments()
      } else if (data.new_status === 'failed') {
        await Swal.fire({
          icon: 'error',
          title: 'Payment Failed',
          text: 'Payment has failed.',
        })
        await loadPayments()
      } else {
        await Swal.fire({
          icon: 'info',
          title: 'Payment Pending',
          text: 'Payment is still pending.',
        })
      }
    } catch (error: any) {
      console.error('Error rechecking payment:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Check Failed',
        text: error.message || 'Failed to check payment status',
      })
    } finally {
      setRecheckingPayments(prev => {
        const newSet = new Set(prev)
        newSet.delete(paymentId)
        return newSet
      })
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

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: currency || 'MYR',
    }).format(amount)
  }

  const resetFilters = () => {
    setStatusFilter('all')
    setDefaultDates()
  }

  // Calculate statistics
  const totalTransactions = payments.length
  const totalSuccess = payments.filter(p => p.status === 'paid').length
  const totalFailed = payments.filter(p => p.status === 'failed').length
  const totalPending = payments.filter(p => p.status === 'pending').length
  const totalRevenue = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Transaction Management</h2>
          <p className="text-gray-600">View and manage all payment transactions (Admin Only)</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-blue-600 mt-2">{totalTransactions}</p>
              </div>
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success</p>
                <p className="text-2xl font-bold text-green-600 mt-2">{totalSuccess}</p>
              </div>
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600 mt-2">{totalFailed}</p>
              </div>
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600 mt-2">{totalPending}</p>
              </div>
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-purple-600 mt-2">{formatCurrency(totalRevenue, 'MYR')}</p>
              </div>
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Success</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={resetFilters}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg transition-colors font-medium"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
            </div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-600">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Package</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map((payment, index) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(payment.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.user?.full_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {payment.user?.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.packages?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(payment.amount, payment.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          payment.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : payment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {payment.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {payment.status === 'pending' && payment.chip_purchase_id ? (
                          <button
                            onClick={() => handleRecheck(payment.id)}
                            disabled={recheckingPayments.has(payment.id)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className={`w-4 h-4 ${recheckingPayments.has(payment.id) ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Recheck
                          </button>
                        ) : payment.status === 'paid' ? (
                          <button
                            onClick={() => window.open(`/invoice?payment=${payment.id}`, '_blank')}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-md font-medium transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Invoice
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
