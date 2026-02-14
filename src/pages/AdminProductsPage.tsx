import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  createShopProduct,
  deleteShopProduct,
  fetchShopProductsPage,
  uploadProductImage
} from "../services/shopApi";
import type { ShopProduct } from "../types/shop";
import { useSession } from "../controls/Auth/useSession";
import "./AdminProductsPage.css";

type StatusTone = `idle` | `saving` | `success` | `error`;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ``)
    .replace(/\s+/g, `-`)
    .replace(/-+/g, `-`)
    .replace(/^-+|-+$/g, ``);
}

function parseTags(value: string): string[] {
  return [...new Set(
    value
      .split(/[\s,]+/)
      .map(tag => tag.replace(/^#+/, ``).trim().toLowerCase())
      .filter(Boolean)
  )];
}

export function AdminProductsPage() {
  const { session, isLoading } = useSession();
  const isAdmin = session?.roles?.includes(`admin`) || session?.roles?.includes(`owner`);

  const [name, setName] = useState(``);
  const [slug, setSlug] = useState(``);
  const [description, setDescription] = useState(``);
  const [price, setPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState(`EUR`);
  const [tagsInput, setTagsInput] = useState(``);
  const [isActive, setIsActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ tone: StatusTone; message: string }>({ tone: `idle`, message: `` });

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const resolvedSlug = useMemo(() => (slug ? slugify(slug) : slugify(name)), [name, slug]);

  const loadProducts = async () => {
    setIsLoadingProducts(true);
    setProductError(null);
    try {
      const response = await fetchShopProductsPage({
        page: 1,
        pageSize: 100,
        sort: `created_at:desc`,
        isActive: 1,
      });
      setProducts(response.data);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to load products.`;
      setProductError(message);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadProducts();
  }, [isAdmin]);

  const resetForm = () => {
    setName(``);
    setSlug(``);
    setDescription(``);
    setPrice(null);
    setCurrency(`EUR`);
    setTagsInput(``);
    setIsActive(true);
    setFile(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!resolvedSlug) {
      setStatus({ tone: `error`, message: `Slug is required.` });
      return;
    }

    if (!name.trim()) {
      setStatus({ tone: `error`, message: `Name is required.` });
      return;
    }

    if (price === null || Number.isNaN(price) || price < 0) {
      setStatus({ tone: `error`, message: `Price must be 0 or more.` });
      return;
    }

    setStatus({ tone: `saving`, message: `Uploading and creating product...` });

    try {
      let imageId: string | null = null;
      if (file) {
        const uploaded = await uploadProductImage(file);
        imageId = uploaded.imageId;
      }

      const created = await createShopProduct({
        slug: resolvedSlug,
        name: name.trim(),
        description: description.trim() || null,
        priceCents: Math.round(price * 100),
        currency: currency.toUpperCase(),
        imageId,
        isActive,
        tags: parseTags(tagsInput),
      });

      setStatus({ tone: `success`, message: `Product '${created.name}' created.` });
      resetForm();
      await loadProducts();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Product creation failed.`;
      setStatus({ tone: `error`, message });
    }
  };

  const handleDeleteProduct = async (product: ShopProduct) => {
    const confirmed = window.confirm(`Delete product '${product.name}' (${product.slug})? This removes tag links and may remove image metadata/object if unused.`);
    if (!confirmed) return;

    setDeletingProductId(product.id);
    setStatus({ tone: `saving`, message: `Deleting '${product.name}'...` });

    try {
      const result = await deleteShopProduct({ id: product.id });
      setStatus({
        tone: `success`,
        message: `Deleted '${result.deleted.name}'. Image metadata removed: ${result.cleanup.deletedImageMetadata ? `yes` : `no`}. Orphan tags removed: ${result.cleanup.deletedOrphanTags}.`,
      });
      await loadProducts();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Delete failed.`;
      setStatus({ tone: `error`, message });
    } finally {
      setDeletingProductId(null);
    }
  };

  if (isLoading) {
    return <section className="admin-products"><p>Checking session...</p></section>;
  }

  if (!isAdmin) {
    return (
      <section className="admin-products">
        <h1>Admin products</h1>
        <p>You need an admin or owner role to manage products.</p>
      </section>
    );
  }

  return (
    <section className="admin-products">
      <header className="admin-products__header">
        <h1>Manage products</h1>
        <p>Create new products and manually delete existing ones.</p>
      </header>

      <form className="admin-products__form" onSubmit={handleSubmit}>
        <h2>Create product</h2>
        <label>
          <span>Name</span>
          <input value={name} onChange={event => setName(event.target.value)} placeholder="Brass Pilot Watch" required />
        </label>

        <label>
          <span>Slug</span>
          <input value={slug} onChange={event => setSlug(event.target.value)} placeholder="auto from name if empty" />
          <small>Resolved: {resolvedSlug || `-`}</small>
        </label>

        <label>
          <span>Description</span>
          <textarea value={description} onChange={event => setDescription(event.target.value)} rows={4} placeholder="Short product story" />
        </label>

        <div className="admin-products__row">
          <label>
            <span>Price</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price ?? ``}
              onChange={event => setPrice(event.target.value ? Number(event.target.value) : null)}
              required
            />
          </label>
          <label>
            <span>Currency</span>
            <input
              value={currency}
              maxLength={3}
              onChange={event => setCurrency(event.target.value.toUpperCase())}
              placeholder="EUR"
              required
            />
          </label>
        </div>

        <label>
          <span>Tags</span>
          <input value={tagsInput} onChange={event => setTagsInput(event.target.value)} placeholder="#watch #18karaat #impressionism" />
          <small>Use spaces or commas. # is optional.</small>
        </label>

        <label>
          <span>Image</span>
          <input type="file" accept="image/*" onChange={event => setFile(event.target.files?.[0] ?? null)} />
        </label>

        <label className="admin-products__checkbox">
          <input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} />
          <span>Product is active</span>
        </label>

        <button type="submit" disabled={status.tone === `saving`}>Create product</button>

        {status.message ? (
          <p className={`admin-products__status admin-products__status--${status.tone}`}>{status.message}</p>
        ) : null}
      </form>

      <section className="admin-products__list">
        <div className="admin-products__list-header">
          <h2>Delete products</h2>
          <button type="button" onClick={() => void loadProducts()} disabled={isLoadingProducts}>Refresh</button>
        </div>

        {isLoadingProducts ? <p>Loading products...</p> : null}
        {productError ? <p className="admin-products__status admin-products__status--error">{productError}</p> : null}

        {!isLoadingProducts && !productError && products.length === 0 ? <p>No products found.</p> : null}

        <ul className="admin-products__items">
          {products.map(product => (
            <li key={product.id} className="admin-products__item">
              <div>
                <strong>{product.name}</strong>
                <p>{product.slug}</p>
                <small>{(product.priceCents / 100).toFixed(2)} {product.currency}</small>
              </div>
              <button
                type="button"
                className="admin-products__delete"
                onClick={() => void handleDeleteProduct(product)}
                disabled={deletingProductId === product.id}
              >
                {deletingProductId === product.id ? `Deleting...` : `Delete`}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
