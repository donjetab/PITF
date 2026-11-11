import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProgramCard } from "./ProgramCard";

export function ProgramPreview({ items, content = {}, editionYear }) {
  const programYear = editionYear || (items[0]?.startsAt ? new Date(items[0].startsAt).getFullYear() : "PITF");
  const trackRef = useRef(null);
  const [sliderState, setSliderState] = useState({
    hasOverflow: false,
    canGoBack: false,
    canGoForward: false,
  });

  const updateSliderState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const maxScroll = track.scrollWidth - track.clientWidth;
    setSliderState({
      hasOverflow: maxScroll > 1,
      canGoBack: track.scrollLeft > 1,
      canGoForward: track.scrollLeft < maxScroll - 1,
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    updateSliderState();
    const observer = new ResizeObserver(updateSliderState);
    observer.observe(track);
    track.addEventListener("scroll", updateSliderState, { passive: true });

    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", updateSliderState);
    };
  }, [items.length, updateSliderState]);

  const move = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * track.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  return (
    <section className="program-section section-shell">
      <div className="section-heading">
        <h2>{programYear} {content.title || "Program"}</h2>
        <Link to="/editions">
          {content.linkText || "View full program"} <span>→</span>
        </Link>
      </div>
      <div
        className={`program-slider${sliderState.hasOverflow ? " has-overflow" : ""}${sliderState.canGoBack ? " can-go-back" : ""}${sliderState.canGoForward ? " can-go-forward" : ""}`}
      >
        {sliderState.hasOverflow && (
          <button
            type="button"
            className="program-slider__arrow"
            onClick={() => move(-1)}
            disabled={!sliderState.canGoBack}
            aria-label="Previous plays"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
        )}
        <div className="program-track" ref={trackRef}>
          {items.map((item) => (
            <ProgramCard key={item.id} item={item} />
          ))}
        </div>
        {sliderState.hasOverflow && (
          <button
            type="button"
            className="program-slider__arrow"
            onClick={() => move(1)}
            disabled={!sliderState.canGoForward}
            aria-label="Next plays"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
