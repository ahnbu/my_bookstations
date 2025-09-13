import React, { useState } from 'react';
import Spinner from './Spinner';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import { SettingsIcon } from './Icons';

const Auth: React.FC = () => {
    const { session } = useAuthStore();
    const { openAuthModal, openProfileModal, openSettingsModal } = useUIStore();
    const [loading, setLoading] = useState(false);

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
            <div className="flex items-center gap-2">
                <button
                    onClick={openProfileModal}
                    className="flex items-center gap-2 hover:bg-gray-800 p-2 rounded-lg transition-colors duration-200"
                    title="프로필 설정"
                >
                    {userAvatar ? (
                        <img src={userAvatar} alt="User avatar" className="w-8 h-8 rounded-full" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">
                                {userEmail?.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                </button>
                <button
                    onClick={openSettingsModal}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors duration-200"
                    title="맞춤 설정"
                >
                    <SettingsIcon className="w-5 h-5 text-gray-300 hover:text-white" />
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