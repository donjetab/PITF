import { Link } from "react-router-dom";
import { contentService, useContentData } from "../services/contentService";
import { PublicLoading } from "../components/PublicLoading";
export function PlaceholderPage({ title }) {
  const { ready } = useContentData();
  const contact = contentService.getContact();
  if (!ready) return <PublicLoading label="Preparing the page" />;
  return (
    <section className="placeholder-page section-shell">
      <p className="kicker">PITF</p>
      <h1>{contact.title || title}</h1>
      <p>This page is prepared for the next project phase.</p>
      {contact.settings?.["contact.location"] && <p>{contact.settings["contact.location"]}</p>}
      <Link className="outline-button" to="/">
        Back to homepage
      </Link>
    </section>
  );
}
