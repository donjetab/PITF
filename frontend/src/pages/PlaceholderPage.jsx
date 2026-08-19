import { Link } from "react-router-dom";
export function PlaceholderPage({ title }) {
  return (
    <section className="placeholder-page section-shell">
      <p className="kicker">PITF</p>
      <h1>{title}</h1>
      <p>This page is prepared for the next project phase.</p>
      <Link className="outline-button" to="/">
        Back to homepage
      </Link>
    </section>
  );
}
