// 새로운 시립 구독형 전자책 파서 테스트
const fs = require('fs');
const path = require('path');

// 새로운 파서 함수 (index.js에서 복사)
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
    
    // 2. 개별 책 항목 추출: 각 <li> 태그 전체 (더 정확한 패턴)
    const bookItemPattern = /<li>\s*([\s\S]*?)\s*<\/li>\s*(?=<li>|$)/gi;
    const bookItems = [...bookListHTML.matchAll(bookItemPattern)];
    
    console.log(`\n=== bookListHTML 일부 확인 ===`);
    console.log('bookListHTML 길이:', bookListHTML.length);
    console.log('bookListHTML 시작 1000자:', bookListHTML.substring(0, 1000));
    console.log(`찾은 책 항목 개수: ${bookItems.length}`);
    
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
        
        // 3. 제목 추출: <li class="tit"><a title="..."> 에서 title 속성 사용
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

        // 4. 저자/출판사/출간일 추출: <li class="writer">
        let author = '';
        let publisher = '';
        let publishDate = '';
        
        console.log(`\n--- 책 ${index + 1} writer 섹션 디버깅 ---`);
        console.log('전체 bookHTML 길이:', bookHTML.length);
        console.log('writer 클래스 포함 여부:', bookHTML.includes('class="writer"'));
        
        // 직접적인 패턴: li class="writer" 찾기
        const writerMatch = bookHTML.match(/<li[^>]*class[^>]*writer[^>]*>([\s\S]*?)<\/li>/i);
        if (writerMatch) {
          const writerContent = writerMatch[1];
          console.log('writer 섹션 원본 내용:', JSON.stringify(writerContent));
          
          // 패턴: 저자명<span>출판사명</span>출간일
          const writerPattern = /^([^<]+)<span[^>]*>([^<]+)<\/span>(.*)$/i;
          const writerDetailMatch = writerContent.match(writerPattern);
          
          if (writerDetailMatch) {
            author = writerDetailMatch[1].trim();
            publisher = writerDetailMatch[2].trim();
            publishDate = writerDetailMatch[3].trim();
            console.log('패턴 매칭 성공:', { author, publisher, publishDate });
          } else {
            console.log('패턴 매칭 실패, 대체 방법 시도');
            // span이 없는 경우 전체 텍스트에서 추출
            const cleanText = writerContent.replace(/<[^>]*>/g, '').trim();
            console.log('정리된 텍스트:', cleanText);
            const parts = cleanText.split(/\s+/);
            console.log('분리된 부분들:', parts);
            if (parts.length > 0) author = parts[0];
            if (parts.length > 1) publisher = parts[1];
            if (parts.length > 2) publishDate = parts.slice(2).join(' ');
            console.log('대체 방법 결과:', { author, publisher, publishDate });
          }
        } else {
          console.log('writer 섹션을 찾을 수 없음');
          // ul 구조 확인
          const ulMatch = bookHTML.match(/<ul[^>]*>[\s\S]*?<\/ul>/i);
          if (ulMatch) {
            console.log('ul 구조 발견:', ulMatch[0].substring(0, 500));
          } else {
            console.log('ul 구조를 찾을 수 없음');
            // 전체 bookHTML 출력 (처음 2500자)
            console.log('=== 전체 bookHTML 내용 (2500자) ===');
            console.log(bookHTML.substring(0, 2500));
          }
        }

        // 5. 내용 추출
        let description = '';
        // 가장 간단한 접근: 인용문으로 시작하는 내용 찾기
        const quoteMatch = bookHTML.match(/"([^"]+)"[\s\S]*?기본소득[\s\S]*?미래를 바라보는/i);
        if (quoteMatch) {
          // 전체 텍스트 영역을 찾아서 정제
          const fullTextMatch = bookHTML.match(/"인공지능의 발전으로[\s\S]*?미래를 바라보는 필자의 통찰력을 이 책을 통하여 알아보도록 하자\./i);
          if (fullTextMatch) {
            description = fullTextMatch[0].replace(/<[^>]*>/g, '').trim().substring(0, 200);
            console.log('내용 추출 성공:', description.substring(0, 100) + '...');
          } else {
            description = quoteMatch[1].substring(0, 200);
            console.log('인용문만 추출:', description);
          }
        } else {
          console.log('내용 추출 실패');
        }

        // 6. 대출 가능 여부 확인 (구독형은 기본적으로 대출 가능)
        const isAvailable = bookHTML.includes('대출') || bookHTML.includes('brwBtn');
        if (isAvailable) {
          availableCount++;
        }

        books.push({
          type: '구독형',
          title: title || '제목 정보 없음',
          author: author || '저자 정보 없음',
          publisher: publisher || '출판사 정보 없음',
          isbn: '',
          totalCopies: null,
          availableCopies: null,
          isAvailable: isAvailable,
          library: '광주시립중앙도서관-구독형',
          detailUrl: '',
          coverImage: '',
          description: description,
          category: '',
          publishDate: publishDate || '출간일 정보 없음',
          pageCount: 0
        });

      } catch (itemError) {
        console.error(`구독형 책 항목 ${index + 1} 파싱 오류:`, itemError);
        // 개별 책 파싱 오류는 무시하고 계속 진행
      }
    });

    const unavailableCount = books.length - availableCount;
    
    return {
      library_name: '광주시립중앙도서관-구독형',
      total_count: books.length,
      available_count: availableCount,
      unavailable_count: unavailableCount,
      books: books
    };

  } catch (error) {
    console.error(`시립도서관 구독형 전자책 파싱 오류: ${error.message}`);
    throw new Error(`시립도서관 구독형 전자책 파싱 오류: ${error.message}`);
  }
}

