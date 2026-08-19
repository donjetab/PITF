export function NewsletterSection({ content }) {
  function submit(event) {
    event.preventDefault();
  }
  return (
    <section className="newsletter">
      <div>
        <p className="kicker">{content.kicker}</p>
        <h2>{content.title}</h2>
        <p>{content.text}</p>
      </div>
      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="newsletter-email">
          Your email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          placeholder="Your email address"
          required
        />
        <button className="outline-button" type="submit">
          Subscribe
        </button>
      </form>
    </section>
  );
}
