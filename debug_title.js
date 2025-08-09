// 제목 처리 로직 디버깅

function processGyeonggiEbookTitle(title) {
  console.log('=== 제목 처리 단계별 분석 ===');
  console.log('1. 원본 제목:', title);
  
  // 특수문자 목록 (쉼표, 하이픈, 콜론, 세미콜론, 괄호 등)
  const specialChars = /[,\-:;()[\]{}]/;
  
  // 특수문자가 있으면 그 위치까지만 추출
  let processedTitle = title;
  const match = title.search(specialChars);
  console.log('2. 특수문자 검색 결과:', match);
  if (match !== -1) {
    console.log('3. 발견된 특수문자:', title[match]);
    processedTitle = title.substring(0, match).trim();
  }
  console.log('4. 특수문자 제거 후:', processedTitle);
  
  // 공백으로 분리하고 빈 문자열 제거
  const words = processedTitle.split(' ').filter(word => word.trim() !== '');
  console.log('5. 단어 분리:', words);
  
  // 최대 3단어까지만 사용
  const result = words.slice(0, 3).join(' ');
  console.log('6. 최종 결과:', result);
  
  return result;
}

// 테스트 케이스들
const testCases = [
  "머니 트렌드 2025 - 새로운 부의 기회를 선점할 55가지 성공 시나리오",
  "확률적 사고의 힘",
  "Java Programming - Advanced Concepts",
  "React.js 완벽 가이드 (2024년판)"
];

testCases.forEach((testCase, index) => {
  console.log(`\n=== 테스트 케이스 ${index + 1} ===`);
  processGyeonggiEbookTitle(testCase);
});