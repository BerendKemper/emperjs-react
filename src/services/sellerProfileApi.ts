const API_ORIGIN = import.meta.env.VITE_AUTH_API_ORIGIN;

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export type SellerProfile = {
  id: string;
  teamId: string | null;
  slug: string;
  displayName: string;
  status: string;
  grantedByUserId: string | null;
  grantedAt: number | null;
  visibility: {
    isContactEmailPublic: boolean;
    isPhonePublic: boolean;
    isMemberListPublic: boolean;
  };
  createdAt: number;
  updatedAt: number;
};

export type SellerProfileMember = {
  userId: string;
  role: `owner` | `admin` | `member`;
  displayName: string | null;
  email: string;
};

export type SellerProfileRequest = {
  id: string;
  requester_user_id: string;
  requested_slug: string;
  requested_display_name: string;
  request_note: string | null;
  status: string;
  reviewed_by_user_id: string | null;
  reviewed_at: number | null;
  created_at: number;
  updated_at: number;
  expires_at: number;
};

export type SellerProfileInvite = {
  id: string;
  seller_profile_id: string;
  invited_email: string;
  role: `admin` | `member`;
  invited_by_user_id: string;
  accepted_by_user_id: string | null;
  status: string;
  created_at: number;
  updated_at: number;
  expires_at: number;
  accepted_at: number | null;
  revoked_at: number | null;
};

export type SellerProfileOwnershipTransfer = {
  id: string;
  sellerProfileId: string;
  targetUserId: string;
  status: string;
  createdAt: number;
  expiresAt: number;
};

export type EmailProviderConnection = {
  id: string;
  scope_type: `system` | `seller_profile`;
  scope_id: string;
  provider: `google` | `microsoft`;
  account_email: string | null;
  sender_email: string | null;
  sender_name: string | null;
  status: `active` | `inactive`;
  created_at: number;
  updated_at: number;
};

function buildSelectorQuery(selector: { id?: string; slug?: string }): string {
  const params = new URLSearchParams();
  if (selector.id?.trim()) params.set(`id`, selector.id.trim());
  if (selector.slug?.trim()) params.set(`slug`, selector.slug.trim().toLowerCase());
  if (!params.toString()) throw new Error(`Selector requires id or slug`);
  return params.toString();
}

export async function fetchSellerProfile(selector: { id?: string; slug?: string }): Promise<SellerProfile> {
  const query = buildSelectorQuery(selector);
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile?${query}`, {
    credentials: `include`,
  });
  const payload = await parseJson<{ profile: SellerProfile }>(response);
  return payload.profile;
}

export async function updateSellerProfile(
  selector: { id?: string; slug?: string },
  patch: {
    slug?: string;
    displayName?: string;
    status?: string;
    isMemberListPublic?: boolean;
  }
): Promise<SellerProfile> {
  const query = buildSelectorQuery(selector);
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile?${query}`, {
    method: `PATCH`,
    credentials: `include`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(patch),
  });
  const payload = await parseJson<{ profile: SellerProfile }>(response);
  return payload.profile;
}

export async function fetchSellerProfileMembers(selector: { id?: string; slug?: string }): Promise<SellerProfileMember[]> {
  const query = buildSelectorQuery(selector);
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile/members?${query}`, {
    credentials: `include`,
  });
  const payload = await parseJson<{ members: SellerProfileMember[] }>(response);
  return payload.members;
}

export async function createSellerProfileRequest(input: {
  slug: string;
  displayName: string;
  requestNote?: string;
}): Promise<SellerProfileRequest> {
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile/request`, {
    method: `POST`,
    credentials: `include`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(input),
  });
  const payload = await parseJson<{ request: SellerProfileRequest }>(response);
  return payload.request;
}

