import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { CloseIcon, GoogleIcon, UserIcon, LockIcon } from './Icons';
import Spinner from './Spinner';
import { useUIStore } from '../stores/useUIStore';

const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authModalMode, closeAuthModal, switchAuthMode, setNotification } = useUIStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthModalOpen) {
      // Reset state when modal opens or mode changes
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setLoading(false);
      setMessage('');
      setError('');
    }
  }, [isAuthModalOpen, authModalMode]);

  if (!isAuthModalOpen) return null;

  const handleAuthAction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (authModalMode === 'signup') {
      if (password !== confirmPassword) {
        setError('비밀번호가 일치하지 않습니다.');
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError('회원가입 중 오류가 발생했습니다: ' + signUpError.message);
      } else if (data.user) {
         if (data.user.identities && data.user.identities.length === 0) {
            setMessage('이미 가입된 이메일입니다. 확인 메일을 다시 보냈으니 이메일함을 확인하시거나 로그인을 시도해주세요.');
        } else {
            setMessage('가입 확인을 위해 이메일을 확인해주세요! 확인 이메일은 최대 5분까지 소요될 수 있습니다.');
        }
      }
    } else { // mode === 'login'
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        if (signInError.message === 'Email not confirmed') {
            setError('회원가입 대기 상태입니다. 회원가입시 발송된 이메일 확인 후에 다시 로그인을 시도하세요.');
        } else {
            setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        }
      } else {
        // Successful login will be handled by the listener in useAuthStore
        // which will close the modal via the UI store
      }
    }
    setLoading(false);
  };

  const getRedirectURL = () => {
    if (typeof window !== 'undefined') {
      const currentURL = window.location.origin;

      // 로컬 개발 환경 감지 (localhost 또는 127.0.0.1)
      if (currentURL.includes('localhost') || currentURL.includes('127.0.0.1')) {
        return currentURL; // 현재 실행중인 전체 URL 사용 (포트 포함)
      }

      // 프로덕션 환경
      return 'https://my-bookstations.vercel.app/';
    }

    return 'https://my-bookstations.vercel.app/';
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getRedirectURL()
        }
    });
    if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
    }
  };

  const title = authModalMode === 'login' ? '로그인' : '회원가입';
  const buttonText = authModalMode === 'login' ? '로그인하기' : '가입하기';
  const switchText = authModalMode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?';
  const switchLinkText = authModalMode === 'login' ? '회원가입' : '로그인';
  const switchTargetMode = authModalMode === 'login' ? 'signup' : 'login';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-sm flex flex-col relative animate-fade-in">
        <button onClick={closeAuthModal} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <CloseIcon className="w-6 h-6" />
        </button>
        <div className="p-8">
          <h2 className="text-2xl font-bold text-white text-center mb-6">{title}</h2>

          <form onSubmit={handleAuthAction}>
            <div className="space-y-4">
              <div className="relative">
                 <UserIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                 <input
                  type="email"
                  placeholder="이메일 주소"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="relative">
                <LockIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  placeholder="비밀번호 (6자 이상)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {authModalMode === 'signup' && (
                <div className="relative">
                    <LockIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                    type="password"
                    placeholder="비밀번호 확인"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
              )}
            </div>

            {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
            {message && <p className="mt-4 text-center text-sm text-green-400">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full flex items-center justify-center py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-300 disabled:bg-gray-600"
            >
              {loading && !message ? <Spinner /> : buttonText}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">또는</span>
            </div>
          </div>
          
           <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors duration-300 shadow-md disabled:opacity-70"
            >
                {loading ? <Spinner /> : <GoogleIcon className="w-5 h-5" />}
                <span>Google 계정으로 계속하기</span>
            </button>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-400">{switchText}</span>
            <button onClick={() => switchAuthMode(switchTargetMode)} className="font-medium text-blue-400 hover:underline ml-1">
              {switchLinkText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;