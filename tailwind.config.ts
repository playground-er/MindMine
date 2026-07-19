import type { Config } from 'tailwindcss'

/**
 * Tokens live in src/styles/tokens.css as CSS custom properties.
 * This config only maps them into Tailwind's utility namespace, so that
 * dark mode (which swaps the variables) works without duplicate classes.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--surface)',
          inset: 'var(--surface-inset)',
          raised: 'var(--surface-raised)',
          hover: 'var(--surface-hover)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          secondary: 'var(--ink-secondary)',
          tertiary: 'var(--ink-tertiary)',
          muted: 'var(--ink-muted)',
        },
        dot: 'var(--dot)',
        focus: 'var(--focus)',
        accent: {
          'note-tint': 'var(--accent-note-tint)',
          'note-line': 'var(--accent-note-line)',
          'note-ink': 'var(--accent-note-ink)',
          'todo-tint': 'var(--accent-todo-tint)',
          'todo-line': 'var(--accent-todo-line)',
          'todo-ink': 'var(--accent-todo-ink)',
          'image-tint': 'var(--accent-image-tint)',
          'image-line': 'var(--accent-image-line)',
          'image-ink': 'var(--accent-image-ink)',
          'link-tint': 'var(--accent-link-tint)',
          'link-line': 'var(--accent-link-line)',
          'link-ink': 'var(--accent-link-ink)',
          'board-tint': 'var(--accent-board-tint)',
          'board-line': 'var(--accent-board-line)',
          'board-ink': 'var(--accent-board-ink)',
        },
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        // [size, { lineHeight, letterSpacing, fontWeight }]
        '2xs': ['11px', { lineHeight: '16px', fontWeight: '500' }],
        xs: ['12px', { lineHeight: '18px' }],
        sm: ['13px', { lineHeight: '21px' }],
        base: ['14px', { lineHeight: '22px', letterSpacing: '-0.011em' }],
        label: ['13px', { lineHeight: '18px', fontWeight: '600' }],
        'title-card': ['15px', { lineHeight: '21px', letterSpacing: '-0.011em', fontWeight: '600' }],
        'title-section': ['17px', { lineHeight: '24px', letterSpacing: '-0.011em', fontWeight: '600' }],
        'title-board': ['28px', { lineHeight: '34px', letterSpacing: '-0.015em', fontWeight: '400' }],
        'title-empty': ['34px', { lineHeight: '42px', letterSpacing: '-0.015em', fontWeight: '400' }],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        inset: 'var(--radius-inset)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        hover: 'var(--shadow-hover)',
        drag: 'var(--shadow-drag)',
        float: 'var(--shadow-float)',
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--ease)',
        out: 'var(--ease-out)',
      },
    },
  },
  plugins: [],
} satisfies Config
