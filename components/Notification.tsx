import React, { useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon } from './Icons';

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // Auto-close after 5 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  const Icon = type === 'success' ? CheckCircleIcon : XCircleIcon;

  return (
    <div 
      className={`fixed top-5 right-5 z-[100] flex items-center p-4 rounded-lg shadow-lg text-white ${bgColor} animate-fade-in`}
      role="alert"
    >
      <Icon className="w-6 h-6 mr-3 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
};

export default Notification;
