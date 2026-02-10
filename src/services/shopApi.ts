import type {
  CreateShopProductPayload,
  ShopProduct,
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

    for (const tag of normalizedTags) {
      params.append(`tags`, tag);
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

  const queryString = params.toString();
  return queryString ? `?${queryString}` : ``;
}

export async function fetchShopProducts(query?: ShopProductQuery): Promise<ShopProduct[]> {
  const queryString = buildShopProductQueryString(query);
  const response = await fetch(`${API_ORIGIN}/shop/products${queryString}`, {
    credentials: `include`,
  });
  const data = await parseJson<{ products: ShopProduct[] }>(response);
  return data.products ?? [];
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

  const data = await parseJson<{ product: ShopProduct }>(response);
  return data.product;
}
