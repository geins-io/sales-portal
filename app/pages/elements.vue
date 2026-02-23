<script setup lang="ts">
import { PackageOpen, Search, ChevronDown } from 'lucide-vue-next';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '~/components/ui/navigation-menu';

const { tenant, isLoading, error } = useTenant();
const quantityInputValue = ref(1);
const showVat = ref(true);

// Generate a <style> tag for color swatches so CSP nonce applies (inline :style is blocked in prod)
const CSS_COLOR_RE =
  /^(oklch|rgb|hsl|hwb|lab|lch)\([^;{}]+\)$|^#[0-9a-fA-F]{3,8}$/;
const CSS_NAME_RE = /^[a-zA-Z][a-zA-Z0-9-]*$/;
const colorSwatchCss = computed(() => {
  const colors = tenant.value?.theme?.colors;
  if (!colors || !Object.keys(colors).length) return '';
  return Object.entries(colors)
    .filter(
      ([name, value]) =>
        CSS_NAME_RE.test(name) && CSS_COLOR_RE.test(String(value)),
    )
    .map(
      ([name, value]) =>
        `.swatch-${name} { background-color: ${String(value)}; }`,
    )
    .join('\n');
});
useHead({ style: [{ innerHTML: colorSwatchCss }] });

// Mock data for commerce components
const mockPrice = {
  sellingPriceIncVat: 199.0,
  sellingPriceIncVatFormatted: '199,00 kr',
  sellingPriceExVat: 159.2,
  sellingPriceExVatFormatted: '159,20 kr',
  regularPriceIncVat: 249.0,
  regularPriceIncVatFormatted: '249,00 kr',
  regularPriceExVat: 199.2,
  regularPriceExVatFormatted: '199,20 kr',
  isDiscounted: true,
  discountPercentage: 20,
  currency: { code: 'SEK', symbol: 'kr' },
};
const mockPriceNoDiscount = {
  ...mockPrice,
  isDiscounted: false,
  discountPercentage: 0,
  sellingPriceIncVat: 249.0,
  sellingPriceIncVatFormatted: '249,00 kr',
  sellingPriceExVat: 199.2,
  sellingPriceExVatFormatted: '199,20 kr',
};
const mockStockInStock = {
  totalStock: 50,
  inStock: 50,
  oversellable: 0,
  static: 0,
};
const mockStockLow = { totalStock: 3, inStock: 3, oversellable: 0, static: 0 };
const mockStockOut = { totalStock: 0, inStock: 0, oversellable: 0, static: 0 };
const mockStockOnDemand = {
  totalStock: 0,
  inStock: 0,
  oversellable: 0,
  static: 5,
};
// Mock data for breadcrumbs
const mockBreadcrumbs = [
  { label: 'Home', href: '/' },
  { label: 'Electronics', href: '/category/electronics' },
  { label: 'Laptops', href: '/category/electronics/laptops' },
  { label: 'MacBook Pro' },
];
const shortBreadcrumbs = [{ label: 'Home', href: '/' }, { label: 'About Us' }];

// Mock data for navigation menu demo
const mockMenuItems = [
  {
    id: 1,
    label: 'Products',
    children: [
      { id: 11, label: 'Brackets & Fasteners', href: '/category/brackets' },
      { id: 12, label: 'Pipes & Fittings', href: '/category/pipes' },
      { id: 13, label: 'Bolts & Screws', href: '/category/bolts' },
      { id: 14, label: 'Tools & Equipment', href: '/category/tools' },
      { id: 15, label: 'Safety Gear', href: '/category/safety' },
      { id: 16, label: 'Adhesives & Sealants', href: '/category/adhesives' },
    ],
  },
  {
    id: 2,
    label: 'Brands',
    children: [
      { id: 21, label: 'MetalWorks Pro', href: '/brands/metalworks' },
      { id: 22, label: 'PipeCraft', href: '/brands/pipecraft' },
      { id: 23, label: 'BoltMax', href: '/brands/boltmax' },
    ],
  },
  { id: 3, label: 'New Arrivals', href: '/new', children: [] },
  { id: 4, label: 'Sale', href: '/sale', children: [] },
];

