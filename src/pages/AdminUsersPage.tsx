import { useEffect, useMemo, useState } from "react";
import { LoginButtons } from "../controls/Auth/LoginButtons";
import { useSession } from "../controls/Auth/useSession";
import "./AdminUsersPage.css";

const AUTH_API_ORIGIN = import.meta.env.VITE_AUTH_API_ORIGIN;

type UserRecord = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  status: `active` | `disabled`;
};

type UsersApiRecord = {
  id: string;
  email: string;
  display_name: string | null;
  roles: string[];
  is_active: number;
};

export function AdminUsersPage() {
  const { session, isLoading } = useSession();
  const [query, setQuery] = useState(``);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const isAuthenticated = session?.authenticated;
  const isAdmin = session?.roles?.includes(`admin`) || session?.roles?.includes(`owner`);

  useEffect(() => {
    const loadUsers = async () => {
      if (!isAuthenticated || !isAdmin) {
        setUsers([]);
        setUsersError(null);
        setIsUsersLoading(false);
        return;
      }

      setIsUsersLoading(true);
      setUsersError(null);

      try {
        const response = await fetch(`${AUTH_API_ORIGIN}/users`, {
          method: `GET`,
          credentials: `include`,
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const payload = (await response.json()) as { users?: UsersApiRecord[] };
        const nextUsers = (payload.users ?? []).map(user => ({
          id: user.id,
          name: user.display_name?.trim() ? user.display_name : user.email,
          email: user.email,
          roles: Array.isArray(user.roles) ? user.roles : [],
          status: user.is_active === 1 ? `active` : `disabled`,
        }));
        setUsers(nextUsers);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : `Failed to load users.`;
        setUsers([]);
        setUsersError(message);
      } finally {
        setIsUsersLoading(false);
      }
    };

    void loadUsers();
  }, [isAuthenticated, isAdmin]);

  const filteredUsers = useMemo(() => {
    if (!query) {
      return users;
    }

    const normalizedQuery = query.toLowerCase();
    return users.filter(user =>
      [user.name, user.email, user.roles.join(` `)].some(value => value.toLowerCase().includes(normalizedQuery))
    );
  }, [query, users]);

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
          <h1>User admin</h1>
          <p>Sign in with an admin account to access user management.</p>
        </header>
        <div className="admin-users__signin">
          <LoginButtons />
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="admin-users">
        <header className="admin-users__header">
          <h1>User admin</h1>
          <p>You do not have permission to view this page.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="admin-users">
      <header className="admin-users__header">
        <h1>User admin</h1>
        <p>Owners can promote admins. Admins can disable non-admin users.</p>
      </header>

      <div className="admin-users__layout">
        <aside className="admin-users__filters">
          <h2>Filters</h2>
          <label className="admin-users__field">
            <span>Search users</span>
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search by name, email, role"
            />
          </label>
          <div className="admin-users__notes">
            <p>Filter results update as you type.</p>
            <p>Admin roles are read-only for non-owners.</p>
          </div>
        </aside>

        <div className="admin-users__list">
          <div className="admin-users__list-header">
            <h2>Users</h2>
            <span>{filteredUsers.length} total</span>
          </div>

          {isUsersLoading ? (
            <div className="admin-users__empty">
              <p>Loading users...</p>
            </div>
          ) : usersError ? (
            <div className="admin-users__empty">
              <p>Unable to load users.</p>
              <p>{usersError}</p>
            </div>
          ) : filteredUsers.length === 0 ? (
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
              {filteredUsers.map(user => (
                <div key={user.id} className="admin-users__row">
                  <span>{user.name}</span>
                  <span>{user.email}</span>
                  <span className="admin-users__roles">
                    {user.roles.map(role => (
                      <span key={role} className="role-pill">
                        {role}
                      </span>
                    ))}
                  </span>
                  <span className={`admin-users__status admin-users__status--${user.status}`}>{user.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
