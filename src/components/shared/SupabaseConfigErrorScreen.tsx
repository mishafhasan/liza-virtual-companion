import React from 'react';
import { AlertTriangle, Database } from 'lucide-react';
import { LogoDisplay } from './LizaLogo';

/**
 * Full-page blocker shown when Supabase is not configured.
 *
 * The app requires a backend — there is no local-only mode. If the deploy is
 * missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, every authenticated
 * route and the login page render this instead of the UI.
 */
export const SupabaseConfigErrorScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center gap-4 mb-8">
          <LogoDisplay width={120} height={40} />
        </div>
        <div className="bg-white/5 backdrop-blur-3xl border border-red-500/30 rounded-3xl p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Backend not configured</h1>
          </div>
          <p className="text-gray-300 mb-6 leading-relaxed">
            Liza requires a Supabase backend to run. This deployment is missing
            the required environment variables, so the app cannot start.
          </p>
          <div className="bg-slate-950/50 rounded-xl p-4 border border-white/10 mb-6">
            <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
              <Database className="w-4 h-4" />
              <span className="font-mono">Required environment variables</span>
            </div>
            <pre className="text-xs font-mono text-purple-300 overflow-x-auto">
{`VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key`}
            </pre>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            If you're the developer, set these in your{' '}
            <code className="text-purple-300 font-mono">.env.local</code> file or
            in your Vercel project settings, then redeploy. Get your keys at{' '}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noreferrer"
              className="text-purple-400 underline hover:text-purple-300"
            >
              supabase.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
};
