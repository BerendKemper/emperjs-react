import { useEffect, useMemo, useState } from "react";
import "./LoginButtons.css";

const GOOGLE_AUTH_URL = `https://accounts.google.com/o/oauth2/v2/auth`;
const MICROSOFT_AUTH_URL = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`;
const AUTH_API_ORIGIN = import.meta.env.VITE_AUTH_API_ORIGIN ?? `https://api.emperjs.com`;

type SessionState = {
  authenticated: boolean;
  provider?: string;
};

export function LoginButtons() {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const sessionEndpoint = useMemo(() => `${AUTH_API_ORIGIN}/auth/session`, []);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch(sessionEndpoint, {
          credentials: `include`,
        });

        if (!response.ok) {
          throw new Error(`Session check failed: ${response.status}`);
        }

        const data = (await response.json()) as SessionState;
        setSession(data);
      } catch (error) {
        console.error(`Failed to load session`, error);
        setSession({ authenticated: false });
      } finally {
        setIsLoadingSession(false);
      }
    };

    void loadSession();
  }, [sessionEndpoint]);

  const googleLogin = () => {
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      redirect_uri: `${AUTH_API_ORIGIN}/auth/google/callback`,
      response_type: `code`,
      scope: `openid email profile`,
      prompt: `select_account`,
    });

    window.location.href = `${GOOGLE_AUTH_URL}?${params}`;
  };

  const microsoftLogin = () => {
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
      redirect_uri: `${AUTH_API_ORIGIN}/auth/microsoft/callback`,
      response_type: `code`,
      scope: `openid email profile`,
      response_mode: `query`,
    });

    window.location.href = `${MICROSOFT_AUTH_URL}?${params}`;
  };

  if (isLoadingSession) {
    return <div className="login-status">Checking session...</div>;
  }

  if (session?.authenticated) {
    return (
      <div className="login-status" title={session.provider ? `Signed in with ${session.provider}` : undefined}>
        Signed in
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
