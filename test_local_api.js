// 로컬 API 테스트
import fetch from 'node-fetch';

async function testLocalAPI() {
  const data = {
    isbn: "9791192768236",
    title: "내 손으로",
    gyeonggiTitle: "내 손으로"
  };
  
  try {
    console.log('요청 데이터:', JSON.stringify(data, null, 2));
    
    const response = await fetch('http://127.0.0.1:8787', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(data)
    });
    
    console.log('응답 상태:', response.status);
    const result = await response.json();
    console.log('응답 데이터:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('에러:', error);
  }
}

testLocalAPI();