import React from 'react';

interface LizaLogoProps {
    size?: number;
    className?: string;
}

export const LizaLogo: React.FC<LizaLogoProps> = ({ size = 40, className = '' }) => (
    <img
        src="/dist/Pliza-logo.png"
        alt="Liza"
        className={`object-contain ${className}`}
        style={{ width: size, height: size }}
    />
);

export const LogoDisplay: React.FC<LizaLogoProps & { showText?: boolean; textSize?: string }> = ({
    size = 40,
    showText = true,
    textSize = 'text-xl',
    className = ''
}) => (
    <div className={`flex items-center gap-3 ${className}`}>
        <LizaLogo size={size} />
        {showText && <span className={`font-extrabold tracking-tight bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent drop-shadow-sm ${textSize}`}>Liza</span>}
    </div>
);
