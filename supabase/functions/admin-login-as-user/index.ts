/**
 * Admin Login As User
 *
 * This Edge Function allows admin to login as any user without password
 * Uses service role to generate a session for the target user
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header to verify admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the requesting user is an admin
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !requestingUser) {
      throw new Error('Invalid authorization')
    }

    // Check if requesting user is admin
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('user')
      .select('role')
      .eq('id', requestingUser.id)
      .single()

    if (adminError || adminUser?.role !== 'admin') {
      throw new Error('Only admins can use this function')
    }

    const { userId } = await req.json()

    if (!userId) {
      throw new Error('User ID is required')
    }

    console.log('Admin login as user:', userId)

    // Generate magic link for the target user
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('user')
      .select('email')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      throw new Error('Target user not found')
    }

    // Get the auth user by email to get their user id
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      console.error('Error listing users:', listError)
      throw listError
    }

    const authUser = authUsers.users.find((u: { email?: string }) => u.email === targetUser.email)
    if (!authUser) {
      throw new Error('Auth user not found')
    }

    // Generate a session for the target user using admin API
    // This creates access_token and refresh_token directly
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email,
    })

    if (sessionError) {
      console.error('Error generating session:', sessionError)
      throw sessionError
    }

    // Extract the token hash from the action_link
    const actionLink = sessionData.properties?.action_link
    if (!actionLink) {
      throw new Error('Failed to generate login link')
    }

    // Parse the token from the action link
    const linkUrl = new URL(actionLink)
    const otpToken = linkUrl.searchParams.get('token')

    if (!otpToken) {
      throw new Error('No token in magic link')
    }

    // Verify the OTP token to get actual session
    const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: otpToken,
      type: 'magiclink',
    })

    if (verifyError) {
      console.error('Error verifying OTP:', verifyError)
      throw verifyError
    }

    console.log('Session generated for:', targetUser.email)

    return new Response(
      JSON.stringify({
        success: true,
        session: verifyData.session,
        email: targetUser.email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in admin-login-as-user function:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
