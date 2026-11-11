import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { adminApi, authStore } from "./adminApi";
import { isStatic } from "../services/contentSource";

const AuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!isStatic && Boolean(authStore.token));
  useEffect(() => {
    if (isStatic || !authStore.token) return;
    adminApi.me().then(setUser).catch(() => authStore.clear()).finally(() => setLoading(false));
  }, []);
  const value = useMemo(() => ({
    user, loading,
    async login(email, password) { const result = await adminApi.login(email, password); authStore.token = result.token; setUser(result.user); return result.user; },
    logout() { authStore.clear(); setUser(null); },
    isSuperAdmin: user?.roles?.includes("SuperAdmin"),
    isAdministrator: user?.roles?.some((role) => role === "SuperAdmin" || role === "Admin"),
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAdminAuth = () => useContext(AuthContext);

export function RequireAdmin({ children }) {
  const auth = useAdminAuth(); const location = useLocation();
  if (auth.loading) return <div className="admin-loading">Loading PITF Admin…</div>;
  if (!auth.user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return children;
}
