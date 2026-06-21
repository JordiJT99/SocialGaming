---
name: Apex Sports
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#3e4944'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#6e7a73'
  outline-variant: '#bec9c2'
  surface-tint: '#006c4f'
  primary: '#005840'
  on-primary: '#ffffff'
  primary-container: '#007355'
  on-primary-container: '#9af5cf'
  inverse-primary: '#7dd8b4'
  secondary: '#5d5e61'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e5'
  on-secondary-container: '#636467'
  tertiary: '#6d5e00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c4ab00'
  on-tertiary-container: '#4a3f00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#99f5cf'
  primary-fixed-dim: '#7dd8b4'
  on-primary-fixed: '#002116'
  on-primary-fixed-variant: '#00513b'
  secondary-fixed: '#e2e2e5'
  secondary-fixed-dim: '#c6c6c9'
  on-secondary-fixed: '#1a1c1e'
  on-secondary-fixed-variant: '#454749'
  tertiary-fixed: '#ffe249'
  tertiary-fixed-dim: '#e3c600'
  on-tertiary-fixed: '#211b00'
  on-tertiary-fixed-variant: '#524600'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  odds-display:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '700'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 1rem
  margin-mobile: 1rem
  margin-desktop: 2rem
  stack-xs: 0.25rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 1.5rem
---

## Brand & Style
The brand personality is professional, authoritative, and high-performance. It targets a demographic that values precision, speed, and reliability—bridging the gap between a traditional institutional sportsbook and a modern, high-growth fintech startup.

The design style is **Corporate / Modern** with a lean towards **Precision Engineering**. It utilizes a structured, grid-based approach to organize high densities of data (odds, stats, player metrics) without overwhelming the user. The aesthetic avoids the typical "casino" neon tropes, opting instead for a "trading platform" feel that evokes trust and serious competition. 
- **White Space:** Generous around major layout blocks to prevent cognitive fatigue.
- **Visual Weight:** Heavy emphasis on legibility and rapid recognition of numerical data.
- **Emotional Response:** Calculated, confident, and premium.

## Colors
The palette is rooted in the heritage of sports betting but elevated through modern saturation and contrast levels.

- **Primary (#007355):** A deep forest green used for brand headers, primary navigation, and "Success" states. It represents the "field of play."
- **Secondary (#1A1C1E):** A dark charcoal used for heavy text, sidebars, and footer elements to provide a grounded, professional anchor.
- **Highlight (#FFDF1B):** A vibrant gold reserved exclusively for high-priority Call-to-Actions (CTAs), live betting indicators, and "Win" states.
- **Backgrounds:** The interface primarily uses a crisp white (#FFFFFF) for the main content area to maximize readability, with a light neutral (#F4F5F6) used for sectioning and "off-canvas" backgrounds.

## Typography
The system uses **Inter** for its exceptional legibility in data-heavy environments and its neutral, modern tone.

- **Data Hierarchy:** Odds and prices use the `odds-display` role, emphasizing weight over size to ensure they remain the focal point of every card.
- **Caps Usage:** `label-sm` uses uppercase styling for secondary metadata (e.g., "MATCH START TIME") to create clear visual separation from primary labels.
- **Numeric Clarity:** Ensure "tabular lining" is enabled in CSS to keep price columns perfectly aligned in data tables.

## Layout & Spacing
This design system utilizes a **Fluid Grid** with a fixed maximum width for desktop to ensure data density remains manageable.

- **Desktop (1280px+):** A 12-column grid. Sidebars for navigation and "Bet Slips" are fixed (typically 240px - 320px), while the central feed remains fluid.
- **Tablet (768px - 1024px):** An 8-column grid. The Bet Slip often transitions to a toggleable overlay or a bottom sheet.
- **Mobile (<768px):** A 4-column grid. Margins are reduced to 16px to maximize the horizontal space for multi-column odds tables.
- **Spacing Logic:** A strict 4px base unit is used. All vertical rhythm follows the `stack` tokens to ensure consistency between unrelated component groups.

## Elevation & Depth
The system uses **Low-contrast outlines** combined with **Ambient shadows** to create a structured, professional hierarchy.

- **Base Level:** White surfaces on a `#F4F5F6` background.
- **Cards:** Defined by a 1px solid border in `#E2E4E6`. On hover, cards transition to a subtle ambient shadow (0px 4px 12px rgba(0,0,0,0.05)) to indicate interactivity.
- **Modals & Bet Slips:** These use a higher elevation with a more pronounced shadow to float above the main interface, signifying a change in the user's task flow.
- **Depth via Tone:** Darker tones (Secondary Color) are used for "global" navigation areas (headers/sidebars) to push the content area forward.

## Shapes
The shape language is **Soft (0.25rem)**, prioritizing a crisp, "engineered" look over high-rounded playfulness.

- **Buttons & Inputs:** Use the base `0.25rem` (4px) radius.
- **Cards & Containers:** Use `rounded-lg` (8px) to provide enough visual distinction from the background without feeling overly bubbly.
- **Status Pills:** Use a full pill-shape (999px) to distinguish them from interactive buttons.

## Components
- **Buttons:**
  - *Primary:* Forest Green with White text. Bold and authoritative.
  - *Action:* Gold (#FFDF1B) with Charcoal text. Used for "Place Bet" or "Deposit."
  - *Ghost:* 1px charcoal border with transparent background for secondary actions.
- **Odds Buttons:** A specific component type. Rectangular, light grey background, featuring the price in `odds-display` typography. They transition to a Primary Green background when "Selected."
- **Data Tables:** High-density rows with 1px bottom borders. Alternating row stripes (zebra striping) in `#F9FAFA` are used for multi-column sports like Horse Racing or player stats.
- **Cards:** Content is grouped into logical modules (e.g., "Live Games," "Upcoming") with a clear header row in light grey or muted green.
- **Input Fields:** Clean, white backgrounds with 1px borders. Focused states use a 2px Primary Green border. Error states use a standard red, but icons are preferred over heavy text warnings to maintain layout integrity.
- **Bet Slip:** A specialized persistent component. It uses high-contrast typography and clear "remove" icons for individual selections, with a "Total Stake" input highlighted in the Secondary charcoal color.