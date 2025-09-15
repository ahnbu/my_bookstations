import { supabase } from '../lib/supabaseClient';

export interface FeedbackData {
  feedback: string;
  userEmail: string;
  userName?: string;
}

export interface FeedbackResponse {
  success: boolean;
  error?: string;
}

/**
 * 사용자 피드백을 관리자에게 이메일로 전송
 * @param data 피드백 데이터 (내용, 사용자 이메일, 사용자 이름)
 * @returns 전송 결과
 */
export const sendFeedback = async (data: FeedbackData): Promise<FeedbackResponse> => {
  try {
    // 입력 검증
    if (!data.feedback || data.feedback.trim().length === 0) {
      return { success: false, error: '피드백 내용을 입력해주세요.' };
    }

    if (data.feedback.length > 100) {
      return { success: false, error: '피드백은 100자 이내로 작성해주세요.' };
    }

    if (!data.userEmail) {
      return { success: false, error: '사용자 이메일이 필요합니다.' };
    }

    // Supabase Edge Function 호출
    const { data: result, error } = await supabase.functions.invoke('send-feedback-email', {
      body: {
        feedback: data.feedback.trim(),
        userEmail: data.userEmail,
        userName: data.userName || '익명 사용자',
      },
    });

    if (error) {
      console.error('피드백 전송 오류:', error);
      return {
        success: false,
        error: '피드백 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      };
    }

    return { success: true };
  } catch (error) {
    console.error('피드백 전송 예외:', error);
    return {
      success: false,
      error: '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.'
    };
  }
};