/**
 * Shared CORS headers for all Edge Functions.
 *
 * Tighten `Access-Control-Allow-Origin` to your deployed frontend origin in
 * production instead of the `*` wildcard.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
