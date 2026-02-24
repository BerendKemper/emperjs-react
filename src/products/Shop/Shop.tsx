import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchShopFilters, fetchShopProductsPage } from "../../services/shopApi";
import type { ShopFilterOption, ShopProduct } from "../../types/shop";
import {
  normalizeSelection,
  parseCsvParam,
  parseNullableNonNegativeIntParam,
  parsePositiveIntParam
} from "../../utils/searchParams";
import { ShopCard } from "../ShopCard/ShopCard";
import "./Shop.css";

type SortKey = `date` | `priceAsc` | `priceDesc` | `name` | `priceCurrency` | `priceUpdated`;

type AppliedFilters = {
  search: string;
  selectedTags: string[];
  selectedAuthorUserIds: string[];
  minPriceCents: number | null;
  maxPriceCents: number | null;
  sortBy: SortKey;
  page: number;
  pageSize: number;
};

type PageState = {
  index: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

const FILTERS_CACHE_KEY = `shop:filters:v1`;
const FILTERS_CACHE_TTL_MS = 10 * 60 * 1000;

const DEFAULT_PAGE_STATE: PageState = {
  index: 1,
  size: 24,
  totalItems: 0,
  totalPages: 0,
  hasPrev: false,
  hasNext: false,
};

const SORT_TO_QUERY: Record<SortKey, string> = {
  date: `created_at:desc`,
  priceAsc: `price_cents:asc,updated_at:desc`,
  priceDesc: `price_cents:desc,updated_at:desc`,
  name: `name:asc,updated_at:desc`,
  priceCurrency: `price_cents:asc,currency:asc`,
  priceUpdated: `price_cents:asc,updated_at:desc`,
};

const VALID_SORT_KEYS = new Set<SortKey>([
  `date`,
  `priceAsc`,
  `priceDesc`,
  `name`,
  `priceCurrency`,
  `priceUpdated`
]);

function normalizeTagSelection(tags: string[]): string[] {
  return normalizeSelection(tags, { lowercase: true });
}

function normalizeIdSelection(values: string[]): string[] {
  return normalizeSelection(values, { lowercase: false });
}

function parseSortKey(raw: string | null): SortKey {
  if (!raw) return `date`;
  return VALID_SORT_KEYS.has(raw as SortKey) ? (raw as SortKey) : `date`;
}

function parseAppliedFiltersFromSearchParams(searchParams: URLSearchParams): AppliedFilters {
  const tagsRaw = searchParams.get(`tags`);
  const tags = tagsRaw
    ? parseCsvParam(tagsRaw, { lowercase: true })
    : [];
  const authorsRaw = searchParams.get(`authors`);
  const authorUserIds = authorsRaw
    ? parseCsvParam(authorsRaw, { lowercase: false })
    : [];

  return {
    search: searchParams.get(`search`)?.trim() ?? ``,
    selectedTags: tags,
    selectedAuthorUserIds: authorUserIds,
    minPriceCents: parseNullableNonNegativeIntParam(searchParams.get(`minPriceCents`)),
    maxPriceCents: parseNullableNonNegativeIntParam(searchParams.get(`maxPriceCents`)),
    sortBy: parseSortKey(searchParams.get(`sortBy`)),
    page: parsePositiveIntParam(searchParams.get(`page`), 1),
    pageSize: parsePositiveIntParam(searchParams.get(`pageSize`), 24),
  };
}

function buildSearchParamsFromAppliedFilters(filters: AppliedFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search) params.set(`search`, filters.search);
  if (filters.selectedTags.length > 0) params.set(`tags`, filters.selectedTags.join(`,`));
  if (filters.selectedAuthorUserIds.length > 0) params.set(`authors`, filters.selectedAuthorUserIds.join(`,`));
  if (filters.minPriceCents !== null) params.set(`minPriceCents`, String(filters.minPriceCents));
  if (filters.maxPriceCents !== null) params.set(`maxPriceCents`, String(filters.maxPriceCents));
  if (filters.sortBy !== `date`) params.set(`sortBy`, filters.sortBy);
  if (filters.page !== 1) params.set(`page`, String(filters.page));
  if (filters.pageSize !== 24) params.set(`pageSize`, String(filters.pageSize));

  return params;
}

function areFiltersEqual(a: AppliedFilters, b: AppliedFilters): boolean {
  return (
    a.search === b.search &&
    a.selectedTags.join(`,`) === b.selectedTags.join(`,`) &&
    a.selectedAuthorUserIds.join(`,`) === b.selectedAuthorUserIds.join(`,`) &&
    a.minPriceCents === b.minPriceCents &&
    a.maxPriceCents === b.maxPriceCents &&
    a.sortBy === b.sortBy &&
    a.page === b.page &&
    a.pageSize === b.pageSize
  );
}

