import { createClient } from "@supabase/supabase-js";

// VITE_* names come from .env / manual setup; NEXT_PUBLIC_* names are what the
// Vercel ↔ Supabase integration creates. Either works.
const env = import.meta.env;
const url = (env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined;
const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string | undefined;

if (!url || !key) {
  throw new Error("Missing Supabase URL or publishable key. Copy .env.example to .env, or connect the Vercel Supabase integration.");
}

export const supabase = createClient(url, key);

export const STUDY_BUCKET = "study-materials";
