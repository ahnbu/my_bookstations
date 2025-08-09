// 현재 서비스의 제목 처리 함수 테스트
function processGyeonggiEbookTitle(title) {
  const specialChars = /[,\-:;()[\]{}]/;
  
  let processedTitle = title;
  const match = title.search(specialChars);
  if (match !== -1) {
    processedTitle = title.substring(0, match).trim();
  }
  
  const words = processedTitle.split(' ').filter(word => word.trim() !== '');
  
  return words.slice(0, 3).join(' ');
}

function createGyeonggiEbookSearchURL(title) {
  const processedTitle = processGyeonggiEbookTitle(title);
  const baseUrl = "https://ebook.library.kr/search";
  const encodedTitle = encodeURIComponent(processedTitle).replace(/'/g, '%27');
  const detailQuery = `TITLE:${encodedTitle}:true`;
  
  return `${baseUrl}?detailQuery=${detailQuery}&OnlyStartWith=false&searchType=all&listType=list`;
}

const testTitle = "내 손으로, 시베리아 횡단열차 - 일러스트레이터 이다의 카메라 없는 핸드메이드 여행일기";
const result = processGyeonggiEbookTitle(testTitle);

console.log('원본 제목:', testTitle);
console.log('현재 서비스 처리 결과:', result);
console.log('검색 URL:', createGyeonggiEbookSearchURL(testTitle));