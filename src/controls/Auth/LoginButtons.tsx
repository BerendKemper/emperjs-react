import { useMemo, useState } from "react";
import { useSession } from "./useSession";
import "./LoginButtons.css";

const AUTH_API_ORIGIN = import.meta.env.VITE_AUTH_API_ORIGIN;

export function LoginButtons() {
  const [isOpen, setIsOpen] = useState(false);
  const { session, isLoading } = useSession();

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

  if (isLoading) {
    return <div className="login-status">Checking session...</div>;
  }

  if (session?.authenticated) {
    return (
      <div className="login-status" title={session.provider ? `Signed in with ${session.provider}` : undefined}>
        {signedInLabel}
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
