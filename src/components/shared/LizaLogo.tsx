import React from 'react';

interface LizaLogoProps {
    width?: number;
    height?: number;
    className?: string;
}

export const LizaLogo: React.FC<LizaLogoProps> = ({ width = 120, height = 40, className = '' }) => (
    <img
        src="/assets/logo.png"
        alt="Liza"
        className={`object-contain ${className}`}
        style={{ width, height }}
    />
);

export const LogoDisplay: React.FC<LizaLogoProps & { showText?: boolean; textSize?: string }> = ({
    width = 120,
    height = 40,
    showText = false,
    textSize = 'text-xl',
    className = ''
}) => (
    <div className={`flex items-center ${className}`}>
        <LizaLogo width={width} height={height} />
    </div>
);
