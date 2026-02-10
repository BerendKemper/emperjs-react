import { useEffect, useMemo, useState } from "react";
import { fetchShopProducts } from "../../services/shopApi";
import type { ShopProduct } from "../../types/shop";
import { ShopCard } from "../ShopCard/ShopCard";
import "./Shop.css";

type SortKey = `date` | `priceAsc` | `priceDesc` | `name`;
type AppliedFilters = {
  search: string;
  selectedTags: string[];
};

export function Shop() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [allProducts, setAllProducts] = useState<ShopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draftSearch, setDraftSearch] = useState(``);
  const [draftSelectedTags, setDraftSelectedTags] = useState<string[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    search: ``,
    selectedTags: [],
  });
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>(`date`);

  useEffect(() => {
    const loadAllProductsForTagFacets = async () => {
      try {
        const data = await fetchShopProducts();
        setAllProducts(data);
      } catch {
        setAllProducts([]);
      }
    };

    void loadAllProductsForTagFacets();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchShopProducts({
          name: appliedFilters.search,
          tags: appliedFilters.selectedTags,
        });

        if (!isCancelled) {
          setProducts(data);
        }
      } catch (caughtError) {
        if (!isCancelled) {
          const message = caughtError instanceof Error ? caughtError.message : `Failed to load products`;
          setError(message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [appliedFilters]);

  const availableTags = useMemo(() => {
    const allTags = allProducts.flatMap(product => product.tags);
    return [...new Set(allTags)].sort((a, b) => a.localeCompare(b));
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    const filtered = products
      .filter(product => (minPrice !== null ? product.priceCents >= minPrice * 100 : true))
      .filter(product => (maxPrice !== null ? product.priceCents <= maxPrice * 100 : true));

    filtered.sort((a, b) => {
      if (sortBy === `priceAsc`) return a.priceCents - b.priceCents;
      if (sortBy === `priceDesc`) return b.priceCents - a.priceCents;
      if (sortBy === `name`) return a.name.localeCompare(b.name);
      return b.createdAt - a.createdAt;
    });

    return filtered;
  }, [maxPrice, minPrice, products, sortBy]);

  const toggleTag = (tag: string) => {
    setDraftSelectedTags(current => (current.includes(tag) ? current.filter(value => value !== tag) : [...current, tag]));
  };

  const normalizeTagSelection = (tags: string[]): string[] => [...new Set(tags)].sort((a, b) => a.localeCompare(b));

  const hasPendingFilterChanges = useMemo(() => {
    const normalizedDraftTags = normalizeTagSelection(draftSelectedTags);
    const normalizedAppliedTags = normalizeTagSelection(appliedFilters.selectedTags);
    return draftSearch.trim() !== appliedFilters.search || normalizedDraftTags.join(`,`) !== normalizedAppliedTags.join(`,`);
  }, [appliedFilters.search, appliedFilters.selectedTags, draftSearch, draftSelectedTags]);

  const applyFilters = () => {
    setAppliedFilters({
      search: draftSearch.trim(),
      selectedTags: normalizeTagSelection(draftSelectedTags),
    });
  };

  const clearFilters = () => {
    setDraftSearch(``);
    setDraftSelectedTags([]);
    setAppliedFilters({ search: ``, selectedTags: [] });
    setMinPrice(null);
    setMaxPrice(null);
    setSortBy(`date`);
  };

  return (
    <section className="shop-view">
      <header className="shop-view__header">
        <h1>Shop collection</h1>
        <p>Browse all active products and refine with tags, search, and price.</p>
      </header>

      <div className="shop-view__layout">
        <aside className="shop-filters">
          <div className="shop-filters__row">
            <label htmlFor="shop-search">Search</label>
            <input
              id="shop-search"
              value={draftSearch}
              onChange={event => setDraftSearch(event.target.value)}
              onKeyDown={event => {
                if (event.key === `Enter`) {
                  applyFilters();
                }
              }}
              placeholder="Search by product name"
            />
          </div>

          <div className="shop-filters__row">
            <label htmlFor="shop-min">Min price</label>
            <input
              id="shop-min"
              type="number"
              min={0}
              value={minPrice ?? ``}
              onChange={event => setMinPrice(event.target.value ? Number(event.target.value) : null)}
              placeholder="0"
            />
          </div>

          <div className="shop-filters__row">
            <label htmlFor="shop-max">Max price</label>
            <input
              id="shop-max"
              type="number"
              min={0}
              value={maxPrice ?? ``}
              onChange={event => setMaxPrice(event.target.value ? Number(event.target.value) : null)}
              placeholder="999"
            />
          </div>

          <div className="shop-filters__row">
            <label htmlFor="shop-sort">Sort</label>
            <select id="shop-sort" value={sortBy} onChange={event => setSortBy(event.target.value as SortKey)}>
              <option value="date">Newest</option>
              <option value="priceAsc">Price low to high</option>
              <option value="priceDesc">Price high to low</option>
              <option value="name">Name</option>
            </select>
          </div>

          <div className="shop-filters__row shop-filters__row--tags">
            <p>Tags</p>
            <div className="shop-filters__tags">
              {availableTags.length === 0 ? <span className="shop-filters__empty">No tags available yet.</span> : availableTags.map(tag => (
                <button
                  type="button"
                  key={tag}
                  className={draftSelectedTags.includes(tag) ? `is-active` : ``}
                  onClick={() => toggleTag(tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          <div className="shop-filters__actions">
            <button type="button" onClick={applyFilters} disabled={!hasPendingFilterChanges || isLoading}>
              {isLoading ? `Applying...` : `Apply filters`}
            </button>
            <button type="button" onClick={clearFilters}>Reset filters</button>
          </div>
          {hasPendingFilterChanges ? <p className="shop-filters__hint">You changed filters. Click Apply filters to refresh results.</p> : null}
        </aside>

        <section className="shop-results">
          {isLoading ? <p className="shop-results__state">Loading products...</p> : null}
          {error ? <p className="shop-results__state shop-results__state--error">{error}</p> : null}
          {!isLoading && !error && filteredProducts.length === 0 ? <p className="shop-results__state">No products match your filters.</p> : null}

          <div className="shop-results__grid">
            {filteredProducts.map(product => (
              <ShopCard
                key={product.id}
                name={product.name}
                description={product.description}
                priceCents={product.priceCents}
                currency={product.currency}
                imageUrl={product.imageUrl}
                tags={product.tags}
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
