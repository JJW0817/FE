import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
// Hook 규칙만 검사한다(조건부 Hook 호출로 화면이 멈추는 문제 방지). exhaustive-deps는 의도적 생략이 많아 켜지 않는다.
export default [
  { ignores: ['dist', 'node_modules', 'tests', 'test-results', 'screenshots'] },
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser }, plugins: { 'react-hooks': hooks }, rules: { 'react-hooks/rules-of-hooks': 'error' } },
];
