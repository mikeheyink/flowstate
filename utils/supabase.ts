import { createClient } from '@supabase/supabase-js';

// In a real Vite/Next.js app, these would be import.meta.env.VITE_SUPABASE_URL
// or process.env.NEXT_PUBLIC_SUPABASE_URL.
// We check for those first, then fallback to the hardcoded values for the preview.

const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_URL) 
  || 'https://paossovhmafrqkeciots.supabase.co';

const supabaseKey = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_ANON_KEY) 
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhb3Nzb3ZobWFmcnFrZWNpb3RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNzYwOTcsImV4cCI6MjA4Mjc1MjA5N30.BkyUMZXHhpLFHk4BOVr3tIVpTFV-DUNm51xd7oZRgGA';

export const supabase = createClient(supabaseUrl, supabaseKey);