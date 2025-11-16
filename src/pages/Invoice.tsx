import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type InvoiceData = {
  payment: {
    id: string
    amount: number
    currency: string
    status: string
    paid_at: string
    created_at: string
    chip_transaction_id?: string
  }
  user: {
    full_name: string
    email: string
    phone?: string
  }
  package: {
    name: string
    description: string
    duration_days: number
  }
}

export default function Invoice() {
  const [searchParams] = useSearchParams()
  const paymentId = searchParams.get('payment')
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInvoice()
  }, [paymentId])

  const loadInvoice = async () => {
    if (!paymentId) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*, user(*), packages(*)')
        .eq('id', paymentId)
        .eq('status', 'paid')
        .single()

      if (error) throw error

      if (data) {
        setInvoice({
          payment: {
            id: data.id,
            amount: data.amount,
            currency: data.currency,
            status: data.status,
            paid_at: data.paid_at,
            created_at: data.created_at,
            chip_transaction_id: data.chip_transaction_id
          },
          user: {
            full_name: data.user.full_name,
            email: data.user.email,
            phone: data.user.phone
          },
          package: {
            name: data.packages.name,
            description: data.packages.description,
            duration_days: data.packages.duration_days
          }
        })
      }
    } catch (error) {
      console.error('Error loading invoice:', error)
      alert('Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: currency || 'MYR',
    }).format(amount)
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading invoice...</p>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Invoice Not Found</h2>
          <p className="mt-2 text-gray-600">This invoice does not exist or has been deleted.</p>
          <button
            onClick={() => window.close()}
            className="mt-6 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden print:shadow-none print:rounded-none">
        {/* Print Button - Hidden when printing */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-end print:hidden">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Invoice
          </button>
        </div>

        {/* Invoice Content */}
        <div className="p-8 print:p-12">
          {/* Header */}
          <div className="flex items-start justify-between mb-8 pb-8 border-b-2 border-gray-200">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">🤖</span>
                <h1 className="text-3xl font-black">
                  <span className="text-gray-900">Pening</span>
                  <span className="text-primary-600">Bot</span>
                </h1>
              </div>
              <p className="text-gray-600">WhatsApp Chatbot Automation Platform</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">INVOICE</h2>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Invoice #:</span> {invoice.payment.id.substring(0, 8).toUpperCase()}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Date:</span> {formatDate(invoice.payment.paid_at || invoice.payment.created_at)}
              </p>
              {invoice.payment.chip_transaction_id && (
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Transaction ID:</span> {invoice.payment.chip_transaction_id}
                </p>
              )}
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Bill To:</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-semibold text-gray-900">{invoice.user.full_name}</p>
              <p className="text-gray-600">{invoice.user.email}</p>
              {invoice.user.phone && (
                <p className="text-gray-600">{invoice.user.phone}</p>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Duration</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-4 px-4">
                    <p className="font-semibold text-gray-900">{invoice.package.name}</p>
                    <p className="text-sm text-gray-600">{invoice.package.description}</p>
                  </td>
                  <td className="py-4 px-4 text-right text-gray-600">
                    {invoice.package.duration_days} days
                  </td>
                  <td className="py-4 px-4 text-right font-semibold text-gray-900">
                    {formatCurrency(invoice.payment.amount, invoice.payment.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="flex justify-between py-2 border-t border-gray-200">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(invoice.payment.amount, invoice.payment.currency)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-t border-gray-200">
                <span className="text-gray-600">Tax:</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(0, invoice.payment.currency)}
                </span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-gray-300 bg-primary-50 px-4 rounded-lg mt-2">
                <span className="text-lg font-bold text-gray-900">Total:</span>
                <span className="text-lg font-bold text-primary-600">
                  {formatCurrency(invoice.payment.amount, invoice.payment.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-green-900">Payment Successful</p>
                <p className="text-sm text-green-700">
                  This invoice has been paid on {formatDate(invoice.payment.paid_at || invoice.payment.created_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-8 border-t border-gray-200">
            <p className="text-gray-600 text-sm mb-2">Thank you for your business!</p>
            <p className="text-gray-500 text-xs">
              For any questions regarding this invoice, please contact us at support@peningbot.com
            </p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:bg-white {
            background-color: white !important;
          }
          .print\\:py-0 {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:rounded-none {
            border-radius: 0 !important;
          }
          .print\\:p-12 {
            padding: 3rem !important;
          }
        }
      `}</style>
    </div>
  )
}
