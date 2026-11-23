import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SoundProvider } from './Sound';
import './style.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><SoundProvider><BrowserRouter basename={import.meta.env.BASE_URL}><App /></BrowserRouter></SoundProvider></React.StrictMode>);
