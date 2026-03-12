# Contributing: Styling Guide 🎨

This guide explains the CSS architecture and styling conventions for the Kubernetes Desktop application.

---

## CSS Architecture

We use **modular CSS** with a clear structure:

```
styles/
├── index.css           # Global styles, CSS variables, resets
├── components/         # Component-specific styles
│   ├── ui/            # UI component styles
│   └── modals/        # Modal styles
└── pages/             # Page-specific styles
    ├── Dashboard.css
    ├── Clusters.css
    └── ClusterDetails.css
```

---

## CSS Variables (Design Tokens)

All colors, spacing, and typography are defined as CSS variables in `styles/index.css`.

### Color System

```css
:root {
  /* Primary Colors */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;

  /* Semantic Colors */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Neutral Colors */
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-border: #334155;
  --color-text: #f1f5f9;
  --color-text-muted: #94a3b8;
}
```

### Spacing Scale

```css
:root {
  --spacing-xs: 0.25rem; /* 4px */
  --spacing-sm: 0.5rem; /* 8px */
  --spacing-md: 1rem; /* 16px */
  --spacing-lg: 1.5rem; /* 24px */
  --spacing-xl: 2rem; /* 32px */
  --spacing-2xl: 3rem; /* 48px */
}
```

### Typography

```css
:root {
  --font-family: 'Inter', -apple-system, sans-serif;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
}
```

---

## Component Styling Pattern

### 1. Create Component CSS File

**File**: `styles/components/ui/MyComponent.css`

```css
/* Component container */
.my-component {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

/* Component elements */
.my-component__title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.my-component__content {
  color: var(--color-text-muted);
}

/* Component states */
.my-component--loading {
  opacity: 0.6;
  pointer-events: none;
}

.my-component--error {
  border-color: var(--color-error);
}
```

### 2. Import in Component

```typescript
import '../../styles/components/ui/MyComponent.css';

export function MyComponent() {
  return (
    <div className="my-component">
      <h3 className="my-component__title">Title</h3>
      <p className="my-component__content">Content</p>
    </div>
  );
}
```

---

## Naming Conventions

We follow **BEM (Block Element Modifier)** methodology:

### Block

The component itself

```css
.cluster-card {
}
```

### Element

Parts of the component (use `__`)

```css
.cluster-card__header {
}
.cluster-card__title {
}
.cluster-card__actions {
}
```

### Modifier

Variations or states (use `--`)

```css
.cluster-card--active {
}
.cluster-card--loading {
}
.cluster-card__title--large {
}
```

### Examples

```css
/* ✅ Good */
.button {
}
.button--primary {
}
.button--large {
}
.button__icon {
}

/* ❌ Bad */
.btn {
} /* Too abbreviated */
.buttonPrimary {
} /* Use -- not camelCase */
.button-icon {
} /* Use __ for elements */
.button_primary {
} /* Use -- for modifiers */
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile first approach */
.my-component {
  /* Mobile styles (default) */
  flex-direction: column;
}

/* Tablet and up */
@media (min-width: 768px) {
  .my-component {
    flex-direction: row;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .my-component {
    max-width: 1200px;
  }
}
```

---

## Common Patterns

### Pattern 1: Card Layout

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  transition: all 0.2s ease;
}

.card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

### Pattern 2: Flex Layouts

```css
/* Horizontal layout with gap */
.flex-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

/* Vertical layout */
.flex-col {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* Space between */
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

### Pattern 3: Grid Layouts

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}
```

### Pattern 4: Transitions

```css
.button {
  transition: all 0.2s ease;
}

.button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.button:active {
  transform: translateY(0);
}
```

---

## Utility Classes

### Spacing Utilities

