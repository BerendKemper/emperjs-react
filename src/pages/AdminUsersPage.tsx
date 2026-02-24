import { useEffect, useMemo, useState } from "react";
import { LoginButtons } from "../controls/Auth/LoginButtons";
import { useSession } from "../controls/Auth/useSession";
import { fetchSellerProfileRequests, updateSellerProfileRequest, type SellerProfileRequest } from "../services/sellerProfileApi";
import { fetchAdminUsersPage, type UsersApiRecord } from "../services/usersApi";
import "./AdminUsersPage.css";

const AUTH_API_ORIGIN = import.meta.env.VITE_AUTH_API_ORIGIN;
const OWNER_MANAGED_ROLES = [`admin`, `seller`, `tester`] as const;
const ADMIN_MANAGED_ROLES = [`seller`] as const;

type ManagedRole = `admin` | `seller` | `tester`;
type AdminTab = `sellerProfiles` | `users`;
type EmailProvider = `google` | `microsoft`;

type UserRecord = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  status: `active` | `disabled`;
};

type PageState = {
  index: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

type UserFilters = {
  name: string;
  email: string;
  emailProviders: string[];
  roles: string[];
  sellerProfile: string;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_STATE: PageState = {
  index: 1,
  size: 24,
  totalItems: 0,
  totalPages: 0,
  hasPrev: false,
  hasNext: false,
};

type EmailProviderConnectionRecord = {
  id: string;
  scope_type: `system` | `seller_profile`;
  scope_id: string;
  provider: EmailProvider;
  account_email: string | null;
  sender_email: string | null;
  sender_name: string | null;
  status: `active` | `inactive`;
  created_at: number;
  updated_at: number;
};

type SystemEmailProviderPayload = {
  connection: EmailProviderConnectionRecord | null;
};

const normalizeRoles = (roles: string[]): string[] =>
  [...new Set(roles.map(role => role.trim().toLowerCase()).filter(Boolean))].sort();

const equalsRoleLists = (a: string[], b: string[]): boolean => {
  const left = normalizeRoles(a);
  const right = normalizeRoles(b);
  if (left.length !== right.length) return false;
  return left.every((role, index) => role === right[index]);
};

const normalizeSelection = (values: string[]): string[] =>
  [...new Set(values.map(value => value.trim().toLowerCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

const areUserFiltersEqual = (a: UserFilters, b: UserFilters): boolean => (
  a.name.trim() === b.name.trim() &&
  a.email.trim() === b.email.trim() &&
  a.sellerProfile.trim() === b.sellerProfile.trim() &&
  normalizeSelection(a.emailProviders).join(`,`) === normalizeSelection(b.emailProviders).join(`,`) &&
  normalizeSelection(a.roles).join(`,`) === normalizeSelection(b.roles).join(`,`) &&
  a.page === b.page &&
  a.pageSize === b.pageSize
);

export function AdminUsersPage() {
  const { session, isLoading } = useSession();
  const [activeTab, setActiveTab] = useState<AdminTab>(`sellerProfiles`);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [pageState, setPageState] = useState<PageState>(DEFAULT_PAGE_STATE);
  const [availableEmailProviders, setAvailableEmailProviders] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [draftName, setDraftName] = useState(``);
  const [draftEmail, setDraftEmail] = useState(``);
  const [draftSellerProfile, setDraftSellerProfile] = useState(``);
  const [draftEmailProviders, setDraftEmailProviders] = useState<string[]>([]);
  const [draftRolesFilter, setDraftRolesFilter] = useState<string[]>([]);
  const [draftPageSize, setDraftPageSize] = useState(24);
  const [appliedUserFilters, setAppliedUserFilters] = useState<UserFilters>({
    name: ``,
    email: ``,
    emailProviders: [],
    roles: [],
    sellerProfile: ``,
    page: 1,
    pageSize: 24,
  });
  const [roleDrafts, setRoleDrafts] = useState<Record<string, ManagedRole[]>>({});
  const [savingByUserId, setSavingByUserId] = useState<Record<string, boolean>>({});
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [isSystemEmailLoading, setIsSystemEmailLoading] = useState(false);
  const [isSystemEmailSaving, setIsSystemEmailSaving] = useState(false);
  const [systemEmailError, setSystemEmailError] = useState<string | null>(null);
  const [systemEmailNotice, setSystemEmailNotice] = useState<string | null>(null);
  const [systemConnection, setSystemConnection] = useState<EmailProviderConnectionRecord | null>(null);
  const [systemProvider, setSystemProvider] = useState<EmailProvider>(`microsoft`);
  const [systemAccountEmail, setSystemAccountEmail] = useState(``);
  const [systemSenderEmail, setSystemSenderEmail] = useState(``);
  const [systemSenderName, setSystemSenderName] = useState(``);
  const [systemStatus, setSystemStatus] = useState<`active` | `inactive`>(`active`);
  const [requestFilterStatus, setRequestFilterStatus] = useState(`pending`);
  const [sellerRequests, setSellerRequests] = useState<SellerProfileRequest[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestActionBusyById, setRequestActionBusyById] = useState<Record<string, boolean>>({});

  const isAuthenticated = Boolean(session?.authenticated);
  const isOwner = Boolean(session?.roles?.includes(`owner`));
  const isAdmin = Boolean(session?.roles?.includes(`admin`));
  const canManageUsers = isOwner || isAdmin;

  const allowedManagedRoles = useMemo<ManagedRole[]>(() => {
    if (isOwner) return [...OWNER_MANAGED_ROLES];
    if (isAdmin) return [...ADMIN_MANAGED_ROLES];
    return [];
  }, [isAdmin, isOwner]);

  const mapApiUser = (user: UsersApiRecord): UserRecord => ({
    id: user.id,
    name: user.display_name?.trim() ? user.display_name : user.email,
    email: user.email,
    roles: normalizeRoles(Array.isArray(user.roles) ? user.roles : []),
    status: user.is_active === 1 ? `active` : `disabled`,
  });

  const syncSystemEmailForm = (connection: EmailProviderConnectionRecord | null) => {
    setSystemConnection(connection);
    setSystemProvider(connection?.provider ?? `microsoft`);
    setSystemAccountEmail(connection?.account_email ?? ``);
    setSystemSenderEmail(connection?.sender_email ?? ``);
    setSystemSenderName(connection?.sender_name ?? ``);
    setSystemStatus(connection?.status ?? `active`);
  };

  const getManagedRolesForUser = (user: UserRecord): ManagedRole[] =>
    user.roles.filter((role): role is ManagedRole =>
      allowedManagedRoles.includes(role as ManagedRole)
    ) as ManagedRole[];

  const loadUsers = async () => {
    if (!isAuthenticated || !canManageUsers) {
      setUsers([]);
      setPageState(DEFAULT_PAGE_STATE);
      setAvailableEmailProviders([]);
      setAvailableRoles([]);
      setRoleDrafts({});
      setUsersError(null);
      setIsUsersLoading(false);
      return;
    }

    setIsUsersLoading(true);
    setUsersError(null);

    try {
      const payload = await fetchAdminUsersPage({
        name: appliedUserFilters.name,
        email: appliedUserFilters.email,
        sellerProfile: appliedUserFilters.sellerProfile,
        emailProviders: appliedUserFilters.emailProviders,
        roles: appliedUserFilters.roles,
        page: appliedUserFilters.page,
        pageSize: appliedUserFilters.pageSize,
      });
      const nextUsers = (payload.users ?? []).map(mapApiUser);
      setUsers(nextUsers);
      setPageState(payload.page ?? DEFAULT_PAGE_STATE);
      setAvailableEmailProviders(normalizeSelection(payload.filters?.emailProviders ?? []));
      setAvailableRoles(normalizeSelection(payload.filters?.roles ?? []));

      const nextDrafts: Record<string, ManagedRole[]> = {};
      for (const user of nextUsers) {
        nextDrafts[user.id] = getManagedRolesForUser(user);
      }
      setRoleDrafts(nextDrafts);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to load users.`;
      setUsers([]);
      setPageState(DEFAULT_PAGE_STATE);
      setRoleDrafts({});
      setUsersError(message);
    } finally {
      setIsUsersLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [isAuthenticated, canManageUsers, allowedManagedRoles.join(`,`), appliedUserFilters]);

  const loadSystemEmailConnection = async () => {
    if (!isAuthenticated || !canManageUsers) {
      syncSystemEmailForm(null);
      setSystemEmailError(null);
      setSystemEmailNotice(null);
      setIsSystemEmailLoading(false);
      return;
    }

    setIsSystemEmailLoading(true);
    setSystemEmailError(null);
    setSystemEmailNotice(null);

    try {
      const response = await fetch(`${AUTH_API_ORIGIN}/admin/email-provider/system`, {
        method: `GET`,
        credentials: `include`,
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as SystemEmailProviderPayload;
      syncSystemEmailForm(payload.connection ?? null);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to load system email provider settings.`;
      syncSystemEmailForm(null);
      setSystemEmailError(message);
    } finally {
      setIsSystemEmailLoading(false);
    }
  };

  useEffect(() => {
    void loadSystemEmailConnection();
  }, [isAuthenticated, canManageUsers]);

  const loadSellerProfileRequests = async () => {
    if (!isAuthenticated || !canManageUsers) {
      setSellerRequests([]);
      setRequestsError(null);
      setIsRequestsLoading(false);
      return;
    }

    setIsRequestsLoading(true);
    setRequestsError(null);
    try {
      const payload = await fetchSellerProfileRequests({
        status: requestFilterStatus || undefined,
        page: 1,
        pageSize: 50,
      });
      setSellerRequests(payload.requests);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to load seller profile requests.`;
      setSellerRequests([]);
      setRequestsError(message);
    } finally {
      setIsRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== `sellerProfiles`) return;
    void loadSellerProfileRequests();
  }, [isAuthenticated, canManageUsers, requestFilterStatus, activeTab]);

  const visibleEmailProviders = useMemo(
    () => normalizeSelection([...availableEmailProviders, ...draftEmailProviders]),
    [availableEmailProviders, draftEmailProviders]
  );

  const visibleRoleFilters = useMemo(
    () => normalizeSelection([...availableRoles, ...draftRolesFilter]),
    [availableRoles, draftRolesFilter]
  );

  const hasPendingUserFilterChanges = useMemo(() => !areUserFiltersEqual(appliedUserFilters, {
    name: draftName,
    email: draftEmail,
    emailProviders: draftEmailProviders,
    roles: draftRolesFilter,
    sellerProfile: draftSellerProfile,
    page: appliedUserFilters.page,
    pageSize: draftPageSize,
  }), [
    appliedUserFilters,
    draftEmail,
    draftEmailProviders,
    draftName,
    draftPageSize,
    draftRolesFilter,
    draftSellerProfile
  ]);

  const toggleManagedRole = (userId: string, role: ManagedRole, checked: boolean) => {
    setRoleDrafts(previous => {
      const current = new Set<ManagedRole>(previous[userId] ?? []);
      if (checked) current.add(role);
      else current.delete(role);
      return { ...previous, [userId]: [...current].sort() as ManagedRole[] };
    });
  };

  const handleResetRoles = (user: UserRecord) => {
    setRoleDrafts(previous => ({
      ...previous,
      [user.id]: getManagedRolesForUser(user),
    }));
  };

  const handleSaveRoles = async (user: UserRecord) => {
    const roles = roleDrafts[user.id] ?? [];
    setSavingByUserId(previous => ({ ...previous, [user.id]: true }));
    setUsersError(null);

    try {
      const response = await fetch(`${AUTH_API_ORIGIN}/users/roles`, {
        method: `PATCH`,
        credentials: `include`,
        headers: { "Content-Type": `application/json` },
        body: JSON.stringify({ userId: user.id, roles }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as { user?: UsersApiRecord };
      const updated = payload.user ? mapApiUser(payload.user) : null;
      if (!updated) {
        throw new Error(`Invalid API response`);
      }

      setUsers(previous => previous.map(existing => existing.id === updated.id ? updated : existing));
      setRoleDrafts(previous => ({
        ...previous,
        [updated.id]: getManagedRolesForUser(updated),
      }));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to update roles.`;
      setUsersError(message);
    } finally {
      setSavingByUserId(previous => ({ ...previous, [user.id]: false }));
    }
  };

  const handleSaveSystemEmailProvider = async () => {
    if (!isOwner) return;
    setIsSystemEmailSaving(true);
    setSystemEmailError(null);
    setSystemEmailNotice(null);

    try {
      const response = await fetch(`${AUTH_API_ORIGIN}/admin/email-provider/system`, {
        method: `PUT`,
        credentials: `include`,
        headers: { "Content-Type": `application/json` },
        body: JSON.stringify({
          provider: systemProvider,
          accountEmail: systemAccountEmail || null,
          senderEmail: systemSenderEmail || null,
          senderName: systemSenderName || null,
          status: systemStatus,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = (await response.json()) as SystemEmailProviderPayload;
      syncSystemEmailForm(payload.connection ?? null);
      setSystemEmailNotice(`System email provider settings saved.`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to save system email provider settings.`;
      setSystemEmailError(message);
    } finally {
      setIsSystemEmailSaving(false);
    }
  };

  const handleDisconnectSystemEmailProvider = async () => {
    if (!isOwner) return;
    setIsSystemEmailSaving(true);
    setSystemEmailError(null);
    setSystemEmailNotice(null);
    try {
      const response = await fetch(`${AUTH_API_ORIGIN}/admin/email-provider/system`, {
        method: `DELETE`,
        credentials: `include`,
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      syncSystemEmailForm(null);
      setSystemEmailNotice(`System email provider settings removed.`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to remove system email provider settings.`;
      setSystemEmailError(message);
    } finally {
      setIsSystemEmailSaving(false);
    }
  };

  const handleRequestAction = async (
    requestId: string,
    action: `approve` | `reject` | `cancel`
  ) => {
    setRequestActionBusyById(previous => ({ ...previous, [requestId]: true }));
    setRequestsError(null);
    try {
      await updateSellerProfileRequest(requestId, action);
      await loadSellerProfileRequests();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Failed to update seller profile request.`;
      setRequestsError(message);
    } finally {
      setRequestActionBusyById(previous => ({ ...previous, [requestId]: false }));
    }
  };

  const toggleEmailProviderFilter = (provider: string) => {
    setDraftEmailProviders(previous => (
      previous.includes(provider)
        ? previous.filter(value => value !== provider)
        : [...previous, provider]
    ));
  };

  const toggleRoleFilter = (role: string) => {
    setDraftRolesFilter(previous => (
      previous.includes(role)
        ? previous.filter(value => value !== role)
        : [...previous, role]
    ));
  };

  const applyUserFilters = () => {
    setAppliedUserFilters({
      name: draftName.trim(),
      email: draftEmail.trim(),
      emailProviders: normalizeSelection(draftEmailProviders),
      roles: normalizeSelection(draftRolesFilter),
      sellerProfile: draftSellerProfile.trim(),
      page: 1,
      pageSize: draftPageSize,
    });
  };

  const clearUserFilters = () => {
    setDraftName(``);
    setDraftEmail(``);
    setDraftSellerProfile(``);
    setDraftEmailProviders([]);
    setDraftRolesFilter([]);
    setDraftPageSize(24);
    setAppliedUserFilters({
      name: ``,
      email: ``,
      emailProviders: [],
      roles: [],
      sellerProfile: ``,
      page: 1,
      pageSize: 24,
    });
  };

  const goToUsersPage = (nextPage: number) => {
    if (nextPage < 1 || (pageState.totalPages > 0 && nextPage > pageState.totalPages)) return;
    setAppliedUserFilters(previous => ({ ...previous, page: nextPage }));
  };

  const userPageIndexes = useMemo(() => {
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

  if (isLoading) {
    return (
      <section className="admin-users">
        <header className="admin-users__header">
          <p>Loading admin console...</p>
        </header>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="admin-users">
        <header className="admin-users__header">
          <h1>Admin</h1>
          <p>Sign in with an admin account to access user management.</p>
        </header>
        <div className="admin-users__signin">
          <LoginButtons />
        </div>
      </section>
    );
  }

  if (!canManageUsers) {
    return (
      <section className="admin-users">
        <header className="admin-users__header">
          <h1>Admin</h1>
          <p>You do not have permission to view this page.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="admin-users">
      <header className="admin-users__header">
        <h1>Admin</h1>
        <p>{isOwner ? `Owner can manage admin, seller and tester roles.` : `Admin can manage seller role only.`}</p>
      </header>

      <div className="admin-users__tabs">
        <button
          type="button"
          className={activeTab === `sellerProfiles` ? `is-active` : ``}
          onClick={() => setActiveTab(`sellerProfiles`)}
        >
          Seller Profiles
        </button>
        <button
          type="button"
          className={activeTab === `users` ? `is-active` : ``}
          onClick={() => setActiveTab(`users`)}
        >
          Users
        </button>
      </div>

      {activeTab === `sellerProfiles` ? (
        <div className="admin-users__seller-profiles">
          <section className="admin-users__card">
            <h2>Seller profile requests</h2>
            <p>Review pending seller-profile creation requests.</p>
            <label className="admin-users__field">
              <span>Status filter</span>
              <select
                value={requestFilterStatus}
                onChange={event => setRequestFilterStatus(event.target.value)}
              >
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
                <option value="cancelled">cancelled</option>
                <option value="expired">expired</option>
              </select>
            </label>
            {requestsError ? <p className="admin-users__error">{requestsError}</p> : null}
            {isRequestsLoading ? <p>Loading requests...</p> : null}
            {!isRequestsLoading && sellerRequests.length === 0 ? <p>No requests found.</p> : null}
            {!isRequestsLoading && sellerRequests.length > 0 ? (
              <div className="admin-users__table">
                <div className="admin-users__row admin-users__row--header admin-users__row--requests">
                  <span>Slug</span>
                  <span>Display name</span>
                  <span>Status</span>
                  <span>Requested</span>
                  <span>Actions</span>
                </div>
                {sellerRequests.map(request => {
                  const isBusy = Boolean(requestActionBusyById[request.id]);
                  const canAct = request.status === `pending`;
                  return (
                    <div key={request.id} className="admin-users__row admin-users__row--requests">
                      <span>{request.requested_slug}</span>
                      <span>{request.requested_display_name}</span>
                      <span>{request.status}</span>
                      <span>{new Date(request.created_at).toLocaleString()}</span>
                      <span className="admin-users__role-actions">
                        <button
                          type="button"
                          className="admin-users__button admin-users__button--primary"
                          disabled={!canAct || isBusy}
                          onClick={() => void handleRequestAction(request.id, `approve`)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="admin-users__button admin-users__button--secondary"
                          disabled={!canAct || isBusy}
                          onClick={() => void handleRequestAction(request.id, `reject`)}
                        >
                          Reject
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className="admin-users__card">
            <h2>System email provider</h2>
            <p>This is the global fallback sender for platform notifications. Seller-profile scoped providers will be added in the next slice.</p>
            {isSystemEmailLoading ? <p>Loading settings...</p> : null}
            {systemEmailError ? <p className="admin-users__error">{systemEmailError}</p> : null}
            {systemEmailNotice ? <p className="admin-users__notice">{systemEmailNotice}</p> : null}

            <label className="admin-users__field">
              <span>Provider</span>
              <select
                value={systemProvider}
                onChange={event => setSystemProvider(event.target.value as EmailProvider)}
                disabled={!isOwner || isSystemEmailSaving}
              >
                <option value="microsoft">Microsoft</option>
                <option value="google">Google</option>
              </select>
            </label>

            <label className="admin-users__field">
              <span>Account email</span>
              <input
                type="email"
                value={systemAccountEmail}
                onChange={event => setSystemAccountEmail(event.target.value)}
                placeholder="owner@example.com"
                disabled={!isOwner || isSystemEmailSaving}
              />
            </label>

            <label className="admin-users__field">
              <span>Sender email</span>
              <input
                type="email"
                value={systemSenderEmail}
                onChange={event => setSystemSenderEmail(event.target.value)}
                placeholder="no-reply@example.com"
                disabled={!isOwner || isSystemEmailSaving}
              />
            </label>

            <label className="admin-users__field">
              <span>Sender name</span>
              <input
                type="text"
                value={systemSenderName}
                onChange={event => setSystemSenderName(event.target.value)}
                placeholder="EmperJS"
                disabled={!isOwner || isSystemEmailSaving}
              />
            </label>

            <label className="admin-users__field">
              <span>Status</span>
              <select
                value={systemStatus}
                onChange={event => setSystemStatus(event.target.value as `active` | `inactive`)}
                disabled={!isOwner || isSystemEmailSaving}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>

            <div className="admin-users__role-actions">
              <button
                type="button"
                onClick={() => void handleSaveSystemEmailProvider()}
                className="admin-users__button admin-users__button--primary"
                disabled={!isOwner || isSystemEmailSaving}
              >
                {isSystemEmailSaving ? `Saving...` : `Save provider`}
              </button>
              <button
                type="button"
                onClick={() => void handleDisconnectSystemEmailProvider()}
                className="admin-users__button admin-users__button--secondary"
                disabled={!isOwner || !systemConnection || isSystemEmailSaving}
              >
                Remove provider
              </button>
            </div>
            {!isOwner ? <p className="admin-users__hint">Read-only for admin users. Owner can edit this setting.</p> : null}
          </section>
        </div>
      ) : null}

      {activeTab === `users` ? (
        <div className="admin-users__layout">
          <aside className="admin-users__filters">
            <h2>Filters</h2>
            <label className="admin-users__field">
              <span>Name</span>
              <input
                type="text"
                value={draftName}
                onChange={event => setDraftName(event.target.value)}
                placeholder="Display name"
              />
            </label>
            <label className="admin-users__field">
              <span>Email</span>
              <input
                type="text"
                value={draftEmail}
                onChange={event => setDraftEmail(event.target.value)}
                placeholder="user@example.com"
              />
            </label>
            <label className="admin-users__field">
              <span>Seller profile</span>
              <input
                type="text"
                value={draftSellerProfile}
                onChange={event => setDraftSellerProfile(event.target.value)}
                placeholder="Slug or display name"
              />
            </label>
            <label className="admin-users__field">
              <span>Page size</span>
              <select
                value={draftPageSize}
                onChange={event => setDraftPageSize(Number(event.target.value))}
              >
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
              </select>
            </label>
            <div className="admin-users__filter-group">
              <p>Email providers</p>
              {visibleEmailProviders.length === 0 ? (
                <span className="admin-users__hint">No providers found for current text filters.</span>
              ) : (
                <div className="admin-users__checkboxes">
                  {visibleEmailProviders.map(provider => (
                    <label key={provider} className="admin-users__checkbox-label">
                      <input
                        type="checkbox"
                        checked={draftEmailProviders.includes(provider)}
                        onChange={() => toggleEmailProviderFilter(provider)}
                      />
                      <span>{provider}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="admin-users__filter-group">
              <p>Roles</p>
              {visibleRoleFilters.length === 0 ? (
                <span className="admin-users__hint">No roles found for current text filters.</span>
              ) : (
                <div className="admin-users__checkboxes">
                  {visibleRoleFilters.map(role => (
                    <label key={role} className="admin-users__checkbox-label">
                      <input
                        type="checkbox"
                        checked={draftRolesFilter.includes(role)}
                        onChange={() => toggleRoleFilter(role)}
                      />
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="admin-users__role-actions">
              <button
                type="button"
                className="admin-users__button admin-users__button--primary"
                disabled={isUsersLoading || !hasPendingUserFilterChanges}
                onClick={applyUserFilters}
              >
                {isUsersLoading ? `Applying...` : `Apply filters`}
              </button>
              <button
                type="button"
                className="admin-users__button admin-users__button--secondary"
                onClick={clearUserFilters}
              >
                Reset filters
              </button>
            </div>
            <div className="admin-users__notes">
              <p>Filters are server-side and update SQL results when you apply.</p>
              <p>You cannot edit your own roles or any owner account.</p>
            </div>
          </aside>

          <div className="admin-users__list">
            <div className="admin-users__list-header">
              <h2>Users</h2>
              <span>{pageState.totalItems} total</span>
            </div>
            <p className="admin-users__hint">
              {pageState.totalPages > 0 ? `Page ${pageState.index} of ${pageState.totalPages}` : `No pages`}
            </p>

            {isUsersLoading ? (
              <div className="admin-users__empty">
                <p>Loading users...</p>
              </div>
            ) : usersError ? (
              <div className="admin-users__empty">
                <p>Unable to process users request.</p>
                <p>{usersError}</p>
              </div>
            ) : users.length === 0 ? (
              <div className="admin-users__empty">
                <p>No users to display yet.</p>
                <p>Try changing your filters.</p>
              </div>
            ) : (
              <div className="admin-users__table">
                <div className="admin-users__row admin-users__row--header">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Roles</span>
                  <span>Status</span>
                </div>
                {users.map(user => {
                  const isSelf = user.id === session?.userId;
                  const isOwnerTarget = user.roles.includes(`owner`);
                  const canEditRow = !isSelf && !isOwnerTarget && allowedManagedRoles.length > 0;
                  const currentManagedRoles = getManagedRolesForUser(user);
                  const draftManagedRoles = roleDrafts[user.id] ?? currentManagedRoles;
                  const isDirty = !equalsRoleLists(draftManagedRoles, currentManagedRoles);
                  const isSaving = Boolean(savingByUserId[user.id]);

                  return (
                    <div key={user.id} className="admin-users__row">
                      <span>{user.name}</span>
                      <span>{user.email}</span>
                      <span className="admin-users__roles admin-users__roles--editable">
                        {user.roles.map(role => (
                          <span key={role} className="role-pill">
                            {role}
                          </span>
                        ))}
                        {canEditRow ? (
                          <div className="admin-users__role-editor">
                            <div className="admin-users__checkboxes">
                              {allowedManagedRoles.map(role => (
                                <label key={`${user.id}-${role}`} className="admin-users__checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={draftManagedRoles.includes(role)}
                                    onChange={event => toggleManagedRole(user.id, role, event.target.checked)}
                                    disabled={isSaving}
                                  />
                                  <span>{role}</span>
                                </label>
                              ))}
                            </div>
                            <div className="admin-users__role-actions">
                              <button
                                type="button"
                                onClick={() => handleResetRoles(user)}
                                disabled={!isDirty || isSaving}
                                className="admin-users__button admin-users__button--secondary"
                              >
                              Reset
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleSaveRoles(user)}
                                disabled={!isDirty || isSaving}
                                className="admin-users__button admin-users__button--primary"
                              >
                                {isSaving ? `Saving...` : `Save roles`}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="admin-users__hint">{isSelf ? `Self` : isOwnerTarget ? `Owner` : `Read-only`}</span>
                        )}
                      </span>
                      <span className={`admin-users__status admin-users__status--${user.status}`}>{user.status}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {pageState.totalPages > 1 ? (
              <div className="admin-users__pagination">
                <button
                  type="button"
                  className="admin-users__button admin-users__button--secondary"
                  onClick={() => goToUsersPage(pageState.index - 1)}
                  disabled={!pageState.hasPrev || isUsersLoading}
                >
                  Previous
                </button>
                {userPageIndexes.map(page => (
                  <button
                    key={page}
                    type="button"
                    className={`admin-users__button ${page === pageState.index ? `admin-users__button--primary` : `admin-users__button--secondary`}`}
                    onClick={() => goToUsersPage(page)}
                    disabled={isUsersLoading}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  className="admin-users__button admin-users__button--secondary"
                  onClick={() => goToUsersPage(pageState.index + 1)}
                  disabled={!pageState.hasNext || isUsersLoading}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