const mockProduct = {
  productId: 1,
  name: 'Stainless Steel Bracket 25mm',
  alias: 'stainless-steel-bracket-25mm',
  articleNumber: 'SSB-025',
  categoryId: 1,
  weight: 250,
  supplierId: 1,
  canonicalUrl: '/products/stainless-steel-bracket-25mm',
  brand: { brandId: 1, name: 'MetalWorks Pro' },
  unitPrice: mockPrice,
  totalStock: mockStockInStock,
  productImages: [{ fileName: 'product-1.jpg', isPrimary: true, url: '' }],
};
const mockProductNoDiscount = {
  ...mockProduct,
  productId: 2,
  name: 'Copper Fitting 15mm',
  alias: 'copper-fitting-15mm',
  articleNumber: 'CF-015',
  canonicalUrl: '/products/copper-fitting-15mm',
  brand: { brandId: 2, name: 'PipeCraft' },
  unitPrice: mockPriceNoDiscount,
  totalStock: mockStockLow,
};
const mockProductOutOfStock = {
  ...mockProduct,
  productId: 3,
  name: 'Titanium Bolt M8',
  alias: 'titanium-bolt-m8',
  articleNumber: 'TB-M8',
  canonicalUrl: '/products/titanium-bolt-m8',
  brand: { brandId: 3, name: 'BoltMax' },
  unitPrice: mockPriceNoDiscount,
  totalStock: mockStockOut,
};
</script>

