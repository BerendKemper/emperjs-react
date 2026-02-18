export interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  authorUserId: string | null;
  authorDisplayName: string | null;
  imageId: string | null;
  imageUrl: string | null;
  images: Array<{
    imageId: string;
    imageUrl: string;
  }>;
  tags: string[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProductSortRule {
  field: string;
  direction: `asc` | `desc`;
}

export interface ShopProductsPage {
  page: {
    index: number;
    size: number;
    totalItems: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
  sort: ProductSortRule[];
  data: ShopProduct[];
}

export interface ShopFilterOption {
  value: string;
  count: number;
}

export interface ShopFiltersResponse {
  tags: ShopFilterOption[];
  currencies: ShopFilterOption[];
  authors: Array<ShopFilterOption & { label: string }>;
  updatedAt: number;
  cacheTtlSeconds: number;
}

export interface CreateShopProductPayload {
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  imageIds: string[];
  isActive: boolean;
  tags: string[];
}

export interface UpdateShopProductPayload {
  slug?: string;
  name?: string;
  description?: string | null;
  priceCents?: number;
  currency?: string;
  imageIds?: string[];
  isActive?: boolean;
  tags?: string[];
}

export interface UploadedImage {
  imageId: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

export interface DeleteShopProductResponse {
  deleted: {
    id: string;
    slug: string;
    name: string;
  };
  cleanup: {
    deletedImageMetadataCount: number;
    deletedImageObjectCount: number;
    deletedUnreferencedTags: number;
  };
}

export interface ShopProductResponse {
  product: ShopProduct;
}

export interface ShopProductUpdateResponse {
  product: ShopProduct;
  cleanup: {
    deletedImageMetadataCount: number;
    deletedImageObjectCount: number;
    deletedUnreferencedTags: number;
  };
}
