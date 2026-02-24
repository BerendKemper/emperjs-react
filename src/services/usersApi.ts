const API_ORIGIN = import.meta.env.VITE_AUTH_API_ORIGIN;

export type UsersApiRecord = {
  id: string;
  email: string;
  display_name: string | null;
  roles: string[];
  is_active: number;
};

export type UsersListQuery = {
  name?: string;
  email?: string;
  emailProviders?: string[];
  roles?: string[];
  sellerProfile?: string;
  page?: number;
  pageSize?: number;
};

export type UsersListPage = {
  page: {
    index: number;
    size: number;
    totalItems: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
  users: UsersApiRecord[];
  filters: {
    emailProviders: string[];
    roles: string[];
  };
};

const normalizeCsvValues = (values: string[]): string[] =>
  [...new Set(values.map(value => value.trim().toLowerCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

const buildUsersQueryString = (query?: UsersListQuery): string => {
  if (!query) return ``;
  const params = new URLSearchParams();

  const name = query.name?.trim();
  if (name) params.set(`name`, name);

  const email = query.email?.trim();
  if (email) params.set(`email`, email);

  const sellerProfile = query.sellerProfile?.trim();
  if (sellerProfile) params.set(`seller_profile`, sellerProfile);

  if (Array.isArray(query.emailProviders)) {
    const values = normalizeCsvValues(query.emailProviders);
    if (values.length > 0) params.set(`email_providers`, values.join(`,`));
  }

  if (Array.isArray(query.roles)) {
    const values = normalizeCsvValues(query.roles);
    if (values.length > 0) params.set(`roles`, values.join(`,`));
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

  const queryString = params.toString();
  return queryString ? `?${queryString}` : ``;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export async function fetchAdminUsersPage(query?: UsersListQuery): Promise<UsersListPage> {
  const queryString = buildUsersQueryString(query);
  const response = await fetch(`${API_ORIGIN}/users${queryString}`, {
    method: `GET`,
    credentials: `include`,
  });
  return parseJson<UsersListPage>(response);
}
