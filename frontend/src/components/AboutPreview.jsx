import { Link } from "react-router-dom";

export function AboutPreview({ content }) {
  const titleLines = content.title.split(". ");

  return (
    <section id="about" className="about section-shell">
      <img
        className="about__image"
        src={content.imageSrc || `${import.meta.env.BASE_URL}assets/theatre-image.png`}
        alt="An empty PITF theatre stage"
      />

      <div className="about__copy">
        <p className="kicker">{content.kicker}</p>
        <h2>
          {titleLines.map((line, index) => (
            <span key={line}>
              {line}
              {index < titleLines.length - 1 ? "." : ""}
            </span>
          ))}
        </h2>

        {content.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}

        <Link className="outline-button" to="/about">
          Learn more
        </Link>
      </div>
    </section>
  );
}
