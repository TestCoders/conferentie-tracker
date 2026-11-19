/**
 * Server-side Supabase client (eigenaar: A).
 * ALLEEN importeren vanuit API-routes / servercode — nooit in een 'use client'-component.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten gezet zijn (zie .env.example)',
    );
  }

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
