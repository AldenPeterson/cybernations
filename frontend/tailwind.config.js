/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom color palette based on existing styles
        primary: {
          DEFAULT: '#007bff',
          hover: '#535bf2',
          light: '#747bff',
        },
        secondary: {
          DEFAULT: '#3b82f6',
          dark: '#059669',
        },
        success: {
          DEFAULT: '#10b981',
          dark: '#059669',
        },
        error: {
          DEFAULT: '#dc2626',
          light: '#fecaca',
        },
        // Coalition colors for NSComparisonsPage
        coalition: {
          blue: '#0d6efd',
          red: '#dc3545',
        },
      },
      boxShadow: {
        'custom': '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      spacing: {
        '15': '3.75rem',
      },
      zIndex: {
        '1000': '1000',
      },
    },
  },
  plugins: [],
}

