import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";
export function Footer({ site }) {
  return (
    <footer>
      <div className="footer-grid">
        <div>
          <BrandMark />
        </div>
        <div>
          <h3>Festival</h3>
          {site.navigation.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </div>
        <div>
          <h3>Contact us</h3>
          <Link to="/contact">Contact page</Link>
          <span>Prishtina, Kosovo</span>
        </div>
        <div>
          <h3>Follow us</h3>
          {site.socialLinks.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>
      </div>
      <p className="copyright">
        © 2026 Prishtina International Theatre Festival. All rights reserved.
      </p>
    </footer>
  );
}
