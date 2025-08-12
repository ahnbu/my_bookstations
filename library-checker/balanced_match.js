const fs = require('fs');

const html = fs.readFileSync('D:/Vibe_Coding/my_bookstation/docs/temp/시립소장_검색결과_외우지않고.html', 'utf8');
const bookListMatch = html.match(/<ul[^>]*class[^>]*book_resultList[^>]*>([\s\S]*?)<\/ul>/i);

if (bookListMatch) {
  const bookListHTML = bookListMatch[1];
  console.log('=== Balanced Bracket Matching 시도 ===');
  
  // 더 간단한 접근: 첫 번째 <li>부터 마지막 </li>까지
  const firstLiStart = bookListHTML.indexOf('<li>');
  const lastLiEnd = bookListHTML.lastIndexOf('</li>') + 5;
  
  if (firstLiStart !== -1 && lastLiEnd !== -1) {
    const fullLiContent = bookListHTML.substring(firstLiStart, lastLiEnd);
    console.log('전체 <li> 영역 길이:', fullLiContent.length);
    console.log('use 클래스 포함 여부:', fullLiContent.includes('class="use"'));
    
    if (fullLiContent.includes('class="use"')) {
      console.log('✅ use 클래스 발견!');
      
      // use 클래스 주변 내용 확인
      const useIndex = fullLiContent.indexOf('class="use"');
      console.log('\nuse 클래스 주변 내용:');
      console.log(fullLiContent.substring(useIndex - 100, useIndex + 200));
      
      // 대출 정보 패턴 테스트
      const loanPatterns = [
        /\[\s*대출\s*:\s*<strong>(\d+)\/(\d+)<\/strong>\s*\]/i,
        /대출\s*:\s*<strong>(\d+)\/(\d+)<\/strong>/i,
        /<p[^>]*class[^>]*use[^>]*>[\s\S]*?대출[^0-9]*(\d+)\/(\d+)[\s\S]*?<\/p>/i
      ];
      
      console.log('\n=== 대출 정보 패턴 테스트 ===');
      for (let i = 0; i < loanPatterns.length; i++) {
        const match = fullLiContent.match(loanPatterns[i]);
        if (match) {
          console.log(`✅ 패턴 ${i+1} 매칭 성공: [${match[1]}/${match[2]}]`);
          const totalCopies = parseInt(match[2]);
          const currentBorrowed = parseInt(match[1]);
          const availableCopies = totalCopies - currentBorrowed;
          console.log(`   총 재고: ${totalCopies}권, 대출 중: ${currentBorrowed}권, 이용 가능: ${availableCopies}권`);
          break;
        } else {
          console.log(`❌ 패턴 ${i+1} 매칭 실패`);
        }
      }
    } else {
      console.log('❌ use 클래스 여전히 없음');
    }
  }
} else {
  console.log('book_resultList를 찾을 수 없음');
}