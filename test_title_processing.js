// 제목 처리 함수 테스트
function processGyeonggiEbookTitle(title) {
  // 더 관대한 처리: 하이픈과 콜론은 허용하고, 괄호에서만 자르기
  const specialChars = /[()[\]{}]/;
  
  // 특수문자가 있으면 그 위치까지만 추출
  let processedTitle = title;
  const match = title.search(specialChars);
  if (match !== -1) {
    processedTitle = title.substring(0, match).trim();
  }
  
  // 쉼표로 구분된 첫 번째 부분과 두 번째 부분을 합치기
  const commaParts = processedTitle.split(',');
  if (commaParts.length >= 2) {
    // "내 손으로, 시베리아 횡단열차" → "내 손으로 시베리아 횡단열차"
    processedTitle = commaParts.slice(0, 2).join(' ').trim();
  }
  
  // 공백으로 분리하고 빈 문자열 제거
  const words = processedTitle.split(/\s+/).filter(word => word.trim() !== '');
  
  // 최대 5단어까지 사용 (더 많은 키워드 포함)
  return words.slice(0, 5).join(' ');
}

const testTitle = "내 손으로, 시베리아 횡단열차 - 일러스트레이터 이다의 카메라 없는 핸드메이드 여행일기";
const result = processGyeonggiEbookTitle(testTitle);

console.log('원본 제목:', testTitle);
console.log('처리된 제목:', result);
console.log('URL 인코딩:', encodeURIComponent(result));