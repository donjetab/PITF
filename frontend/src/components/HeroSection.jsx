import { Link } from "react-router-dom";

export function HeroSection({ content }) {
  return (
    <section className="hero-section" style={content.imageSrc ? { "--hero-image": `url("${content.imageSrc}")` } : undefined}>
      <div className="hero-content">
        <h1 className="hero-title-animated">
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
        <Link className="outline-button" to={content.ctaUrl || "/about"}>
          {content.ctaText || "Discover more"}
        </Link>
      </div>
    </section>
  );
}
