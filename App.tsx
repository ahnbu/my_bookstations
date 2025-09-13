
import React, { useEffect } from 'react';
import BookSearchListModal from './components/BookSearchListModal';
import BookDetails from './components/BookDetails';
import MyLibrary from './components/MyLibrary';
import SearchForm from './components/SearchForm';
import DevToolsFloat from './components/DevToolsFloat';
import AuthModal from './components/AuthModal';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import SettingsModal from './components/SettingsModal';
import Notification from './components/Notification';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

import { useUIStore } from './stores/useUIStore';
import { useAuthStore } from './stores/useAuthStore';
import { useBookStore } from './stores/useBookStore';
import { useSettingsStore } from './stores/useSettingsStore';

const App: React.FC = () => {
  const { notification, setNotification } = useUIStore();
  const initializeAuthListener = useAuthStore(state => state.initializeAuthListener);
  const session = useAuthStore(state => state.session);
  const fetchUserLibrary = useBookStore(state => state.fetchUserLibrary);
  const clearLibrary = useBookStore(state => state.clearLibrary);
  const fetchUserSettings = useSettingsStore(state => state.fetchUserSettings);

  useEffect(() => {
    const unsubscribe = initializeAuthListener();
    return () => unsubscribe();
  }, [initializeAuthListener]);

  useEffect(() => {
    if (session) {
      fetchUserLibrary();
      fetchUserSettings();
    } else {
      clearLibrary();
    }
  }, [session, fetchUserLibrary, clearLibrary, fetchUserSettings]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=signup')) {
      setNotification({
        message: '회원가입이 완료되었습니다! 환영합니다.',
        type: 'success',
      });
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [setNotification]);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Header />

        <SearchForm />
        
        <BookDetails />
        
        <MyLibrary />

        <BookSearchListModal />

        <AuthModal />
        
        <ProfileSettingsModal />
        
        <SettingsModal />
      </main>
      <Footer />
      
      {/* 개발환경에서만 개발자 도구 표시 */}
      {import.meta.env.DEV && <DevToolsFloat />}
    </div>
  );
};

export default App;
