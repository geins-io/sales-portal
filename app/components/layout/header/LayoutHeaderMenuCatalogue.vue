<script setup lang="ts">
import type { MenuItemType } from '#shared/types/cms';
import { getMenuLabel } from '#shared/utils/menu';
import { ChevronRight, CircleArrowRight } from 'lucide-vue-next';
import { NavigationMenuLink } from '~/components/ui/navigation-menu';

const props = defineProps<{
  /** The open top item's children. */
  items: MenuItemType[];
}>();

const { t } = useI18n();
const { visibleChildren, linkTag, linkAttrs } = useHeaderMenuLinks();

// The open item of each level, the items themselves, not their ids: a menu
// item's id is optional. Column n + 1 shows the children of the n-th.
const openPath = shallowRef<MenuItemType[]>([]);
const columnId = useId();

// The path as far as each item is still among its parent's children.
const path = computed(() => {
  const open: MenuItemType[] = [];
  let level = props.items;
  for (const item of openPath.value) {
    if (!level.includes(item)) break;
    open.push(item);
    level = visibleChildren(item);
  }
  return open;
});

function toggle(level: number, item: MenuItemType) {
  const above = path.value.slice(0, level);
  openPath.value = path.value[level] === item ? above : [...above, item];
}

// A category row looks the same as a button or a link. Link classes go
// through NavigationMenuLink's `class`, where cn() replaces its own small
// text and padding; on the child both would apply.
const toggleClass =
  'focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 text-left outline-none focus-visible:ring-[3px]';
const rowClass = 'hover:bg-muted rounded-md px-3 py-2.5 text-base font-medium';
const columnRowClass = 'hover:bg-muted rounded-md px-3 py-1.5 text-sm';
const linkClass =
  'block underline-offset-4 hover:text-inherit focus:bg-transparent focus:text-inherit';
</script>

<template>
  <div class="flex items-stretch" data-testid="menu-catalogue">
    <div data-menu-column class="flex w-72 shrink-0 flex-col gap-0.5 pr-6">
      <template v-for="item in items" :key="item.id">
        <button
          v-if="visibleChildren(item).length"
          type="button"
          :class="[toggleClass, rowClass, path[0] === item ? 'bg-muted' : '']"
          :aria-expanded="path[0] === item"
          :aria-controls="path[0] === item ? `${columnId}-0` : undefined"
          @click="toggle(0, item)"
        >
          <span class="min-w-0">{{ getMenuLabel(item) }}</span>
          <ChevronRight
            class="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
        </button>
        <NavigationMenuLink v-else as-child :class="[linkClass, rowClass]">
          <component :is="linkTag(item)" v-bind="linkAttrs(item)">
            {{ getMenuLabel(item) }}
          </component>
        </NavigationMenuLink>
      </template>
    </div>

    <div
      v-for="(open, level) in path"
      :id="`${columnId}-${level}`"
      :key="level"
      data-menu-column
      class="border-border flex w-64 shrink-0 flex-col gap-0.5 border-l px-6"
    >
      <NavigationMenuLink
        as-child
        class="mb-2 flex-row items-center gap-2 self-start rounded-md px-3 py-1.5 text-base font-semibold underline-offset-4 hover:bg-transparent hover:text-inherit hover:underline focus:bg-transparent focus:text-inherit"
      >
        <component
          :is="linkTag(open)"
          v-bind="linkAttrs(open)"
          :aria-label="t('layout.menu_go_to', { name: getMenuLabel(open) })"
        >
          {{ getMenuLabel(open) }}
          <CircleArrowRight class="size-4 shrink-0" aria-hidden="true" />
        </component>
      </NavigationMenuLink>
      <template v-for="child in visibleChildren(open)" :key="child.id">
        <button
          v-if="visibleChildren(child).length"
          type="button"
          :class="[
            toggleClass,
            columnRowClass,
            path[level + 1] === child ? 'bg-muted' : '',
          ]"
          :aria-expanded="path[level + 1] === child"
          :aria-controls="
            path[level + 1] === child ? `${columnId}-${level + 1}` : undefined
          "
          @click="toggle(level + 1, child)"
        >
          <span class="min-w-0">{{ getMenuLabel(child) }}</span>
          <ChevronRight
            class="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
        </button>
        <NavigationMenuLink
          v-else
          as-child
          :class="[linkClass, columnRowClass]"
        >
          <component :is="linkTag(child)" v-bind="linkAttrs(child)">
            {{ getMenuLabel(child) }}
          </component>
        </NavigationMenuLink>
      </template>
    </div>
  </div>
</template>
