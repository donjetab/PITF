import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NewsletterSection } from "../components/NewsletterSection";
import { NewsCard } from "../components/NewsCard";
import { contentService, useNewsArchive } from "../services/contentService";
import { PublicLoading } from "../components/PublicLoading";
import { isStatic } from "../services/contentSource";

const pageSize = 12;

function editionLabel(number) {
  const remainder = number % 100;
  if (remainder >= 11 && remainder <= 13) return `${number}th`;
  if (number % 10 === 1) return `${number}st`;
  if (number % 10 === 2) return `${number}nd`;
  if (number % 10 === 3) return `${number}rd`;
  return `${number}th`;
}

function paginationModel(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index);

  const pages = new Set([0, total - 1, current - 1, current, current + 1]);
  const ordered = [...pages].filter((index) => index >= 0 && index < total).sort((a, b) => a - b);
  const result = [];

  ordered.forEach((index, position) => {
    if (position && index - ordered[position - 1] > 1) result.push(`ellipsis-${index}`);
    result.push(index);
  });

  return result;
}

export function NewsPage() {
  const { ready } = useNewsArchive();
  const news = contentService.getNews();
  const newsletter = contentService.getHomeContent().newsletter;
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const editions = contentService.getEditions().sort((a, b) => b.number - a.number);
  const hero = contentService.getPageContent("news", "hero")?.content || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedEdition = searchParams.get("edition");
  const editionFilter = requestedEdition && editions.some((edition) => String(edition.number) === requestedEdition)
    ? requestedEdition
    : "all";
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = news.filter((item) => {
    const matchesEdition = editionFilter === "all" || item.editionId === Number(editionFilter);
    const matchesQuery = `${item.title} ${item.summary} ${item.body}`.toLowerCase().includes(normalizedQuery);
    return matchesEdition && matchesQuery;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const featured = news.find((item) => item.imageSrc) || news[0];
  const paginationPages = paginationModel(page, pageCount);

  function updateQuery(event) {
    setQuery(event.target.value);
    setPage(0);
  }

  function updateEdition(value) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === "all") next.delete("edition");
      else next.set("edition", value);
      return next;
    }, { replace: true });
    setPage(0);
  }

  if (!ready) return <PublicLoading label="Gathering the stories" />;

  return (
    <div className="news-page">
      <header className="news-hero">
        {featured?.imageSrc && <img src={featured.imageSrc} alt="" />}
        <div className="news-hero__content section-shell">
          <h1>{hero.title || "News"}</h1>
          <div className="news-hero__ornament" aria-hidden="true"><i /><span>◈</span><i /></div>
          <p>{hero.text}</p>
          <label className="news-search">
            <span className="sr-only">Search news</span>
            <input value={query} onChange={updateQuery} type="search" placeholder="Search stories" />
            <span aria-hidden="true">⌕</span>
          </label>
        </div>
      </header>

      <main className="news-listing section-shell">
        <nav className="news-filters" aria-label="Filter news by edition">
          <button className={editionFilter === "all" ? "is-active" : ""} onClick={() => updateEdition("all")}>All editions</button>
          {editions.map((edition) => (
            <button
              className={editionFilter === String(edition.number) ? "is-active" : ""}
              onClick={() => updateEdition(String(edition.number))}
              key={edition.number}
            >
              {editionLabel(edition.number)} <span>{edition.year}</span>
            </button>
          ))}
        </nav>
        {visible.length ? <div className="news-grid">{visible.map((item) => <NewsCard item={isStatic && page > 0 ? { ...item, detailAvailable: false } : item} key={item.id} />)}</div> : <p className="news-empty">No stories match your search.</p>}
        {pageCount > 1 && (
          <nav className="news-pagination" aria-label="News pages">
            <button className="news-pagination__arrow" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}><ChevronLeft aria-hidden="true" /></button>
            {paginationPages.map((entry) => typeof entry === "string" ? (
              <span key={entry} aria-hidden="true">…</span>
            ) : (
              <button className={page === entry ? "is-active" : ""} aria-label={`Page ${entry + 1}`} aria-current={page === entry ? "page" : undefined} onClick={() => setPage(entry)} key={entry}>{entry + 1}</button>
            ))}
            <button className="news-pagination__arrow" aria-label="Next page" disabled={page === pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}><ChevronRight aria-hidden="true" /></button>
          </nav>
        )}
      </main>
      <NewsletterSection content={newsletter} />
    </div>
  );
}
