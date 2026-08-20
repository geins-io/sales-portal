# Component Conventions

## Never resolve auto-imported components through `<component :is>`

Do not write `<component :is="'NuxtLink'">`, or any dynamic `<component :is>` that names an
auto-imported framework component with a string literal.

```vue
<!-- Wrong: renders a literal <NuxtLink> tag that does nothing -->
<component :is="to ? 'NuxtLink' : 'div'" :to="to">
  <slot />
</component>

<!-- Right: explicit branches -->
<NuxtLink v-if="to" :to="to">
  <slot />
</NuxtLink>
<div v-else>
  <slot />
</div>
```

Nuxt cannot resolve auto-imported component names from string literals at runtime.
`resolveDynamicComponent` looks the name up in the globally registered components, and
auto-imported components are not in that registry — they are compiled in per-file. The lookup
fails silently: instead of erroring, Vue falls back to treating the string as a native tag, so
the rendered HTML contains a literal `<NuxtLink>` element. The browser treats it as an unknown
element. It has no `href`, so clicks do nothing and the link is invisible to crawlers.

**Unit tests do not catch this.** Component tests stub `NuxtLink`, and the stub resolves by name
where the real auto-import does not — so the test renders a working link and passes while
production ships a dead one. This reached production once (the product card in PR #138) and was
found by a production smoke test in PR #139, not by the suite.

When reviewing a component that conditionally renders a link versus a plain wrapper, insist on
the explicit `v-if` / `v-else` pattern. If you need a dynamic component for something other than
an auto-imported one, import it explicitly and bind the component object rather than its name:

```vue
<script setup lang="ts">
import Foo from './Foo.vue';
import Bar from './Bar.vue';
const active = computed(() => (props.kind === 'foo' ? Foo : Bar));
</script>

<template>
  <component :is="active" />
</template>
```

Binding the resolved component object is safe — the failure mode is specific to resolving a
**name** at runtime.
