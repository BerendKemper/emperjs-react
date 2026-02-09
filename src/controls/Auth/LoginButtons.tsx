import { useMemo, useState } from "react";
import { AUTH_SESSION_CHANGED_EVENT, useSession } from "./useSession";
import "./LoginButtons.css";

const AUTH_API_ORIGIN = import.meta.env.VITE_AUTH_API_ORIGIN;

export function LoginButtons() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const { session, isLoading, refreshSession } = useSession();

  const signedInLabel = useMemo(() => {
    if (!session?.authenticated) {
      return null;
    }

    if (session.displayName) {
      return `Signed in as ${session.displayName}`;
    }

    return `Signed in`;
  }, [session]);

  const currentReturnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  const googleLogin = () => {
    const params = new URLSearchParams({ returnTo: currentReturnTo });
    window.location.href = `${AUTH_API_ORIGIN}/auth/google/start?${params.toString()}`;
  };

  const microsoftLogin = () => {
    const params = new URLSearchParams({ returnTo: currentReturnTo });
    window.location.href = `${AUTH_API_ORIGIN}/auth/microsoft/start?${params.toString()}`;
  };

  const logout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      const response = await fetch(`${AUTH_API_ORIGIN}/auth/logout`, {
        method: `POST`,
        credentials: `include`,
      });

      if (!response.ok) {
        throw new Error(`Logout failed: ${response.status}`);
      }

      await refreshSession();
      window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
    } catch (caughtError) {
      console.error(`Failed to logout`, caughtError);
      setLogoutError(caughtError instanceof Error ? caughtError.message : `Unable to sign out`);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return <div className="login-status">Checking session...</div>;
  }

  if (session?.authenticated) {
    return (
      <div className="login-authenticated">
        <div className="login-status" title={session.provider ? `Signed in with ${session.provider}` : undefined}>
          {signedInLabel}
        </div>
        <button className="logout-trigger" onClick={logout} disabled={isLoggingOut}>
          {isLoggingOut ? `Signing out...` : `Sign out`}
        </button>
        {logoutError ? <div className="login-error" role="alert">{logoutError}</div> : null}
      </div>
    );
  }

  return (
    <div className="login-actions">
      <button className="login-trigger" onClick={() => setIsOpen(true)}>
        Sign in
      </button>
      {isOpen ? (
        <div className="login-overlay" role="presentation" onClick={() => setIsOpen(false)}>
          <div
            className="login-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="login-modal-header">
              <h2 id="login-title">Sign in to continue</h2>
              <button className="login-close" onClick={() => setIsOpen(false)} aria-label="Close sign in">
                ×
              </button>
            </div>
            <p className="login-modal-description">Choose a provider to access your account.</p>
            <div className="login-providers">
              <button className="provider-button" onClick={googleLogin}>
                Sign in with Google
              </button>
              <button className="provider-button" onClick={microsoftLogin}>
                Sign in with Microsoft
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
