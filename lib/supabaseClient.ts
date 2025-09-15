import { createClient } from '@supabase/supabase-js'
import { Database } from '../types';

// Supabase 프로젝트 URL (환경변수에서 가져오기)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

// Supabase 프로젝트의 'anon' publishable 키 (환경변수에서 가져오기)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 환경변수 검증
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL 환경변수가 설정되지 않았습니다.')
}

if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.')
}

// Supabase 클라이언트 생성 (Database 타입 적용)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)