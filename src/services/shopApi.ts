import type {
  CreateShopProductPayload,
  ShopProduct,
  UploadedImage
} from "../types/shop";

const API_ORIGIN = import.meta.env.VITE_AUTH_API_ORIGIN;

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export async function fetchShopProducts(): Promise<ShopProduct[]> {
  const response = await fetch(`${API_ORIGIN}/shop/products`, {
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
