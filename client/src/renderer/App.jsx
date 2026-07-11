import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Bubble    from './components/Bubble/Bubble';
import Dashboard from './components/Dashboard/Dashboard';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';

const App = () => (
  <ThemeProvider>
    <LanguageProvider>
      <HashRouter>
        <Routes>
          <Route path="/"          element={<Bubble    />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </HashRouter>
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
