<script setup lang="ts">
import type { MenuItemType } from '#shared/types/cms';
import { getMenuLabel } from '#shared/utils/menu';
import { ChevronDown } from 'lucide-vue-next';
import { NavigationMenuLink } from '~/components/ui/navigation-menu';

const props = defineProps<{ item: MenuItemType }>();

const { t } = useI18n();
const { visibleChildren, linkTag, linkAttrs } = useHeaderMenuLinks();

const open = ref(false);
const children = computed(() => visibleChildren(props.item));
const label = computed(() => getMenuLabel(props.item));
const listId = useId();

// reka's own arrow-key and Tab handling in the dropdown picks links by
// tabIndex and ignores `inert`, so folded links leave the tab order too.
const foldedTabindex = computed(() => (open.value ? undefined : -1));

// Link classes go through NavigationMenuLink's `class`, where cn() replaces
// its own text size and padding; on the child both would apply.
const linkClass =
  'hover:bg-muted block rounded-md px-3 py-1.5 text-sm underline-offset-4 transition-colors hover:text-inherit focus:bg-transparent focus:text-inherit';
// A heading without children looks the same as a toggle heading.
const headingClass = 'hover:bg-muted rounded-md px-3 py-2 text-sm';
</script>

<template>
  <li>
    <template v-if="children.length">
      <button
        type="button"
        class="focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 text-left transition-colors outline-none focus-visible:ring-[3px]"
        :class="[headingClass, open ? 'bg-muted font-semibold' : 'font-medium']"
        :aria-expanded="open"
        :aria-controls="listId"
        @click="open = !open"
      >
        <span class="min-w-0">{{ label }}</span>
        <ChevronDown
          class="size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none"
          :class="open ? 'rotate-180' : ''"
          aria-hidden="true"
        />
      </button>
      <div
        :id="listId"
        class="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        :class="open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
        :inert="!open"
      >
        <ul class="min-h-0 overflow-hidden pl-3">
          <li class="pt-1">
            <NavigationMenuLink as-child :class="linkClass">
              <component
                :is="linkTag(item)"
                v-bind="linkAttrs(item)"
                :tabindex="foldedTabindex"
              >
                {{ t('layout.menu_all_in', { name: label }) }}
              </component>
            </NavigationMenuLink>
          </li>
          <li v-for="child in children" :key="child.id">
            <NavigationMenuLink as-child :class="linkClass">
              <component
                :is="linkTag(child)"
                v-bind="linkAttrs(child)"
                :tabindex="foldedTabindex"
              >
                {{ getMenuLabel(child) }}
              </component>
            </NavigationMenuLink>
          </li>
        </ul>
      </div>
    </template>
    <NavigationMenuLink
      v-else
      as-child
      :class="[
        headingClass,
        'block font-medium underline-offset-4 transition-colors hover:text-inherit focus:bg-transparent focus:text-inherit',
      ]"
    >
      <component :is="linkTag(item)" v-bind="linkAttrs(item)">
        {{ label }}
      </component>
    </NavigationMenuLink>
  </li>
</template>
