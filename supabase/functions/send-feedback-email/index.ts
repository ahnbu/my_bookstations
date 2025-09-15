// supabase/functions/send-feedback-email/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from 'npm:resend'

// 환경변수에서 Resend API 키를 가져옵니다.
const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

// CORS 설정을 위한 헤더 (클라이언트에서 호출하려면 필수!)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 실제 프로덕션에서는 특정 도메인으로 제한하는 것이 좋습니다.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 클라이언트에서 보낸 JSON 데이터를 파싱합니다.
    const { feedback, userEmail, userName } = await req.json()

    // Resend를 이용해 이메일을 보냅니다.
    const { data, error } = await resend.emails.send({
      from: 'Feedback <onboarding@resend.dev>', // Resend에서 기본 제공하는 주소
      to: Deno.env.get('ADMIN_EMAIL')!, // 환경변수에서 관리자 이메일 주소를 가져옵니다.
      subject: `[피드백 도착] ${userName || userEmail} 님으로부터`,
      html: `
        <h3>새로운 피드백이 도착했습니다.</h3>
        <p><strong>작성자:</strong> ${userName || 'N/A'} (${userEmail})</p>
        <p><strong>시간:</strong> ${new Date().toLocaleString('ko-KR')}</p>
        <hr>
        <p><strong>내용:</strong></p>
        <p>${feedback}</p>
      `,
    })

    if (error) {
      throw error
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})