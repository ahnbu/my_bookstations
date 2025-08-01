import { createClient } from '@supabase/supabase-js'
import { Database } from '../types';

// Supabase 프로젝트 URL
const supabaseUrl = 'https://ugzruzaywohbynjzjesm.supabase.co'

// Supabase 프로젝트의 'anon' publishable 키
const supabaseAnonKey = 'sb_publishable_1TqlqLDyou1Hh3SqNWVmEA_jWOyksss'

// Supabase 클라이언트 생성 (Database 타입 적용)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)