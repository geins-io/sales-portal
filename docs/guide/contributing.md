# Contributing

Thank you for your interest in contributing to the Sales Portal! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20 or newer
- PNPM 9+
- Git

### Local Development

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/sales-portal.git
   cd sales-portal
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

## Code Standards

### Formatting

We use Prettier for code formatting. Format your code before committing:

```bash
pnpm format
```

Check formatting without writing:

```bash
pnpm format:check
```

### Linting

ESLint is configured for code quality. Run the linter:

```bash
pnpm lint
```

Auto-fix issues:

```bash
pnpm lint:fix
```

### Type Checking

Ensure TypeScript types are correct:

```bash
pnpm typecheck
```

### Pre-commit Hooks

Husky is configured to run linting and formatting checks before each commit. This happens automatically when you commit.

## Testing

### Running Tests

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run all tests
pnpm test:all
```

### Writing Tests

- **Unit tests** go in `tests/unit/` or `tests/server/`
- **Component tests** go in `tests/components/`
- **E2E tests** go in `tests/e2e/`

See the [Testing Guide](/testing) for detailed testing documentation.

## Project Structure

```
app/                    # Frontend application
├── components/
│   ├── layout/         # Layout components (header, footer)
│   └── ui/             # UI primitives (shadcn-vue)
├── composables/        # Vue composables
├── pages/              # File-based routing
└── plugins/            # Nuxt plugins

server/                 # Backend code
├── api/                # API endpoints
├── plugins/            # Server plugins
└── utils/              # Server utilities

shared/                 # Shared code (client + server)
└── types/              # TypeScript types

tests/                  # Test files
docs/                   # Documentation
```

## Component Guidelines

### Using shadcn-vue

Add new shadcn-vue components using the CLI:

```bash
pnpm dlx shadcn-vue add button
```

Components are generated in `app/components/ui/`.

### Creating Custom Components

1. Use TypeScript for all components
2. Use Composition API with `<script setup>`
3. Use design tokens for colors and spacing
4. Add appropriate ARIA attributes for accessibility

Example:

```vue
<script setup lang="ts">
interface Props {
  title: string
  variant?: 'default' | 'outline'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default'
})
</script>

<template>
  <div
    class="bg-background text-foreground rounded-md p-4"
    :class="{ 'border border-border': props.variant === 'outline' }"
  >
    <h2 class="text-lg font-semibold">{{ props.title }}</h2>
    <slot />
  </div>
</template>
```

## Commit Messages

Use clear, descriptive commit messages:

```
feat: add product search functionality
fix: resolve cart quantity update issue
docs: update API reference
test: add unit tests for useDebounce
refactor: simplify tenant context logic
```

Prefixes:
- `feat:` — New features
- `fix:` — Bug fixes
- `docs:` — Documentation changes
- `test:` — Test additions/changes
- `refactor:` — Code refactoring
- `chore:` — Maintenance tasks

## Pull Requests

1. Ensure all tests pass: `pnpm test:all`
2. Ensure linting passes: `pnpm lint`
3. Update documentation if needed
4. Write a clear PR description
5. Link to any related issues

## Getting Help

- Check existing [issues](https://github.com/litium/sales-portal/issues)
- Review the [documentation](/guide/getting-started)
- Ask questions in discussions

## License

By contributing, you agree that your contributions will be licensed under the project's license.
