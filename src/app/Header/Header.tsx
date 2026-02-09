import { Link } from "react-router-dom";
import { LoginButtons } from "../../controls/Auth/LoginButtons";
import { useSession } from "../../controls/Auth/useSession";
import "./Header.css";

export function Header() {
  const { session, isLoading } = useSession();
  const isAuthenticated = session?.authenticated;
  const isAdmin = session?.roles?.includes(`admin`) || session?.roles?.includes(`owner`);

  return (
    <nav id="header">
      <div className="header-links">
        <Link to="/">Home</Link>
        <Link to="/shop">Shop</Link>
        {!isLoading && isAuthenticated ? <Link to="/settings">Settings</Link> : null}
        {!isLoading && isAuthenticated && isAdmin ? <Link to="/admin/users">Users</Link> : null}
        {!isLoading && isAuthenticated && isAdmin ? <Link to="/admin/products">Products</Link> : null}
      </div>
      <LoginButtons />
    </nav>
  );
}
