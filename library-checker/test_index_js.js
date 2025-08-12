const fs = require('fs');

// index.js에서 parseSiripOwnedEbookHTML 함수를 추출하여 테스트
async function testParsing() {
  try {
    console.log('=== index.js 파싱 로직 테스트 ===');
    
    // 인공지능 파일로 테스트
    const html = fs.readFileSync('D:/Vibe_Coding/my_bookstation/docs/temp/시립소장_검색결과_인공지능.html', 'utf8');
    console.log(`HTML 파일 로드 (크기: ${Math.round(html.length / 1024)}KB)`);
    
    // 개선된 파싱 로직 적용
    const searchTitle = '인공지능';
    
    // 1. 책 리스트 전체 추출 (개선된 패턴)
    let bookListMatch = html.match(/<ul[^>]*class[^>]*book_resultList[^>]*>([\s\S]*?)<\/ul>\s*<!-- paging -->/i);
    let alternativeMatch = null;
    
    if (!bookListMatch) {
      console.log('❌ book_resultList with paging 매칭 실패, 대안 시도...');
      alternativeMatch = html.match(/<ul[^>]*class[^>]*book_resultList[^>]*>([\s\S]*)<\/ul>/i);
      if (alternativeMatch) {
        console.log('✅ 대안 패턴으로 book_resultList 추출 성공');
      }
    } else {
      console.log('✅ book_resultList with paging 매칭 성공');
    }
    
    const finalBookListHTML = bookListMatch ? bookListMatch[1] : (alternativeMatch ? alternativeMatch[1] : '');
    
    if (!finalBookListHTML) {
      console.log('❌ book_resultList 추출 실패');
      return;
    }
    
    console.log(`✅ 최종 book_resultList 추출 성공 (길이: ${finalBookListHTML.length}자)`);
    console.log(`🔍 use 클래스 포함 여부: ${finalBookListHTML.includes('class="use"')}`);
    
    if (!finalBookListHTML.includes('class="use"')) {
      console.log('❌ use 클래스 여전히 누락');
      return;
    }
    
    // 2. 전체 영역에서 책 정보 추출
    console.log('\n=== 책 정보 추출 ===');
    
    // 제목 추출
    let title = '';
    const titleMatch = finalBookListHTML.match(/<li[^>]*class[^>]*tit[^>]*>[\s\S]*?<a[^>]*title="([^"]*)"[^>]*>/i);
    if (titleMatch) {
      title = titleMatch[1].trim().split('|')[0].trim();
      console.log(`📚 제목: "${title}"`);
    }
    
    // 저자/출판사/출간일 추출
    let author = '', publisher = '', publishDate = '';
    const writerMatch = finalBookListHTML.match(/<li[^>]*class[^>]*writer[^>]*>([\s\S]*?)<\/li>/i);
    if (writerMatch) {
      const writerContent = writerMatch[1];
      const writerPattern = /^([^<]+)<span[^>]*>([^<]+)<\/span>(.*)$/i;
      const writerDetailMatch = writerContent.match(writerPattern);
      
      if (writerDetailMatch) {
        author = writerDetailMatch[1].trim();
        publisher = writerDetailMatch[2].trim();
        publishDate = writerDetailMatch[3].trim();
        console.log(`✍️ 저자: "${author}"`);
        console.log(`🏢 출판사: "${publisher}"`);
        console.log(`📅 출간일: "${publishDate}"`);
      }
    }
    
    // 3. 대출 현황 파싱 (핵심!)
    console.log('\n=== 대출 현황 파싱 ===');
    
    const loanPatterns = [
      /\[\s*대출\s*:\s*<strong>(\d+)\/(\d+)<\/strong>\s*\]/i,
      /대출\s*:\s*<strong>(\d+)\/(\d+)<\/strong>/i,
      /<p[^>]*class[^>]*use[^>]*>[\s\S]*?대출[^0-9]*(\d+)\/(\d+)[\s\S]*?<\/p>/i
    ];
    
    let useMatch = null;
    let patternUsed = '';
    
    for (let i = 0; i < loanPatterns.length; i++) {
      useMatch = finalBookListHTML.match(loanPatterns[i]);
      if (useMatch) {
        patternUsed = `패턴${i+1}`;
        console.log(`✅ 대출 정보 매칭 성공 - ${patternUsed}: [${useMatch[1]}/${useMatch[2]}]`);
        break;
      }
    }
    
    if (useMatch) {
      const currentBorrowed = parseInt(useMatch[1]);
      const totalCopies = parseInt(useMatch[2]);
      const availableCopies = Math.max(0, totalCopies - currentBorrowed);
      const isAvailable = availableCopies > 0;
      
      console.log(`\n📊 최종 대출 현황:`);
      console.log(`   - 총 재고: ${totalCopies}권`);
      console.log(`   - 현재 대출: ${currentBorrowed}권`);
      console.log(`   - 대출 가능: ${availableCopies}권`);
      console.log(`   - 이용 가능: ${isAvailable ? 'YES' : 'NO'}`);
      
      console.log(`\n🎯 검증 결과:`);
      console.log(`   기대값: totalCopies=3, availableCopies=0`);
      console.log(`   실제값: totalCopies=${totalCopies}, availableCopies=${availableCopies}`);
      
      if (totalCopies === 3 && availableCopies === 0) {
        console.log(`   ✅ 검증 성공! 올바른 대출 현황 파싱`);
      } else {
        console.log(`   ❌ 검증 실패! 값이 일치하지 않음`);
      }
    } else {
      console.log('❌ 모든 대출 정보 패턴 매칭 실패');
    }
    
  } catch (error) {
    console.error('테스트 오류:', error.message);
  }
}

testParsing();