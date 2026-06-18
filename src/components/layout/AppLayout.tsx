import React, { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { addTimeSpent, updateStreak } from '@/services/supabase/userStatsService';

/**
 * AppLayout wraps all authenticated routes.
 *
 * Global behaviours wired here (runs for every authenticated page):
 * - Time-spent tracking: accumulated every 60 s and flushed on tab close.
 * - Streak update: triggered once on mount so every login counts.
 * - Visibility tracking: pauses the timer when the tab is hidden to avoid
 *   counting idle time unfairly.
 */
export const AppLayout: React.FC = () => {
    const sessionStartRef = useRef<Date>(new Date());
    const lastFlushRef = useRef<Date>(new Date());
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isVisibleRef = useRef<boolean>(true);

    const flushTime = () => {
        if (!isVisibleRef.current) return;
        const now = new Date();
        const seconds = Math.floor((now.getTime() - lastFlushRef.current.getTime()) / 1000);
        if (seconds >= 10) {
            addTimeSpent(seconds);
            lastFlushRef.current = now;
        }
    };

    useEffect(() => {
        // Update streak once when the authenticated app opens.
        updateStreak();

        // Reset timers on mount.
        sessionStartRef.current = new Date();
        lastFlushRef.current = new Date();

        // Flush every 60 seconds.
        intervalRef.current = setInterval(flushTime, 60_000);

        // Handle tab visibility changes — pause when hidden.
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab became hidden → flush accumulated time.
                flushTime();
                isVisibleRef.current = false;
            } else {
                // Tab is visible again → reset the last-flush reference.
                isVisibleRef.current = true;
                lastFlushRef.current = new Date();
            }
        };

        // Flush remaining time before the page unloads.
        const handleBeforeUnload = () => {
            flushTime();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            // Final flush on component unmount.
            flushTime();
            if (intervalRef.current) clearInterval(intervalRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-purple-500/30">
            <Header />
            <main>
                <Outlet />
            </main>
        </div>
    );
};
