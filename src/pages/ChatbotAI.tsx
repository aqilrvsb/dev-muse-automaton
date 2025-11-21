import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'
import { Phone, CheckCircle, XCircle, DollarSign, TrendingUp } from 'lucide-react'

type AIConversation = {
  id_prospect: number
  device_id: string
  prospect_name: string
  prospect_num: string
  niche: string
  stage: string
  human: number
  date_insert: string
  conv_last: string
  detail: string
}

export default function ChatbotAI() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<AIConversation[]>([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [deviceFilter, setDeviceFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Analytics states - 6 boxes
  const [totalLead, setTotalLead] = useState(0)
  const [stuckIntro, setStuckIntro] = useState(0)
  const [response, setResponse] = useState(0)
  const [close, setClose] = useState(0)
  const [sales, setSales] = useState(0)
  const [closingRate, setClosingRate] = useState(0)

  // Unique values for filters
  const [devices, setDevices] = useState<string[]>([])
  const [stages, setStages] = useState<string[]>([])

  useEffect(() => {
    loadConversations()
    setDefaultDates()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [conversations, deviceFilter, stageFilter, startDate, endDate, searchQuery])

  const setDefaultDates = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')

    setStartDate(`${year}-${month}-01`)
    setEndDate(`${year}-${month}-${day}`)
  }

  const loadConversations = async () => {
    try {
      // Fetch user's devices first (for non-admin users)
      let userDeviceIds: string[] = []
      if (user && user.role !== 'admin') {
        const { data: userDevices } = await supabase
          .from('device_setting')
          .select('device_id')
          .eq('user_id', user.id)

        userDeviceIds = userDevices?.map(d => d.device_id) || []
      }

      // Build query for AI WhatsApp conversations
      let query = supabase
        .from('ai_whatsapp')
        .select('*')
        .order('date_insert', { ascending: false })

      // For non-admin users, filter by their device IDs
      if (user && user.role !== 'admin' && userDeviceIds.length > 0) {
        query = query.in('device_id', userDeviceIds)
      }

      const { data, error } = await query

      if (error) throw error

      const convData = data || []
      setConversations(convData)

      // Extract unique devices from device_setting table (not from conversations)
      let deviceSettingsQuery = supabase
        .from('device_setting')
        .select('device_id')

      // For non-admin users, filter by their devices
      if (user && user.role !== 'admin') {
        deviceSettingsQuery = deviceSettingsQuery.eq('user_id', user.id)
      }

      const { data: deviceSettings } = await deviceSettingsQuery

      const uniqueDevices = deviceSettings ? [...new Set(deviceSettings.map(d => d.device_id).filter(Boolean))] : []
      const uniqueStages = [...new Set(convData.map(c => c.stage || 'Welcome Message'))]
      setDevices(uniqueDevices)
      setStages(uniqueStages)

    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...conversations]

    // Device filter
    if (deviceFilter) {
      filtered = filtered.filter(c => c.device_id === deviceFilter)
    }

    // Stage filter
    if (stageFilter) {
      filtered = filtered.filter(c => (c.stage || 'Welcome Message') === stageFilter)
    }

    // Date range filter
    if (startDate || endDate) {
      filtered = filtered.filter(c => {
        if (!c.date_insert) return false
        const convDate = new Date(c.date_insert)
        const dateStr = convDate.toISOString().split('T')[0]

        if (startDate && dateStr < startDate) return false
        if (endDate && dateStr > endDate) return false
        return true
      })
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c =>
        (c.prospect_name && c.prospect_name.toLowerCase().includes(query)) ||
        (c.prospect_num && c.prospect_num.toLowerCase().includes(query)) ||
        (c.niche && c.niche.toLowerCase().includes(query))
      )
    }

    setFilteredConversations(filtered)
    calculateAnalytics(filtered)
  }

  const calculateAnalytics = (data: AIConversation[]) => {
    // Total Lead - all conversations
    const lead = data.length

    // Stuck Intro - conversations with stage = "Introduction"
    const stuck = data.filter(c => c.stage === 'Introduction').length

    // Response - conversations with non-null stage and not "Introduction"
    const resp = data.filter(c =>
      c.stage !== null &&
      c.stage !== undefined &&
      c.stage !== '' &&
      c.stage !== 'Introduction'
    ).length

    // Close - conversations with non-null detail field (captured customer details)
    const closed = data.filter(c => c.detail !== null && c.detail !== undefined && c.detail !== '').length

    // Sales - sum of all RM values from HARGA field in details
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

    // Closing Rate - (Close / Lead) * 100
    const rate = lead > 0 ? parseFloat(((closed / lead) * 100).toFixed(2)) : 0

    setTotalLead(lead)
    setStuckIntro(stuck)
    setResponse(resp)
    setClose(closed)
    setSales(totalSales)
    setClosingRate(rate)
  }

  const resetFilters = () => {
    setDeviceFilter('')
    setStageFilter('')
    setSearchQuery('')
    setDefaultDates()
  }

  const exportToCSV = () => {
    if (filteredConversations.length === 0) {
      Swal.fire({
        title: 'No Data',
        text: 'No conversations to export',
        icon: 'warning',
        confirmButtonColor: '#667eea',
      })
      return
    }

    // CSV header with conversation history and details column
    let csv = 'No,ID Device,Date,Name,Phone Number,Niche,Stage,Details,Reply Status,Conversation History\n'

    filteredConversations.forEach((conv, index) => {
      const dateFormatted = conv.date_insert ? new Date(conv.date_insert).toLocaleDateString() : '-'
      const replyStatus = conv.human === 1 ? 'Human' : 'AI'

      // Escape conversation history for CSV while preserving newlines
      const convHistory = (conv.conv_last || 'No conversation history')
        .replace(/"/g, '""') // Escape double quotes

      // Escape details for CSV
      const details = (conv.detail || '-')
        .replace(/"/g, '""') // Escape double quotes

      csv += `${index + 1},"${conv.device_id || '-'}","${dateFormatted}","${conv.prospect_name || '-'}","${conv.prospect_num || '-'}","${conv.niche || '-'}","${conv.stage || 'Welcome Message'}","${details}","${replyStatus}","${convHistory}"\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chatbot-ai-conversations-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    Swal.fire({
      title: 'Success!',
      text: `Exported ${filteredConversations.length} conversations to CSV`,
      icon: 'success',
      confirmButtonColor: '#667eea',
    })
  }

  const viewDetail = (conv: AIConversation) => {
    Swal.fire({
      title: 'Customer Details',
      html: `
        <div style="text-align: left; font-family: monospace; font-size: 14px;">
          <p><strong>Phone:</strong> ${conv.prospect_num || '-'}</p>
          <p><strong>Name:</strong> ${conv.prospect_name || '-'}</p>
          <p><strong>Device:</strong> ${conv.device_id || '-'}</p>
          <p><strong>Niche:</strong> ${conv.niche || '-'}</p>
          <p><strong>Stage:</strong> ${conv.stage || 'Welcome Message'}</p>
          <hr style="margin: 15px 0;">
          ${conv.detail ? `
          <p><strong>Customer Details:</strong></p>
          <div style="background: #e8f4fd; padding: 10px; border-radius: 5px; white-space: pre-wrap; text-align: left; border-left: 3px solid #667eea;">
${conv.detail}
          </div>
          ` : '<p style="text-align: center; color: #999;">No customer details captured</p>'}
        </div>
      `,
      width: '700px',
      confirmButtonText: 'OK',
      confirmButtonColor: '#667eea',
    })
  }

  const viewConversation = (conv: AIConversation) => {
    Swal.fire({
      title: 'Conversation Details',
      html: `
        <div style="text-align: left; font-family: monospace; font-size: 14px;">
          <p><strong>Phone:</strong> ${conv.prospect_num || '-'}</p>
          <p><strong>Name:</strong> ${conv.prospect_name || '-'}</p>
          <p><strong>Device:</strong> ${conv.device_id || '-'}</p>
          <p><strong>Niche:</strong> ${conv.niche || '-'}</p>
          <p><strong>Stage:</strong> ${conv.stage || 'Welcome Message'}</p>
          <hr style="margin: 15px 0;">
          ${conv.detail ? `
          <p><strong>Customer Details:</strong></p>
          <div style="background: #e8f4fd; padding: 10px; border-radius: 5px; margin-bottom: 15px; white-space: pre-wrap; text-align: left; border-left: 3px solid #667eea;">
${conv.detail}
          </div>
          <hr style="margin: 15px 0;">
          ` : ''}
          <p><strong>Conversation History:</strong></p>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 5px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; text-align: left;">
${conv.conv_last || 'No conversation history'}
          </div>
        </div>
      `,
      width: '700px',
      confirmButtonText: 'OK',
      confirmButtonColor: '#667eea',
    })
  }

  const changeStatus = async (conv: AIConversation) => {
    const result = await Swal.fire({
      title: 'Change Status',
      html: `
        <p style="margin-bottom: 15px;">Current status: <strong>${conv.human === 1 ? 'Human' : 'AI'}</strong></p>
        <p>Select new status for this conversation:</p>
      `,
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'AI',
      denyButtonText: 'Human',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#10B981',
      denyButtonColor: '#F59E0B',
    })

    if (result.isConfirmed || result.isDenied) {
      const newHumanValue = result.isDenied ? 1 : null
      const newStatus = result.isDenied ? 'Human' : 'AI'

      try {
        const { error } = await supabase
          .from('ai_whatsapp')
          .update({ human: newHumanValue })
          .eq('prospect_num', conv.prospect_num)

        if (error) throw error

        Swal.fire({
          title: 'Updated!',
          text: `Status changed to ${newStatus}`,
          icon: 'success',
          confirmButtonColor: '#667eea',
        })
        loadConversations()
      } catch (error) {
        console.error('Error updating status:', error)
        Swal.fire({
          title: 'Error!',
          text: 'Failed to update status',
          icon: 'error',
          confirmButtonColor: '#d33',
        })
      }
    }
  }

  const deleteConversation = async (prospectNum: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'This will delete the conversation and all scheduled sequence messages',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    })

    if (!result.isConfirmed) return

    try {
      // Step 1: Get conversation to find device_id
      const { data: conversation } = await supabase
        .from('ai_whatsapp')
        .select('device_id')
        .eq('prospect_num', prospectNum)
        .single()

      if (!conversation) throw new Error('Conversation not found')

      // Step 2: Get all scheduled messages for this prospect
      const { data: scheduledMessages } = await supabase
        .from('sequence_scheduled_messages')
        .select('id, whacenter_message_id, device_id')
        .eq('prospect_num', prospectNum)
        .eq('status', 'scheduled')

      // Step 3: Delete scheduled messages from WhatsApp Center API
      if (scheduledMessages && scheduledMessages.length > 0) {
        console.log(`Deleting ${scheduledMessages.length} scheduled messages from WhatsApp Center...`)

        const { data: device } = await supabase
          .from('device_setting')
          .select('instance')
          .eq('device_id', conversation.device_id)
          .single()

        if (device) {
          for (const msg of scheduledMessages) {
            if (msg.whacenter_message_id) {
              try {
                const WHACENTER_API_URL = import.meta.env.VITE_WHACENTER_API_URL || 'https://api.whacenter.com'
                const deleteUrl = `${WHACENTER_API_URL}/api/deleteMessage?device_id=${encodeURIComponent(device.instance)}&id=${encodeURIComponent(msg.whacenter_message_id)}`

                await fetch(deleteUrl, {
                  method: 'GET',
                  mode: 'no-cors' // Handle CORS gracefully
                })
                console.log(`Deleted scheduled message: ${msg.whacenter_message_id}`)
              } catch (apiError) {
                console.log('WhatsApp API call skipped (CORS or network issue):', apiError)
              }
            }
          }
        }

        // Step 4: Update database status to 'cancelled'
        await supabase
          .from('sequence_scheduled_messages')
          .update({ status: 'cancelled' })
          .eq('prospect_num', prospectNum)
          .eq('status', 'scheduled')

        console.log(`Updated ${scheduledMessages.length} scheduled messages to cancelled`)
      }

      // Step 5: Delete enrollment records
      const { error: enrollmentError } = await supabase
        .from('sequence_enrollments')
        .delete()
        .eq('prospect_num', prospectNum)

      if (enrollmentError) {
        console.error('Error deleting enrollments:', enrollmentError)
      } else {
        console.log(`Deleted enrollment records for ${prospectNum}`)
      }

      // Step 6: Delete conversation from ai_whatsapp
      const { error } = await supabase
        .from('ai_whatsapp')
        .delete()
        .eq('prospect_num', prospectNum)

      if (error) throw error

      Swal.fire({
        title: 'Deleted!',
        text: 'Conversation and all scheduled messages deleted successfully',
        icon: 'success',
        confirmButtonColor: '#667eea',
      })
      loadConversations()
    } catch (error) {
      console.error('Error deleting conversation:', error)
      Swal.fire({
        title: 'Error!',
        text: 'Failed to delete conversation',
        icon: 'error',
        confirmButtonColor: '#d33',
      })
    }
  }

  // View scheduled sequences for a prospect
  const viewSequences = async (prospectNum: string) => {
    try {
      // Fetch scheduled messages from sequence_scheduled_messages table
      // Join with sequence_enrollments to get the correct schedule_message time
      const { data: scheduledMessages, error } = await supabase
        .from('sequence_scheduled_messages')
        .select(`
          id,
          flow_number,
          message,
          image_url,
          whacenter_message_id,
          sequence_id,
          sequences (
            trigger
          ),
          sequence_enrollments!inner (
            schedule_message
          )
        `)
        .eq('prospect_num', prospectNum)
        .eq('status', 'scheduled')
        .order('flow_number', { ascending: true })

      if (error) throw error

      if (!scheduledMessages || scheduledMessages.length === 0) {
        Swal.fire({
          title: 'No Scheduled Messages',
          text: 'This prospect has no scheduled sequence messages',
          icon: 'info',
          confirmButtonColor: '#667eea',
        })
        return
      }

      // Build table HTML
      const tableRows = scheduledMessages.map((msg: any, index: number) => {
        // Format schedule_message from sequence_enrollments
        // Database format: 2025-11-21 19:16:04.165+00
        // Display format: 21/11/2025, 19:16
        const scheduleMessage = msg.sequence_enrollments?.schedule_message || msg.scheduled_time
        const timestamp = scheduleMessage.replace('T', ' ').split('.')[0]
        const [datePart, timePart] = timestamp.split(' ')
        const [year, month, day] = datePart.split('-')
        const [hour, minute] = timePart.split(':')
        const formattedTime = `${day}/${month}/${year}, ${hour}:${minute}`

        const stageTrigger = msg.sequences?.trigger || '-'
        const imagePreview = msg.image_url
          ? `<a href="${msg.image_url}" target="_blank" style="color: #667eea; text-decoration: underline;">View Image</a>`
          : '-'

        return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; text-align: left;">${index + 1}</td>
            <td style="padding: 12px; text-align: left;">${stageTrigger}</td>
            <td style="padding: 12px; text-align: left;">${msg.flow_number}</td>
            <td style="padding: 12px; text-align: left;">${imagePreview}</td>
            <td style="padding: 12px; text-align: left; max-width: 300px; word-wrap: break-word;">${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}</td>
            <td style="padding: 12px; text-align: left;">${formattedTime}</td>
            <td style="padding: 12px; text-align: center;">
              <button
                onclick="deleteScheduledMessage('${msg.id}', '${msg.whacenter_message_id}')"
                style="background: #ef4444; color: white; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600;"
              >
                🗑️ Delete
              </button>
            </td>
          </tr>
        `
      }).join('')

      Swal.fire({
        title: `Scheduled Messages for ${prospectNum}`,
        html: `
          <div style="max-height: 500px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead style="background: #f3f4f6; position: sticky; top: 0;">
                <tr>
                  <th style="padding: 12px; text-align: left; font-weight: 700;">ID</th>
                  <th style="padding: 12px; text-align: left; font-weight: 700;">Stage Trigger</th>
                  <th style="padding: 12px; text-align: left; font-weight: 700;">No Flow</th>
                  <th style="padding: 12px; text-align: left; font-weight: 700;">Image</th>
                  <th style="padding: 12px; text-align: left; font-weight: 700;">Message</th>
                  <th style="padding: 12px; text-align: left; font-weight: 700;">Time Schedule (MY)</th>
                  <th style="padding: 12px; text-align: center; font-weight: 700;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        `,
        width: '90%',
        confirmButtonText: 'Close',
        confirmButtonColor: '#667eea',
        didOpen: () => {
          // Attach delete function to window for button onclick handlers
          (window as any).deleteScheduledMessage = async (messageId: string, whacenterMessageId: string) => {
            await deleteScheduledMessage(messageId, whacenterMessageId)
            // Close and reopen modal with updated data
            Swal.close()
            viewSequences(prospectNum)
          }
        }
      })

    } catch (error) {
      console.error('Error fetching scheduled messages:', error)
      Swal.fire({
        title: 'Error!',
        text: 'Failed to fetch scheduled messages',
        icon: 'error',
        confirmButtonColor: '#d33',
      })
    }
  }

  // Delete a specific scheduled message
  const deleteScheduledMessage = async (messageId: string, whacenterMessageId: string) => {
    const result = await Swal.fire({
      title: 'Delete Scheduled Message?',
      text: 'This will cancel the scheduled message from WhatsApp Center',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    })

    if (!result.isConfirmed) return

    try {
      // Step 1: Get enrollment_id from the scheduled message
      const { data: messageData } = await supabase
        .from('sequence_scheduled_messages')
        .select('enrollment_id, device_id')
        .eq('id', messageId)
        .single()

      if (!messageData) throw new Error('Scheduled message not found')

      // Step 2: Try to delete from WhatsApp Center API (skip CORS errors gracefully)
      try {
        const { data: device } = await supabase
          .from('device_setting')
          .select('instance')
          .eq('device_id', messageData.device_id)
          .single()

        if (device) {
          const WHACENTER_API_URL = import.meta.env.VITE_WHACENTER_API_URL || 'https://api.whacenter.com'
          const deleteUrl = `${WHACENTER_API_URL}/api/deleteMessage?device_id=${encodeURIComponent(device.instance)}&id=${encodeURIComponent(whacenterMessageId)}`

          await fetch(deleteUrl, {
            method: 'GET',
            mode: 'no-cors' // Handle CORS gracefully
          })
          console.log('Attempted to delete from WhatsApp Center')
        }
      } catch (apiError) {
        // Ignore WhatsApp API errors (CORS, network issues, etc.)
        console.log('WhatsApp API call skipped (CORS or network issue):', apiError)
      }

      // Step 3: Update database status to 'cancelled'
      const { error: updateError } = await supabase
        .from('sequence_scheduled_messages')
        .update({ status: 'cancelled' })
        .eq('id', messageId)

      if (updateError) throw updateError

      // Step 4: Delete enrollment record if this was the only scheduled message
      const { data: otherMessages } = await supabase
        .from('sequence_scheduled_messages')
        .select('id')
        .eq('enrollment_id', messageData.enrollment_id)
        .eq('status', 'scheduled')

      if (!otherMessages || otherMessages.length === 0) {
        // No more scheduled messages, delete the enrollment
        await supabase
          .from('sequence_enrollments')
          .delete()
          .eq('id', messageData.enrollment_id)

        console.log('Deleted enrollment record (no more scheduled messages)')
      }

      Swal.fire({
        title: 'Deleted!',
        text: 'Scheduled message cancelled successfully',
        icon: 'success',
        confirmButtonColor: '#667eea',
        timer: 2000
      })

    } catch (error) {
      console.error('Error deleting scheduled message:', error)
      Swal.fire({
        title: 'Error!',
        text: 'Failed to delete scheduled message',
        icon: 'error',
        confirmButtonColor: '#d33',
      })
    }
  }


  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto animate-fade-in-up">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl card-soft">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Chatbot AI Conversations</h1>
          </div>
          <p className="text-gray-600 font-medium">Monitor and manage your AI-powered chatbot interactions</p>
        </div>

        {/* Analytics - 6 Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          {/* Total Lead */}
          <div className="bg-white rounded-xl p-4 card-soft card-hover transition-smooth border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-5 h-5 text-purple-600" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Lead</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalLead}</div>
          </div>

          {/* Stuck Intro */}
          <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Stuck Intro</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{stuckIntro}</div>
          </div>

          {/* Response */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Response</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{response}</div>
          </div>

          {/* Close */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-green-100">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Close</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{close}</div>
          </div>

          {/* Sales */}
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Sales</span>
            </div>
            <div className="text-2xl font-bold text-amber-600">RM {sales.toLocaleString()}</div>
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
        <div className="bg-white rounded-xl p-6 card-soft mb-6 transition-smooth">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Device</label>
              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
              >
                <option value="">All Devices</option>
                {devices.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Stage</label>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
              >
                <option value="">All Stages</option>
                {stages.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, phone, niche..."
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-smooth font-medium"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={resetFilters}
              className="px-5 py-2.5 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-smooth flex items-center gap-2 font-medium card-soft border border-gray-200"
            >
              🔄 Reset Filters
            </button>
            <button
              onClick={exportToCSV}
              className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-smooth flex items-center gap-2 font-medium card-soft"
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 bg-white rounded-xl card-soft">
            <div className="inline-block h-14 w-14 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center card-soft">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 font-medium text-lg">No conversations found matching your filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden card-soft transition-smooth">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-subtle">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">No</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Device</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Phone</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Niche</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Stage</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Detail</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">History</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Sequence</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredConversations.map((conv, index) => {
                    const dateFormatted = conv.date_insert
                      ? new Date(conv.date_insert).toLocaleDateString('en-GB')
                      : '-'

                    return (
                      <tr key={conv.id_prospect} className="hover:bg-gradient-subtle transition-smooth">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{index + 1}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-medium">{conv.device_id || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-medium">{dateFormatted}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-semibold">{conv.prospect_name || '-'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{conv.prospect_num}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200">
                            {conv.niche || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium max-w-xs">
                          <div className="whitespace-normal break-words">
                            {conv.stage || 'Welcome Message'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {conv.detail ? (
                            <button
                              onClick={() => viewDetail(conv)}
                              className="text-blue-600 hover:text-blue-800 transition-smooth text-lg"
                              title="View Customer Details"
                            >
                              📋
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => viewConversation(conv)}
                            className="text-blue-600 hover:text-blue-800 transition-smooth text-lg"
                            title="View Conversation"
                          >
                            👁️
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => viewSequences(conv.prospect_num)}
                            className="text-purple-600 hover:text-purple-800 transition-smooth text-lg"
                            title="View Scheduled Sequences"
                          >
                            📅
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => changeStatus(conv)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-smooth hover:opacity-80 cursor-pointer ${
                              conv.human === 1
                                ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-700 border-yellow-200'
                                : 'bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200'
                            }`}
                            title="Click to change status"
                          >
                            {conv.human === 1 ? 'Human' : 'AI'}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => deleteConversation(conv.prospect_num)}
                            className="text-red-600 hover:text-red-800 transition-smooth text-lg"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
