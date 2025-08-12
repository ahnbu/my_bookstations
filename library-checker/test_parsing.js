// 시립도서관 소장형 전자책 파싱 로직 테스트 스크립트
const fs = require('fs');
const path = require('path');

console.log('=== 시립도서관 소장형 전자책 파싱 로직 테스트 ===');
console.log('실제 HTML 파일: 시립소장_검색결과_외우지않고.html');
console.log('');

// 개선된 파싱 로직 테스트 (index.js와 동일한 로직)
function testParsingLogic(bookHTML, title = "테스트 책") {
  console.log(`🔍 대출 정보 파싱 시작: "${title}"`);
  
  // 개선된 다중 패턴 매칭 시스템
  const loanPatterns = [
    // 패턴 1: <span>[ 대출 : <strong>3/3</strong></span> (가장 정확한 패턴)
    /\[\s*대출\s*:\s*<strong>(\d+)\/(\d+)<\/strong>\s*\]/i,
    // 패턴 2: 대출 : <strong>3/3</strong> (strong 태그 있음)
    /대출\s*:\s*<strong>(\d+)\/(\d+)<\/strong>/i,
    // 패턴 3: [ 대출 : 3/3 ] (기본 텍스트 형태)
    /\[\s*대출\s*:\s*(\d+)\/(\d+)\s*\]/i,
    // 패턴 4: 대출 : 3/3 (심플 형태)
    /대출\s*:\s*(\d+)\/(\d+)/i,
    // 패턴 5: <p class="use"> 내부 전체 매칭
    /<p[^>]*class[^>]*use[^>]*>[\s\S]*?대출[^0-9]*(\d+)\/(\d+)[\s\S]*?<\/p>/i
  ];
  
  let useMatch = null;
  let patternUsed = '';
  let patternIndex = -1;
  
  // 패턴 순서대로 시도
  for (let i = 0; i < loanPatterns.length; i++) {
    useMatch = bookHTML.match(loanPatterns[i]);
    if (useMatch) {
      patternIndex = i + 1;
      patternUsed = `패턴${patternIndex}`;
      console.log(`✅ 대출 정보 매칭 성공 - ${patternUsed}: [${useMatch[1]}/${useMatch[2]}]`);
      break;
    }
  }
  
  if (useMatch) {
    const currentBorrowed = parseInt(useMatch[1]);
    const totalCopies = parseInt(useMatch[2]);
    const availableCopies = Math.max(0, totalCopies - currentBorrowed);
    const isAvailable = availableCopies > 0;
    
    // 예약 정보도 추출
    const reservationPatterns = [
      /예약\s*:\s*<strong>(\d+)<\/strong>/i,
      /예약\s*:\s*(\d+)/i
    ];
    
    let reservations = 0;
    for (const pattern of reservationPatterns) {
      const reservationMatch = bookHTML.match(pattern);
      if (reservationMatch) {
        reservations = parseInt(reservationMatch[1]);
        break;
      }
    }
    
    console.log(`📊 대출 현황 (${patternUsed}): "${title}"`);
    console.log(`   - 총 재고: ${totalCopies}권`);
    console.log(`   - 현재 대출: ${currentBorrowed}권`);
    console.log(`   - 대출 가능: ${availableCopies}권`);
    console.log(`   - 예약 대기: ${reservations}명`);
    console.log(`   - 이용 가능: ${isAvailable ? 'YES' : 'NO'}`);
    
    return {
      pattern: patternUsed,
      currentBorrowed: currentBorrowed,
      totalCopies: totalCopies,
      availableCopies: availableCopies,
      isAvailable: isAvailable,
      reservations: reservations
    };
  } else {
    console.log(`❌ 모든 패턴 매칭 실패: "${title}"`);
    console.log(`HTML에서 'class="use"' 포함 여부: ${bookHTML.includes('class="use"')}`);
    console.log(`HTML에서 '대출' 키워드 포함 여부: ${bookHTML.includes('대출')}`);
    
    // class="use" 부분이 있다면 해당 부분 출력
    if (bookHTML.includes('class="use"')) {
      const useIndex = bookHTML.indexOf('class="use"');
      console.log(`🔍 class="use" 주변 HTML:`, bookHTML.substring(useIndex - 100, useIndex + 200));
    }
    
    return null;
  }
}

