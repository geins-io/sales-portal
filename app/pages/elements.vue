<script setup lang="ts">
// shadcn-vue components are auto-imported via shadcn-nuxt module
// Only Lucide icons need explicit imports
import {
  ShoppingCart,
  Download,
  MailPlus,
  Star,
  User,
  LogOut,
  Box,
  ListFilter,
  Grid2x2,
  LayoutList,
  Search,
  Settings,
  Keyboard,
  CreditCard,
  Calculator,
  Calendar,
  Smile,
  FileText,
  AlignLeft,
  FileDown,
  Link2,
} from 'lucide-vue-next';

const { tenant, isLoading, error } = useTenant();
const selectedVariant = ref('');
const quantity = ref(1);
const commandOpen = ref(false);
const dialogOpen = ref(false);
</script>

<template>
  <div class="container mx-auto space-y-12 p-8">
    <!-- Tenant Info -->
    <section class="space-y-2">
      <h1 class="text-3xl font-bold">
        {{ $t('elements.component_showcase') }}
      </h1>
      <p class="text-muted-foreground">
        Tenant: {{ tenant?.tenantId ?? 'No tenant' }}
      </p>
      <p class="text-muted-foreground">
        Tenant Name: {{ tenant?.branding?.name ?? 'No tenant name' }}
      </p>
      <div class="text-muted-foreground flex items-center gap-2">
        <span>Tenant Logo:</span>
        <img
          v-if="tenant?.branding?.logoUrl"
          :src="tenant.branding.logoUrl"
          alt="Tenant logo"
          class="h-8 max-w-[200px] object-contain"
        />
        <span v-else>No logo</span>
      </div>
      <p class="text-muted-foreground">
        Tenant Theme: {{ tenant?.theme?.name ?? 'No theme' }}
      </p>
      <div class="space-y-2">
        <p class="text-muted-foreground text-sm font-medium">
          Tenant Theme Colors:
        </p>
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
              :style="{ backgroundColor: String(value) }"
            />
            <span class="text-muted-foreground text-xs">{{ name }}</span>
          </div>
        </div>
        <p v-else class="text-muted-foreground text-sm">No colors</p>
      </div>
      <div class="space-y-1">
        <p class="text-muted-foreground text-sm font-medium">CSS:</p>
        <pre
          class="bg-muted max-h-64 overflow-auto rounded-md p-4 text-sm"
        ><code>{{ tenant?.css ?? 'No CSS' }}</code></pre>
      </div>
      <p v-if="isLoading" class="text-muted-foreground">
        {{ $t('common.loading') }}
      </p>
      <p v-if="error" class="text-destructive">Error: {{ error?.message }}</p>
    </section>

    <Separator />

    <!-- Breadcrumb -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Breadcrumb</h2>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/products">Products</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Current Product</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </section>

    <Separator />

    <!-- Buttons -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Buttons</h2>
      <div class="flex flex-wrap gap-4">
        <Button variant="default">Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </div>
      <div class="flex flex-wrap gap-4">
        <Button variant="default" size="lg">
          <ShoppingCart class="mr-2 h-4 w-4" />
          {{ $t('cart.add_to_cart') }}
        </Button>
        <Button variant="outline" size="sm">
          <Download class="mr-2 h-4 w-4" />
          {{ $t('product.download') }}
        </Button>
        <Button variant="ghost" size="sm">
          <MailPlus class="mr-2 h-4 w-4" />
          {{ $t('product.add_to_quote') }}
        </Button>
      </div>
    </section>

    <Separator />

    <!-- Card -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Card</h2>
      <div class="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{{ $t('product.product_card') }}</CardTitle>
            <CardDescription>{{
              $t('product.product_card_description')
            }}</CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              This is the card content area where you can place any content.
            </p>
          </CardContent>
          <CardFooter class="flex justify-between">
            <Button variant="outline">{{ $t('common.cancel') }}</Button>
            <Button>{{ $t('common.save') }}</Button>
          </CardFooter>
        </Card>
      </div>
    </section>

    <Separator />

    <!-- Aspect Ratio -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Aspect Ratio</h2>
      <div class="w-[400px]">
        <AspectRatio
          :ratio="16 / 9"
          class="bg-muted flex items-center justify-center rounded-md"
        >
          <span class="text-muted-foreground">16:9 Aspect Ratio</span>
        </AspectRatio>
      </div>
      <div class="w-[300px]">
        <AspectRatio
          :ratio="1"
          class="bg-muted flex items-center justify-center rounded-md"
        >
          <span class="text-muted-foreground">1:1 Square</span>
        </AspectRatio>
      </div>
    </section>

    <Separator />

    <!-- Carousel -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Carousel</h2>
      <Carousel class="mx-auto w-full max-w-sm">
        <CarouselContent>
          <CarouselItem v-for="i in 5" :key="i">
            <div class="p-1">
              <Card>
                <CardContent
                  class="flex aspect-square items-center justify-center p-6"
                >
                  <span class="text-4xl font-semibold">{{ i }}</span>
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </section>

    <Separator />

    <!-- Select -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Select</h2>
      <div class="w-[320px] space-y-2">
        <Label>Variant</Label>
        <Select v-model="selectedVariant">
          <SelectTrigger>
            <SelectValue placeholder="Select a variant" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Sizes</SelectLabel>
              <SelectItem value="9mm">9 mm</SelectItem>
              <SelectItem value="12mm">12 mm</SelectItem>
              <SelectItem value="15mm">15 mm</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <p class="text-muted-foreground text-sm">
          Selected: {{ selectedVariant || 'None' }}
        </p>
      </div>
    </section>

    <Separator />

    <!-- Number Field -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Number Field (Quantity Stepper)</h2>
      <div class="flex items-center gap-4">
        <NumberField v-model="quantity" :min="1" :max="99">
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
        <span class="text-muted-foreground text-sm"
          >Quantity: {{ quantity }}</span
        >
      </div>
    </section>

    <Separator />

    <!-- Tabs -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Tabs</h2>
      <Tabs default-value="details" class="w-full max-w-2xl">
        <TabsList>
          <TabsTrigger value="details" class="gap-2">
            <FileText class="h-4 w-4" />
            {{ $t('product.details') }}
          </TabsTrigger>
          <TabsTrigger value="description" class="gap-2">
            <AlignLeft class="h-4 w-4" />
            {{ $t('product.description') }}
          </TabsTrigger>
          <TabsTrigger value="documents" class="gap-2">
            <FileDown class="h-4 w-4" />
            {{ $t('product.documents') }}
          </TabsTrigger>
          <TabsTrigger value="related" class="gap-2">
            <Link2 class="h-4 w-4" />
            {{ $t('product.related') }}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="details" class="rounded-b-md border p-4">
          <h3 class="mb-2 font-semibold">Product Details</h3>
          <p class="text-muted-foreground">
            Technical specifications and attributes go here.
          </p>
        </TabsContent>
        <TabsContent value="description" class="rounded-b-md border p-4">
          <h3 class="mb-2 font-semibold">Description</h3>
          <p class="text-muted-foreground">
            Full product description and features.
          </p>
        </TabsContent>
        <TabsContent value="documents" class="rounded-b-md border p-4">
          <h3 class="mb-2 font-semibold">Documents</h3>
          <p class="text-muted-foreground">
            Datasheets and manuals available for download.
          </p>
        </TabsContent>
        <TabsContent value="related" class="rounded-b-md border p-4">
          <h3 class="mb-2 font-semibold">Related Products</h3>
          <p class="text-muted-foreground">
            Similar products you might be interested in.
          </p>
        </TabsContent>
      </Tabs>
    </section>

    <Separator />

    <!-- Table -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Table (Product Attributes)</h2>
      <Table class="max-w-2xl">
        <TableCaption>{{ $t('product.product_specifications') }}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{{ $t('product.attribute') }}</TableHead>
            <TableHead>{{ $t('product.value') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell class="font-medium">Material</TableCell>
            <TableCell>Stainless Steel</TableCell>
          </TableRow>
          <TableRow>
            <TableCell class="font-medium">Dimensions</TableCell>
            <TableCell>100 x 50 x 25 mm</TableCell>
          </TableRow>
          <TableRow>
            <TableCell class="font-medium">Weight</TableCell>
            <TableCell>250g</TableCell>
          </TableRow>
          <TableRow>
            <TableCell class="font-medium">Color</TableCell>
            <TableCell>Silver</TableCell>
          </TableRow>
          <TableRow>
            <TableCell class="font-medium">Warranty</TableCell>
            <TableCell>2 years</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>

    <Separator />

    <!-- Label -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Label</h2>
      <div class="space-y-2">
        <Label for="email">{{ $t('elements.email_address') }}</Label>
        <Input
          id="email"
          type="email"
          class="max-w-sm"
          :placeholder="$t('elements.enter_your_email')"
        />
      </div>
    </section>

    <Separator />

    <!-- Badge -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Badge</h2>
      <div class="flex flex-wrap gap-4">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
      </div>
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm">Notifications</span>
          <Badge
            variant="destructive"
            class="h-5 w-5 justify-center rounded-full p-0"
            >3</Badge
          >
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm">Pending</span>
          <Badge variant="secondary">2 items</Badge>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm">Status</span>
          <Badge variant="outline" class="border-green-600 text-green-600"
            >Active</Badge
          >
        </div>
      </div>
    </section>

    <Separator />

    <!-- Avatar -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Avatar</h2>
      <div class="flex flex-wrap items-center gap-6">
        <div class="space-y-2 text-center">
          <Avatar class="h-12 w-12">
            <AvatarImage src="https://github.com/shadcn.png" alt="User" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <p class="text-muted-foreground text-xs">With image</p>
        </div>
        <div class="space-y-2 text-center">
          <Avatar class="h-12 w-12">
            <AvatarFallback>AJ</AvatarFallback>
          </Avatar>
          <p class="text-muted-foreground text-xs">Fallback</p>
        </div>
        <div class="space-y-2 text-center">
          <Avatar class="h-10 w-10">
            <AvatarFallback class="bg-primary text-primary-foreground">
              <User class="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <p class="text-muted-foreground text-xs">Icon</p>
        </div>
      </div>
      <!-- User card example like portal design -->
      <Card class="max-w-md">
        <CardHeader class="flex-row items-center gap-4">
          <Avatar class="h-14 w-14">
            <AvatarFallback>AJ</AvatarFallback>
          </Avatar>
          <div class="flex-1">
            <CardTitle class="text-lg">Welcome Adam!</CardTitle>
            <CardDescription>Customer no: 21390231</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div class="flex flex-col gap-2">
            <Button variant="link" class="h-auto justify-start p-0">
              <Star class="mr-2 h-4 w-4" />
              Your Favorites
            </Button>
            <Button variant="link" class="h-auto justify-start p-0">
              <User class="mr-2 h-4 w-4" />
              Your account
            </Button>
            <Button variant="link" class="h-auto justify-start p-0">
              <LogOut class="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>

    <Separator />

    <!-- Statistic Cards (Portal style) -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Statistic Cards</h2>
      <div
        class="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card class="bg-muted">
          <CardHeader class="flex-row items-center justify-between pb-2">
            <span class="text-sm font-medium">Pending quotations</span>
            <Badge
              variant="destructive"
              class="h-5 w-5 justify-center rounded-full p-0"
              >2</Badge
            >
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">2</p>
            <p class="text-muted-foreground text-xs">
              Closes expiration date 2026-02-17
            </p>
          </CardContent>
        </Card>
        <Card class="bg-muted">
          <CardHeader class="flex-row items-center justify-between pb-2">
            <span class="text-sm font-medium">Open orders</span>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">5</p>
            <p class="text-muted-foreground text-xs">
              Expected delivery this week
            </p>
          </CardContent>
        </Card>
        <Card class="bg-muted">
          <CardHeader class="flex-row items-center justify-between pb-2">
            <span class="text-sm font-medium">Favorites</span>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">12</p>
            <p class="text-muted-foreground text-xs">Products saved</p>
          </CardContent>
        </Card>
        <Card class="bg-muted">
          <CardHeader class="flex-row items-center justify-between pb-2">
            <span class="text-sm font-medium">Total orders</span>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">47</p>
            <p class="text-muted-foreground text-xs">This year</p>
          </CardContent>
        </Card>
      </div>
    </section>

    <Separator />

    <!-- Input -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Input</h2>
      <div class="flex max-w-md flex-col gap-4">
        <Input placeholder="Default input" />
        <Input type="email" placeholder="Email address" />
        <Input type="password" placeholder="Password" />
        <Input disabled placeholder="Disabled input" />
        <div class="relative">
          <Search
            class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Input class="pl-10" placeholder="Search products..." />
        </div>
      </div>
    </section>

    <Separator />

    <!-- Skeleton -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Skeleton</h2>
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-4">
          <Skeleton class="h-12 w-12 rounded-full" />
          <div class="space-y-2">
            <Skeleton class="h-4 w-[250px]" />
            <Skeleton class="h-4 w-[200px]" />
          </div>
        </div>
        <Card class="max-w-sm">
          <CardHeader>
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton class="h-[200px] w-full" />
          </CardContent>
          <CardFooter>
            <Skeleton class="h-9 w-full" />
          </CardFooter>
        </Card>
      </div>
    </section>

    <Separator />

    <!-- Pagination -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Pagination</h2>
      <Pagination
        :total="100"
        :items-per-page="10"
        :sibling-count="1"
        show-edges
        :default-page="2"
      >
        <PaginationContent>
          <PaginationFirst />
          <PaginationPrevious />
          <PaginationNext />
          <PaginationLast />
        </PaginationContent>
      </Pagination>
      <p class="text-muted-foreground text-sm">
        {{ $t('elements.showing_n_of_total', { n: 16, total: 96 }) }}
      </p>
    </section>

    <Separator />

    <!-- Product List Toolbar -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Product List Toolbar</h2>
      <div
        class="flex max-w-4xl flex-wrap items-center justify-between gap-4 rounded-md border p-4"
      >
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <ListFilter class="mr-2 h-4 w-4" />
            {{ $t('elements.filter') }}
          </Button>
          <div class="relative">
            <Search
              class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Input class="w-[200px] pl-10" placeholder="Search..." />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Select>
            <SelectTrigger class="w-[150px]">
              <SelectValue :placeholder="$t('product.sort_by')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
          <div class="flex">
            <Button variant="outline" size="icon" class="rounded-r-none">
              <Grid2x2 class="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              class="rounded-l-none border-l-0"
            >
              <LayoutList class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>

    <Separator />

    <!-- Product Card Grid (PLP style) -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Product Card Grid</h2>
      <div
        class="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card v-for="i in 4" :key="i" class="overflow-hidden">
          <div class="relative">
            <AspectRatio :ratio="1" class="bg-muted">
              <div class="flex h-full items-center justify-center">
                <Box class="text-muted-foreground h-12 w-12" />
              </div>
            </AspectRatio>
            <Button
              variant="outline"
              size="icon"
              class="absolute top-2 right-2 h-8 w-8"
            >
              <Star class="h-4 w-4" />
            </Button>
          </div>
          <CardHeader class="p-4">
            <CardTitle class="text-base">Product {{ i }}</CardTitle>
            <CardDescription>Art nr: {{ 1000 + i }}-ABC</CardDescription>
          </CardHeader>
          <CardContent class="p-4 pt-0">
            <p class="text-xl font-semibold">${{ (19.99 * i).toFixed(2) }}</p>
          </CardContent>
          <CardFooter class="flex gap-2 p-4 pt-0">
            <NumberField :default-value="1" :min="1" class="w-24">
              <NumberFieldContent>
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
            <Button class="flex-1" size="sm">
              <ShoppingCart class="mr-2 h-4 w-4" />
              Add
            </Button>
          </CardFooter>
        </Card>
      </div>
    </section>

    <Separator />

    <!-- Dropdown Menu -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Dropdown Menu</h2>
      <div class="flex flex-wrap gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline"> Open Menu </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <User class="mr-2 h-4 w-4" />
                Profile
                <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard class="mr-2 h-4 w-4" />
                Billing
                <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings class="mr-2 h-4 w-4" />
                Settings
                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Keyboard class="mr-2 h-4 w-4" />
                Keyboard shortcuts
                <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut class="mr-2 h-4 w-4" />
              Log out
              <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- User menu example -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon">
              <Avatar class="h-8 w-8">
                <AvatarFallback>AJ</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Adam Johnson</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Star class="mr-2 h-4 w-4" />
              Favorites
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ShoppingCart class="mr-2 h-4 w-4" />
              Orders
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut class="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </section>

    <Separator />

    <!-- Command (Search Palette) -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Command (Search Palette)</h2>
      <p class="text-muted-foreground text-sm">
        Press ⌘K or click the button to open
      </p>
      <Button
        variant="outline"
        class="text-muted-foreground w-full max-w-sm justify-start"
        @click="commandOpen = true"
      >
        <Search class="mr-2 h-4 w-4" />
        Search products...
        <kbd
          class="bg-muted text-muted-foreground ml-auto rounded px-2 py-0.5 text-xs"
          >⌘K</kbd
        >
      </Button>
      <CommandDialog v-model:open="commandOpen">
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem value="calendar">
              <Calendar class="mr-2 h-4 w-4" />
              Calendar
            </CommandItem>
            <CommandItem value="emoji">
              <Smile class="mr-2 h-4 w-4" />
              Search Emoji
            </CommandItem>
            <CommandItem value="calculator">
              <Calculator class="mr-2 h-4 w-4" />
              Calculator
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem value="profile">
              <User class="mr-2 h-4 w-4" />
              Profile
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem value="billing">
              <CreditCard class="mr-2 h-4 w-4" />
              Billing
              <CommandShortcut>⌘B</CommandShortcut>
            </CommandItem>
            <CommandItem value="settings">
              <Settings class="mr-2 h-4 w-4" />
              Settings
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </section>

    <Separator />

    <!-- Dialog -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Dialog</h2>
      <Dialog v-model:open="dialogOpen">
        <DialogTrigger as-child>
          <Button variant="outline">Open Dialog</Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{{ $t('elements.share_link') }}</DialogTitle>
            <DialogDescription>
              {{ $t('elements.share_link_description') }}
            </DialogDescription>
          </DialogHeader>
          <div class="flex items-center gap-2">
            <Input
              readonly
              :default-value="'https://example.com/share/abc123'"
              class="flex-1"
            />
            <Button type="submit" size="sm"> {{ $t('common.copy') }} </Button>
          </div>
          <DialogFooter class="sm:justify-start">
            <DialogClose as-child>
              <Button variant="secondary"> {{ $t('common.close') }} </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>

    <Separator />

    <!-- Branding -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Branding</h2>

      <!-- BrandLogo -->
      <div class="space-y-3">
        <h3 class="text-lg font-medium">BrandLogo</h3>
        <div class="flex flex-wrap items-center gap-8">
          <div class="space-y-1 text-center">
            <BrandLogo />
            <p class="text-muted-foreground text-xs">Default (linked)</p>
          </div>
          <div class="space-y-1 text-center">
            <BrandLogo :linked="false" />
            <p class="text-muted-foreground text-xs">Unlinked</p>
          </div>
          <div class="space-y-1 text-center">
            <BrandLogo height="h-6" />
            <p class="text-muted-foreground text-xs">h-6</p>
          </div>
          <div class="space-y-1 text-center">
            <BrandLogo height="h-12" />
            <p class="text-muted-foreground text-xs">h-12</p>
          </div>
        </div>
      </div>

      <Separator />

      <!-- LitiumLogo -->
      <div class="space-y-3">
        <h3 class="text-lg font-medium">LitiumLogo</h3>
        <div class="flex flex-wrap items-center gap-8">
          <div class="space-y-1 text-center">
            <LitiumLogo variant="symbol" class="size-6" />
            <p class="text-muted-foreground text-xs">Symbol (size-6)</p>
          </div>
          <div class="space-y-1 text-center">
            <LitiumLogo variant="symbol" class="size-8" />
            <p class="text-muted-foreground text-xs">Symbol (size-8)</p>
          </div>
          <div class="space-y-1 text-center">
            <LitiumLogo variant="wordmark" class="h-6" />
            <p class="text-muted-foreground text-xs">Wordmark (h-6)</p>
          </div>
          <div class="space-y-1 text-center">
            <LitiumLogo variant="wordmark" class="h-8" />
            <p class="text-muted-foreground text-xs">Wordmark (h-8)</p>
          </div>
          <div class="space-y-1 text-center">
            <LitiumLogo variant="symbol" class="text-primary size-8" />
            <p class="text-muted-foreground text-xs">Primary color</p>
          </div>
        </div>
      </div>

      <Separator />

      <!-- PoweredBy -->
      <div class="space-y-3">
        <h3 class="text-lg font-medium">PoweredBy</h3>
        <p class="text-muted-foreground text-sm">
          Tenant watermark setting:
          <code class="bg-muted rounded px-1">{{
            tenant?.branding?.watermark ?? 'N/A'
          }}</code>
        </p>
        <div class="flex flex-wrap items-center gap-8">
          <div class="space-y-1 text-center">
            <PoweredBy />
            <p class="text-muted-foreground text-xs">Default (from tenant)</p>
          </div>
          <div class="space-y-1 text-center">
            <PoweredBy variant="full" />
            <p class="text-muted-foreground text-xs">variant="full"</p>
          </div>
          <div class="space-y-1 text-center">
            <PoweredBy variant="minimal" />
            <p class="text-muted-foreground text-xs">variant="minimal"</p>
          </div>
          <div class="space-y-1 text-center">
            <PoweredBy variant="none" />
            <p class="text-muted-foreground text-xs">variant="none" (hidden)</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-8">
          <div class="space-y-1 text-center">
            <PoweredBy variant="full" label="Built with Litium" />
            <p class="text-muted-foreground text-xs">Custom label</p>
          </div>
          <div class="space-y-1 text-center">
            <PoweredBy variant="full" href="https://example.com" />
            <p class="text-muted-foreground text-xs">Custom href</p>
          </div>
        </div>
      </div>

      <Separator />

      <!-- Copyright -->
      <div class="space-y-3">
        <h3 class="text-lg font-medium">Copyright</h3>
        <div class="flex flex-wrap items-center gap-8">
          <div class="space-y-1 text-center">
            <Copyright />
            <p class="text-muted-foreground text-xs">Default</p>
          </div>
        </div>
      </div>

      <Separator />

      <!-- Footer combo example -->
      <div class="space-y-3">
        <h3 class="text-lg font-medium">Footer Example (preview)</h3>
        <div
          class="border-border flex flex-col items-center gap-2 rounded-md border px-4 py-4 text-xs sm:flex-row sm:justify-between"
        >
          <Copyright />
          <PoweredBy />
        </div>
      </div>
    </section>

    <Separator />

    <!-- Locale & Market Switchers -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Locale & Market Switchers</h2>
      <p class="text-muted-foreground text-sm">
        Hidden when only one option is available. Uses tenant's
        <code class="bg-muted rounded px-1">availableLocales</code> and
        <code class="bg-muted rounded px-1">availableMarkets</code>.
      </p>

      <div class="space-y-3">
        <h3 class="text-lg font-medium">LocaleSwitcher</h3>
        <div class="flex flex-wrap items-center gap-8">
          <div class="space-y-1 text-center">
            <LocaleSwitcher />
            <p class="text-muted-foreground text-xs">
              variant="icon" (default)
            </p>
          </div>
          <div class="space-y-1 text-center">
            <LocaleSwitcher variant="text" />
            <p class="text-muted-foreground text-xs">variant="text"</p>
          </div>
          <div class="space-y-1 text-center">
            <LocaleSwitcher variant="inline" />
            <p class="text-muted-foreground text-xs">variant="inline"</p>
          </div>
        </div>
      </div>

      <Separator />

      <div class="space-y-3">
        <h3 class="text-lg font-medium">MarketSwitcher</h3>
        <div class="flex flex-wrap items-center gap-8">
          <div class="space-y-1 text-center">
            <MarketSwitcher />
            <p class="text-muted-foreground text-xs">
              variant="icon" (default)
            </p>
          </div>
          <div class="space-y-1 text-center">
            <MarketSwitcher variant="text" />
            <p class="text-muted-foreground text-xs">variant="text"</p>
          </div>
          <div class="space-y-1 text-center">
            <MarketSwitcher variant="inline" />
            <p class="text-muted-foreground text-xs">variant="inline"</p>
          </div>
        </div>
      </div>
    </section>

    <Separator />
  </div>
</template>
