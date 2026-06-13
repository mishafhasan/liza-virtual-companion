// Edge Function: proxy-heygen-session
// Creates a short-lived HeyGen streaming token server-side (auth-gated), so the
// raw HeyGen API key never reaches the browser.
// Deploy: supabase functions deploy proxy-heygen-session
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

    const apiKey = Deno.env.get('HEYGEN_API_KEY');
    if (!apiKey) throw new Error('HEYGEN_API_KEY not configured');

    const tokenResponse = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.message || 'HeyGen token creation failed');
    }

    return new Response(JSON.stringify({ token: tokenData.data?.token }), {
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
