import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createShopProduct,
  deleteShopProduct,
  fetchShopProductBySlug,
  updateShopProduct,
  uploadProductImage
} from "../services/shopApi";
import { useSession } from "../controls/Auth/useSession";
import type { ShopProduct } from "../types/shop";
import "./ShopProductPage.css";

type StatusTone = `idle` | `loading` | `saving` | `success` | `error`;
type EditorTab = `edit` | `preview`;

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

export function ShopProductPage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useSession();
  const isOwner = Boolean(session?.roles?.includes(`owner`));
  const isAdmin = session?.roles?.includes(`admin`) || isOwner;
  const canManageProducts = isAdmin || session?.roles?.includes(`seller`);
  const isCreateMode = slug === `new` || location.pathname === `/shop/products/new`;

  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [status, setStatus] = useState<{ tone: StatusTone; message: string }>({
    tone: isCreateMode ? `idle` : `loading`,
    message: isCreateMode ? `` : `Loading product...`
  });
  const [isEditing, setIsEditing] = useState(isCreateMode);
  const [file, setFile] = useState<File | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>(`edit`);

  const [name, setName] = useState(``);
  const [slugInput, setSlugInput] = useState(``);
  const [description, setDescription] = useState(``);
  const [price, setPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState(`EUR`);
  const [tagsInput, setTagsInput] = useState(``);
  const [isActive, setIsActive] = useState(true);
  const [productImages, setProductImages] = useState<Array<{ imageId: string; imageUrl: string }>>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canEditCurrentProduct = Boolean(
    session?.userId &&
    (isAdmin || (product?.authorUserId && product.authorUserId === session.userId))
  );
  const isProductAuthor = Boolean(
    session?.userId &&
    product?.authorUserId &&
    product.authorUserId === session.userId
  );
  const canDeleteCurrentProduct = canEditCurrentProduct && isOwner;
  const canArchiveCurrentProduct = Boolean(product && (isOwner || isProductAuthor));

  const resolvedSlug = useMemo(() => slugify(slugInput || name), [name, slugInput]);

  useEffect(() => {
    if (isCreateMode) {
      setProduct(null);
      setName(``);
      setSlugInput(``);
      setDescription(``);
      setPrice(null);
      setCurrency(`EUR`);
      setTagsInput(``);
      setIsActive(true);
      setProductImages([]);
      setActiveImageIndex(0);
      setFile(null);
      setEditorTab(`edit`);
      setIsEditing(true);
      setStatus({ tone: `idle`, message: `` });
      return;
    }

    let cancelled = false;
    const load = async () => {
      if (!slug) return;
      setStatus({ tone: `loading`, message: `Loading product...` });
      try {
        const loaded = await fetchShopProductBySlug(slug);
        if (cancelled) return;
        setProduct(loaded);
        setName(loaded.name);
        setSlugInput(loaded.slug);
        setDescription(loaded.description ?? ``);
        setPrice(loaded.priceCents / 100);
        setCurrency(loaded.currency);
        setTagsInput(loaded.tags.join(` `));
        setIsActive(loaded.isActive);
        setProductImages(
          loaded.images && loaded.images.length > 0
            ? loaded.images
            : (loaded.imageId && loaded.imageUrl ? [{ imageId: loaded.imageId, imageUrl: loaded.imageUrl }] : [])
        );
        setActiveImageIndex(0);
        setEditorTab(`edit`);
        setStatus({ tone: `idle`, message: `` });
      } catch (caughtError) {
        if (cancelled) return;
        const message = caughtError instanceof Error ? caughtError.message : `Failed to load product`;
        setStatus({ tone: `error`, message });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isCreateMode, slug]);

  const validateRequired = (): string | null => {
    if (!resolvedSlug) return `Slug is required`;
    if (!name.trim()) return `Name is required`;
    if (!description.trim()) return `Description is required`;
    if (price === null || Number.isNaN(price) || price < 0) return `Price must be 0 or more`;
    if (!currency.trim() || currency.trim().length !== 3) return `Currency must be a 3-letter code`;
    return null;
  };

  const handleSave = async () => {
    if (!canManageProducts) return;
    const validationError = validateRequired();
    if (validationError) {
      setStatus({ tone: `error`, message: validationError });
      return;
    }

    setStatus({ tone: `saving`, message: isCreateMode ? `Creating product...` : `Saving product...` });
    try {
      let effectiveImages = [...productImages];
      if (file) {
        const uploaded = await uploadProductImage(file);
        effectiveImages = [...effectiveImages, { imageId: uploaded.imageId, imageUrl: uploaded.url }];
        setFile(null);
      }

      if (effectiveImages.length < 1) {
        throw new Error(`At least one image is required`);
      }

      const payload = {
        slug: resolvedSlug,
        name: name.trim(),
        description: description.trim(),
        priceCents: Math.round((price ?? 0) * 100),
        currency: currency.trim().toUpperCase(),
        imageIds: effectiveImages.map(image => image.imageId),
        isActive,
        tags: parseTags(tagsInput),
      };

      if (isCreateMode) {
        const created = await createShopProduct(payload);
        setStatus({ tone: `success`, message: `Product created` });
        navigate(`/shop/products/${encodeURIComponent(created.slug)}`, { replace: true });
        return;
      }

      const targetSlug = product?.slug ?? slug;
      if (!targetSlug) throw new Error(`Missing product slug`);
      const updated = await updateShopProduct({ slug: targetSlug }, payload);
      setProduct(updated.product);
      setName(updated.product.name);
      setSlugInput(updated.product.slug);
      setDescription(updated.product.description ?? ``);
      setPrice(updated.product.priceCents / 100);
      setCurrency(updated.product.currency);
      setTagsInput(updated.product.tags.join(` `));
      setIsActive(updated.product.isActive);
      setProductImages(updated.product.images ?? []);
      setActiveImageIndex(0);
      setStatus({ tone: `success`, message: `Product updated` });
      setEditorTab(`edit`);
      setIsEditing(false);

      if (updated.product.slug !== targetSlug) {
        navigate(`/shop/products/${encodeURIComponent(updated.product.slug)}`, { replace: true });
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Save failed`;
      setStatus({ tone: `error`, message });
    }
  };

  const handleDelete = async () => {
    if (!canDeleteCurrentProduct) return;
    const targetSlug = product?.slug ?? slug;
    if (!targetSlug) return;
    if (!window.confirm(`Delete product '${targetSlug}'?`)) return;

    setStatus({ tone: `saving`, message: `Deleting product...` });
    try {
      await deleteShopProduct({ slug: targetSlug });
      navigate(`/shop`, { replace: true });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Delete failed`;
      setStatus({ tone: `error`, message });
    }
  };

  const handleArchive = async () => {
    if (!canArchiveCurrentProduct) return;
    const targetSlug = product?.slug ?? slug;
    if (!targetSlug || !product?.isActive) return;
    if (!window.confirm(`Archive product '${targetSlug}'?`)) return;

    setStatus({ tone: `saving`, message: `Archiving product...` });
    try {
      const updated = await updateShopProduct({ slug: targetSlug }, { isActive: false });
      setProduct(updated.product);
      setIsActive(updated.product.isActive);
      setStatus({ tone: `success`, message: `Product archived` });
      setIsEditing(false);
      setEditorTab(`edit`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Archive failed`;
      setStatus({ tone: `error`, message });
    }
  };

  if (!isCreateMode && status.tone === `loading`) {
    return <section className="shop-product"><p>Loading product...</p></section>;
  }

  if (!isCreateMode && status.tone === `error` && !product) {
    return <section className="shop-product"><p className="shop-product__error">{status.message}</p></section>;
  }

  if (isCreateMode && !canManageProducts) {
    return <section className="shop-product"><p className="shop-product__error">Only admin, owner, or seller users can create products.</p></section>;
  }

  const editing = isCreateMode || isEditing;
  const draftTags = parseTags(tagsInput);
  const clampedActiveImageIndex = productImages.length > 0
    ? Math.min(activeImageIndex, productImages.length - 1)
    : 0;
  const activeImage = productImages[clampedActiveImageIndex] ?? null;

  const showNextImage = () => {
    if (productImages.length < 2) return;
    setActiveImageIndex(current => (current + 1) % productImages.length);
  };

  const showPrevImage = () => {
    if (productImages.length < 2) return;
    setActiveImageIndex(current => (current - 1 + productImages.length) % productImages.length);
  };

  const handleGalleryTouchStart = (clientX: number) => {
    touchStartXRef.current = clientX;
  };

  const handleGalleryTouchEnd = (clientX: number) => {
    const start = touchStartXRef.current;
    touchStartXRef.current = null;
    if (start === null) return;
    const deltaX = clientX - start;
    if (Math.abs(deltaX) < 40) return;
    if (deltaX < 0) {
      showNextImage();
      return;
    }
    showPrevImage();
  };

  const setPendingFile = (nextFile: File | null) => {
    setFile(nextFile);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const previewProduct: ShopProduct = {
    id: product?.id ?? `draft`,
    slug: resolvedSlug || product?.slug || `draft`,
    name: name.trim() || `Untitled product`,
    description: description.trim() || null,
    priceCents: Math.round((price ?? 0) * 100),
    currency: (currency.trim().toUpperCase() || `EUR`).slice(0, 3),
    authorUserId: product?.authorUserId ?? session?.userId ?? null,
    authorDisplayName: product?.authorDisplayName ?? session?.displayName ?? null,
    imageId: activeImage?.imageId ?? null,
    imageUrl: activeImage?.imageUrl ?? null,
    images: productImages,
    tags: draftTags,
    isActive,
    createdAt: product?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };

  return (
    <section className="shop-product">
      <header className="shop-product__header">
        <h1>{editing ? `Product editor` : product?.name ?? `Product`}</h1>
        {status.message ? <p className={`shop-product__status shop-product__status--${status.tone}`}>{status.message}</p> : null}
        {!isCreateMode && canEditCurrentProduct ? (
          <div className="shop-product__actions">
            <button type="button" onClick={() => setIsEditing(current => !current)}>
              {isEditing ? `Cancel edit` : `Edit product`}
            </button>
            {canDeleteCurrentProduct ? (
              <button type="button" className="shop-product__delete" onClick={handleDelete}>Delete product</button>
            ) : null}
            {canArchiveCurrentProduct ? (
              <button
                type="button"
                className="shop-product__archive"
                onClick={handleArchive}
                disabled={!product?.isActive}
              >
                {product?.isActive ? `Archive product` : `Archived`}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <article className="shop-product__content">
        {editing ? (
          <>
            {canManageProducts ? (
              <div className="shop-product__tabs">
                <button
                  type="button"
                  className={editorTab === `edit` ? `is-active` : ``}
                  onClick={() => setEditorTab(`edit`)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={editorTab === `preview` ? `is-active` : ``}
                  onClick={() => setEditorTab(`preview`)}
                >
                  Preview
                </button>
              </div>
            ) : null}
            {editorTab === `edit` ? (
              <div className="shop-product__editor">
                <label>
                  <span>Name *</span>
                  <input value={name} onChange={event => setName(event.target.value)} />
                </label>
                <label>
                  <span>Slug *</span>
                  <input value={slugInput} onChange={event => setSlugInput(event.target.value)} />
                  <small>Resolved: {resolvedSlug || `-`}</small>
                </label>
                <label>
                  <span>Description *</span>
                  <textarea rows={8} value={description} onChange={event => setDescription(event.target.value)} />
                </label>
                <div className="shop-product__row">
                  <label>
                    <span>Price *</span>
                    <input type="number" min={0} step="0.01" value={price ?? ``} onChange={event => setPrice(event.target.value ? Number(event.target.value) : null)} />
                  </label>
                  <label>
                    <span>Currency *</span>
                    <input value={currency} maxLength={3} onChange={event => setCurrency(event.target.value.toUpperCase())} />
                  </label>
                </div>
                <label>
                  <span>Tags</span>
                  <input value={tagsInput} onChange={event => setTagsInput(event.target.value)} placeholder="#tag1 #tag2" />
                </label>
                <label>
                  <span>Images</span>
                  {activeImage?.imageUrl ? <img src={activeImage.imageUrl} alt={name || `product image`} className="shop-product__preview" /> : null}
                  {productImages.length > 0 ? (
                    <div className="shop-product__image-list">
                      {productImages.map((image, index) => (
                        <button
                          key={image.imageId}
                          type="button"
                          className={index === clampedActiveImageIndex ? `is-active` : ``}
                          onClick={() => setActiveImageIndex(index)}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div
                    className={`shop-product__upload-dropzone ${isDragActive ? `is-drag-active` : ``}`}
                    onDragOver={event => {
                      event.preventDefault();
                      setIsDragActive(true);
                    }}
                    onDragLeave={event => {
                      event.preventDefault();
                      setIsDragActive(false);
                    }}
                    onDrop={event => {
                      event.preventDefault();
                      setIsDragActive(false);
                      const dropped = event.dataTransfer.files?.[0] ?? null;
                      if (dropped && dropped.type.startsWith(`image/`)) {
                        setPendingFile(dropped);
                      }
                    }}
                  >
                    <p className="shop-product__upload-icon" aria-hidden="true">+</p>
                    <p className="shop-product__upload-title">Drag an image here</p>
                    <p className="shop-product__upload-subtitle">
                      or{` `}
                      <span
                        role="button"
                        tabIndex={0}
                        className="shop-product__upload-link"
                        onClick={openFileDialog}
                        onKeyDown={event => {
                          if (event.key === `Enter` || event.key === ` `) {
                            event.preventDefault();
                            openFileDialog();
                          }
                        }}
                      >
                        Upload a file
                      </span>
                    </p>
                    {file ? <p className="shop-product__upload-filename">{file.name}</p> : null}
                    <input
                      ref={fileInputRef}
                      className="shop-product__upload-input"
                      type="file"
                      accept="image/*"
                      onChange={event => setPendingFile(event.target.files?.[0] ?? null)}
                    />
                  </div>
                  {activeImage ? (
                    <button
                      type="button"
                      onClick={() => {
                        setProductImages(current => {
                          const next = current.filter(image => image.imageId !== activeImage.imageId);
                          if (next.length === 0) {
                            setActiveImageIndex(0);
                          } else if (clampedActiveImageIndex >= next.length) {
                            setActiveImageIndex(next.length - 1);
                          }
                          return next;
                        });
                      }}
                    >
                      Remove selected image
                    </button>
                  ) : null}
                </label>
                <label className="shop-product__checkbox">
                  <input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} />
                  <span>Active</span>
                </label>
                <button type="button" onClick={() => void handleSave()} disabled={status.tone === `saving`}>
                  {isCreateMode ? `Create product` : `Save changes`}
                </button>
              </div>
            ) : (
              <div className="shop-product__viewer">
                {previewProduct.imageUrl ? (
                  <div
                    className="shop-product__gallery"
                    onTouchStart={event => handleGalleryTouchStart(event.changedTouches[0]?.clientX ?? 0)}
                    onTouchEnd={event => handleGalleryTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
                  >
                    <img src={previewProduct.imageUrl} alt={previewProduct.name} className="shop-product__hero" />
                    {previewProduct.images.length > 1 ? (
                      <div className="shop-product__gallery-controls">
                        <button type="button" onClick={showPrevImage}>Prev</button>
                        <span>{`${clampedActiveImageIndex + 1} / ${previewProduct.images.length}`}</span>
                        <button type="button" onClick={showNextImage}>Next</button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <p className="shop-product__meta">{`${(previewProduct.priceCents / 100).toFixed(2)} ${previewProduct.currency}`}</p>
                <p className="shop-product__meta">{`Author: ${previewProduct.authorDisplayName ?? `Unknown`}`}</p>
                <p>{previewProduct.description ?? `No description.`}</p>
                <div className="shop-product__tags">
                  {previewProduct.tags.length > 0 ? previewProduct.tags.map(tag => <span key={tag}>#{tag}</span>) : <span>#untagged</span>}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="shop-product__viewer">
            {activeImage?.imageUrl ? (
              <div
                className="shop-product__gallery"
                onTouchStart={event => handleGalleryTouchStart(event.changedTouches[0]?.clientX ?? 0)}
                onTouchEnd={event => handleGalleryTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
              >
                <img src={activeImage.imageUrl} alt={product?.name ?? `product image`} className="shop-product__hero" />
                {(product?.images.length ?? 0) > 1 ? (
                  <div className="shop-product__gallery-controls">
                    <button type="button" onClick={showPrevImage}>Prev</button>
                    <span>{`${clampedActiveImageIndex + 1} / ${product?.images.length ?? 0}`}</span>
                    <button type="button" onClick={showNextImage}>Next</button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <p className="shop-product__meta">{product ? `${(product.priceCents / 100).toFixed(2)} ${product.currency}` : ``}</p>
            <p className="shop-product__meta">{`Author: ${product?.authorDisplayName ?? `Unknown`}`}</p>
            <p>{product?.description}</p>
            <div className="shop-product__tags">
              {product?.tags.map(tag => <span key={tag}>#{tag}</span>)}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
