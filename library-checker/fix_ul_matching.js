const fs = require('fs');

const html = fs.readFileSync('D:/Vibe_Coding/my_bookstation/docs/temp/시립소장_검색결과_외우지않고.html', 'utf8');

console.log('=== UL 매칭 문제 해결 테스트 ===');

// 기존 방법 (non-greedy)
const nonGreedyMatch = html.match(/<ul[^>]*class[^>]*book_resultList[^>]*>([\s\S]*?)<\/ul>/i);
console.log('Non-greedy 방법:');
console.log('길이:', nonGreedyMatch ? nonGreedyMatch[1].length : 'null');
console.log('use 클래스 포함:', nonGreedyMatch ? nonGreedyMatch[1].includes('class="use"') : false);

// 개선된 방법 (greedy)
const greedyMatch = html.match(/<ul[^>]*class[^>]*book_resultList[^>]*>([\s\S]*)<\/ul>/i);
console.log('\nGreedy 방법:');
console.log('길이:', greedyMatch ? greedyMatch[1].length : 'null');
console.log('use 클래스 포함:', greedyMatch ? greedyMatch[1].includes('class="use"') : false);

// 더 구체적인 방법: book_resultList 다음의 가장 가까운 </ul> + <!-- paging --> 찾기
const specificMatch = html.match(/<ul[^>]*class[^>]*book_resultList[^>]*>([\s\S]*?)<\/ul>\s*<!-- paging -->/i);
console.log('\n구체적 방법 (paging 주석까지):');
console.log('길이:', specificMatch ? specificMatch[1].length : 'null');
console.log('use 클래스 포함:', specificMatch ? specificMatch[1].includes('class="use"') : false);

// 가장 확실한 방법: book_resultList부터 다음 <!-- paging -->까지
const bookResultStart = html.indexOf('class="book_resultList"');
const pagingStart = html.indexOf('<!-- paging -->', bookResultStart);

if (bookResultStart !== -1 && pagingStart !== -1) {
  // <ul class="book_resultList"> 시작점 찾기
  const ulStart = html.lastIndexOf('<ul', bookResultStart) + html.substring(html.lastIndexOf('<ul', bookResultStart)).indexOf('>') + 1;
  // <!-- paging --> 바로 전의 </ul> 찾기  
  const ulEnd = html.lastIndexOf('</ul>', pagingStart);
  
  const definitiveContent = html.substring(ulStart, ulEnd);
  
  console.log('\n확실한 방법 (위치 기반):');
  console.log('길이:', definitiveContent.length);
  console.log('use 클래스 포함:', definitiveContent.includes('class="use"'));
  
  if (definitiveContent.includes('class="use"')) {
    console.log('✅ 드디어 use 클래스 발견!');
    
    // 대출 정보 패턴 테스트
    const loanPattern = /\[\s*대출\s*:\s*<strong>(\d+)\/(\d+)<\/strong>\s*\]/i;
    const match = definitiveContent.match(loanPattern);
    
    if (match) {
      console.log(`🎯 대출 정보 파싱 성공: [${match[1]}/${match[2]}]`);
      console.log(`   총 재고: ${match[2]}권`);
      console.log(`   현재 대출: ${match[1]}권`);  
      console.log(`   이용 가능: ${parseInt(match[2]) - parseInt(match[1])}권`);
    }
  }
}