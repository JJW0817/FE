import './styles.css'; // 먼저: CSS 레이어 순서 선언
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { initAnalytics, usePageView } from './analytics';
import { Splash } from './components/Splash';
import { Theme } from '@astryxdesign/core/theme';
import { themes, defaultThemeSlug } from './astryx-themes';
initAnalytics();
function Tracked() { usePageView(); return <App/>; }
createRoot(document.getElementById('root')!).render(<Theme theme={themes[defaultThemeSlug]} mode="light"><HashRouter><Tracked/></HashRouter><Splash/></Theme>);
