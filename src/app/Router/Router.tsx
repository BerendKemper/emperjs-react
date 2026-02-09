import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "../Layout/Layout";
import { HomePage } from "../../pages/HomePage";
import { ShopPage } from "../../pages/ShopPage";
import { UserSettingsPage } from "../../pages/UserSettingsPage";
import { AdminUsersPage } from "../../pages/AdminUsersPage";
import { AdminProductsPage } from "../../pages/AdminProductsPage";
import { useSession } from "../../controls/Auth/useSession";
import "./Router.css";

export function Router() {
  const { session, isLoading } = useSession();
  const isAuthenticated = Boolean(session?.authenticated);
  const isAdmin = session?.roles?.includes(`admin`) || session?.roles?.includes(`owner`);

  if (isLoading) {
    return <div>Checking session...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          {isAuthenticated ? <Route path="/settings" element={<UserSettingsPage />} /> : null}
          {isAuthenticated && isAdmin ? <Route path="/admin/users" element={<AdminUsersPage />} /> : null}
          {isAuthenticated && isAdmin ? <Route path="/admin/products" element={<AdminProductsPage />} /> : null}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
