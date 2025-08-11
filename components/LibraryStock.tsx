import React from 'react';
import { LibraryStockResponse } from '../types';
import { generateLibraryDetailURL, isLibraryStockClickable } from '../services/unifiedLibrary.service';
import Spinner from './Spinner';

interface LibraryStockProps {
  stock: LibraryStockResponse | null;
  isLoading: boolean;
  error: string | null;
}

const LibraryStock: React.FC<LibraryStockProps> = ({ stock, isLoading, error }) => {
  // 퇴촌도서관 재고 클릭 핸들러
  const handleLibraryStockClick = (item: any) => {
    console.log('퇴촌도서관 재고 클릭됨:', item);
    console.log('클릭 가능 여부:', isLibraryStockClickable(item));
    
    if (isLibraryStockClickable(item)) {
      const url = generateLibraryDetailURL(item.recKey, item.bookKey, item.publishFormCode);
      console.log('생성된 URL:', url);
      console.log('파라미터 확인:', { recKey: item.recKey, bookKey: item.bookKey, publishFormCode: item.publishFormCode });
      window.open(url, '_blank');
    } else {
      console.log('클릭 불가능한 항목입니다. 사유:', {
        isToechon: item['소장도서관'] === '퇴촌도서관',
        isAvailable: item['대출상태'] === '대출가능',
        hasParams: !!item.recKey && !!item.bookKey && !!item.publishFormCode
      });
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center p-8">
          <Spinner />
          <p className="ml-4 text-gray-400">도서관 재고를 확인하는 중입니다...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-yellow-400 bg-yellow-900/50 p-4 rounded-lg">
          <p><strong>재고 확인 오류:</strong> {error}</p>
        </div>
      );
    }

    if (!stock || !stock.availability || stock.availability.length === 0) {
      return (
        <div className="text-center text-gray-400 bg-gray-900/50 p-4 rounded-lg">
          <p>경기도 광주시 시립도서관에는 해당 도서의 재고가 없습니다.</p>
        </div>
      );
    }
    
    const sortedAvailability = [...stock.availability].sort((a, b) => {
        if (a['소장도서관'] === '퇴촌도서관' && b['소장도서관'] !== '퇴촌도서관') {
            return -1;
        }
        if (a['소장도서관'] !== '퇴촌도서관' && b['소장도서관'] === '퇴촌도서관') {
            return 1;
        }
        return a['소장도서관'].localeCompare(b['소장도서관']);
    });

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="p-3 font-semibold text-gray-300">소장도서관</th>
              <th className="p-3 font-semibold text-gray-300">청구기호</th>
              <th className="p-3 font-semibold text-gray-300 text-center">대출상태</th>
              <th className="p-3 font-semibold text-gray-300">반납예정일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sortedAvailability.map((item, index) => {
              const isToechon = item['소장도서관'] === '퇴촌도서관';
              const isClickable = isLibraryStockClickable(item);
              
              return (
                <tr key={index} className={isToechon ? 'bg-blue-900/30' : 'hover:bg-gray-700/50'}>
                  <td className="p-3 text-white font-semibold">
                    {isToechon ? (
                      <span className="flex items-center">
                        {item['소장도서관']}
                        <span className="ml-2 text-xs bg-blue-500 text-white font-bold px-2 py-0.5 rounded-full">My</span>
                      </span>
                    ) : (
                      item['소장도서관']
                    )}
                  </td>
                  <td className="p-3 text-gray-300 font-mono">{item['청구기호']}</td>
                  <td className="p-3 text-center font-bold">
                    {isClickable ? (
                      <button 
                        onClick={() => handleLibraryStockClick(item)}
                        className="text-green-400 hover:text-green-300 hover:underline cursor-pointer transition-colors duration-200"
                        title="클릭하여 도서관 상세 페이지로 이동"
                      >
                        {item['대출상태']}
                      </button>
                    ) : (
                      <span className={item['대출상태'] === '대출가능' ? 'text-green-400' : 'text-red-400'}>
                        {item['대출상태']}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-gray-400">{item['반납예정일'] !== '-' ? item['반납예정일'] : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="mt-8 pt-6 border-t border-gray-700">
      <h3 className="text-2xl font-bold text-white mb-4">도서관 재고 현황 (경기도 광주시)</h3>
      <div className="bg-gray-900/50 rounded-lg shadow-inner p-1 sm:p-4">
        {renderContent()}
      </div>
    </div>
  );
};

export default LibraryStock;