// 완전한 파싱 로직 테스트 함수 (index.js와 동일한 구조)
function parseFullHTML(html, searchTitle) {
  try {
    console.log(`\n=== 시립도서관 소장형 전자책 완전 파싱 테스트: "${searchTitle}" ===`);
    
    // 검색 결과가 없는 경우 체크
    if (html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다') || html.includes('"총 0개"')) {
      console.log('❌ 검색 결과 없음');
      return { total_count: 0, available_count: 0, books: [] };
    }

    // 1. 책 리스트 전체 추출: <ul class="book_resultList">
    const bookListMatch = html.match(/<ul[^>]*class[^>]*book_resultList[^>]*>([\s\S]*?)<\/ul>/i);
    if (!bookListMatch) {
      console.log('❌ book_resultList를 찾을 수 없음');
      return { total_count: 0, available_count: 0, books: [] };
    }
    
    const bookListHTML = bookListMatch[1];
    console.log(`✅ book_resultList 추출 성공 (길이: ${bookListHTML.length}자)`);
    
    // 2. 개별 책 항목 추출: 실제 HTML 구조 분석 기반 패턴
    // 중첩된 <li> 구조를 고려하여 가장 바깥쪽 <li>만 추출
    console.log('HTML 구조 분석:');
    console.log(`<li> 개수: ${(bookListHTML.match(/<li>/gi) || []).length}`);
    console.log(`</li> 개수: ${(bookListHTML.match(/<\/li>/gi) || []).length}`);
    
    // 패턴 1: non-greedy 매칭으로 최소한의 내용만 캡처
    let bookItemPattern = /<li>[\s\S]*?<\/li>/gi;
    let bookItems = [...bookListHTML.matchAll(bookItemPattern)];
    console.log(`패턴 1 (non-greedy) 결과: ${bookItems.length}개`);
    
    // 패턴 1로 찾은 첫 번째 항목에 use 클래스가 있는지 확인
    if (bookItems.length > 0) {
      const hasUseClass = bookItems[0][0].includes('class="use"');
      console.log(`첫 번째 항목에 use 클래스 포함: ${hasUseClass}`);
      
      if (!hasUseClass) {
        console.log('⚠️ use 클래스 누락, greedy 패턴으로 재시도...');
        // 패턴 2: greedy 매칭으로 더 많은 내용 캡처
        bookItemPattern = /<li>[\s\S]*<\/li>/gi;
        const greedyItems = [...bookListHTML.matchAll(bookItemPattern)];
        console.log(`패턴 2 (greedy) 결과: ${greedyItems.length}개`);
        
        if (greedyItems.length > 0) {
          const greedyHasUseClass = greedyItems[0][0].includes('class="use"');
          console.log(`greedy 첫 번째 항목에 use 클래스 포함: ${greedyHasUseClass}`);
          if (greedyHasUseClass) {
            bookItems = greedyItems;
            console.log('✅ greedy 패턴 채택');
          }
        }
      }
    }
    
    // 최종 확인: bookListHTML 전체에 use 클래스가 있는지 확인
    if (bookItems.length === 0) {
      const hasUseInOriginal = bookListHTML.includes('class="use"');
      console.log(`원본 bookListHTML에 use 클래스 포함: ${hasUseInOriginal}`);
      
      if (hasUseInOriginal) {
        console.log('⚠️ 패턴 매칭 실패하지만 use 클래스 존재, 전체를 하나의 항목으로 처리');
        bookItems = [{ 0: bookListHTML, index: 0 }];
      }
    }
    
    console.log(`📚 책 항목 ${bookItems.length}개 발견`);
    
    if (bookItems.length === 0) {
      console.log('❌ 개별 책 항목을 찾을 수 없음');
      return { total_count: 0, available_count: 0, books: [] };
    }

    const books = [];
    let availableCount = 0;
    
    bookItems.forEach((match, index) => {
      try {
        const bookHTML = match[0]; // 전체 li 내용 (match[0]이 전체 매칭)
        
        // 디버깅: HTML 구조 확인
        console.log(`\n=== 책 ${index + 1} HTML 구조 분석 ===`);
        console.log(`전체 길이: ${bookHTML.length}자`);
        console.log(`class="use" 포함 여부: ${bookHTML.includes('class="use"')}`);
        
        // 제목 추출
        let title = '';
        const titleMatch = bookHTML.match(/<li[^>]*class[^>]*tit[^>]*>[\s\S]*?<a[^>]*title="([^"]*)"[^>]*>/i);
        if (titleMatch) {
          title = titleMatch[1].trim().split('|')[0].trim();
        }
        
        if (!title) {
          console.log(`⚠️ 제목 추출 실패 - 책 ${index + 1} 건너뛰기`);
          return;
        }

        console.log(`📚 책 제목: "${title}"`);

        // 저자/출판사/출간일 추출
        let author = '', publisher = '', publishDate = '';
        const writerMatch = bookHTML.match(/<li[^>]*class[^>]*writer[^>]*>([\s\S]*?)<\/li>/i);
        if (writerMatch) {
          const writerContent = writerMatch[1];
          const writerPattern = /^([^<]+)<span[^>]*>([^<]+)<\/span>(.*)$/i;
          const writerDetailMatch = writerContent.match(writerPattern);
          
          if (writerDetailMatch) {
            author = writerDetailMatch[1].trim();
            publisher = writerDetailMatch[2].trim();
            publishDate = writerDetailMatch[3].trim();
          }
        }

        // 대출 현황 파싱
        const loanResult = testParsingLogic(bookHTML, title);
        
        let totalCopies = 1, availableCopies = 1, isAvailable = true;
        if (loanResult) {
          totalCopies = loanResult.totalCopies;
          availableCopies = loanResult.availableCopies;
          isAvailable = loanResult.isAvailable;
        }

        if (isAvailable) {
          availableCount++;
        }

        books.push({
          type: '소장형',
          title: title,
          author: author || '저자 정보 없음',
          publisher: publisher || '출판사 정보 없음',
          totalCopies: totalCopies,
          availableCopies: availableCopies,
          isAvailable: isAvailable,
          publishDate: publishDate || '출간일 정보 없음'
        });

      } catch (itemError) {
        console.error(`책 항목 ${index + 1} 파싱 오류:`, itemError.message);
      }
    });

    const result = {
      library_name: '광주시립중앙도서관-소장형',
      total_count: books.length,
      available_count: availableCount,
      unavailable_count: books.length - availableCount,
      books: books
    };
    
    console.log(`\n📋 최종 파싱 결과:`);
    console.log(`   - 총 도서: ${books.length}권`);
    console.log(`   - 대출 가능: ${availableCount}권`);
    console.log(`   - 대출 불가: ${books.length - availableCount}권`);
    
    return result;

  } catch (error) {
    console.error(`파싱 오류: ${error.message}`);
    return { total_count: 0, available_count: 0, books: [] };
  }
}

