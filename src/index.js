import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Import your main App component

// You can add a basic CSS file if you want, e.g., src/index.css
// import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// (You don't strictly need reportWebVitals for basic deployment, but it's part of CRA boilerplate)