<template>
  <div class="container mx-auto space-y-12 p-8">
    <!-- Header -->
    <section class="space-y-2">
      <h1 class="text-3xl font-bold">
        {{ $t('elements.component_showcase') }}
      </h1>
      <p class="text-muted-foreground text-sm">
        Custom components built for this storefront. Tenant-aware, theme-aware.
      </p>
    </section>

    <Separator />

    <!-- ============================================ -->
    <!-- TENANT & THEMING                             -->
    <!-- ============================================ -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Tenant & Theming</h2>
      <div class="grid gap-6 md:grid-cols-2">
        <!-- Tenant info -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Tenant Info</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">ID</span>
              <code class="bg-muted rounded px-1.5 text-xs">{{
                tenant?.tenantId ?? 'N/A'
              }}</code>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Name</span>
              <span>{{ tenant?.branding?.name ?? 'N/A' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Theme</span>
              <span>{{ tenant?.theme?.name ?? 'N/A' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Logo</span>
              <img
                v-if="tenant?.branding?.logoUrl"
                :src="tenant.branding.logoUrl"
                alt="Tenant logo"
                class="h-6 max-w-[120px] object-contain"
              />
              <span v-else class="text-xs italic">None</span>
            </div>
            <p v-if="isLoading" class="text-muted-foreground">Loading...</p>
            <p v-if="error" class="text-destructive">
              Error: {{ error?.message }}
            </p>
          </CardContent>
        </Card>

        <!-- Theme colors -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Theme Colors</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              v-if="
                tenant?.theme?.colors && Object.keys(tenant.theme.colors).length
              "
              class="flex flex-wrap gap-3"
            >
              <div
                v-for="(value, name) in tenant.theme.colors"
                :key="name"
                class="flex flex-col items-center gap-1"
              >
                <div
                  class="h-8 w-8 rounded-full border"
                  :class="`swatch-${name}`"
                />
                <span class="text-muted-foreground text-xs">{{ name }}</span>
              </div>
            </div>
            <p v-else class="text-muted-foreground text-sm">No colors</p>
          </CardContent>
        </Card>
      </div>

      <!-- CSS dump -->
      <details class="rounded-md border">
        <summary class="text-muted-foreground cursor-pointer px-4 py-2 text-sm">
          Tenant CSS (click to expand)
        </summary>
        <pre
          class="bg-muted max-h-48 overflow-auto rounded-b-md p-4 text-xs"
        ><code>{{ tenant?.css ?? 'No CSS' }}</code></pre>
      </details>
    </section>

    <Separator />

    <!-- ============================================ -->
    <!-- BRANDING                                     -->
    <!-- ============================================ -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Branding</h2>

      <div class="grid gap-6 md:grid-cols-2">
        <!-- BrandLogo -->
        <div class="space-y-3">
          <h3 class="text-sm font-medium">BrandLogo</h3>
          <div class="flex flex-wrap items-center gap-6">
            <div class="space-y-1 text-center">
              <BrandLogo />
              <p class="text-muted-foreground text-xs">Default</p>
            </div>
            <div class="space-y-1 text-center">
              <BrandLogo :linked="false" />
              <p class="text-muted-foreground text-xs">Unlinked</p>
            </div>
            <div class="space-y-1 text-center">
              <BrandLogo height="h-12" />
              <p class="text-muted-foreground text-xs">h-12</p>
            </div>
          </div>
        </div>

        <!-- LitiumLogo -->
        <div class="space-y-3">
          <h3 class="text-sm font-medium">LitiumLogo</h3>
          <div class="flex flex-wrap items-center gap-6">
            <div class="space-y-1 text-center">
              <LitiumLogo variant="symbol" class="size-8" />
              <p class="text-muted-foreground text-xs">Symbol</p>
            </div>
            <div class="space-y-1 text-center">
              <LitiumLogo variant="wordmark" class="h-6" />
              <p class="text-muted-foreground text-xs">Wordmark</p>
            </div>
            <div class="space-y-1 text-center">
              <LitiumLogo variant="symbol" class="text-primary size-8" />
              <p class="text-muted-foreground text-xs">Primary color</p>
            </div>
          </div>
        </div>
      </div>

      <!-- PoweredBy + Copyright -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium">PoweredBy & Copyright</h3>
        <div class="flex flex-wrap items-center gap-6">
          <div class="space-y-1 text-center">
            <PoweredBy variant="full" />
            <p class="text-muted-foreground text-xs">full</p>
          </div>
          <div class="space-y-1 text-center">
            <PoweredBy variant="minimal" />
            <p class="text-muted-foreground text-xs">minimal</p>
          </div>
          <div class="space-y-1 text-center">
            <Copyright />
            <p class="text-muted-foreground text-xs">Copyright</p>
          </div>
        </div>
        <div
          class="border-border flex flex-col items-center gap-2 rounded-md border px-4 py-3 text-xs sm:flex-row sm:justify-between"
        >
          <Copyright />
          <PoweredBy />
        </div>
      </div>
    </section>

    <Separator />

    <!-- ============================================ -->
    <!-- LOCALE & MARKET                              -->
    <!-- ============================================ -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Locale & Market</h2>
      <p class="text-muted-foreground text-sm">
        Hidden when only one option is available.
      </p>
      <div class="grid gap-6 md:grid-cols-2">
        <div class="space-y-3">
          <h3 class="text-sm font-medium">LocaleSwitcher</h3>
          <div class="flex flex-wrap items-center gap-6">
            <div class="space-y-1 text-center">
              <LocaleSwitcher />
              <p class="text-muted-foreground text-xs">icon</p>
            </div>
            <div class="space-y-1 text-center">
              <LocaleSwitcher variant="text" />
              <p class="text-muted-foreground text-xs">text</p>
            </div>
            <div class="space-y-1 text-center">
              <LocaleSwitcher variant="inline" />
              <p class="text-muted-foreground text-xs">inline</p>
            </div>
          </div>
        </div>
        <div class="space-y-3">
          <h3 class="text-sm font-medium">MarketSwitcher</h3>
          <div class="flex flex-wrap items-center gap-6">
            <div class="space-y-1 text-center">
              <MarketSwitcher />
              <p class="text-muted-foreground text-xs">icon</p>
            </div>
            <div class="space-y-1 text-center">
              <MarketSwitcher variant="text" />
              <p class="text-muted-foreground text-xs">text</p>
            </div>
            <div class="space-y-1 text-center">
              <MarketSwitcher variant="inline" />
              <p class="text-muted-foreground text-xs">inline</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <Separator />

    <!-- ============================================ -->
    <!-- COMMERCE                                     -->
    <!-- ============================================ -->
    <section class="space-y-8">
      <h2 class="text-2xl font-semibold">Commerce</h2>

      <!-- PriceDisplay -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium">PriceDisplay</h3>
        <Label class="flex items-center gap-2 text-xs">
          <input v-model="showVat" type="checkbox" class="accent-primary" />
          Include VAT
        </Label>
        <div class="flex flex-wrap items-start gap-8">
          <div class="space-y-1">
            <PriceDisplay :price="mockPrice" :show-vat="showVat" />
            <p class="text-muted-foreground text-xs">Discounted (20% off)</p>
          </div>
          <div class="space-y-1">
            <PriceDisplay :price="mockPriceNoDiscount" :show-vat="showVat" />
            <p class="text-muted-foreground text-xs">Regular</p>
          </div>
          <div class="space-y-1">
            <PriceDisplay :price="mockPrice" :show-vat="showVat" from-price />
            <p class="text-muted-foreground text-xs">From price</p>
          </div>
        </div>
      </div>

      <Separator />

      <!-- StockBadge -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium">StockBadge</h3>
        <div class="flex flex-wrap items-center gap-3">
          <StockBadge :stock="mockStockInStock" />
          <StockBadge :stock="mockStockLow" />
          <StockBadge :stock="mockStockOut" />
          <StockBadge :stock="mockStockOnDemand" />
        </div>
      </div>

      <Separator />

      <!-- QuantityInput -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium">QuantityInput</h3>
        <div class="flex items-center gap-4">
          <QuantityInput v-model="quantityInputValue" :min="1" :max="99" />
          <span class="text-muted-foreground text-sm">
            Value: {{ quantityInputValue }}
          </span>
        </div>
      </div>

      <Separator />

      <!-- ProductCard -->
      <div class="space-y-4">
        <h3 class="text-sm font-medium">ProductCard</h3>
        <p class="text-muted-foreground text-xs">
          Composes GeinsImage + PriceDisplay + StockBadge internally.
        </p>

        <h4
          class="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          Grid
        </h4>
        <div class="grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-3">
          <ProductCard :product="mockProduct" />
          <ProductCard :product="mockProductNoDiscount" />
          <ProductCard :product="mockProductOutOfStock" />
        </div>

        <h4
          class="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          List
        </h4>
        <div class="flex max-w-2xl flex-col gap-3">
          <ProductCard :product="mockProduct" variant="list" />
          <ProductCard :product="mockProductNoDiscount" variant="list" />
        </div>
      </div>

      <Separator />

      <!-- LoadingState -->
      <div class="space-y-4">
        <h3 class="text-sm font-medium">LoadingState</h3>
        <div class="space-y-6">
          <div>
            <p class="text-muted-foreground mb-2 text-xs">
              card-grid (count=4)
            </p>
            <LoadingState variant="card-grid" :count="4" />
          </div>
          <div>
            <p class="text-muted-foreground mb-2 text-xs">
              card-list (count=3)
            </p>
            <LoadingState variant="card-list" :count="3" />
          </div>
          <div class="max-w-4xl">
            <p class="text-muted-foreground mb-2 text-xs">detail</p>
            <LoadingState variant="detail" />
          </div>
          <div class="max-w-md">
            <p class="text-muted-foreground mb-2 text-xs">text</p>
            <LoadingState variant="text" />
          </div>
        </div>
      </div>

      <Separator />

      <!-- EmptyState -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium">EmptyState</h3>
        <div class="grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          <div class="rounded-lg border">
            <EmptyState
              title="No products found"
              description="Try adjusting your search or filter criteria."
              :icon="Search"
              action-label="Browse all products"
              action-to="/products"
            />
          </div>
          <div class="rounded-lg border">
            <EmptyState
              title="Your cart is empty"
              description="Add some items to get started."
              :icon="PackageOpen"
              action-label="Start shopping"
              action-to="/products"
            />
          </div>
        </div>
      </div>
    </section>

    <Separator />

    <!-- ============================================ -->
    <!-- BREADCRUMBS                                  -->
    <!-- ============================================ -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Breadcrumbs</h2>
      <div class="space-y-6">
        <div>
          <p class="text-muted-foreground mb-2 text-sm">Short (2 items)</p>
          <AppBreadcrumbs :items="shortBreadcrumbs" />
        </div>
        <div>
          <p class="text-muted-foreground mb-2 text-sm">
            Long (4 items, collapses on mobile)
          </p>
          <AppBreadcrumbs :items="mockBreadcrumbs" />
        </div>
      </div>
    </section>

    <Separator />

    <!-- ============================================ -->
    <!-- NAVIGATION MENU (Mega Menu)                  -->
    <!-- ============================================ -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Navigation Menu</h2>
      <p class="text-muted-foreground text-sm">
        Mega menu dropdown using reka-ui NavigationMenu. Demo uses mock data
        since CMS menu items have no children configured.
      </p>

      <div class="bg-muted rounded-lg border">
        <nav class="flex h-16 items-center px-4 lg:px-8">
          <NavigationMenu class="max-w-none justify-start">
            <NavigationMenuList class="gap-2">
              <NavigationMenuItem v-for="item in mockMenuItems" :key="item.id">
                <!-- Item with children: trigger + dropdown -->
                <template v-if="item.children.length">
                  <NavigationMenuTrigger>
                    {{ item.label }}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div
                      class="grid w-[400px] grid-cols-2 gap-1 p-2 md:w-[500px]"
                    >
                      <NavigationMenuLink
                        v-for="child in item.children"
                        :key="child.id"
                        as-child
                      >
                        <NuxtLink
                          :to="child.href"
                          class="hover:bg-accent hover:text-accent-foreground rounded-sm px-3 py-2 text-sm transition-colors"
                        >
                          {{ child.label }}
                        </NuxtLink>
                      </NavigationMenuLink>
                    </div>
                  </NavigationMenuContent>
                </template>

                <!-- Item without children: plain link -->
                <template v-else>
                  <NavigationMenuLink as-child>
                    <NuxtLink
                      :to="item.href!"
                      class="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground inline-flex h-9 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                    >
                      {{ item.label }}
                      <ChevronDown class="size-3 opacity-50" />
                    </NuxtLink>
                  </NavigationMenuLink>
                </template>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </nav>
      </div>
    </section>

    <Separator />
  </div>
</template>
