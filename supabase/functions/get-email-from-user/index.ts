/**
 * Get Email from User Table
 *
 * This Edge Function looks up user email from the custom 'user' table
 * Supports login by email or any unique identifier
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

    const { identifier } = await req.json()

    if (!identifier) {
      throw new Error('Email or identifier is required')
    }

    console.log('Looking up user for identifier:', identifier)

    // If identifier is already an email, return it
    if (identifier.includes('@')) {
      return new Response(
        JSON.stringify({ email: identifier }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Otherwise, look up email from custom 'user' table
    // You can extend this to support other fields like phone, full_name, etc.
    const { data: user, error } = await supabaseAdmin
      .from('user')
      .select('email')
      .or(`email.eq.${identifier},phone.eq.${identifier}`)
      .maybeSingle()

    if (error) {
      console.error('Error looking up user:', error)
      throw error
    }

    if (!user) {
      console.log('No user found for identifier:', identifier)
      return new Response(
        JSON.stringify({ email: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found email for identifier')

    return new Response(
      JSON.stringify({ email: user.email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in get-email-from-user function:', error)
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
