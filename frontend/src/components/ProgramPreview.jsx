import { Link } from "react-router-dom";
import { ProgramCard } from "./ProgramCard";
export function ProgramPreview({ items }) {
  return (
    <section className="program-section section-shell">
      <div className="section-heading">
        <h2>2026 Program</h2>
        <Link to="/editions">
          View full program <span>→</span>
        </Link>
      </div>
      <div className="program-track">
        {items.map((item) => (
          <ProgramCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
