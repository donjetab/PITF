import { useEffect } from "react";
import { BrowserRouter, HashRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { isStatic } from "./services/contentSource";
import { SiteLayout } from "./layouts/SiteLayout";
import { HomePage } from "./pages/HomePage";
import { AboutPage } from "./pages/AboutPage";
import { EditionsPage } from "./pages/EditionsPage";
import { EditionDetailPage } from "./pages/EditionDetailPage";
import { DayDetailPage } from "./pages/DayDetailPage";
import { ContactPage } from "./pages/ContactPage";
import { NewsPage } from "./pages/NewsPage";
import { NewsDetailPage } from "./pages/NewsDetailPage";
import "./App.css";
import "./admin/Admin.css";
import { AdminAuthProvider, RequireAdmin } from "./admin/AdminAuth";
import { AdminLogin } from "./admin/AdminLogin";
import { AdminLayout } from "./admin/AdminLayout";
import { Dashboard } from "./admin/Dashboard";
import { ResourceEditorPage, ResourcePage } from "./admin/ResourcePage";
import { MediaLibrary } from "./admin/MediaLibrary";
import { UsersPage } from "./admin/UsersPage";
import { HomepageEditor } from "./admin/HomepageEditor";
import { AboutEditor } from "./admin/AboutEditor";
import { ContactEditor } from "./admin/ContactEditor";
import { NavigationEditor } from "./admin/NavigationEditor";
import { FooterEditor } from "./admin/FooterEditor";
import { contentService, useContentData } from "./services/contentService";

function LanguageBoundary({ fixedLanguage }) {
  const { lang: routeLanguage } = useParams();
  const lang = fixedLanguage || routeLanguage;
  const { language } = useContentData();
  useEffect(() => {
    if (lang === "en" || lang === "sq") {
      document.documentElement.lang = lang;
      if (language !== lang) contentService.setLanguage(lang);
    }
  }, [lang, language]);
  if (lang !== "en" && lang !== "sq") return <Navigate to="/" replace />;
  return language === lang ? <Outlet /> : null;
}

function LegacyPublicRedirect() {
  const location = useLocation();
  return <Navigate to={`/${location.pathname.replace(/^\/en\/?/, "")}${location.search}${location.hash}`} replace />;
}

export default function App() {
  const Router = isStatic ? HashRouter : BrowserRouter;
  return (
    <Router><AdminAuthProvider>
      <Routes>
        <Route element={<LanguageBoundary fixedLanguage="en" />}>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="editions" element={<EditionsPage />} />
            <Route path="editions/:editionSlug" element={<EditionDetailPage />} />
            <Route path="editions/:editionSlug/days/:dayNumber" element={<DayDetailPage />} />
            <Route path="news" element={<NewsPage />} />
            <Route path="news/:newsSlug" element={<NewsDetailPage />} />
            <Route path="contact" element={<ContactPage />} />
          </Route>
        </Route>
        <Route path="sq" element={<LanguageBoundary fixedLanguage="sq" />}>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="editions" element={<EditionsPage />} />
            <Route path="editions/:editionSlug" element={<EditionDetailPage />} />
            <Route path="editions/:editionSlug/days/:dayNumber" element={<DayDetailPage />} />
            <Route path="news" element={<NewsPage />} />
            <Route path="news/:newsSlug" element={<NewsDetailPage />} />
            <Route path="contact" element={<ContactPage />} />
          </Route>
        </Route>
        <Route path="en/*" element={<LegacyPublicRedirect />} />
        <Route path="admin/login" element={isStatic ? <Navigate to="/" replace /> : <AdminLogin />} />
        <Route path="admin" element={isStatic ? <Navigate to="/" replace /> : <RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<Dashboard />} />
          <Route path="homepage" element={<HomepageEditor />} />
          <Route path="home-content" element={<ResourcePage resource="pages" scope={{ pageKey: "home" }} title="Homepage text & media" />} />
          <Route path="about" element={<AboutEditor />} />
          <Route path="editions" element={<ResourcePage resource="editions" />} />
          <Route path="editions/:id" element={<ResourceEditorPage resource="editions" />} />
          <Route path="days" element={<ResourcePage resource="days" />} />
          <Route path="days/:id" element={<ResourceEditorPage resource="days" />} />
          <Route path="activities" element={<ResourcePage resource="activities" />} />
          <Route path="activities/:id" element={<ResourceEditorPage resource="activities" />} />
          <Route path="program" element={<ResourcePage resource="program" />} />
          <Route path="program/:id" element={<ResourceEditorPage resource="program" />} />
          <Route path="news" element={<ResourcePage resource="news" />} />
          <Route path="news/:id" element={<ResourceEditorPage resource="news" />} />
          <Route path="galleries" element={<ResourcePage resource="galleries" />} />
          <Route path="media" element={<MediaLibrary />} />
          <Route path="media/folders" element={<MediaLibrary />} />
          <Route path="sponsors" element={<ResourcePage resource="sponsors" />} />
          <Route path="awards" element={<ResourcePage resource="awards" />} />
          <Route path="contact" element={<ContactEditor />} />
          <Route path="navigation" element={<NavigationEditor />} />
          <Route path="footer" element={<FooterEditor />} />
          <Route path="languages" element={<ResourcePage resource="languages" />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminAuthProvider></Router>
  );
}
