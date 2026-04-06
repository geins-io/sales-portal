export interface SavedListItem {
  id: string;
  productId: number;
  sku: string;
  name: string;
  articleNumber: string;
  quantity: number;
  unitPrice: number;
  unitPriceFormatted: string;
  imageUrl?: string;
}

export interface SavedList {
  id: string;
  userId: string;
  name: string;
  description?: string;
  items: SavedListItem[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
