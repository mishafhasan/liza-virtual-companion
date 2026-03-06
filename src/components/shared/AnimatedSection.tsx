import React from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

interface AnimatedSectionProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    effect?: 'fade-up' | 'scale-up' | 'slide-in-left' | 'slide-in-right';
}

export const AnimatedSection: React.FC<AnimatedSectionProps> = ({
    children,
    className = '',
    delay = 0,
    effect = 'fade-up'
}) => {
    const { ref, isVisible } = useScrollAnimation(0.1);

    const getEffectClass = () => {
        if (!isVisible) return 'opacity-0 translate-y-8';

        switch (effect) {
            case 'scale-up': return 'animate-scale-up opacity-100';
            case 'slide-in-left': return 'animate-slide-in-left opacity-100';
            case 'slide-in-right': return 'animate-slide-in-right opacity-100';
            default: return 'animate-fade-up opacity-100';
        }
    };

    return (
        <div
            ref={ref}
            className={`transition-all duration-700 ${className} ${getEffectClass()}`}
            style={{ animationDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
};
