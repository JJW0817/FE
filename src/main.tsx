import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { initAnalytics, usePageView } from './analytics';
import './styles.css';
initAnalytics();
function Tracked() { usePageView(); return <App/>; }
createRoot(document.getElementById('root')!).render(<HashRouter><Tracked/></HashRouter>);
