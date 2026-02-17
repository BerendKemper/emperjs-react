import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "../Layout/Layout";
import { HomePage } from "../../pages/HomePage";
import { ShopPage } from "../../pages/ShopPage";
import { ShopProductPage } from "../../pages/ShopProductPage";
import { UserSettingsPage } from "../../pages/UserSettingsPage";
import { AdminUsersPage } from "../../pages/AdminUsersPage";
import { useSession } from "../../controls/Auth/useSession";
import "./Router.css";

export function Router() {
  const { session, isLoading } = useSession();
  const isAuthenticated = Boolean(session?.authenticated);
  const isAdmin = session?.roles?.includes(`admin`) || session?.roles?.includes(`owner`);
  const canManageProducts = isAdmin || session?.roles?.includes(`seller`);

  if (isLoading) {
    return <div>Checking session...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/products/:slug" element={<ShopProductPage />} />
          {isAuthenticated ? <Route path="/settings" element={<UserSettingsPage />} /> : null}
          {isAuthenticated && isAdmin ? <Route path="/admin/users" element={<AdminUsersPage />} /> : null}
          {isAuthenticated && canManageProducts ? <Route path="/shop/products/new" element={<ShopProductPage />} /> : null}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

