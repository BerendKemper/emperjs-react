import "./ShopCard.css";

interface ProductCardProps {
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  tags: string[];
}

function formatPrice(priceCents: number, currency: string): string {
  return new Intl.NumberFormat(`en-US`, {
    style: `currency`,
    currency,
  }).format(priceCents / 100);
}

export function ShopCard({
  name,
  description,
  priceCents,
  currency,
  imageUrl,
  tags,
}: ProductCardProps) {
  return (
    <article className="shop-card">
      {imageUrl ? <img src={imageUrl} alt={name} className="shop-card__img" loading="lazy" /> : <div className="shop-card__placeholder">No image</div>}
      <div className="shop-card__body">
        <h3>{name}</h3>
        {description ? <p className="shop-card__description">{description}</p> : <p className="shop-card__description shop-card__description--empty">No description available.</p>}
        <p className="shop-card__price">{formatPrice(priceCents, currency)}</p>
        <div className="shop-card__tags">
          {tags.length === 0
            ? <span className="shop-card__tag shop-card__tag--muted">untagged</span>
            : tags.map(tag => <span key={tag} className="shop-card__tag">#{tag}</span>)}
        </div>
      </div>
    </article>
  );
}
