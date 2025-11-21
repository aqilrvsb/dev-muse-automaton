import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase, Package } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

type Payment = {
  id: string
  package_id: string
  amount: number
  currency: string
  status: string
  created_at: string
  chip_purchase_id?: string
  packages?: Package
}

export default function Billings() {
  const { user } = useAuth()
  const [packages, setPackages] = useState<Package[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [currentPackage, setCurrentPackage] = useState<Package | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [recheckingPayments, setRecheckingPayments] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadBillingData()
  }, [user?.package_id])

  const loadBillingData = async () => {
    try {
      // Load packages
      const { data: packagesData } = await supabase
        .from('packages')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true })

      // Load current user's package if they have one
      if (user?.package_id) {
        const { data: userPackageData } = await supabase
          .from('packages')
          .select('*')
          .eq('id', user.package_id)
          .single()

        setCurrentPackage(userPackageData)
      } else {
        setCurrentPackage(null)
      }

      // Load payment history
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*, packages(*)')
        .order('created_at', { ascending: false })

      setPackages(packagesData || [])
      setPayments(paymentsData || [])
    } catch (error) {
      console.error('Error loading billing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: currency || 'MYR',
    }).format(amount)
  }

  const handleUpgrade = async (pkg: Package) => {
    if (!user?.id) {
      await Swal.fire({
        icon: 'error',
        title: 'Not Logged In',
        text: 'Please log in to upgrade',
      })
      return
    }

    if (user.package_id === pkg.id) {
      await Swal.fire({
        icon: 'info',
        title: 'Already Subscribed',
        text: 'You are already on this plan',
      })
      return
    }

    setProcessing(true)

    try {
      // Create CHIP payment order via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('chip-payment-topup', {
        body: {
          user_id: user.id,
          package_id: pkg.id,
          amount: pkg.price,
          description: `Subscription - ${pkg.name}`,
        },
      })

      if (error) throw error

      if (data?.payment_url) {
        // Redirect to payment page in current tab
        window.location.href = data.payment_url
      } else {
        throw new Error('No payment URL received')
      }
    } catch (error: any) {
      console.error('Error creating payment:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Payment Failed',
        text: error.message || 'Failed to create payment. Please try again.',
      })
    } finally {
      setProcessing(false)
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
          text: 'Your subscription has been activated.',
        })
        await loadBillingData()
      } else if (data.new_status === 'failed') {
        await Swal.fire({
          icon: 'error',
          title: 'Payment Failed',
          text: 'Please try making a new purchase.',
        })
        await loadBillingData()
      } else {
        await Swal.fire({
          icon: 'info',
          title: 'Payment Pending',
          text: 'Payment is still pending. Please wait or try again later.',
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

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Billings & Subscription</h2>
          <p className="text-gray-600">Manage your subscription and view payment history</p>
        </div>

        {/* Current Subscription */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl p-6 mb-8 text-white shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 mb-1">Current Plan</p>
              <h3 className="text-3xl font-bold">{currentPackage?.name || user?.status || 'Trial'}</h3>
              <p className="text-purple-100 mt-2">
                {user?.subscription_end
                  ? `Renews on ${formatDate(user.subscription_end)}`
                  : 'No active subscription'}
              </p>
              {user?.subscription_status && (
                <p className="text-sm text-purple-200 mt-1">
                  Status: {user.subscription_status.charAt(0).toUpperCase() + user.subscription_status.slice(1)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-purple-100 mb-1">Device Limit</p>
              <p className="text-4xl font-bold">{user?.max_devices || 0}</p>
              <p className="text-sm text-purple-200 mt-1">devices</p>
            </div>
          </div>
        </div>

        {/* Available Packages */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Available Plans</h3>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white border border-gray-200 rounded-xl p-6 hover:border-primary-500 hover:shadow-md transition-all shadow-sm"
                >
                  <h4 className="text-xl font-bold text-gray-900 mb-2">{pkg.name}</h4>
                  <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">
                      {formatCurrency(pkg.price, pkg.currency)}
                    </span>
                    <span className="text-gray-600 ml-2">/month</span>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {Array.isArray(pkg.features) && pkg.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-gray-600">
                        <span className="text-green-600">✓</span>
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(pkg)}
                    disabled={processing || user?.package_id === pkg.id}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? 'Processing...' : user?.package_id === pkg.id ? 'Current Plan' : 'Upgrade'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment History */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Payment History</h3>

          {payments.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
              <p className="text-gray-600">No payment history yet</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Package
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(payment.created_at)}
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
                          {payment.status}
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
