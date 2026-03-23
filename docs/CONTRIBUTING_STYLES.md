# Contributing: Styling Guide 🎨

This guide explains the CSS architecture and styling conventions for the Kubernetes Desktop application. We use a combination of **Sass (SCSS)** and **Tailwind CSS**.

---

## Styling Architecture

We use a modular approach centered around SCSS for component-specific styles and Tailwind for utility-based styling.

### 1. SCSS Structure (`styles/`)

The `styles/` directory is organized by functionality:

- `index.scss`: The main entry point that `@use`s all other styles.
- `variables.scss`: Design tokens (CSS variables) and Sass variables.
- `mixins.scss`: Shared Sass mixins (e.g., `scrollbar`, `smooth-transition`).
- `components/`: Component-specific styles (e.g., `ui/Button.scss`).
- `pages/`: Page-specific layout and styling.

### 2. Tailwind CSS

Tailwind is used for:

- Standardized utility classes (spacing, alignment, etc.).
- Rapid prototyping.
- Animations (e.g., `animate-spin`).

---

## Design Tokens (CSS Variables)

All core design tokens are defined as CSS variables in `styles/variables.scss`.

### Color System

Tokens are scoped to `:root` (Light) and `[data-theme='dark']` (Dark).

```css
:root {
  --bg-primary: rgb(255 255 255);
  --bg-secondary: rgb(248 250 252);
  --text-primary: rgb(15 23 42);
  --color-primary: rgb(37 99 235);
  --color-success: rgb(22 163 74);
  --color-error: rgb(220 38 38);
}

[data-theme='dark'] {
  --bg-primary: rgb(15 23 42);
  --bg-secondary: rgb(30 41 59);
  --text-primary: rgb(241 245 249);
}
```

### Spacing & Typography

- **Spacing**: `--spacing-xs` to `--spacing-2xl`.
- **Typography**: `--font-size-xs` to `--font-size-2xl`.

---

## Component Styling Pattern

### 1. SCSS Components

We use **BEM (Block Element Modifier)** naming for component-specific SCSS.

**File**: `styles/components/ui/MyComponent.scss`

```scss
@use '../../variables' as *;

.my-component {
  display: flex;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);

  &__title {
    font-size: var(--font-size-lg);
    color: var(--text-primary);
  }

  &--active {
    border-color: var(--color-primary);
  }
}
```

### 2. Merging Classes (`cn` utility)

Use the `cn` utility from `src/lib/utils.ts` to merge SCSS classes with Tailwind utility classes.

```typescript
import { cn } from '../../lib/utils';
import '../../styles/components/ui/MyComponent.scss';

export function MyComponent({ className, isActive }: Props) {
  return (
    <div className={cn(
      'my-component',
      isActive && 'my-component--active',
      'p-4 shadow-md', // Tailwind utilities
      className
    )}>
      <h3 className="my-component__title">Hello</h3>
    </div>
  );
}
```

---

## SCSS Best Practices

### ✅ DO

- **Use `@use` instead of `@import`**: Modern Sass modules prevent namespace collisions.
- **Reference CSS Variables**: Always prefer `var(--token-name)` over hardcoded hex values.
- **Use Mixins**: Leverage shared mixins for complex repetitive styles like custom scrollbars.
  ```scss
  * {
    @include scrollbar();
  }
  ```
- **Follow BEM**: Keep selectors flat and maintainable.

### ❌ DON'T

- **Don't nest too deeply**: Maximum 3 levels of nesting in SCSS.
- **Don't use `!important`**: Manage specificity using proper BEM modifiers or parent selectors.
- **Don't hardcode colors**: If a color is missing from `variables.scss`, add it as a new design token.

---

## Utility Classes vs Custom SCSS

### Use Tailwind when:

- Adding simple spacing, margins, or padding.
- Centering elements (`flex items-center justify-center`).
- Implementing standard animations (`animate-pulse`).

### Use Custom SCSS when:

- Building complex, reusable UI components (Buttons, Cards, Modals).
- Implementing theme-aware tokens that change significantly between light and dark mode.
- Writing complex transitions and hover states.

---

## Next Steps

1. ✅ Review `styles/variables.scss` for the full list of available design tokens.
2. ✅ Review `styles/mixins.scss` for shared behavior.
3. ✅ Check `styles/index.scss` to see how components are exported.
4. ✅ Run `npm run lint` to ensure style consistency.
