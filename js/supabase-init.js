/* =============================================
   SUPABASE INITIALIZATION
   ============================================= */

const SUPABASE_URL = 'https://sokfowdozloaehjxflvv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNva2Zvd2RvemxvYWVoanhmbHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTczNzcsImV4cCI6MjA4NzMzMzM3N30.tlM6M-ZnvF1zBvFZTznDb_EOHNeRxNLlYT2RUC5hYDI';

// Initialize the Supabase client
window.kakSupabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

if (!window.kakSupabase) {
    console.error('Supabase library not loaded. Make sure to include the CDN script tag before this file.');
}