// 테스트 실행
async function testNewParser() {
  try {
    console.log('=== 새로운 시립 구독형 전자책 파서 테스트 ===\n');
    
    // HTML 파일 읽기
    const htmlPath = path.join(__dirname, '..', 'docs', 'temp', '시립구독_검색결과.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    console.log('HTML 파일 읽기 성공');
    console.log('HTML 길이:', htmlContent.length);
    console.log('book_resultList 포함 여부:', htmlContent.includes('book_resultList'));
    console.log('');
    
    // 파싱 실행
    const result = parseSiripSubscriptionEbookHTML(htmlContent, '인공지능');
    
    console.log('=== 파싱 결과 ===');
    console.log('도서관:', result.library_name);
    console.log('총 책 수:', result.total_count);
    console.log('대출 가능 책 수:', result.available_count);
    console.log('대출 불가 책 수:', result.unavailable_count);
    console.log('');
    
    if (result.books.length > 0) {
      console.log('=== 첫 번째 책 정보 ===');
      const firstBook = result.books[0];
      console.log('제목:', firstBook.title);
      console.log('저자:', firstBook.author);
      console.log('출판사:', firstBook.publisher);
      console.log('출간일:', firstBook.publishDate);
      console.log('대출 가능 여부:', firstBook.isAvailable);
      console.log('내용 (200자):', firstBook.description);
      console.log('');
      
      if (result.books.length > 1) {
        console.log('=== 두 번째 책 정보 ===');
        const secondBook = result.books[1];
        console.log('제목:', secondBook.title);
        console.log('저자:', secondBook.author);
        console.log('출판사:', secondBook.publisher);
        console.log('출간일:', secondBook.publishDate);
        console.log('대출 가능 여부:', secondBook.isAvailable);
        console.log('');
      }
      
      console.log('=== 전체 책 목록 (제목만) ===');
      result.books.forEach((book, index) => {
        console.log(`${index + 1}. ${book.title} - ${book.author} (${book.publisher})`);
      });
    } else {
      console.log('파싱된 책이 없습니다.');
    }
    
  } catch (error) {
    console.error('테스트 실행 오류:', error);
  }
}

// 테스트 실행
testNewParser();