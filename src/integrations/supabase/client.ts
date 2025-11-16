import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bjnjucwpwdzgsnqmpmff.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqbmp1Y3dwd2R6Z3NucW1wbWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0OTk1MzksImV4cCI6MjA3NjA3NTUzOX0.vw1rOUqYWFkPNDwTdEgIfsCO9pyvTsFKaXHq3RcRTNU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