// 메인 테스트 실행
console.log('\n=== 실제 HTML 파일로 완전 파싱 테스트 ===');
try {
  const htmlPath = 'D:/Vibe_Coding/my_bookstation/docs/temp/시립소장_검색결과_외우지않고.html';
  
  if (fs.existsSync(htmlPath)) {
    console.log(`✅ HTML 파일 발견: ${htmlPath}`);
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    console.log(`✅ HTML 파일 로드 성공 (크기: ${Math.round(htmlContent.length / 1024)}KB)`);
    
    const result = parseFullHTML(htmlContent, '외우지 않는 공부법');
    
    console.log(`\n🎯 기대값과 비교:`);
    console.log(`   - 기대값: totalCopies=3, availableCopies=0 (3/3 모두 대출 중)`);
    if (result.books.length > 0) {
      const firstBook = result.books[0];
      console.log(`   - 실제값: totalCopies=${firstBook.totalCopies}, availableCopies=${firstBook.availableCopies}`);
      
      if (firstBook.totalCopies === 3 && firstBook.availableCopies === 0) {
        console.log(`   ✅ 검증 성공! 올바른 대출 현황 파싱`);
      } else {
        console.log(`   ❌ 검증 실패! 대출 현황 파싱 오류`);
      }
    }
    
    console.log(`\n📄 전체 결과:`);
    console.log(JSON.stringify(result, null, 2));
    
  } else {
    console.log(`❌ HTML 파일을 찾을 수 없음: ${htmlPath}`);
  }
} catch (error) {
  console.error(`테스트 실행 오류: ${error.message}`);
}
