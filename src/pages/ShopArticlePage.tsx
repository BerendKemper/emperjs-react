import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createShopArticle,
  deleteShopArticle,
  fetchShopArticleBySlug,
  updateShopArticle,
  uploadProductImage
} from "../services/shopApi";
import { useSession } from "../controls/Auth/useSession";
import type { ShopProduct } from "../types/shop";
import "./ShopArticlePage.css";

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

export function ShopArticlePage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useSession();
  const isAdmin = session?.roles?.includes(`admin`) || session?.roles?.includes(`owner`);
  const isCreateMode = slug === `new` || location.pathname === `/shop/articles/new`;

  const [article, setArticle] = useState<ShopProduct | null>(null);
  const [status, setStatus] = useState<{ tone: StatusTone; message: string }>({
    tone: isCreateMode ? `idle` : `loading`,
    message: isCreateMode ? `` : `Loading article...`
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
  const [imageId, setImageId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const resolvedSlug = useMemo(() => slugify(slugInput || name), [name, slugInput]);

  useEffect(() => {
    if (isCreateMode) {
      setArticle(null);
      setName(``);
      setSlugInput(``);
      setDescription(``);
      setPrice(null);
      setCurrency(`EUR`);
      setTagsInput(``);
      setIsActive(true);
      setImageId(null);
      setImageUrl(null);
      setFile(null);
      setEditorTab(`edit`);
      setIsEditing(true);
      setStatus({ tone: `idle`, message: `` });
      return;
    }

    let cancelled = false;
    const load = async () => {
      if (!slug) return;
      setStatus({ tone: `loading`, message: `Loading article...` });
      try {
        const loaded = await fetchShopArticleBySlug(slug);
        if (cancelled) return;
        setArticle(loaded);
        setName(loaded.name);
        setSlugInput(loaded.slug);
        setDescription(loaded.description ?? ``);
        setPrice(loaded.priceCents / 100);
        setCurrency(loaded.currency);
        setTagsInput(loaded.tags.join(` `));
        setIsActive(loaded.isActive);
        setImageId(loaded.imageId);
        setImageUrl(loaded.imageUrl);
        setEditorTab(`edit`);
        setStatus({ tone: `idle`, message: `` });
      } catch (caughtError) {
        if (cancelled) return;
        const message = caughtError instanceof Error ? caughtError.message : `Failed to load article`;
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
    if (!isAdmin) return;
    const validationError = validateRequired();
    if (validationError) {
      setStatus({ tone: `error`, message: validationError });
      return;
    }

    setStatus({ tone: `saving`, message: isCreateMode ? `Creating article...` : `Saving article...` });
    try {
      let effectiveImageId = imageId;
      if (file) {
        const uploaded = await uploadProductImage(file);
        effectiveImageId = uploaded.imageId;
        setFile(null);
      }

      const payload = {
        slug: resolvedSlug,
        name: name.trim(),
        description: description.trim(),
        priceCents: Math.round((price ?? 0) * 100),
        currency: currency.trim().toUpperCase(),
        imageId: effectiveImageId,
        isActive,
        tags: parseTags(tagsInput),
      };

      if (isCreateMode) {
        const created = await createShopArticle(payload);
        setStatus({ tone: `success`, message: `Article created` });
        navigate(`/shop/articles/${encodeURIComponent(created.slug)}`, { replace: true });
        return;
      }

      const targetSlug = article?.slug ?? slug;
      if (!targetSlug) throw new Error(`Missing article slug`);
      const updated = await updateShopArticle({ slug: targetSlug }, payload);
      setArticle(updated.article);
      setName(updated.article.name);
      setSlugInput(updated.article.slug);
      setDescription(updated.article.description ?? ``);
      setPrice(updated.article.priceCents / 100);
      setCurrency(updated.article.currency);
      setTagsInput(updated.article.tags.join(` `));
      setIsActive(updated.article.isActive);
      setImageId(updated.article.imageId);
      setImageUrl(updated.article.imageUrl);
      setStatus({ tone: `success`, message: `Article updated` });
      setEditorTab(`edit`);
      setIsEditing(false);

      if (updated.article.slug !== targetSlug) {
        navigate(`/shop/articles/${encodeURIComponent(updated.article.slug)}`, { replace: true });
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Save failed`;
      setStatus({ tone: `error`, message });
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) return;
    const targetSlug = article?.slug ?? slug;
    if (!targetSlug) return;
    if (!window.confirm(`Delete article '${targetSlug}'?`)) return;

    setStatus({ tone: `saving`, message: `Deleting article...` });
    try {
      await deleteShopArticle({ slug: targetSlug });
      navigate(`/shop`, { replace: true });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Delete failed`;
      setStatus({ tone: `error`, message });
    }
  };

  if (!isCreateMode && status.tone === `loading`) {
    return <section className="shop-article"><p>Loading article...</p></section>;
  }

  if (!isCreateMode && status.tone === `error` && !article) {
    return <section className="shop-article"><p className="shop-article__error">{status.message}</p></section>;
  }

  if (isCreateMode && !isAdmin) {
    return <section className="shop-article"><p className="shop-article__error">Only admins can create articles.</p></section>;
  }

  const editing = isCreateMode || isEditing;
  const draftTags = parseTags(tagsInput);
  const previewArticle: ShopProduct = {
    id: article?.id ?? `draft`,
    slug: resolvedSlug || article?.slug || `draft`,
    name: name.trim() || `Untitled article`,
    description: description.trim() || null,
    priceCents: Math.round((price ?? 0) * 100),
    currency: (currency.trim().toUpperCase() || `EUR`).slice(0, 3),
    imageId,
    imageUrl,
    tags: draftTags,
    isActive,
    createdAt: article?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };

  return (
    <section className="shop-article">
      <header className="shop-article__header">
        <h1>{editing ? `Article editor` : article?.name ?? `Article`}</h1>
        {status.message ? <p className={`shop-article__status shop-article__status--${status.tone}`}>{status.message}</p> : null}
        {!isCreateMode && isAdmin ? (
          <div className="shop-article__actions">
            <button type="button" onClick={() => setIsEditing(current => !current)}>
              {isEditing ? `Cancel edit` : `Edit article`}
            </button>
            <button type="button" className="shop-article__delete" onClick={handleDelete}>Delete article</button>
          </div>
        ) : null}
      </header>

      <article className="shop-article__content">
        {editing ? (
          <>
            {isAdmin ? (
              <div className="shop-article__tabs">
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
              <div className="shop-article__editor">
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
                <div className="shop-article__row">
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
                  <span>Image</span>
                  {imageUrl ? <img src={imageUrl} alt={name || `article image`} className="shop-article__preview" /> : null}
                  <input type="file" accept="image/*" onChange={event => setFile(event.target.files?.[0] ?? null)} />
                  {imageId ? <button type="button" onClick={() => { setImageId(null); setImageUrl(null); }}>Remove image</button> : null}
                </label>
                <label className="shop-article__checkbox">
                  <input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} />
                  <span>Active</span>
                </label>
                <button type="button" onClick={() => void handleSave()} disabled={status.tone === `saving`}>
                  {isCreateMode ? `Create article` : `Save changes`}
                </button>
              </div>
            ) : (
              <div className="shop-article__viewer">
                {previewArticle.imageUrl ? <img src={previewArticle.imageUrl} alt={previewArticle.name} className="shop-article__hero" /> : null}
                <p className="shop-article__meta">{`${(previewArticle.priceCents / 100).toFixed(2)} ${previewArticle.currency}`}</p>
                <p>{previewArticle.description ?? `No description.`}</p>
                <div className="shop-article__tags">
                  {previewArticle.tags.length > 0 ? previewArticle.tags.map(tag => <span key={tag}>#{tag}</span>) : <span>#untagged</span>}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="shop-article__viewer">
            {article?.imageUrl ? <img src={article.imageUrl} alt={article.name} className="shop-article__hero" /> : null}
            <p className="shop-article__meta">{article ? `${(article.priceCents / 100).toFixed(2)} ${article.currency}` : ``}</p>
            <p>{article?.description}</p>
            <div className="shop-article__tags">
              {article?.tags.map(tag => <span key={tag}>#{tag}</span>)}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
