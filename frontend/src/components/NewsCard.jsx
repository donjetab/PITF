import { Link } from "react-router-dom";
import { useContentData } from "../services/contentService";

function formatNewsDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function NewsCard({ item }) {
  const { language } = useContentData();
  const clickable = item.detailAvailable !== false;
  const link = item.isExternalOnly && item.externalUrl ? item.externalUrl : `${language === "sq" ? "/sq" : ""}/news/${item.slug}`;
  const external = item.isExternalOnly && item.externalUrl;
  const content = <article className="news-card">
      <div className="news-card__media">
        {item.imageSrc ? <img src={item.imageSrc} alt="" loading="lazy" /> : item.videoSrc ? <video src={item.videoSrc} muted playsInline preload="metadata" aria-hidden="true" /> : <span>PITF {item.editionYear}</span>}
      </div>
      <div className="news-card__body">
        <p><time dateTime={item.date}>{formatNewsDate(item.date)}</time><i>·</i>{item.suggestedType?.replaceAll("-", " ") || "Festival"}</p>
        <h2>{item.title}</h2>
        <p className="news-card__summary">{item.summary || item.body}</p>
        {clickable && <span className="news-card__link">Read more <span aria-hidden="true">→</span></span>}
      </div>
    </article>;
  if (!clickable) return <div className="news-card__target">{content}</div>;
  return external
    ? <a className="news-card__target" href={link} target={item.externalTarget} rel="noreferrer" aria-label={`Read ${item.title}`}>{content}</a>
    : <Link className="news-card__target" to={link} aria-label={`Read ${item.title}`}>{content}</Link>;
}
