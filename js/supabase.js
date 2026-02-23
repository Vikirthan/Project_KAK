/* ===================================================
   KAK HYGIENE SYSTEM — Unified Backend
   Project: https://sokfowdozloaehjxflvv.supabase.co
   =================================================== */

const SUPABASE_URL = 'https://sokfowdozloaehjxflvv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNva2Zvd2RvemxvYWVoanhmbHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTczNzcsImV4cCI6MjA4NzMzMzM3N30.tlM6M-ZnvF1zBvFZTznDb_EOHNeRxNLlYT2RUC5hYDI';

// Initialize the Supabase client
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Verification log
console.log('%c [KAK-SYSTEM] Unified Backend Initialized: ' + SUPABASE_URL, 'color: #818cf8; font-weight: bold;');