export async function fetchSellerProfileRequests(options?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ page: number; pageSize: number; total: number; requests: SellerProfileRequest[] }> {
  const params = new URLSearchParams();
  if (options?.status?.trim()) params.set(`status`, options.status.trim().toLowerCase());
  if (typeof options?.page === `number`) params.set(`page`, String(options.page));
  if (typeof options?.pageSize === `number`) params.set(`pageSize`, String(options.pageSize));

  const query = params.toString() ? `?${params.toString()}` : ``;
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile/requests${query}`, {
    credentials: `include`,
  });
  return parseJson<{ page: number; pageSize: number; total: number; requests: SellerProfileRequest[] }>(response);
}

export async function updateSellerProfileRequest(
  requestId: string,
  action: `approve` | `reject` | `cancel`
): Promise<{
  request: SellerProfileRequest;
  sellerProfileId?: string;
}> {
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile/request?id=${encodeURIComponent(requestId)}`, {
    method: `PATCH`,
    credentials: `include`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify({ action }),
  });
  return parseJson<{ request: SellerProfileRequest; sellerProfileId?: string }>(response);
}

export async function fetchSellerProfileInvites(selector: { id?: string; slug?: string }): Promise<SellerProfileInvite[]> {
  const query = buildSelectorQuery(selector);
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile/invites?${query}`, {
    credentials: `include`,
  });
  const payload = await parseJson<{ invites: SellerProfileInvite[] }>(response);
  return payload.invites;
}

export async function createSellerProfileInvite(
  selector: { id?: string; slug?: string },
  input: { email: string; role: `admin` | `member` }
): Promise<{ invite: SellerProfileInvite; acceptedImmediately: boolean; delivery: `queued` | `skipped` }> {
  const query = buildSelectorQuery(selector);
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile/invite?${query}`, {
    method: `POST`,
    credentials: `include`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(input),
  });
  return parseJson<{ invite: SellerProfileInvite; acceptedImmediately: boolean; delivery: `queued` | `skipped` }>(response);
}

export async function revokeSellerProfileInvite(inviteId: string): Promise<SellerProfileInvite> {
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile/invite?id=${encodeURIComponent(inviteId)}`, {
    method: `DELETE`,
    credentials: `include`,
  });
  const payload = await parseJson<{ invite: SellerProfileInvite }>(response);
  return payload.invite;
}

export async function startSellerProfileOwnershipTransfer(
  selector: { id?: string; slug?: string },
  targetUserId: string
): Promise<{ transfer: SellerProfileOwnershipTransfer; delivery: `queued` | `skipped` }> {
  const query = buildSelectorQuery(selector);
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile/ownership-transfer?${query}`, {
    method: `POST`,
    credentials: `include`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify({ targetUserId }),
  });
  return parseJson<{ transfer: SellerProfileOwnershipTransfer; delivery: `queued` | `skipped` }>(response);
}

export async function fetchSellerProfileEmailProvider(selector: { id?: string; slug?: string }): Promise<EmailProviderConnection | null> {
  const query = buildSelectorQuery(selector);
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile/email-provider?${query}`, {
    credentials: `include`,
  });
  const payload = await parseJson<{ connection: EmailProviderConnection | null }>(response);
  return payload.connection;
}

export async function upsertSellerProfileEmailProvider(
  selector: { id?: string; slug?: string },
  input: {
    provider: `google` | `microsoft`;
    accountEmail?: string | null;
    senderEmail?: string | null;
    senderName?: string | null;
    status?: `active` | `inactive`;
  }
): Promise<EmailProviderConnection> {
  const query = buildSelectorQuery(selector);
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile/email-provider?${query}`, {
    method: `PUT`,
    credentials: `include`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(input),
  });
  const payload = await parseJson<{ connection: EmailProviderConnection }>(response);
  return payload.connection;
}

export async function deleteSellerProfileEmailProvider(selector: { id?: string; slug?: string }): Promise<boolean> {
  const query = buildSelectorQuery(selector);
  const response = await fetch(`${API_ORIGIN}/shop/seller-profile/email-provider?${query}`, {
    method: `DELETE`,
    credentials: `include`,
  });
  const payload = await parseJson<{ deleted: boolean }>(response);
  return payload.deleted;
}
