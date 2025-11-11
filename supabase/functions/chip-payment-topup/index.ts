/**
 * CHIP Payment Handler for PeningBot
 *
 * Allows users to purchase subscription packages via CHIP Payment Gateway
 * Updates user subscription after successful payment
 */ import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const CHIP_API_KEY = Deno.env.get('CHIP_API_KEY');
const CHIP_BASE_URL = 'https://gate.chip-in.asia/api/v1';
const CHIP_BRAND_ID = Deno.env.get('CHIP_BRAND_ID');
// Debug: Log environment variables on startup
console.log('🔧 CHIP Payment Environment Check:');
console.log('  CHIP_API_KEY:', CHIP_API_KEY ? '✅ Set (' + CHIP_API_KEY.substring(0, 20) + '...)' : '❌ NOT SET');
console.log('  CHIP_BRAND_ID:', CHIP_BRAND_ID ? '✅ Set (' + CHIP_BRAND_ID + ')' : '❌ NOT SET');
const handler = async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  // Handle GET requests (health checks from CHIP)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'ok',
      message: 'CHIP webhook endpoint ready'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    const contentType = req.headers.get('content-type') || '';
    // Check if it's a webhook from CHIP
    if (req.method === 'POST' && contentType.includes('application/json')) {
      const signature = req.headers.get('X-Signature');
      if (signature) {
        return await handleWebhook(req, signature);
      }
    }
    // Regular API call from frontend
    const body = await req.json();
    const { user_id, package_id, amount, description } = body;
    if (!user_id || !package_id || !amount) {
      return new Response(JSON.stringify({
        error: 'user_id, package_id and amount are required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get user data (table is 'user' not 'users')
    const { data: userData, error: userError } = await supabase.from('user').select('full_name, email').eq('id', user_id).single();
    if (userError || !userData) {
      return new Response(JSON.stringify({
        error: 'User not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const userName = userData.full_name || 'User';
    const userEmail = userData.email || `${user_id.substring(0, 8)}@peningbot.com`;
    // Get package details
    const { data: packageData, error: packageError } = await supabase.from('packages').select('*').eq('id', package_id).single();
    if (packageError || !packageData) {
      return new Response(JSON.stringify({
        error: 'Package not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Create payment record in database
    const { data: payment, error: paymentError } = await supabase.from('payments').insert({
      user_id,
      package_id,
      amount,
      currency: 'MYR',
      status: 'pending',
      metadata: {
        type: 'subscription',
        package_name: packageData.name,
        description: description || `Subscription - ${packageData.name}`
      }
    }).select().single();
    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
      throw new Error('Failed to create payment record');
    }
    // Get app origin dynamically from request headers
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    let appOrigin = origin;
    if (!appOrigin && referer) {
      try {
        const refererUrl = new URL(referer);
        appOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      } catch (e) {
        console.error('Failed to parse referer:', e);
      }
    }
    if (!appOrigin) {
      appOrigin = Deno.env.get('APP_ORIGIN') || 'https://peningbot.vercel.app';
    }
    console.log(`🌐 Using app origin: ${appOrigin}`);
    // Create CHIP purchase
    const chipData = {
      brand_id: CHIP_BRAND_ID,
      client: {
        email: userEmail,
        full_name: userName
      },
      purchase: {
        currency: 'MYR',
        products: [
          {
            name: packageData.name,
            price: Math.round(amount * 100),
            quantity: 1
          }
        ],
        notes: `${packageData.name} subscription for ${userName}`,
        metadata: {
          user_id: user_id,
          payment_id: payment.id,
          package_id: package_id,
          type: 'subscription'
        }
      },
      success_redirect: `${appOrigin}/billings?status=success`,
      failure_redirect: `${appOrigin}/billings?status=failed`,
      success_callback: `${Deno.env.get('SUPABASE_URL')}/functions/v1/chip-payment-topup`,
      reference: `PKG-${payment.id.substring(0, 8)}`,
      send_receipt: true
    };
    console.log('📤 Creating CHIP purchase:', JSON.stringify(chipData, null, 2));
    const response = await fetch(`${CHIP_BASE_URL}/purchases/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHIP_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chipData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('CHIP API error:', errorText);
      throw new Error(`CHIP API error: ${response.status} - ${errorText}`);
    }
    const purchaseData = await response.json();
    console.log('✅ CHIP purchase created:', purchaseData.id);
    // Update payment record with CHIP purchase ID
    await supabase.from('payments').update({
      chip_purchase_id: purchaseData.id,
      chip_checkout_url: purchaseData.checkout_url,
      metadata: {
        type: 'subscription',
        package_name: packageData.name,
        description: description || `Subscription - ${packageData.name}`,
        chip_data: purchaseData
      }
    }).eq('id', payment.id);
    return new Response(JSON.stringify({
      success: true,
      purchase_id: purchaseData.id,
      payment_url: purchaseData.checkout_url,
      payment_id: payment.id,
      amount: amount
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in chip-payment-topup:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
};
async function handleWebhook(req, signature) {
  try {
    const webhookData = await req.json();
    console.log('🔔 CHIP Webhook received:', JSON.stringify(webhookData, null, 2));
    console.log('🔐 Signature:', signature);
    const purchaseId = webhookData.id;
    if (!purchaseId) {
      console.error('❌ Missing purchase ID in webhook');
      return new Response('Missing purchase ID', {
        status: 400
      });
    }
    console.log(`📋 Webhook for Purchase ${purchaseId} - Verifying with CHIP API...`);
    // Verify payment status with CHIP API
    const verifyResponse = await fetch(`${CHIP_BASE_URL}/purchases/${purchaseId}/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CHIP_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!verifyResponse.ok) {
      console.error(`❌ Failed to verify purchase from CHIP API: ${verifyResponse.status}`);
      return new Response('Failed to verify purchase', {
        status: 500
      });
    }
    const chipPurchaseData = await verifyResponse.json();
    console.log('✅ Verified purchase from CHIP API:', JSON.stringify(chipPurchaseData, null, 2));
    const status = chipPurchaseData.status;
    const eventType = webhookData.event_type || 'purchase.updated';
    const transactionId = chipPurchaseData.transaction_data?.id || chipPurchaseData.transaction?.id || purchaseId;
    console.log(`📋 Purchase ${purchaseId} - Status: ${status} - Event: ${eventType}`);
    // Find payment record by CHIP purchase ID
    const { data: payment, error: paymentError } = await supabase.from('payments').select('*').eq('chip_purchase_id', purchaseId).maybeSingle();
    if (paymentError || !payment) {
      console.error('❌ Payment not found for purchase:', purchaseId);
      return new Response('Payment not found', {
        status: 404
      });
    }
    // Prevent double-processing
    if (payment.status === 'paid') {
      console.log('⚠️ Payment already marked as paid, skipping:', payment.id);
      return new Response(JSON.stringify({
        message: 'Payment already processed'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Map CHIP status to our payment status
    let newStatus = 'pending';
    if (status === 'paid') {
      newStatus = 'paid';
    } else if ([
      'error',
      'cancelled',
      'expired',
      'charged_back',
      'overdue'
    ].includes(status)) {
      newStatus = 'failed';
    } else if ([
      'created',
      'sent',
      'viewed',
      'pending_execute',
      'pending_charge',
      'pending_capture'
    ].includes(status)) {
      newStatus = 'pending';
    } else if ([
      'hold',
      'preauthorized'
    ].includes(status)) {
      newStatus = 'pending';
    } else if ([
      'refunded',
      'pending_refund'
    ].includes(status)) {
      newStatus = 'refunded';
    }
    console.log(`📝 Payment ${payment.id} status changing: ${payment.status} → ${newStatus}`);
    // Update payment status
    const paid_at = status === 'paid' ? new Date().toISOString() : null;
    await supabase.from('payments').update({
      status: newStatus,
      paid_at,
      chip_transaction_id: transactionId,
      updated_at: new Date().toISOString(),
      metadata: {
        ...payment.metadata,
        chip_status: status,
        chip_webhook_data: webhookData,
        last_event: eventType
      }
    }).eq('id', payment.id);
    console.log(`✅ Payment ${payment.id} status updated to: ${newStatus}`);
    // ONLY activate subscription if payment is successful
    if (status === 'paid' && newStatus === 'paid') {
      console.log(`💰 Payment SUCCESSFUL - Activating subscription for user ${payment.user_id}`);
      // Get package details
      const { data: packageData } = await supabase.from('packages').select('*').eq('id', payment.package_id).single();
      if (!packageData) {
        console.error('❌ Package not found:', payment.package_id);
        return new Response(JSON.stringify({
          error: 'Package not found'
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      // Calculate expiry date based on package duration
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + (packageData.duration_days || 30));
      // Update user subscription (table is 'user' not 'users')
      const { error: subscriptionError } = await supabase.from('user').update({
        package_id: payment.package_id,
        subscription_status: 'active',
        subscription_start: now.toISOString(),
        subscription_end: expiryDate.toISOString(),
        max_devices: packageData.max_devices,
        updated_at: now.toISOString()
      }).eq('id', payment.user_id);
      if (subscriptionError) {
        console.error('❌ Error updating subscription:', subscriptionError);
        await supabase.from('payments').update({
          status: 'failed'
        }).eq('id', payment.id);
        return new Response(JSON.stringify({
          error: 'Error updating subscription'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      console.log(`✅ Subscription activated for user ${payment.user_id}`);
    } else {
      console.log(`ℹ️ Payment status is "${status}" - Subscription not activated`);
    }
    return new Response(JSON.stringify({
      message: 'OK',
      status: newStatus
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
serve(handler);
