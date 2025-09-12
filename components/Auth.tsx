import React, { useState } from 'react';
import Spinner from './Spinner';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';

const Auth: React.FC = () => {
    const { session, signOut } = useAuthStore();
    const { openAuthModal } = useUIStore();
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);
        await signOut();
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-2">
                <Spinner />
            </div>
        );
    }

    if (session) {
        const { user } = session;
        const userAvatar = user.user_metadata?.avatar_url;
        const userEmail = user.email;

        return (
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    {userAvatar && (
                        <img src={userAvatar} alt="User avatar" className="w-8 h-8 rounded-full" />
                    )}
                    <span className="text-sm text-gray-300 hidden sm:inline">{userEmail}</span>
                </div>
                <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors duration-300 text-sm"
                >
                    로그아웃
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => openAuthModal('login')}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-300 text-sm"
            >
                로그인
            </button>
            <button
                onClick={() => openAuthModal('signup')}
                className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors duration-300 text-sm"
            >
                회원가입
            </button>
        </div>
    );
};

export default Auth;