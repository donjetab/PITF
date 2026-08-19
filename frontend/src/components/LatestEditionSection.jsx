import { Link } from "react-router-dom";

export function LatestEditionSection({ edition }) {
  return (
    <section className="latest">
      <div className="latest__copy">
        <img className="latest__smoke" src="/assets/smoke.png" alt="" />

        <h2 className="latest__title">
          <strong className="latest__number">
            {edition.number}
            <sup>th</sup>
          </strong>
          <span>Edition of PITF</span>
        </h2>

        <p className="edition-tagline">{edition.description}</p>
        <p>
          The Prishtina International Theatre Festival celebrates its 10th
          edition in 2026, honouring a decade of bold stories, fearless artists,
          and deep connections across borders.
        </p>
        <Link className="outline-button" to="/editions">
          Explore the edition <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="latest__divider" aria-hidden="true">
        <img src="/assets/act-outline-icon.png" alt="" />
      </div>

      <div className="latest__art">
        <img src="/assets/latest-edition-pic.jpg" alt="PITF theatre performance" />
        <b>18–23 May 2026</b>
      </div>
    </section>
  );
}
