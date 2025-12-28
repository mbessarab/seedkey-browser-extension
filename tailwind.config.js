/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './entrypoints/**/*.{html,ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background colors
        background: {
          DEFAULT: '#0C1327',
          card: '#151D32',
          elevated: '#1A2340',
        },
        // Text colors
        text: {
          DEFAULT: '#E5E7EB',
          muted: '#94A3B8',
          accent: '#60A5FA',
        },
        // Border colors
        border: {
          DEFAULT: '#2D3A5C',
          light: '#3D4F7A',
        },
        // Primary (cyan/teal accent matching logo)
        primary: {
          DEFAULT: '#22D3BB',
          hover: '#14B8A6',
          light: 'rgba(34, 211, 187, 0.15)',
        },
        secondary: {
          DEFAULT: '#3D4F7A',
          hover: '#4B5F8A',
        },
        danger: {
          DEFAULT: '#EF4444',
          hover: '#DC2626',
          bg: 'rgba(239, 68, 68, 0.15)',
        },
        success: {
          DEFAULT: '#22C55E',
          bg: 'rgba(34, 197, 94, 0.15)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.15)',
          text: '#FBBF24',
        },
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '8px',
        lg: '16px',
      },
      animation: {
        spin: 'spin 1s linear infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(34, 211, 187, 0.3)',
        'glow-sm': '0 0 10px rgba(34, 211, 187, 0.2)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};

