import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { BrandMark } from "./BrandMark";
export function Navbar({ site, editions, language, onLanguageChange }) {
  const { pathname } = useLocation();
  const localized = (path) => `${language === "sq" ? "/sq" : ""}${path}`;
  const isEditionsRoute = pathname.startsWith(localized("/editions"));
  const [open, setOpen] = useState(false),
    [editionsOpen, setEditionsOpen] = useState(false),
    [scrolled, setScrolled] = useState(false);
  const orderedEditions = [...editions].sort((first, second) => second.number - first.number || second.year - first.year);
  const editionYears = orderedEditions.map((edition) => edition.year).filter(Boolean);

  useEffect(() => {
    setOpen(false);
    setEditionsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 32);
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  const closeNavigation = () => {
    setOpen(false);
    setEditionsOpen(false);
  };

  const isExternal = (item) => item.target === "_blank" || /^(https?:)?\/\//i.test(item.to);

  return (
    <header className={`navbar${isEditionsRoute ? " navbar--editions" : ""}${scrolled ? " navbar--scrolled" : ""}`}>
      <NavLink to={localized("/")} onClick={closeNavigation}>
        <BrandMark compact />
      </NavLink>
      <button
        className="menu-button"
        type="button"
        aria-expanded={open}
        aria-controls="main-navigation"
        onClick={() => setOpen(!open)}
      >
        <span />
        <span />
        <span />
        <span className="sr-only">Menu</span>
      </button>
      <nav
        id="main-navigation"
        className={open ? "nav-links is-open" : "nav-links"}
        aria-label="Primary navigation"
      >
        {site.navigation.map((item) =>
          item.to === "/editions" ? (
            <div
              className={`nav-editions${editionsOpen ? " is-open" : ""}`}
              key={item.to}
              onMouseEnter={() => setEditionsOpen(true)}
              onMouseLeave={() => setEditionsOpen(false)}
              onFocus={() => setEditionsOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setEditionsOpen(false);
                }
              }}
            >
              <div className="nav-editions__controls">
                <NavLink
                  className={isEditionsRoute ? "active" : undefined}
                  to={localized(item.to)}
                  onClick={closeNavigation}
                >
                  {item.label}
                </NavLink>
                <button
                  className="nav-editions__toggle"
                  type="button"
                  aria-label="Show PITF editions"
                  aria-expanded={editionsOpen}
                  aria-controls="editions-navigation"
                  onClick={() => setEditionsOpen((current) => !current)}
                >
                  <svg aria-hidden="true" viewBox="0 0 12 8">
                    <path d="m1 1 5 5 5-5" />
                  </svg>
                </button>
              </div>
              <div id="editions-navigation" className="nav-editions__menu">
                <div className="nav-editions__heading">
                  <span>PITF archive</span>
                  <small>{editionYears.length ? `${Math.min(...editionYears)}—${Math.max(...editionYears)}` : "PITF"}</small>
                </div>
                <div className="nav-editions__grid">
                {orderedEditions.map((edition) => (
                  <NavLink
                    key={edition.id}
                    to={localized(`/editions/${edition.slug}`)}
                    onClick={closeNavigation}
                  >
                    <span>{String(edition.number).padStart(2, "0")} Edition</span>
                    <small>{edition.year}</small>
                  </NavLink>
                ))}
                </div>
                <NavLink
                  className="nav-editions__all"
                  to={localized("/editions")}
                  onClick={closeNavigation}
                >
                  Explore all editions <span aria-hidden="true">→</span>
                </NavLink>
              </div>
            </div>
          ) : isExternal(item) ? (
            <a
              key={item.to}
              href={item.to}
              target={item.target || "_blank"}
              rel={item.target === "_blank" ? "noreferrer" : undefined}
              onClick={closeNavigation}
            >
              {item.label}
            </a>
          ) : (
            <NavLink
              key={item.to}
              to={localized(item.to)}
              onClick={closeNavigation}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.label}
            </NavLink>
          ),
        )}
        <div
          className="language-toggle"
          role="group"
          aria-label="Select language"
        >
          {["EN", "SQ"].map((code) => (
            <button
              key={code}
              type="button"
              className={language === code.toLowerCase() ? "active" : ""}
              aria-pressed={language === code.toLowerCase()}
              onClick={() => onLanguageChange(code)}
            >
              {code}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}
