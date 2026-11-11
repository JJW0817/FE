export { api, createApiClient, ApiError, MOCK_CODE, NETWORK_CODE } from './client';
export type { ApiClient, ClientConfig, RequestOptions, Violation, AuthTokens } from './client';
export { errorMessage, fieldErrors, isApiError, isUnauthorized, isOffline } from './errors';
export { useApi, useAction } from './hooks';
export * from './mappers';
export * from './products';
export * from './orders';
export * from './addresses';
export * from './inquiries';
export * from './account';
export * from './notifications';
export * from './seller';
export { useLive } from './live';
export type { LiveState } from './live';
export { SERVICE_BASE } from './services';
export type * from './types';

import { api } from './client';
export const getAccessToken = () => api.getAccessToken();
export const setAccessToken = (token: string | null) => api.setAccessToken(token);

/*
 * 아래는 명세 확정 전에 화면에 흩어져 있는 추정 호출용 호환 함수(경로에 `/v1`이 없다). 새 코드는 `api.get('/v1/...')`를 쓴다.
 * 명세와 다른 호출 목록은 docs/api-gap.md 4절. 화면별 연동 때 `api`로 옮기며 지운다.
 */
/** @deprecated */ export const apiGet = (path: string) => api.get<unknown>(`/v1${path}`);
/** @deprecated */ export const apiPost = (path: string, body?: unknown) => api.post<unknown>(`/v1${path}`, body);
/** @deprecated */ export const apiPut = (path: string, body?: unknown) => api.put<unknown>(`/v1${path}`, body);
/** @deprecated */ export const apiPatch = (path: string, body?: unknown) => api.patch<unknown>(`/v1${path}`, body);
/** @deprecated */ export const apiDelete = (path: string) => api.delete<unknown>(`/v1${path}`);
/** @deprecated */ export const apiPostForm = (path: string, form: FormData) => api.upload<unknown>('POST', `/v1${path}`, form);