```css
.p-sm {
  padding: var(--spacing-sm);
}
.p-md {
  padding: var(--spacing-md);
}
.p-lg {
  padding: var(--spacing-lg);
}

.m-sm {
  margin: var(--spacing-sm);
}
.m-md {
  margin: var(--spacing-md);
}
.m-lg {
  margin: var(--spacing-lg);
}

.gap-sm {
  gap: var(--spacing-sm);
}
.gap-md {
  gap: var(--spacing-md);
}
```

### Text Utilities

```css
.text-sm {
  font-size: var(--font-size-sm);
}
.text-base {
  font-size: var(--font-size-base);
}
.text-lg {
  font-size: var(--font-size-lg);
}

.text-muted {
  color: var(--color-text-muted);
}
.text-error {
  color: var(--color-error);
}
.text-success {
  color: var(--color-success);
}

.font-bold {
  font-weight: 600;
}
.font-semibold {
  font-weight: 500;
}
```

---

## Theme Support

### Dark Mode (Default)

The application ships with a dark theme. CSS variables are scoped to `[data-theme='dark']` in `styles/index.css`.

```css
[data-theme='dark'] {
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-text: #f1f5f9;
}
```

### Light Mode (Not yet implemented)

A light mode theme selector is not currently available in the Settings UI. When adding light-mode support, override variables under a `[data-theme='light']` selector:

```css
[data-theme='light'] {
  --color-bg: #ffffff;
  --color-surface: #f8fafc;
  --color-text: #0f172a;
}
```

---

## Animations

### Fade In

```css
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.fade-in {
  animation: fadeIn 0.3s ease;
}
```

### Slide Up

```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-up {
  animation: slideUp 0.4s ease;
}
```

---

## Best Practices

### ✅ DO

- **Use CSS variables** for all colors, spacing, and typography

  ```css
  /* ✅ Good */
  color: var(--color-primary);
  padding: var(--spacing-md);

  /* ❌ Bad */
  color: #3b82f6;
  padding: 16px;
  ```

- **Follow BEM naming**

  ```css
  /* ✅ Good */
  .cluster-card {
  }
  .cluster-card__title {
  }
  .cluster-card--active {
  }
  ```

- **Use semantic class names**

  ```css
  /* ✅ Good */
  .error-message {
  }
  .submit-button {
  }

  /* ❌ Bad */
  .red-text {
  }
  .big-btn {
  }
  ```

- **Group related styles**

  ```css
  /* Layout */
  .component {
    display: flex;
    gap: var(--spacing-md);
  }

  /* Visual */
  .component {
    background: var(--color-surface);
    border-radius: var(--radius-md);
  }

  /* Typography */
  .component {
    font-size: var(--font-size-base);
    color: var(--color-text);
  }
  ```

### ❌ DON'T

- **Don't use inline styles**

  ```tsx
  /* ❌ Bad */
  <div style={{ color: 'red', padding: '16px' }}>

  /* ✅ Good */
  <div className="error-message">
  ```

- **Don't use `!important`** (except for utilities)

  ```css
  /* ❌ Bad */
  .component {
    color: red !important;
  }

  /* ✅ Good - increase specificity */
  .parent .component {
    color: red;
  }
  ```

- **Don't nest too deeply**

  ```css
  /* ❌ Bad */
  .a .b .c .d .e {
  }

  /* ✅ Good */
  .component__element {
  }
  ```

---

## File Organization

```
styles/
├── index.css                    # Global styles, variables
├── components/
│   ├── ui/
│   │   ├── Button.css
│   │   ├── Card.css
│   │   └── Badge.css
│   ├── modals/
│   │   └── BaseModal.css
│   └── cluster/
│       └── ClusterCard.css
└── pages/
    ├── Dashboard.css
    └── ClusterDetails.css
```

---

## Next Steps

1. ✅ Read [Feature Development Guide](./CONTRIBUTING_FEATURES.md)
2. ✅ Read [Testing Guide](./CONTRIBUTING_TESTS.md)
3. ✅ Review `styles/index.css` for all available variables
4. ✅ Check existing components for styling examples
