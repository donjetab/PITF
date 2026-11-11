import { useEffect, useLayoutEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { contentService, useContentData } from "../services/contentService";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
export function SiteLayout() {
  const { language } = useContentData();
  const location = useLocation();
  const navigate = useNavigate();
  const site = contentService.getSite();
  const editions = contentService.getEditions();
  const [showBackToTop, setShowBackToTop] = useState(false);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    const updateBackToTop = () => setShowBackToTop(window.scrollY > 520);
    updateBackToTop();
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    return () => window.removeEventListener("scroll", updateBackToTop);
  }, []);

  return (
    <>
      <Navbar site={site} editions={editions} language={language} onLanguageChange={(nextLanguage) => {
        const code = nextLanguage.toLowerCase();
        const pathWithoutLanguage = location.pathname.replace(/^\/(en|sq)(?=\/|$)/, "") || "/";
        const newsMatch = pathWithoutLanguage.match(/^\/news\/([^/]+)$/);
        const localizedPath = newsMatch ? `/news/${contentService.getLocalizedNewsSlug(decodeURIComponent(newsMatch[1]), code)}` : pathWithoutLanguage;
        contentService.setLanguage(code);
        navigate(`${code === "sq" ? "/sq" : ""}${localizedPath === "/" ? "/" : localizedPath}${location.search}${location.hash}`);
      }} />
      <main>
        <Outlet />
      </main>
      <button
        className={`back-to-top${showBackToTop ? " is-visible" : ""}`}
        type="button"
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUp aria-hidden="true" />
      </button>
      <Footer site={site} />
    </>
  );
}
