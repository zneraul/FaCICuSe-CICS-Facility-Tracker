import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './public/assets/css/tokens.css';
import './public/assets/css/layout.css';
import './public/assets/css/components.css';
import './public/assets/css/landing-html.css';
import './public/assets/css/auth-modal.css';
import './styles/calendar.css';
import './styles/analytics.css';
// VARSITY theme layer — must load last so it overrides every base token above.
import './public/assets/css/theme-varsity.css';

createRoot(document.getElementById('root')).render(<App />);
