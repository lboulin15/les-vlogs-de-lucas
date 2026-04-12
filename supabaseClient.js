import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
 
const SUPABASE_URL = 'https://pkijqjceysnzeiyhiulz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraWpxamNleXNuemVpeWhpdWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDAwMzMsImV4cCI6MjA5MTU3NjAzM30.-Y5kAwo_q5iKWzeWPhZ6JqQVbHPrfzk3seXbOgIOuaY';
 
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
 