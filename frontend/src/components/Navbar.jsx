import { useState } from "react";
import { NavLink } from "react-router-dom";
import { BrandMark } from "./BrandMark";
export function Navbar({ site }) {
  const [open, setOpen] = useState(false),
    [language, setLanguage] = useState("EN");
  return (
    <header className="navbar">
      <NavLink to="/" onClick={() => setOpen(false)}>
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
        {site.navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {item.label}
          </NavLink>
        ))}
        <div
          className="language-toggle"
          role="group"
          aria-label="Select language"
        >
          {["EN", "SQ"].map((code) => (
            <button
              key={code}
              type="button"
              className={language === code ? "active" : ""}
              aria-pressed={language === code}
              onClick={() => setLanguage(code)}
            >
              {code}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}
