import React from 'react';
import { useSettings } from '@/context/SettingsContext';

export const SettingsPage: React.FC = () => {
    const { settings: _settings } = useSettings();

    return (
        <div className="min-h-[calc(100vh-65px)] bg-slate-950 p-6 flex justify-center">
            <div className="w-full max-w-2xl">
                <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>
                <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden p-8">
                    <p className="text-gray-400 text-center">
                        Settings are available through the Chat interface sidebar panel.
                        <br />
                        <span className="text-sm text-gray-500 mt-2 block">
                            Open Entertainment Chat and click the settings icon to access all configuration options.
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
};
