import { Link } from "react-router-dom";

export function HeroSection({ content }) {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <h1>
          {content.titleParts.map((part) => (
            <span key={part} className="hero-title-line">
              {part.split(" ").map((word) => (
                <span key={word} className="hero-title-word">
                  <span className="hero-title-initial">{word[0]}</span>
                  {word.slice(1)}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <p>{content.description}</p>
        <Link className="outline-button" to="/about">
          Discover more
        </Link>
      </div>
    </section>
  );
}
