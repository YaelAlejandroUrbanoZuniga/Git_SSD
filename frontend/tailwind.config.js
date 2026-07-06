/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        nexteer: {
          red: '#DC0202',
          'header-red': '#AA0202',
          sidebar: '#808285',
          page: '#EEEEEE',
          border: '#E0E0E0',
          'border-soft': '#D1D3D4',
          link: '#0084C0',
          'text-secondary': '#808285',
          'sidebar-line': '#6B7280',
        },
        status: {
          active: '#6ABF4B',
          pending: '#D4A017',
          warning: '#E3650B',
          error: '#DC0202',
          info: '#02B3E1',
          archived: '#6B7280',
        },
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.08)',
        selectable: '0 2px 6px rgba(0,0,0,0.10)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.13)',
        'btn-hover': '0 6px 16px rgba(0,0,0,0.18)',
        dropdown: '0 8px 24px rgba(0,0,0,0.20)',
      },
      borderRadius: {
        card: '8px',
        btn: '8px',
        input: '6px',
        badge: '4px',
        modal: '12px',
        dropdown: '8px',
      },
    },
  },
  plugins: [],
};
