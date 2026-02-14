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
  updatedAt: number;
  cacheTtlSeconds: number;
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

export interface UpdateShopProductPayload {
  slug?: string;
  name?: string;
  description?: string | null;
  priceCents?: number;
  currency?: string;
  imageId?: string | null;
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
    deletedImageMetadata: boolean;
    deletedImageObject: boolean;
    deletedOrphanTags: number;
  };
}

export interface ShopArticleResponse {
  article: ShopProduct;
}

export interface ShopArticleUpdateResponse {
  article: ShopProduct;
  cleanup: {
    deletedImageMetadata: boolean;
    deletedImageObject: boolean;
    deletedOrphanTags: number;
  };
}
