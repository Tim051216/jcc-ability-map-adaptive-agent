# BiliLearn Frontend Design System

version: 0.1
inspired-by: awesome-design-md / Claude-design-analysis

## Intent

This product is not a dashboard-first admin tool.
It should feel like a warm, guided learning product with an embedded AI tutor.

Design goals:

- Reduce visible "box-in-box" UI
- Keep primary actions obvious
- Let users scan quickly, then go deeper
- Make AI feel embedded, not bolted on
- Keep learning pages warmer and more editorial than generic SaaS panels

## Visual Direction

- Canvas should stay light, warm, and soft rather than cold white
- Cards should feel like content surfaces, not hard bordered modules
- Use dark text with warm accents rather than blue-heavy enterprise styling
- Keep strong contrast only for key CTA and truly important states

## Color Tokens

- `canvas`: `#faf9f5`
- `surface-soft`: `#f5f0e8`
- `surface-card`: `#ffffff`
- `surface-muted`: `#f7fafb`
- `ink`: `#171c22`
- `body`: `#5a6970`
- `muted`: `#8a96a3`
- `hairline`: `#e8edf2`
- `primary`: `#fb7299`
- `primary-deep`: `#e85d8e`
- `secondary`: `#0f6c7b`
- `secondary-soft`: `#eef7ff`
- `success`: `#1f9d68`
- `warning`: `#d97706`
- `danger`: `#dc2626`

## Typography

- Large page titles should feel confident and concise
- Prefer compact product headings over oversized marketing hero text
- Use serif display only when a page is explicitly editorial
- Default product UI should stay sans-serif and clean

Recommended scale:

- Page title: `30-36px`, `800`
- Section title: `20-24px`, `800`
- Card title: `16-20px`, `800`
- Body: `14px`, relaxed line height
- Eyebrow: `10-12px`, uppercase, high tracking

## Layout Rules

- One page should have one obvious primary purpose
- Avoid more than 3 visually heavy regions above the fold
- Prefer one strong card over several equal-priority blocks
- When content is for scanning, prefer single-column flow over busy grids
- Put summary state close to the action it affects

## Component Rules

### Cards

- Default radius: `24px`
- Avoid nested bordered cards unless information hierarchy truly requires it
- Shadows should be soft and low contrast
- Use border + subtle background before adding stronger shadow

### Buttons

- One primary CTA per region
- Secondary actions should become text buttons or light outline pills
- Do not place 3 equal visual-weight buttons in one row unless required

### Filters / Status

- Use pills and compact summary bars
- Applied filters should be visible near the result list
- Avoid stacking multiple alert bars vertically if they can be merged

### AI Tutor

- AI tutor is part of the product shell, not a separate tool page
- Tutor interactions should feel lightweight, persistent, and contextual
- Loading states should appear once, in the message stream itself

## Page-Specific Guidance

### Overview

- Feels like a guided home, not a metrics dashboard
- Prioritize "who you are", "what to do next", and "where to continue"

### Resources

- Behave like a content library
- Optimize for scanability and quick entry into materials

### Evaluation

- Behave like a short assessment flow
- Minimize setup friction
- Emphasize start, answer, result, next step

### Report

- Behave like a profile interpretation page
- Explain what the profile is, what it is made of, and how to use it

## Do Not

- Do not overuse cold gray dashboard panels
- Do not make every section look equally important
- Do not stack redundant explanations above and below the same action
- Do not let decorative labels compete with real user tasks