function normalizePriceToCents(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) return null;
  if (value < 0) return 0;
  return Math.round(value * 100);
}

function sortTagOptionsByCount(tags: ShopFilterOption[]): ShopFilterOption[] {
  return [...tags].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.value.localeCompare(b.value);
  });
}

function readCachedTags(): ShopFilterOption[] {
  try {
    const raw = sessionStorage.getItem(FILTERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { tags?: ShopFilterOption[]; expiresAt?: number };
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) return [];
    return Array.isArray(parsed.tags) ? sortTagOptionsByCount(parsed.tags) : [];
  } catch {
    return [];
  }
}

function writeCachedTags(tags: ShopFilterOption[]): void {
  try {
    sessionStorage.setItem(
      FILTERS_CACHE_KEY,
      JSON.stringify({
        tags,
        expiresAt: Date.now() + FILTERS_CACHE_TTL_MS,
      })
    );
  } catch {
    // Ignore cache write failures
  }
}

export function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = useMemo(
    () => parseAppliedFiltersFromSearchParams(searchParams),
    [searchParams]
  );

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [pageState, setPageState] = useState<PageState>(DEFAULT_PAGE_STATE);
  const [availableTags, setAvailableTags] = useState<ShopFilterOption[]>(readCachedTags);
  const [availableAuthors, setAvailableAuthors] = useState<Array<ShopFilterOption & { label: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState(``);
  const [authorSearch, setAuthorSearch] = useState(``);

  const [draftSearch, setDraftSearch] = useState(initialFilters.search);
  const [draftSelectedTags, setDraftSelectedTags] = useState<string[]>(initialFilters.selectedTags);
  const [draftSelectedAuthorUserIds, setDraftSelectedAuthorUserIds] = useState<string[]>(initialFilters.selectedAuthorUserIds);
  const [draftMinPrice, setDraftMinPrice] = useState<number | null>(
    initialFilters.minPriceCents !== null ? initialFilters.minPriceCents / 100 : null
  );
  const [draftMaxPrice, setDraftMaxPrice] = useState<number | null>(
    initialFilters.maxPriceCents !== null ? initialFilters.maxPriceCents / 100 : null
  );
  const [draftSortBy, setDraftSortBy] = useState<SortKey>(initialFilters.sortBy);
  const [draftPageSize, setDraftPageSize] = useState(initialFilters.pageSize);

  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(initialFilters);

  useEffect(() => {
    const fromUrl = parseAppliedFiltersFromSearchParams(searchParams);
    setAppliedFilters(current => (areFiltersEqual(current, fromUrl) ? current : fromUrl));
    setDraftSearch(fromUrl.search);
    setDraftSelectedTags(fromUrl.selectedTags);
    setDraftSelectedAuthorUserIds(fromUrl.selectedAuthorUserIds);
    setDraftMinPrice(fromUrl.minPriceCents !== null ? fromUrl.minPriceCents / 100 : null);
    setDraftMaxPrice(fromUrl.maxPriceCents !== null ? fromUrl.maxPriceCents / 100 : null);
    setDraftSortBy(fromUrl.sortBy);
    setDraftPageSize(fromUrl.pageSize);
  }, [searchParams]);

  useEffect(() => {
    const next = buildSearchParamsFromAppliedFilters(appliedFilters).toString();
    const current = searchParams.toString();
    if (next !== current) {
      setSearchParams(next, { replace: false });
    }
  }, [appliedFilters, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    const loadFilters = async () => {
      setIsLoadingFilters(true);
      try {
        const data = await fetchShopFilters({ isActive: 1 });
        if (cancelled) return;
        const sortedTags = sortTagOptionsByCount(data.tags);
        setAvailableTags(sortedTags);
        setAvailableAuthors(data.authors);
        writeCachedTags(sortedTags);
      } catch {
        // Use cached values if request fails
      } finally {
        if (!cancelled) setIsLoadingFilters(false);
      }
    };

    void loadFilters();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchShopProductsPage({
          name: appliedFilters.search,
          tags: appliedFilters.selectedTags,
          authorUserIds: appliedFilters.selectedAuthorUserIds,
          minPriceCents: appliedFilters.minPriceCents ?? undefined,
          maxPriceCents: appliedFilters.maxPriceCents ?? undefined,
          isActive: 1,
          page: appliedFilters.page,
          pageSize: appliedFilters.pageSize,
          sort: SORT_TO_QUERY[appliedFilters.sortBy],
        });

        if (!isCancelled) {
          setProducts(response.data);
          setPageState(response.page);
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

    void loadPage();
    return () => {
      isCancelled = true;
    };
  }, [appliedFilters]);

  const filteredTagOptions = useMemo(() => {
    const search = tagSearch.trim().toLowerCase();
    if (!search) return availableTags;
    return availableTags.filter(tag => tag.value.toLowerCase().includes(search));
  }, [availableTags, tagSearch]);

  const filteredAuthorOptions = useMemo(() => {
    const search = authorSearch.trim().toLowerCase();
    if (!search) return availableAuthors;
    return availableAuthors.filter(author =>
      author.label.toLowerCase().includes(search)
    );
  }, [availableAuthors, authorSearch]);

  const draftMinPriceCents = normalizePriceToCents(draftMinPrice);
  const draftMaxPriceCents = normalizePriceToCents(draftMaxPrice);
  const hasInvalidPriceRange =
    draftMinPriceCents !== null &&
    draftMaxPriceCents !== null &&
    draftMinPriceCents > draftMaxPriceCents;

  const hasPendingFilterChanges = useMemo(() => {
    const normalizedDraftTags = normalizeTagSelection(draftSelectedTags);
    const normalizedAppliedTags = normalizeTagSelection(appliedFilters.selectedTags);
    const normalizedDraftAuthors = normalizeIdSelection(draftSelectedAuthorUserIds);
    const normalizedAppliedAuthors = normalizeIdSelection(appliedFilters.selectedAuthorUserIds);

    return (
      draftSearch.trim() !== appliedFilters.search ||
      normalizedDraftTags.join(`,`) !== normalizedAppliedTags.join(`,`) ||
      normalizedDraftAuthors.join(`,`) !== normalizedAppliedAuthors.join(`,`) ||
      draftMinPriceCents !== appliedFilters.minPriceCents ||
      draftMaxPriceCents !== appliedFilters.maxPriceCents ||
      draftSortBy !== appliedFilters.sortBy ||
      draftPageSize !== appliedFilters.pageSize
    );
  }, [
    appliedFilters.maxPriceCents,
    appliedFilters.minPriceCents,
    appliedFilters.pageSize,
    appliedFilters.search,
    appliedFilters.selectedAuthorUserIds,
    appliedFilters.selectedTags,
    appliedFilters.sortBy,
    draftMaxPriceCents,
    draftMinPriceCents,
    draftPageSize,
    draftSearch,
    draftSelectedAuthorUserIds,
    draftSelectedTags,
    draftSortBy
  ]);

  const toggleTag = (tag: string) => {
    setDraftSelectedTags(current => (current.includes(tag) ? current.filter(value => value !== tag) : [...current, tag]));
  };

  const toggleAuthor = (authorUserId: string) => {
    setDraftSelectedAuthorUserIds(current => (
      current.includes(authorUserId)
        ? current.filter(value => value !== authorUserId)
        : [...current, authorUserId]
    ));
  };

  const applyFilters = () => {
    if (hasInvalidPriceRange) return;

    setAppliedFilters({
      search: draftSearch.trim(),
      selectedTags: normalizeTagSelection(draftSelectedTags),
      selectedAuthorUserIds: normalizeIdSelection(draftSelectedAuthorUserIds),
      minPriceCents: draftMinPriceCents,
      maxPriceCents: draftMaxPriceCents,
      sortBy: draftSortBy,
      page: 1,
      pageSize: draftPageSize,
    });
  };

  const clearFilters = () => {
    setDraftSearch(``);
    setDraftSelectedTags([]);
    setDraftSelectedAuthorUserIds([]);
    setDraftMinPrice(null);
    setDraftMaxPrice(null);
    setDraftSortBy(`date`);
    setDraftPageSize(24);
    setTagSearch(``);
    setAuthorSearch(``);
    setAppliedFilters({
      search: ``,
      selectedTags: [],
      selectedAuthorUserIds: [],
      minPriceCents: null,
      maxPriceCents: null,
      sortBy: `date`,
      page: 1,
      pageSize: 24,
    });
  };

  const goToPage = (page: number) => {
    if (page < 1 || (pageState.totalPages > 0 && page > pageState.totalPages)) return;
    setAppliedFilters(current => ({ ...current, page }));
  };

  const pageIndexes = useMemo(() => {
    if (pageState.totalPages <= 0) return [];
    const maxButtons = 8;
    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, pageState.index - half);
    let end = start + maxButtons - 1;
    if (end > pageState.totalPages) {
      end = pageState.totalPages;
      start = Math.max(1, end - maxButtons + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [pageState.index, pageState.totalPages]);

  return (
    <section className="shop-view">
      <header className="shop-view__header">
        <h1>Shop collection</h1>
        <p>Browse active products with server-side filtering, sorting, and pagination.</p>
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
                if (event.key === `Enter`) applyFilters();
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
              value={draftMinPrice ?? ``}
              onChange={event => setDraftMinPrice(event.target.value ? Number(event.target.value) : null)}
              placeholder="0"
            />
          </div>

          <div className="shop-filters__row">
            <label htmlFor="shop-max">Max price</label>
            <input
              id="shop-max"
              type="number"
              min={0}
              value={draftMaxPrice ?? ``}
              onChange={event => setDraftMaxPrice(event.target.value ? Number(event.target.value) : null)}
              placeholder="999"
            />
          </div>

          <div className="shop-filters__row">
            <label htmlFor="shop-sort">Sort</label>
            <select id="shop-sort" value={draftSortBy} onChange={event => setDraftSortBy(event.target.value as SortKey)}>
              <option value="date">Newest</option>
              <option value="priceAsc">Price low to high</option>
              <option value="priceDesc">Price high to low</option>
              <option value="name">Name</option>
              <option value="priceCurrency">Price, then currency</option>
              <option value="priceUpdated">Price, then updated</option>
            </select>
          </div>

          <div className="shop-filters__row">
            <label htmlFor="shop-page-size">Page size</label>
            <select
              id="shop-page-size"
              value={draftPageSize}
              onChange={event => setDraftPageSize(Number(event.target.value))}
            >
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={72}>72</option>
            </select>
          </div>

          <div className="shop-filters__row shop-filters__row--tags">
            <p>Tags</p>
            <input
              aria-label="Search tags"
              value={tagSearch}
              onChange={event => setTagSearch(event.target.value)}
              placeholder="Search tags"
            />
            <div className="shop-filters__tag-list">
              {isLoadingFilters && availableTags.length === 0 ? <span className="shop-filters__empty">Loading tags...</span> : null}
              {!isLoadingFilters && filteredTagOptions.length === 0 ? <span className="shop-filters__empty">No tags found.</span> : null}
              {filteredTagOptions.map(tag => (
                <label key={tag.value} className="shop-filters__checkbox">
                  <input
                    type="checkbox"
                    checked={draftSelectedTags.includes(tag.value)}
                    onChange={() => toggleTag(tag.value)}
                  />
                  <span>#{tag.value}</span>
                  <small>{tag.count}</small>
                </label>
              ))}
            </div>
          </div>

          <div className="shop-filters__row shop-filters__row--tags">
            <p>Authors</p>
            <input
              aria-label="Search authors"
              value={authorSearch}
              onChange={event => setAuthorSearch(event.target.value)}
              placeholder="Search authors"
            />
            <div className="shop-filters__tag-list">
              {isLoadingFilters && availableAuthors.length === 0 ? <span className="shop-filters__empty">Loading authors...</span> : null}
              {!isLoadingFilters && filteredAuthorOptions.length === 0 ? <span className="shop-filters__empty">No authors found.</span> : null}
              {filteredAuthorOptions.map(author => (
                <label key={author.value} className="shop-filters__checkbox">
                  <input
                    type="checkbox"
                    checked={draftSelectedAuthorUserIds.includes(author.value)}
                    onChange={() => toggleAuthor(author.value)}
                  />
                  <span>{author.label}</span>
                  <small>{author.count}</small>
                </label>
              ))}
            </div>
          </div>

          <div className="shop-filters__actions">
            <button type="button" onClick={applyFilters} disabled={!hasPendingFilterChanges || isLoading || hasInvalidPriceRange}>
              {isLoading ? `Applying...` : `Apply filters`}
            </button>
            <button type="button" onClick={clearFilters}>Reset filters</button>
          </div>

          {hasInvalidPriceRange ? <p className="shop-results__state shop-results__state--error">Min price must be less than or equal to max price.</p> : null}
          {hasPendingFilterChanges ? <p className="shop-filters__hint">You changed filters. Click Apply filters to refresh results.</p> : null}
        </aside>

        <section className="shop-results">
          <div className="shop-results__summary">
            <p className="shop-results__state">
              {pageState.totalItems} products
              {pageState.totalPages > 0 ? ` • page ${pageState.index} of ${pageState.totalPages}` : ``}
            </p>
          </div>

          {isLoading ? <p className="shop-results__state">Loading products...</p> : null}
          {error ? <p className="shop-results__state shop-results__state--error">{error}</p> : null}
          {!isLoading && !error && products.length === 0 ? <p className="shop-results__state">No products match your filters.</p> : null}

          <div className="shop-results__grid">
            {products.map(product => (
              <ShopCard
                key={product.id}
                slug={product.slug}
                name={product.name}
                description={product.description}
                priceCents={product.priceCents}
                currency={product.currency}
                imageUrl={product.imageUrl}
                tags={product.tags}
              />
            ))}
          </div>

          {pageState.totalPages > 1 ? (
            <div className="shop-pagination">
              <button type="button" onClick={() => goToPage(pageState.index - 1)} disabled={!pageState.hasPrev}>
                Previous
              </button>
              {pageIndexes.map(page => (
                <button
                  key={page}
                  type="button"
                  className={page === pageState.index ? `is-active` : ``}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              ))}
              <button type="button" onClick={() => goToPage(pageState.index + 1)} disabled={!pageState.hasNext}>
                Next
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
