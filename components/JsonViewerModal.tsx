import React, { useEffect } from 'react';
import { CloseIcon } from './Icons';
import { useUIStore } from '../stores/useUIStore'; // [추가]

interface JsonViewerModalProps {
  jsonData: object | null;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

const JsonViewerModal: React.FC = () => {
  // [수정] ✅ props 대신 useUIStore에서 상태와 액션을 가져옴
  const { isJsonViewerModalOpen, jsonViewerData, jsonViewerTitle, closeJsonViewerModal } = useUIStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeJsonViewerModal();
      }
    };
    if (isJsonViewerModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isJsonViewerModalOpen, closeJsonViewerModal]);

  if (!isJsonViewerModalOpen || !jsonViewerData) return null;

  const formattedJson = JSON.stringify(jsonViewerData, null, 2);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[60] p-4">
      <div className="bg-elevated rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-primary">
          <h2 className="text-xl font-bold text-primary">{jsonViewerTitle}</h2>
          <button onClick={closeJsonViewerModal} className="text-secondary hover:text-primary">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-auto">
          <pre className="text-sm text-primary bg-secondary p-4 rounded-md whitespace-pre-wrap break-all">
            <code>{formattedJson}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

// const JsonViewerModal: React.FC<JsonViewerModalProps> = ({ jsonData, isOpen, onClose, title = "JSON 데이터" }) => {
  // useEffect(() => {
  //   const handleKeyDown = (event: KeyboardEvent) => {
  //     if (event.key === 'Escape') {
  //       onClose();
  //     }
  //   };
  //   if (isOpen) {
  //     window.addEventListener('keydown', handleKeyDown);
  //   }
  //   return () => {
  //     window.removeEventListener('keydown', handleKeyDown);
  //   };
  // }, [isOpen, onClose]);

  // if (!isOpen || !jsonData) return null;

  // // JSON.stringify의 세 번째 인자는 들여쓰기(space) 개수입니다.
  // const formattedJson = JSON.stringify(jsonData, null, 2);

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[60] p-4">
//       <div className="bg-elevated rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
//         <div className="flex justify-between items-center p-4 border-b border-primary">
//           <h2 className="text-xl font-bold text-primary">{title}</h2>
//           <button onClick={onClose} className="text-secondary hover:text-primary">
//             <CloseIcon className="w-6 h-6" />
//           </button>
//         </div>
//         <div className="p-6 overflow-auto">
//           <pre className="text-sm text-primary bg-secondary p-4 rounded-md whitespace-pre-wrap break-all">
//             <code>{formattedJson}</code>
//           </pre>
//         </div>
//       </div>
//     </div>
//   );
// };

export default JsonViewerModal;