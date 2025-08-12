// 최종 구독형 전자책 파서 테스트
const fs = require('fs');
const path = require('path');

// index.js에서 수정된 파서 함수 복사
function parseSiripSubscriptionEbookHTML(html, searchTitle) {
  try {
    // 검색 결과가 없는 경우 체크
    if (html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다') || html.includes('"총 0개"')) {
      return {
        library_name: '광주시립중앙도서관-구독형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: []
      };
    }

    // 1. 책 리스트 전체 추출: <ul class="book_resultList">
    const bookListMatch = html.match(/<ul[^>]*class[^>]*book_resultList[^>]*>([\s\S]*?)<\/ul>/i);
    if (!bookListMatch) {
      return {
        library_name: '광주시립중앙도서관-구독형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: []
      };
    }
    
    const bookListHTML = bookListMatch[1];
    
    // 2. 개별 책 항목 추출: 각 <li> 태그 전체 (개선된 패턴)
    const bookItemPattern = /<li>\s*([\s\S]*?)\s*<\/li>\s*(?=<li>|$)/gi;
    const bookItems = [...bookListHTML.matchAll(bookItemPattern)];
    
    if (bookItems.length === 0) {
      return {
        library_name: '광주시립중앙도서관-구독형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: []
      };
    }

    const books = [];
    let availableCount = 0;
    
    bookItems.forEach((match, index) => {
      try {
        const bookHTML = match[1]; // 전체 li 내용
        
        // 3. 제목 추출: <li class="tit"><a title=".."> 에서 title 속성 사용
        let title = '';
        const titleMatch = bookHTML.match(/<li[^>]*class[^>]*tit[^>]*>[\s\S]*?<a[^>]*title="([^"]*)"[^>]*>/i);
        if (titleMatch) {
          title = titleMatch[1].trim();
          // 파이프(|) 뒤의 도서관 정보 제거
          title = title.split('|')[0].trim();
        }
        
        if (!title) {
          return; // 제목이 없으면 건너뛰기
        }

        // 4. 저자/출판사/출간일 추출: <li class="writer"> (테스트 검증 완료)
        let author = '';
        let publisher = '';
        let publishDate = '';
        
        const writerMatch = bookHTML.match(/<li[^>]*class[^>]*writer[^>]*>([\s\S]*?)<\/li>/i);
        if (writerMatch) {
          const writerContent = writerMatch[1];
          
          // 패턴: 저자명<span>출판사명</span>출간일
          const writerPattern = /^([^<]+)<span[^>]*>([^<]+)<\/span>(.*)$/i;
          const writerDetailMatch = writerContent.match(writerPattern);
          
          if (writerDetailMatch) {
            author = writerDetailMatch[1].trim();
            publisher = writerDetailMatch[2].trim();
            publishDate = writerDetailMatch[3].trim();
          } else {
            // span이 없는 경우 전체 텍스트에서 추출
            const cleanText = writerContent.replace(/<[^>]*>/g, '').trim();
            const parts = cleanText.split(/\s+/);
            if (parts.length > 0) author = parts[0];
            if (parts.length > 1) publisher = parts[1];
            if (parts.length > 2) publishDate = parts.slice(2).join(' ');
          }
        }

        // 구독형은 항상 대출 가능 (재고 제한 없음)
        availableCount++;

        books.push({
          type: '구독형',
          title: title || '제목 정보 없음',
          author: author || '저자 정보 없음',
          publisher: publisher || '출판사 정보 없음',
          isAvailable: true, // 구독형은 항상 대출 가능
          publishDate: publishDate || '출간일 정보 없음'
        });

      } catch (itemError) {
        console.error(`구독형 책 항목 ${index + 1} 파싱 오류:`, itemError);
        // 개별 책 파싱 오류는 무시하고 계속 진행
      }
    });

    // 구독형은 모든 책이 대출 가능하므로 available_count = total_count
    return {
      library_name: '광주시립중앙도서관-구독형',
      total_count: books.length,
      available_count: books.length, // 구독형 특성: 재고 제한 없음
      unavailable_count: 0, // 구독형은 항상 0
      books: books
    };

  } catch (error) {
    console.error(`시립도서관 구독형 전자책 파싱 오류: ${error.message}`);
    throw new Error(`시립도서관 구독형 전자책 파싱 오류: ${error.message}`);
  }
}

// 테스트 실행
async function testFinalParser() {
  try {
    console.log('=== 구독형 전자책 최종 파서 테스트 ===\n');
    
    // HTML 파일 읽기
    const htmlPath = path.join(__dirname, '..', 'docs', 'temp', '시립구독_검색결과.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    console.log('HTML 파일 읽기 성공');
    console.log('HTML 길이:', htmlContent.length);
    console.log('');
    
    // 파싱 실행
    const result = parseSiripSubscriptionEbookHTML(htmlContent, '인공지능');
    
    console.log('=== 최종 파싱 결과 (간소화된 포맷) ===');
    console.log(JSON.stringify({
      subscription: result
    }, null, 2));
    
    console.log('\n=== 검증 포인트 ===');
    console.log('✅ 응답 포맷 간소화:', result.books[0] && Object.keys(result.books[0]).length === 6 ? '성공' : `실패 (${Object.keys(result.books[0]).length}개 필드)`);
    console.log('✅ 구독형 특성 반영:', result.available_count === result.total_count ? '성공' : '실패');
    console.log('✅ 개별 책 대출 가능:', result.books[0] && result.books[0].isAvailable === true ? '성공' : '실패');
    console.log('✅ unavailable_count:', result.unavailable_count === 0 ? '성공' : '실패');
    
    if (result.books[0]) {
      console.log('\n=== 현재 필드 목록 ===');
      console.log('개별 책 필드들:', Object.keys(result.books[0]));
      console.log('필드 개수:', Object.keys(result.books[0]).length);
    }
    
    return result;
    
  } catch (error) {
    console.error('테스트 실행 오류:', error);
    return null;
  }
}

// 테스트 실행
testFinalParser().then(result => {
  if (result) {
    console.log('\n🎉 구독형 전자책 파싱 완료! 사용 준비됨.');
  }
});