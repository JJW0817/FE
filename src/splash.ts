/** 로그인 확인(토큰 재발급)이 끝났다는 신호 — App이 알리고, 시작 화면(Splash)이 이 신호를 기다린다 */
let done: () => void = () => {};
export const authReady = new Promise<void>(r => { done = r; });
export const markAuthReady = () => done();
