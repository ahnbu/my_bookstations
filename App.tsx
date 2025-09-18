
import React, { useEffect } from 'react';
import BookSearchListModal from './components/BookSearchListModal';
import BookDetails from './components/BookDetails';
import MyLibrary from './components/MyLibrary';
import SearchForm from './components/SearchForm';
import AdminPanel from './components/DevToolsFloat';
import AuthModal from './components/AuthModal';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import SettingsModal from './components/SettingsModal';
import FeedbackModal from './components/FeedbackModal';
import BulkSearchModal from './components/BulkSearchModal';
import APITestModal from './components/APITestModal';
import DevNoteModal from './components/DevNoteModal';
import WelcomeModal from './components/WelcomeModal';
import MyLibraryBookDetailModal from './components/MyLibraryBookDetailModal';
import Notification from './components/Notification';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import { addHomeResetListener } from './utils/events';

import { useUIStore } from './stores/useUIStore';
import { useAuthStore } from './stores/useAuthStore';
import { useBookStore } from './stores/useBookStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { isAdmin } from './utils/adminCheck';

const App: React.FC = () => {
  const { notification, setNotification, openWelcomeModal, selectedBookIdForDetail, closeMyLibraryBookDetailModal } = useUIStore();
  const initializeAuthListener = useAuthStore(state => state.initializeAuthListener);
  const session = useAuthStore(state => state.session);
  const fetchUserLibrary = useBookStore(state => state.fetchUserLibrary);
  const clearLibrary = useBookStore(state => state.clearLibrary);
  const fetchUserSettings = useSettingsStore(state => state.fetchUserSettings);
  const applyTheme = useSettingsStore(state => state.applyTheme);
  const settings = useSettingsStore(state => state.settings);

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

  // 설정이 로드되면 테마 적용
  useEffect(() => {
    if (settings.theme) {
      applyTheme(settings.theme);
    }
  }, [settings.theme, applyTheme]);

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

  // 첫 방문자 감지 및 웰컴 모달 표시
  useEffect(() => {
    const hasVisitedBefore = localStorage.getItem('hasVisited');
    if (!hasVisitedBefore) {
      // 약간의 지연을 두어 다른 초기화가 완료된 후 웰컴 모달 표시
      setTimeout(() => {
        openWelcomeModal();
      }, 500);
    }
  }, [openWelcomeModal]);

  // 홈 리셋 이벤트 구독 - 전역 모달 닫기 (성능 최적화)
  useEffect(() => {
    const cleanup = addHomeResetListener(() => {
      // 전역 상세 모달 닫기 (조건부 체크를 내부에서 수행)
      const { selectedBookIdForDetail: currentBookId, closeMyLibraryBookDetailModal: closeModal } = useUIStore.getState();
      if (currentBookId) {
        closeModal();
      }
    });

    return cleanup;
  }, []); // 빈 의존성 배열로 이벤트 리스너 재등록 방지

  return (
    <div className="min-h-screen bg-primary text-primary font-sans">
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

        <FeedbackModal />
      </main>
      <Footer />

      {/* 웰컴 모달 */}
      <WelcomeModal />

      {/* 전역 상세 모달 */}
      {selectedBookIdForDetail && (
        <MyLibraryBookDetailModal
          bookId={selectedBookIdForDetail}
          onClose={closeMyLibraryBookDetailModal}
        />
      )}

      {/* 개발환경에서만 개발자 도구 표시 */}
      {isAdmin(session?.user?.email) && <AdminPanel />}

      {/* 개발도구 독립 모달들 */}
      {isAdmin(session?.user?.email) && (
        <>
          <BulkSearchModal />
          <APITestModal />
          <DevNoteModal />
        </>
      )}
    </div>
  );
};

export default App;
