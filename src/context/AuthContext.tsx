import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { User, LoginCredentials, SignupCredentials } from '@/types';
import { toast } from 'sonner';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    signup: (credentials: SignupCredentials) => Promise<void>;
    logout: () => void;
    updateProfile: (updates: Partial<User>) => void;
    deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const login = async ({ email, password }: LoginCredentials) => {
        setIsLoading(true);
        return new Promise<void>((resolve, reject) => {
            setTimeout(() => {
                if (!email.includes('@') || password.length < 6) {
                    toast.error('Invalid credentials');
                    setIsLoading(false);
                    reject(new Error('Invalid credentials'));
                    return;
                }
                setUser({
                    id: 'user-' + Date.now(),
                    email,
                    name: email.split('@')[0],
                    createdAt: new Date(),
                    lastLoginAt: new Date(),
                });
                toast.success('Welcome back!');
                setIsLoading(false);
                resolve();
            }, 1000);
        });
    };

    const signup = async ({ email, password, name }: SignupCredentials) => {
        setIsLoading(true);
        return new Promise<void>((resolve, reject) => {
            setTimeout(() => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email) || password.length < 8 || name.length < 2) {
                    toast.error('Please check your inputs');
                    setIsLoading(false);
                    reject(new Error('Invalid inputs'));
                    return;
                }
                setUser({
                    id: 'user-' + Date.now(),
                    email,
                    name,
                    createdAt: new Date(),
                    lastLoginAt: new Date(),
                });
                toast.success('Account created!');
                setIsLoading(false);
                resolve();
            }, 1200);
        });
    };

    const logout = () => {
        setUser(null);
        toast.success('Logged out');
    };

    const updateProfile = (updates: Partial<User>) => {
        if (user) {
            setUser({ ...user, ...updates });
            toast.success('Profile updated!');
        }
    };

    const deleteAccount = async () => {
        if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            setIsLoading(true);
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    setUser(null);
                    setIsLoading(false);
                    toast.error('Account deleted successfully');
                    resolve();
                }, 1500);
            });
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, signup, logout, updateProfile, deleteAccount }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
