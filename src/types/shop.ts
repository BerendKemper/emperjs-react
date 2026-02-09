export interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  imageId: string | null;
  imageUrl: string | null;
  tags: string[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateShopProductPayload {
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  imageId: string | null;
  isActive: boolean;
  tags: string[];
}

export interface UploadedImage {
  imageId: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}
