// Edge Function: generate-embedding
// Generates a 768-dim embedding for RAG memory using Gemini text-embedding-004.
// Auth-gated; the API key stays server-side.
// Deploy: supabase functions deploy generate-embedding
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { text } = await req.json();
    if (!text || typeof text !== 'string') throw new Error('Text is required');

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // outputDimensionality truncates to 768 to match the DB vector(768) column
        body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }),
      },
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Embedding generation failed');

    return new Response(JSON.stringify({ embedding: data.embedding?.values }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const message = (error as Error).message;
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: message === 'Unauthorized' ? 401 : 500,
    });
  }
});
