/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_USE_MOCK?: string; readonly VITE_MOCK_AUTH?: string; readonly VITE_DEMO_LOGIN?: string; readonly VITE_API_TARGET?: string; readonly VITE_PG_TARGET?: string; readonly VITE_GA_ID?: string; readonly VITE_QUICK_SCHEDULE?: string }
/** Vite define(vite.config.ts): Vercel 빌드 환경. 로컬은 빈 문자열 */
declare const __VERCEL_ENV__: string;
