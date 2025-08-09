// 두 가지 제목 처리 방식 비교

function processBookTitle(title) {
  // 한글 외의 문자(영어, 숫자, 특수문자 등)를 공백으로 변경
  const processedTitle = title.replace(/[^가-힣\s]/g, ' ');
  
  // 공백으로 분리하고 빈 문자열 제거
  const chunks = processedTitle.split(' ').filter(chunk => chunk.trim() !== '');
  
  // 3개 이하면 그대로 반환, 3개 초과면 첫 3개만 반환
  if (chunks.length <= 3) {
    return chunks.join(' ');
  }
  return chunks.slice(0, 3).join(' ');
}

function processGyeonggiEbookTitle(title) {
  // 특수문자 목록 (쉼표, 하이픈, 콜론, 세미콜론, 괄호 등)
  const specialChars = /[,\-:;()[\]{}]/;
  
  // 특수문자가 있으면 그 위치까지만 추출
  let processedTitle = title;
  const match = title.search(specialChars);
  if (match !== -1) {
    processedTitle = title.substring(0, match).trim();
  }
  
  // 공백으로 분리하고 빈 문자열 제거
  const words = processedTitle.split(' ').filter(word => word.trim() !== '');
  
  // 최대 3단어까지만 사용
  return words.slice(0, 3).join(' ');
}

const testTitle = "머니 트렌드 2025 - 새로운 부의 기회를 선점할 55가지 성공 시나리오";

console.log('=== 제목 처리 방식 비교 ===');
console.log('원본 제목:', testTitle);
console.log('');
console.log('1. processBookTitle (기존 - 한글만):');
console.log('   결과:', processBookTitle(testTitle));
console.log('');
console.log('2. processGyeonggiEbookTitle (경기도용 - 숫자/영어 포함):');
console.log('   결과:', processGyeonggiEbookTitle(testTitle));
console.log('');

console.log('=== 예상되는 API 요청 ===');
console.log('{');
console.log('  "isbn": "9791170402008",');
console.log(`  "title": "${processBookTitle(testTitle)}",`);
console.log(`  "gyeonggiTitle": "${processGyeonggiEbookTitle(testTitle)}"`);
console.log('}');