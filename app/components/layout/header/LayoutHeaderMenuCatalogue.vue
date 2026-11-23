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

// The item itself, not its id: a menu item's id is optional.
const open = shallowRef<MenuItemType | null>(null);
const columnId = useId();

const openItem = computed(() =>
  open.value && props.items.includes(open.value) ? open.value : null,
);

function toggle(item: MenuItemType) {
  open.value = openItem.value === item ? null : item;
}

// A category row looks the same as a button or a link. Link classes go
// through NavigationMenuLink's `class`, where cn() replaces its own small
// text and padding; on the child both would apply.
const rowClass = 'hover:bg-muted rounded-md px-3 py-2.5 text-base font-medium';
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
          class="focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 text-left outline-none focus-visible:ring-[3px]"
          :class="[rowClass, openItem === item ? 'bg-muted' : '']"
          :aria-expanded="openItem === item"
          :aria-controls="openItem === item ? columnId : undefined"
          @click="toggle(item)"
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

    <!-- The menu holds three levels: the children here are always links. -->
    <div
      v-if="openItem"
      :id="columnId"
      data-menu-column
      class="border-border flex w-64 shrink-0 flex-col gap-0.5 border-l px-6"
    >
      <NavigationMenuLink
        as-child
        class="mb-2 flex-row items-center gap-2 self-start rounded-md px-3 py-1.5 text-base font-semibold underline-offset-4 hover:bg-transparent hover:text-inherit hover:underline focus:bg-transparent focus:text-inherit"
      >
        <component
          :is="linkTag(openItem)"
          v-bind="linkAttrs(openItem)"
          :aria-label="t('layout.menu_go_to', { name: getMenuLabel(openItem) })"
        >
          {{ getMenuLabel(openItem) }}
          <CircleArrowRight class="size-4 shrink-0" aria-hidden="true" />
        </component>
      </NavigationMenuLink>
      <NavigationMenuLink
        v-for="child in visibleChildren(openItem)"
        :key="child.id"
        as-child
        :class="[linkClass, 'hover:bg-muted rounded-md px-3 py-1.5 text-sm']"
      >
        <component :is="linkTag(child)" v-bind="linkAttrs(child)">
          {{ getMenuLabel(child) }}
        </component>
      </NavigationMenuLink>
    </div>
  </div>
</template>
