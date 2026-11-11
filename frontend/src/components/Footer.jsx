import { Link, useLocation } from "react-router-dom";
import { BrandMark } from "./BrandMark";

function SocialIcon({ name }) {
  const icon = name.toLowerCase();

  if (icon === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4.25" />
        <circle className="social-icon__dot" cx="17.4" cy="6.7" r="1" />
      </svg>
    );
  }

  if (icon === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.2 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.8-.1-1.7-.2-2.5-.2-2.5 0-4.2 1.5-4.2 4.3v2.2H8v3.1h2.8v8h3.4Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.4 3c.4 2.2 1.7 3.6 3.9 4v3.1a8.1 8.1 0 0 1-3.9-1.2v6.2a6 6 0 1 1-5.2-5.9v3.2a2.8 2.8 0 1 0 2 2.7V3h3.2Z" />
    </svg>
  );
}

export function Footer({ site }) {
  const { pathname } = useLocation();
  const language = pathname.match(/^\/(en|sq)(?=\/|$)/)?.[1] || "en";
  const localized = (path) => `${language === "sq" ? "/sq" : ""}${path}`;
  const isEditionsRoute = pathname.startsWith(localized("/editions"));
  const isExternal = (item) => item.target === "_blank" || /^(https?:)?\/\//i.test(item.to);
  const sections = site.footerSections?.length ? site.footerSections : [
    { title: site.footerLabels?.festival || "Festival", items: site.navigation.map((item) => ({ label: item.label, url: item.to, target: item.target })) },
    { title: site.footerLabels?.contact || "Contact us", items: [{ label: site.footerLabels?.contactPage || "Contact page", url: "/contact" }, { label: site.location, url: "" }] },
    { title: site.footerLabels?.follow || "Follow us", items: site.socialLinks.map((item) => ({ label: item.label, url: item.href, target: "_blank" })) },
  ];

  return (
    <footer className={isEditionsRoute ? "footer--editions" : undefined}>
      <div className="footer-grid">
        <div>
          <BrandMark />
        </div>
        {sections.slice(0, 3).map((section, sectionIndex) => <div key={`${section.title}-${sectionIndex}`}><h3>{section.title}</h3>{(section.items || []).map((item, itemIndex) => {
          if (!item.url) return <span key={`${item.label}-${itemIndex}`}>{item.label}</span>;
          const normalized = { ...item, to: item.url };
          const hasSocialIcon = ["instagram", "facebook", "tiktok"].includes(item.label.toLowerCase());
          if (isExternal(normalized)) return <a className={hasSocialIcon ? "footer-social-link" : undefined} key={`${item.label}-${itemIndex}`} href={item.url} target={item.target || "_blank"} rel={item.target === "_blank" ? "noreferrer" : undefined}>{hasSocialIcon && <SocialIcon name={item.label} />}{item.label}</a>;
          return <Link key={`${item.label}-${itemIndex}`} to={localized(item.url)}>{item.label}</Link>;
        })}</div>)}
      </div>
      <img
        className="footer-decoration"
        src={`${import.meta.env.BASE_URL}assets/act-icon.png`}
        alt=""
        aria-hidden="true"
      />
      <p className="copyright">{site.copyright}</p>
    </footer>
  );
}
