import { type FormEvent, useMemo, useState } from "react";
import {
  createShopProduct,
  uploadProductImage
} from "../services/shopApi";
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

  const resolvedSlug = useMemo(() => (slug ? slugify(slug) : slugify(name)), [name, slug]);

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
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Product creation failed.`;
      setStatus({ tone: `error`, message });
    }
  };

  if (isLoading) {
    return <section className="admin-products"><p>Checking session...</p></section>;
  }

  if (!isAdmin) {
    return (
      <section className="admin-products">
        <h1>Admin products</h1>
        <p>You need an admin or owner role to create products.</p>
      </section>
    );
  }

  return (
    <section className="admin-products">
      <header className="admin-products__header">
        <h1>Create product</h1>
        <p>Upload image first, then save product metadata and tags.</p>
      </header>

      <form className="admin-products__form" onSubmit={handleSubmit}>
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
    </section>
  );
}
