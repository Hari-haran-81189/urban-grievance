// Paste YOUR values from Supabase → Project Settings → API
const SUPABASE_URL = "https://nszkjsenwwizvhdmjosv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hGUOOWd9FfUbGVlKWT0mkA_cFvrrvlV";

// "db" is the connection we will use on every page
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);