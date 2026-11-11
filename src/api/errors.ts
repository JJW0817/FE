import { ApiError, MOCK_CODE, NETWORK_CODE } from './client';
import type { Violation } from './client';

/** 화면에 보여 줄 에러 문구. 서버가 준 한국어 `message`를 우선한다 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === NETWORK_CODE || error.code === MOCK_CODE) return error.message;
    // 코드 없는 5xx(게이트웨이 오류 등)와 공통 서버 오류는 같은 안내로
    if (error.status >= 500 && (error.code === 'COMMON_INTERNAL_SERVER_ERROR' || error.code.startsWith('HTTP_'))) return '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
    return error.message;
  }
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요.';
}
/** 입력 검증 오류(400)를 `{ 필드: 메시지 }`로 */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? Object.fromEntries(error.violations.map((v: Violation) => [v.field, v.message])) : {};
}
export const isApiError = (error: unknown, code?: string): error is ApiError => error instanceof ApiError && (!code || error.code === code);
/** 로그인이 필요하거나 세션이 끝난 경우 */
export const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401;
/** 서버 연결 없이 mock 모드로 동작 중이거나 네트워크가 끊긴 경우 — 화면은 목업 상태를 그대로 쓰면 된다 */
export const isOffline = (error: unknown) => error instanceof ApiError && (error.code === MOCK_CODE || error.code === NETWORK_CODE);
