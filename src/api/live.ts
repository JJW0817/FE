import { useEffect, useRef } from 'react';
import { IMAGE_EXPIRED, USE_MOCK } from '../config';
import type { State } from '../domain';
import { mutate } from '../store';
import { useApi } from './hooks';


export interface LiveState { loading: boolean; error: string; reload: () => void; live: boolean }
const MOCK_STATE: LiveState = { loading: false, error: '', reload: () => {}, live: false };

/**
 * 서버 데이터를 화면이 읽는 store에 반영한다. 화면은 지금처럼 `useStore()`로 읽고, 이 훅이 주는 loading·error로 상태만 그린다.
 * - mock 모드: 아무것도 하지 않는다(store의 목업 데이터 그대로)
 * - 실제 API: `load` 결과를 `apply(state, data)`로 store에 넣는다. deps가 바뀌면 다시 부른다
 */
export function useLive<T>(load: (signal: AbortSignal) => Promise<T>, apply: (s: State, data: T) => void, deps: readonly unknown[] = []): LiveState {
  if (USE_MOCK) return MOCK_STATE; // 빌드 시 고정되는 값이라 훅 호출 순서는 바뀌지 않는다
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const state = useApi(load, deps);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const applyRef = useRef(apply); applyRef.current = apply;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { if (state.data !== undefined) mutate(s => applyRef.current(s, state.data as T)); }, [state.data]);
  // 사진 임시 주소가 만료돼 깨지면 이 화면의 데이터를 다시 받아 새 열람 주소로 바꾼다(여러 장이 한꺼번에 깨져도 15초에 한 번)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const last = useRef(0);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { const on = () => { if (Date.now() - last.current < 15_000) return; last.current = Date.now(); state.reload(); }; window.addEventListener(IMAGE_EXPIRED, on); return () => window.removeEventListener(IMAGE_EXPIRED, on); }, [state.reload]);
  return { loading: state.loading, error: state.error, reload: state.reload, live: true };
}
