/**
 * Admin Delete User
 *
 * This Edge Function allows admin to delete any user
 * Uses service role to bypass RLS
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

    console.log('Admin deleting user:', userId)

    // Get user email first for auth deletion
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('user')
      .select('email')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      throw new Error('Target user not found')
    }

    // Delete related data first (to avoid foreign key constraints)

    // 1. Delete user's devices
    await supabaseAdmin
      .from('device_setting')
      .delete()
      .eq('user_id', userId)

    // 2. Delete user's prompts
    await supabaseAdmin
      .from('prompts')
      .delete()
      .eq('user_id', userId)

    // 3. Delete user's ai_whatsapp conversations
    await supabaseAdmin
      .from('ai_whatsapp')
      .delete()
      .eq('user_id', userId)

    // 4. Delete user from public.user table
    const { error: deleteError } = await supabaseAdmin
      .from('user')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      console.error('Error deleting from user table:', deleteError)
      throw deleteError
    }

    // 5. Delete from Supabase Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('Error deleting from auth:', authDeleteError)
      // Don't throw - user table is already deleted
    }

    console.log('User deleted successfully:', targetUser.email)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User deleted successfully',
        email: targetUser.email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in admin-delete-user function:', error)
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
