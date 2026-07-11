import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Sun, Moon, Palette } from 'lucide-react';

const ThemeToggle = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  const getIcon = () => {
    if (theme.id === 'calmed-light') {
      return <Sun size={20} />;
    }
    return <Moon size={20} />;
  };

  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        padding: '8px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
        fontSize: '14px',
        fontWeight: '500',
      }}
      onMouseEnter={(e) => {
        e.target.style.background = 'var(--bg-card-2)';
      }}
      onMouseLeave={(e) => {
        e.target.style.background = 'var(--bg-card)';
      }}
      title={`Current theme: ${theme.name}. Click to change.`}
    >
      <Palette size={18} />
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {getIcon()}
        <span>{theme.name}</span>
      </span>
    </button>
  );
};

export default ThemeToggle;
