import { useState } from "react";
import "./LoginButtons.css";

const GOOGLE_AUTH_URL = `https://accounts.google.com/o/oauth2/v2/auth`;
const MICROSOFT_AUTH_URL = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`;

export function LoginButtons() {
  const [isOpen, setIsOpen] = useState(false);

  const googleLogin = () => {
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      redirect_uri: `https://api.emperjs.com/auth/google/callback`,
      response_type: `code`,
      scope: `openid email profile`,
      prompt: `select_account`,
    });

    window.location.href = `${GOOGLE_AUTH_URL}?${params}`;
  };

  const microsoftLogin = () => {
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
      redirect_uri: `https://api.emperjs.com/auth/microsoft/callback`,
      response_type: `code`,
      scope: `openid email profile`,
      response_mode: `query`,
    });

    window.location.href = `${MICROSOFT_AUTH_URL}?${params}`;
  };

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
            onClick={(event) => event.stopPropagation()}
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
