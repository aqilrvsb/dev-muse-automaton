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

    const { userId, adminId } = await req.json()

    if (!userId) {
      throw new Error('User ID is required')
    }

    if (!adminId) {
      throw new Error('Admin ID is required')
    }

    // Verify the requesting user is an admin by checking database
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('user')
      .select('role')
      .eq('id', adminId)
      .single()

    if (adminError || adminUser?.role !== 'admin') {
      throw new Error('Only admins can use this function')
    }

    console.log('Admin', adminId, 'deleting user:', userId)

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
    // Order matters due to foreign key relationships!

    // 1. Get user's sequences first (needed for cascade delete)
    const { data: userSequences } = await supabaseAdmin
      .from('sequences')
      .select('id')
      .eq('user_id', userId)

    const sequenceIds = userSequences?.map((s: { id: string }) => s.id) || []

    // 2. Delete sequence_scheduled_messages (depends on sequence_enrollments and sequences)
    if (sequenceIds.length > 0) {
      await supabaseAdmin
        .from('sequence_scheduled_messages')
        .delete()
        .in('sequence_id', sequenceIds)

      // 3. Delete sequence_enrollments (depends on sequences)
      await supabaseAdmin
        .from('sequence_enrollments')
        .delete()
        .in('sequence_id', sequenceIds)

      // 4. Delete sequence_flows (depends on sequences)
      await supabaseAdmin
        .from('sequence_flows')
        .delete()
        .in('sequence_id', sequenceIds)

      // 5. Delete sequences
      await supabaseAdmin
        .from('sequences')
        .delete()
        .eq('user_id', userId)
    }

    // 6. Delete user's bank_images
    await supabaseAdmin
      .from('bank_images')
      .delete()
      .eq('user_id', userId)

    // 7. Delete user's payments
    await supabaseAdmin
      .from('payments')
      .delete()
      .eq('user_id', userId)

    // 8. Delete user's orders
    await supabaseAdmin
      .from('orders')
      .delete()
      .eq('user_id', userId)

    // 9. Delete user's devices
    await supabaseAdmin
      .from('device_setting')
      .delete()
      .eq('user_id', userId)

    // 10. Delete user's prompts
    await supabaseAdmin
      .from('prompts')
      .delete()
      .eq('user_id', userId)

    // 11. Delete user's ai_whatsapp conversations
    await supabaseAdmin
      .from('ai_whatsapp')
      .delete()
      .eq('user_id', userId)

    // 12. Delete user from public.user table
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
