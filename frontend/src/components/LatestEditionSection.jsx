import { Link } from "react-router-dom";

export function LatestEditionSection({ edition }) {
  return (
    <section className="latest">
      <div className="latest__copy">
        <img className="latest__smoke" src={`${import.meta.env.BASE_URL}assets/smoke.png`} alt="" />

        <h2 className="latest__title">
          <strong className="latest__number">
            {edition.number}
            <sup>th</sup>
          </strong>
          <span>{edition.featureTitle || "Edition of PITF"}</span>
        </h2>

        <p className="edition-tagline">
          <span>{edition.title}</span>
          <span>{edition.storySubtitle || "A celebration of theatre."}</span>
        </p>
        {edition.featureText && <p>{edition.featureText}</p>}
        <p className="latest__date">{edition.dateLabel || edition.year}</p>
        <Link className="outline-button" to={`/editions/${edition.slug}`}>
          Explore the edition <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="latest__divider" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}assets/act-outline-icon.png`} alt="" />
      </div>

      <div className="latest__art">
        <img src={edition.detailHeaderSrc || edition.bannerSrc || `${import.meta.env.BASE_URL}assets/latest-edition-pic.jpg`} alt={`${edition.title} header`} />
        <b>{edition.dateLabel || edition.year}</b>
      </div>
    </section>
  );
}
