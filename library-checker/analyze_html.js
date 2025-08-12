const fs = require('fs');

const html = fs.readFileSync('D:/Vibe_Coding/my_bookstation/docs/temp/시립소장_검색결과_외우지않고.html', 'utf8');
const bookListMatch = html.match(/<ul[^>]*class[^>]*book_resultList[^>]*>([\s\S]*?)<\/ul>/i);

if (bookListMatch) {
  const bookListHTML = bookListMatch[1];
  console.log('=== book_resultList 내용 분석 ===');
  console.log('길이:', bookListHTML.length);
  console.log('첫 200자:');
  console.log(bookListHTML.substring(0, 200));
  console.log('\n<li> 태그 개수:', (bookListHTML.match(/<li>/gi) || []).length);
  console.log('</li> 태그 개수:', (bookListHTML.match(/<\/li>/gi) || []).length);
  
  console.log('\n첫 번째 <li> 위치부터 1000자:');
  const firstLi = bookListHTML.indexOf('<li>');
  if (firstLi !== -1) {
    console.log(bookListHTML.substring(firstLi, firstLi + 1000));
    
    // <li>부터 </li>까지 완전한 매칭 테스트
    const liPattern = /<li>[\s\S]*?<\/li>/gi;
    const matches = [...bookListHTML.matchAll(liPattern)];
    console.log('\n완전한 <li>...</li> 매칭 개수:', matches.length);
    
    if (matches.length > 0) {
      console.log('첫 번째 매칭 길이:', matches[0][0].length);
      console.log('첫 번째 매칭 끝부분 200자:');
      const firstMatch = matches[0][0];
      console.log(firstMatch.substring(firstMatch.length - 200));
    }
  }
} else {
  console.log('book_resultList를 찾을 수 없음');
}