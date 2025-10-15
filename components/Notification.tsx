import React, { useEffect } from 'react';
// [수정] AlertTriangleIcon과 InfoIcon을 Icons 파일에서 import
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon, InfoIcon } from './Icons';

interface NotificationProps {
  // [수정] type에 'warning'과 'info' 추가
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    // [수정] 타입별로 자동 닫힘 시간 설정 (info와 warning은 3초)
    const duration = {
      success: 2000,
      error: 4000,
      warning: 3000,
      info: 3000,
    };
    const timer = setTimeout(() => {
      onClose();
    }, duration[type]);

    return () => clearTimeout(timer);
  }, [onClose, type]);

  // [수정] 타입별 배경색 매핑
  const themeClasses = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-yellow-500',
    info: 'bg-blue-600',
  };

  // [수정] 타입별 아이콘 매핑
  const Icon = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    warning: AlertTriangleIcon,
    info: InfoIcon,
  }[type];


  return (
    <div 
      // [수정] themeClasses를 사용하여 동적으로 배경색 클래스 적용
      className={`fixed top-5 right-5 z-[100] flex items-center p-4 rounded-lg shadow-lg text-white ${themeClasses[type]} animate-fade-in`}
      role="alert"
    >
      <Icon className="w-6 h-6 mr-3 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
};

export default Notification;