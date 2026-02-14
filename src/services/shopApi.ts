import type {
  CreateShopProductPayload,
  DeleteShopProductResponse,
  ShopArticleResponse,
  ShopArticleUpdateResponse,
  ShopFiltersResponse,
  ShopProductsPage,
  ShopProduct,
  UpdateShopProductPayload,
  UploadedImage
} from "../types/shop";

const API_ORIGIN = import.meta.env.VITE_AUTH_API_ORIGIN;

export interface ShopProductQuery {
  name?: string;
  tags?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  currency?: string;
  isActive?: 0 | 1;
  page?: number;
  pageSize?: number;
  sort?: string;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

function buildShopProductQueryString(query?: ShopProductQuery): string {
  if (!query) return ``;

  const params = new URLSearchParams();
  const name = query.name?.trim();
  if (name) params.set(`name`, name);

  if (Array.isArray(query.tags)) {
    const normalizedTags = [...new Set(
      query.tags
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean)
    )];
    if (normalizedTags.length > 0) {
      params.set(`tags`, normalizedTags.join(`,`));
    }
  }

  if (typeof query.minPriceCents === `number`) {
    if (!Number.isSafeInteger(query.minPriceCents) || query.minPriceCents < 0) {
      throw new Error(`minPriceCents must be a non-negative safe integer`);
    }
    params.set(`min_price_cents`, String(query.minPriceCents));
  }

  if (typeof query.maxPriceCents === `number`) {
    if (!Number.isSafeInteger(query.maxPriceCents) || query.maxPriceCents < 0) {
      throw new Error(`maxPriceCents must be a non-negative safe integer`);
    }
    params.set(`max_price_cents`, String(query.maxPriceCents));
  }

  if (query.currency?.trim()) {
    params.set(`currency`, query.currency.trim().toUpperCase());
  }

  if (typeof query.isActive === `number`) {
    params.set(`is_active`, String(query.isActive));
  }

  if (typeof query.page === `number`) {
    if (!Number.isSafeInteger(query.page) || query.page < 1) {
      throw new Error(`page must be a positive safe integer`);
    }
    params.set(`page`, String(query.page));
  }

  if (typeof query.pageSize === `number`) {
    if (!Number.isSafeInteger(query.pageSize) || query.pageSize < 1) {
      throw new Error(`pageSize must be a positive safe integer`);
    }
    params.set(`pageSize`, String(query.pageSize));
  }

  if (query.sort?.trim()) {
    params.set(`sort`, query.sort.trim());
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : ``;
}

export async function fetchShopProducts(query?: ShopProductQuery): Promise<ShopProduct[]> {
  const page = await fetchShopProductsPage(query);
  return page.data;
}

export async function fetchShopProductsPage(query?: ShopProductQuery): Promise<ShopProductsPage> {
  const queryString = buildShopProductQueryString(query);
  const response = await fetch(`${API_ORIGIN}/shop/products${queryString}`, {
    credentials: `include`,
  });
  return parseJson<ShopProductsPage>(response);
}

export async function fetchShopFilters(query?: ShopProductQuery): Promise<ShopFiltersResponse> {
  const queryString = buildShopProductQueryString(query);
  const response = await fetch(`${API_ORIGIN}/shop/filters${queryString}`, {
    credentials: `include`,
  });
  return parseJson<ShopFiltersResponse>(response);
}

export async function uploadProductImage(file: File): Promise<UploadedImage> {
  const formData = new FormData();
  formData.append(`file`, file);

  const response = await fetch(`${API_ORIGIN}/shop/images/upload`, {
    method: `POST`,
    credentials: `include`,
    body: formData,
  });

  return parseJson<UploadedImage>(response);
}

export async function createShopProduct(
  payload: CreateShopProductPayload
): Promise<ShopProduct> {
  const response = await fetch(`${API_ORIGIN}/shop/products`, {
    method: `POST`,
    credentials: `include`,
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJson<{ product?: ShopProduct; article?: ShopProduct }>(response);
  return data.product ?? data.article ?? (() => { throw new Error(`Invalid create response`); })();
}

export async function fetchShopArticleBySlug(slug: string): Promise<ShopProduct> {
  const response = await fetch(`${API_ORIGIN}/shop/articles?slug=${encodeURIComponent(slug)}`, {
    credentials: `include`,
  });
  const data = await parseJson<ShopArticleResponse>(response);
  return data.article;
}

export async function createShopArticle(payload: CreateShopProductPayload): Promise<ShopProduct> {
  const response = await fetch(`${API_ORIGIN}/shop/articles`, {
    method: `POST`,
    credentials: `include`,
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJson<ShopArticleResponse>(response);
  return data.article;
}

export async function updateShopArticle(
  selector: { id?: string; slug?: string },
  payload: UpdateShopProductPayload
): Promise<ShopArticleUpdateResponse> {
  const params = new URLSearchParams();
  if (selector.id?.trim()) params.set(`id`, selector.id.trim());
  if (selector.slug?.trim()) params.set(`slug`, selector.slug.trim().toLowerCase());
  if (!params.toString()) {
    throw new Error(`updateShopArticle requires id or slug`);
  }

  const response = await fetch(`${API_ORIGIN}/shop/articles?${params.toString()}`, {
    method: `PATCH`,
    credentials: `include`,
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify(payload),
  });
  return parseJson<ShopArticleUpdateResponse>(response);
}

export async function deleteShopProduct(selector: { id?: string; slug?: string }): Promise<DeleteShopProductResponse> {
  const params = new URLSearchParams();
  if (selector.id?.trim()) params.set(`id`, selector.id.trim());
  if (selector.slug?.trim()) params.set(`slug`, selector.slug.trim().toLowerCase());

  if (!params.toString()) {
    throw new Error(`deleteShopProduct requires id or slug`);
  }

  const response = await fetch(`${API_ORIGIN}/shop/products?${params.toString()}`, {
    method: `DELETE`,
    credentials: `include`,
  });

  return parseJson<DeleteShopProductResponse>(response);
}

export async function deleteShopArticle(selector: { id?: string; slug?: string }): Promise<DeleteShopProductResponse> {
  const params = new URLSearchParams();
  if (selector.id?.trim()) params.set(`id`, selector.id.trim());
  if (selector.slug?.trim()) params.set(`slug`, selector.slug.trim().toLowerCase());

  if (!params.toString()) {
    throw new Error(`deleteShopArticle requires id or slug`);
  }

  const response = await fetch(`${API_ORIGIN}/shop/articles?${params.toString()}`, {
    method: `DELETE`,
    credentials: `include`,
  });

  return parseJson<DeleteShopProductResponse>(response);
}
