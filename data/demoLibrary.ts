// data/demoLibrary.ts
//
// 로그인 전 첫 화면에 보여주는 예시 서재 스냅샷이다.
// 운영 DB에서 1회 추출한 정적 데이터이므로 재고는 snapshotDate 시점 값이다.
// 갱신 절차는 docs/DEVELOPMENT.md의 "데모 서재 스냅샷 갱신"을 따른다.

import { CustomTag, SelectedBook } from '../types';
import demoLibraryData from './demoLibrary.json';

export const DEMO_SNAPSHOT_DATE: string = demoLibraryData.snapshotDate;

// 데모 전용 태그 정의. 비로그인 기본 설정(default_personal 1개)에는 없으므로
// MyLibraryListItem의 tagsOverride prop으로만 주입한다.
export const DEMO_TAGS = demoLibraryData.tags as CustomTag[];

// 데모 도서의 id는 음수(-1 ~ -10)다. 실제 user_library.id(양수)와 충돌하지 않는다.
export const DEMO_BOOKS = demoLibraryData.books as unknown as SelectedBook[];
