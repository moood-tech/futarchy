/**
 * Tailwind theme mapped onto the canonical moood design tokens.
 * Colours resolve to the CSS custom properties vendored in src/styles/tokens.css
 * (the real @moood/design-system token output) so the POC stays on-brand.
 *
 * Brand hard rules honoured here:
 *  - cyan `#33b1ff` (`cta`) is CTA / active accent ONLY — never body text.
 *  - purple `emphasis` is the moood-side / comparison highlight only.
 *  - Geist = headings, Inter = body, IBM Plex Mono = eyebrows/labels.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--color-page)", // #f4f4f4
        surface: "var(--color-surface)", // #ffffff
        cream: "var(--color-surface-cream)", // #e8e4df
        "surface-mid": "var(--color-surface-mid)", // #eeece9
        "divider-cream": "var(--color-border-divider-cream)",
        hairline: "var(--color-border-hairline)", // #e8e8e8

        ink: "var(--color-text-primary)", // #161616
        "ink-2": "var(--color-text-strong)", // #525252
        muted: "var(--color-text-muted)", // #6f6f6f
        quiet: "var(--color-text-quiet)", // #8d8d8d
        placeholder: "var(--color-text-placeholder)", // #c6c6c6

        cta: {
          DEFAULT: "var(--color-cta-default)", // #33b1ff — CTA ONLY
          hover: "var(--color-cta-hover)", // #1192e8
          active: "var(--color-cta-active)", // #0072c3
          soft: "var(--color-cta-soft)", // rgba(51,177,255,.12)
        },
        magenta: {
          DEFAULT: "var(--color-accent-magenta)", // #d02670
          soft: "var(--color-accent-magenta-soft)",
        },
        emphasis: {
          light: "var(--color-emphasis-bg-light)", // #f0eeff
          deep: "var(--color-emphasis-bg-deep)", // #e0d5ff
          text: "var(--color-emphasis-text)", // #3d1f99
          alt: "var(--color-emphasis-text-alt)", // #5a2dbf
        },
        success: {
          DEFAULT: "var(--color-status-success)", // #24a148
          bg: "var(--color-status-success-bg)", // #defbe6
        },
        danger: {
          DEFAULT: "var(--color-status-error)", // #da1e28
          bg: "var(--color-status-error-bg)", // #fff1f1
        },
        warning: {
          DEFAULT: "var(--color-status-warning)", // #f1c21b
          glyph: "var(--color-status-warning-glyph)", // #b28600
          bg: "var(--color-status-warning-bg)", // #fcf4d6
        },
        info: {
          DEFAULT: "var(--color-status-info)", // #007d79 teal
          bg: "var(--color-status-info-bg)", // #d9fbfb
        },
      },
      fontFamily: {
        heading: ["Geist", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        xs: "0.5rem", // input / icon
        sm: "0.625rem", // segment
        md: "0.75rem", // button touch
        lg: "0.875rem", // card
        xl: "1rem", // surface
        "2xl": "1.125rem", // sheet
        pill: "62.4375rem",
      },
      boxShadow: {
        sm: "0 2px 6px rgba(0,0,0,0.06)",
        lg: "0 8px 30px rgba(0,0,0,0.10)",
      },
      letterSpacing: {
        label: "0.08em",
        tight: "-0.01em",
      },
      maxWidth: {
        content: "1080px",
      },
    },
  },
  plugins: [],
};
