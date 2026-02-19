export type GeinsImageType = 'product' | 'category' | 'brand' | 'cms';

export const GEINS_IMAGE_SIZES: Record<
  GeinsImageType,
  { folder: string; width: number }[]
> = {
  product: [
    { folder: '100x100', width: 100 },
    { folder: '250x250', width: 250 },
    { folder: '400x400', width: 400 },
    { folder: '800x800', width: 800 },
  ],
  category: [
    { folder: '250x250', width: 250 },
    { folder: '500x500', width: 500 },
    { folder: '1000x1000', width: 1000 },
  ],
  brand: [
    { folder: '250x250', width: 250 },
    { folder: '500x500', width: 500 },
  ],
  cms: [
    { folder: '500x500', width: 500 },
    { folder: '1000x1000', width: 1000 },
    { folder: '2000x2000', width: 2000 },
  ],
};
