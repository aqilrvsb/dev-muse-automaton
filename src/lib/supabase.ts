import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bjnjucwpwdzgsnqmpmff.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqbmp1Y3dwd2R6Z3NucW1wbWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0OTk1MzksImV4cCI6MjA3NjA3NTUzOX0.vw1rOUqYWFkPNDwTdEgIfsCO9pyvTsFKaXHq3RcRTNU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Types
export type User = {
  id: string
  email: string
  full_name: string
  phone?: string
  password?: string
  is_active: boolean
  status: string
  expired?: string
  package_id?: string
  subscription_status: string
  subscription_start?: string
  subscription_end?: string
  max_devices: number
  role?: string
  created_at: string
  updated_at: string
  packages?: {
    name: string
  }
}

export type Device = {
  id: string
  device_id: string
  instance: string
  webhook_id: string
  provider: 'waha' | 'wablas' | 'whacenter'
  api_key_option: string
  api_key: string
  phone_number: string
  user_id: string
  status?: string
  created_at: string
  updated_at: string
}

export type Flow = {
  id: string
  id_device: string
  name: string
  niche: string
  nodes: any
  edges: any
  nodes_data?: string
  created_at: string
  updated_at: string
}

export type Package = {
  id: string
  name: string
  description: string
  price: number
  currency: string
  duration_days: number
  max_devices: number
  features: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Prompt = {
  id: string
  device_id: string
  niche: string
  prompts_name: string
  prompts_data: string
  user_id: string
  created_at: string
  updated_at: string
}
