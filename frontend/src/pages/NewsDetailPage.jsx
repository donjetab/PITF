import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { NewsletterSection } from "../components/NewsletterSection";
import { contentService, useContentData, useNewsDetail } from "../services/contentService";
import { PublicLoading } from "../components/PublicLoading";

function formatArticleDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function ArticleBody({ body, summary }) {
  const text = body || summary;
  if (/<\/?[a-z][\s\S]*>/i.test(text)) {
    const documentNode = new DOMParser().parseFromString(text, "text/html");
    const allowedTags = new Set(["P", "DIV", "BR", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "H2", "H3", "BLOCKQUOTE", "A"]);
    for (const element of [...documentNode.body.querySelectorAll("*")]) {
      if (!allowedTags.has(element.tagName)) {
        element.replaceWith(...element.childNodes);
        continue;
      }
      const href = element.tagName === "A" ? element.getAttribute("href") : null;
      for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
      if (element.tagName === "A" && href && /^(https?:|mailto:|\/)/i.test(href)) {
        element.setAttribute("href", href);
        element.setAttribute("rel", "noopener noreferrer");
      }
    }
    return <div className="news-article__richtext" dangerouslySetInnerHTML={{ __html: documentNode.body.innerHTML }} />;
  }
  const paragraphs = text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  return paragraphs.map((paragraph, index) => <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>);
}

function externalHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return "External coverage"; }
}

export function NewsDetailPage() {
  const { newsSlug } = useParams();
  const { language } = useContentData();
  const languagePrefix = language === "sq" ? "/sq" : "";
  const article = useNewsDetail(newsSlug);
  const newsletter = contentService.getHomeContent().newsletter;

  if (article === undefined) return <PublicLoading label="Preparing the story" />;

  if (article === null) {
    return (
      <section className="news-article news-article--missing section-shell">
        <h1>Story not found</h1>
        <Link className="outline-button" to={`${languagePrefix}/news`}>Back to news</Link>
      </section>
    );
  }

  const gallery = article.mediaImages?.slice(1, 7) || [];

  return (
    <div className="news-article-page">
      <article className="news-article section-shell">
        <header className="news-article__header">
          <Link className="news-article__back" to={`${languagePrefix}/news`}><ArrowLeft aria-hidden="true" /> All news</Link>
          <div className="news-article__meta"><span>PITF {article.editionYear}</span><i aria-hidden="true" /><span>{article.suggestedType?.replaceAll("-", " ") || "Festival news"}</span><i aria-hidden="true" /><time dateTime={article.date}>{formatArticleDate(article.date)}</time></div>
          <h1>{article.title}</h1>
        </header>

        {article.imageSrc && (
          <figure className="news-article__lead">
            <img src={article.imageSrc} alt="" />
          </figure>
        )}

        {!article.imageSrc && article.videos?.[0] && (
          <figure className="news-article__lead">
            <video controls playsInline preload="metadata" poster={article.videos[0].poster || undefined}>
              <source src={article.videos[0].src} />
            </video>
          </figure>
        )}

        <div className="news-article__body">
          <ArticleBody body={article.body} summary={article.summary} />
        </div>

        {gallery.length > 0 && (
          <section className="news-article__gallery" aria-label="Article gallery">
            {gallery.map((image, index) => <img src={image} alt="" loading="lazy" key={`${image}-${index}`} />)}
          </section>
        )}

        {article.externalLinks?.length > 0 && (
          <section className="news-article__coverage" aria-labelledby="related-coverage-title">
            <div className="news-article__coverage-heading">
              <p>Related coverage</p>
              <h2 id="related-coverage-title">Read more about this story</h2>
            </div>
            <div className="news-article__coverage-grid">
              {article.externalLinks.map((link, index) => (
                <a href={link.url} target={link.target || "_blank"} rel="noopener noreferrer" key={`${link.url}-${index}`}>
                  <span>{externalHost(link.url)}</span>
                  <h3>{link.label || "View external article"}</h3>
                  <strong>Open article <i aria-hidden="true">→</i></strong>
                </a>
              ))}
            </div>
          </section>
        )}
      </article>
      <NewsletterSection content={newsletter} />
    </div>
  );
}
