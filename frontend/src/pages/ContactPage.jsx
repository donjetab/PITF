import { ArrowUpRight, Mail, MapPin, Send } from "lucide-react";
import { NewsletterSection } from "../components/NewsletterSection";
import { contentService, useContentData } from "../services/contentService";
import { PublicLoading } from "../components/PublicLoading";

const copy = {
  en: { title: "Contact us", eyebrow: "PITF welcomes your message", intro: "Questions about the festival, programme, partnerships or press? Reach our team directly.", location: "Find us", message: "Send a message", name: "Your name", email: "Email address", subject: "Subject", body: "How can we help?", send: "Compose email", direct: "Contact PITF directly", write: "Email our team" },
  sq: { title: "Na kontaktoni", eyebrow: "PITF mirëpret mesazhin tuaj", intro: "Pyetje për festivalin, programin, partneritetet apo mediat? Kontaktoni ekipin tonë drejtpërdrejt.", location: "Na gjeni", message: "Dërgoni një mesazh", name: "Emri juaj", email: "Adresa e emailit", subject: "Subjekti", body: "Si mund t'ju ndihmojmë?", send: "Përgatit emailin", direct: "Kontaktoni PITF drejtpërdrejt", write: "Shkruani ekipit tonë" },
};

export function ContactPage() {
  const { ready, language } = useContentData();
  const contact = contentService.getContact();
  const newsletter = contentService.getHomeContent().newsletter;
  const text = { ...(copy[language] || copy.en), ...contact };
  const location = contact.settings?.["contact.location"] || "Prishtina, Kosovo";
  const email = contact.emailAddress || contact.settings?.["contact.email"] || "pitf@aab-edu.net";
  const instagram = contact.instagramUrl || (contact.settings?.["social.instagram"] && contact.settings["social.instagram"] !== "#" ? contact.settings["social.instagram"] : "https://www.instagram.com/prishtinaitf/");
  const facebook = contact.facebookUrl || (contact.settings?.["social.facebook"] && contact.settings["social.facebook"] !== "#" ? contact.settings["social.facebook"] : "https://www.facebook.com/search/top?q=Prishtina%20International%20Theater%20Festival");
  const tiktok = contact.tiktokUrl || (contact.settings?.["social.tiktok"] && contact.settings["social.tiktok"] !== "#" ? contact.settings["social.tiktok"] : "https://www.tiktok.com/@prishtinaitf");
  const mapUrl = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1467.5204358892984!2d21.112436258848692!3d42.63929348072231!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x13549f005d591c87%3A0x2473b114eef9fd14!2zVGVhdHJpIEFBQiDigJxGYXJ1ayBCZWdvbGxp4oCd!5e0!3m2!1sen!2s!4v1791282812331!5m2!1sen!2s";

  function composeEmail(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = data.get("subject") || "PITF enquiry";
    const body = `${data.get("message")}\n\n${data.get("name")}\n${data.get("email")}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  if (!ready) return <PublicLoading label="Preparing the page" />;
  return <div className="contact-page">
    <header className="contact-hero"><img src={contact.imageSrc || `${import.meta.env.BASE_URL}assets/hero-background.jpg`} alt="" /><div className="contact-hero__content section-shell"><p className="contact-hero__eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><div className="contact-hero__ornament" aria-hidden="true"><i /><span>◇</span><i /></div><p>{text.intro}</p></div></header>
    <main className="contact-main">
      <div className="contact-main__inner section-shell">
      <section className="contact-workspace">
        <div className="contact-location"><div className="contact-section-title"><MapPin aria-hidden="true" /><div><span>01</span><h2>{text.location}</h2></div></div><div className="contact-map"><iframe src={mapUrl} title="Teatri AAB Faruk Begolli map" loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div><a href="https://www.google.com/maps/search/?api=1&query=Teatri%20AAB%20Faruk%20Begolli" target="_blank" rel="noreferrer"><span>Teatri AAB “Faruk Begolli”, {location}</span><ArrowUpRight aria-hidden="true" /></a></div>
        <form className="contact-form" onSubmit={composeEmail}><div className="contact-section-title"><Mail aria-hidden="true" /><div><span>02</span><h2>{text.message}</h2></div></div><div className="contact-form__row"><label>{text.name}<input name="name" required autoComplete="name" /></label><label>{text.email}<input name="email" required type="email" autoComplete="email" /></label></div><label>{text.subject}<input name="subject" required /></label><label>{text.body}<textarea name="message" required rows="7" /></label><button type="submit"><Send aria-hidden="true" />{text.send}</button></form>
      </section>
      <section className="contact-direct" aria-labelledby="contact-direct-title"><div><span>PITF</span><h2 id="contact-direct-title">{text.direct}</h2></div><nav><a href={`mailto:${email}`}><Mail aria-hidden="true" /><span><small>{text.write}</small><strong>{email}</strong></span><ArrowUpRight aria-hidden="true" /></a><a href={instagram} target="_blank" rel="noreferrer"><b className="contact-social-card__mark">IG</b><span><small>{text.instagramLabel || "Instagram"}</small><strong>{text.instagramHandle || "@prishtinaitf"}</strong></span><ArrowUpRight aria-hidden="true" /></a><a href={facebook} target="_blank" rel="noreferrer"><b className="contact-social-card__mark">FB</b><span><small>{text.facebookLabel || "Facebook"}</small><strong>{text.facebookName || "Prishtina International Theatre Festival"}</strong></span><ArrowUpRight aria-hidden="true" /></a><a href={tiktok} target="_blank" rel="noreferrer"><b className="contact-social-card__mark">TT</b><span><small>{text.tiktokLabel || "TikTok"}</small><strong>{text.tiktokHandle || "@prishtinaitf"}</strong></span><ArrowUpRight aria-hidden="true" /></a></nav></section>
      </div>
    </main>
    <NewsletterSection content={newsletter} />
  </div>;
}
