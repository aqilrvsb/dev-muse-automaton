/**
 * Check Payment Status with CHIP API
 *
 * Manually queries CHIP API to verify payment status
 * and updates the database accordingly
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const CHIP_API_KEY = Deno.env.get('CHIP_API_KEY')
const CHIP_BASE_URL = 'https://gate.chip-in.asia/api/v1'

const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { payment_id } = await req.json()

    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: 'payment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get payment record from database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single()

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!payment.chip_purchase_id) {
      return new Response(
        JSON.stringify({ error: 'No CHIP purchase ID found for this payment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔍 Checking CHIP payment status for purchase: ${payment.chip_purchase_id}`)

    // Query CHIP API to get current status
    const chipResponse = await fetch(`${CHIP_BASE_URL}/purchases/${payment.chip_purchase_id}/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!chipResponse.ok) {
      const errorText = await chipResponse.text()
      console.error('CHIP API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to check payment status with CHIP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const chipData = await chipResponse.json()
    console.log('✅ CHIP API response:', JSON.stringify(chipData, null, 2))

    const chipStatus = chipData.status
    const transactionId = chipData.transaction_data?.id || chipData.transaction?.id || payment.chip_purchase_id

    // Map CHIP status to our payment status
    let newStatus = 'pending'
    if (chipStatus === 'paid') {
      newStatus = 'paid'
    } else if (['error', 'cancelled', 'expired', 'charged_back', 'overdue'].includes(chipStatus)) {
      newStatus = 'failed'
    } else if (['refunded', 'pending_refund'].includes(chipStatus)) {
      newStatus = 'refunded'
    }

    console.log(`📝 Payment ${payment.id} status: ${payment.status} → ${newStatus}`)

    // Update payment status in database
    const paid_at = chipStatus === 'paid' ? new Date().toISOString() : null
    await supabase
      .from('payments')
      .update({
        status: newStatus,
        paid_at,
        chip_transaction_id: transactionId,
        updated_at: new Date().toISOString(),
        metadata: {
          ...payment.metadata,
          chip_status: chipStatus,
          last_manual_check: new Date().toISOString(),
        }
      })
      .eq('id', payment.id)

    console.log(`✅ Payment ${payment.id} updated to: ${newStatus}`)

    // If payment is successful, activate subscription
    if (chipStatus === 'paid' && newStatus === 'paid' && payment.status !== 'paid') {
      console.log(`💰 Payment SUCCESSFUL - Activating subscription for user ${payment.user_id}`)

      // Get package details
      const { data: packageData } = await supabase
        .from('packages')
        .select('*')
        .eq('id', payment.package_id)
        .single()

      if (packageData) {
        // Calculate expiry date
        const now = new Date()
        const expiryDate = new Date(now)
        expiryDate.setDate(expiryDate.getDate() + (packageData.duration_days || 30))

        // Update user subscription
        await supabase
          .from('user')
          .update({
            package_id: payment.package_id,
            subscription_status: 'active',
            subscription_start: now.toISOString(),
            subscription_end: expiryDate.toISOString(),
            max_devices: packageData.max_devices,
            updated_at: now.toISOString(),
          })
          .eq('id', payment.user_id)

        console.log(`✅ Subscription activated for user ${payment.user_id}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        old_status: payment.status,
        new_status: newStatus,
        chip_status: chipStatus,
        chip_data: chipData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('Error checking payment status:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

serve(handler)
