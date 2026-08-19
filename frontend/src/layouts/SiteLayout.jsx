import { Outlet } from "react-router-dom";
import { contentService } from "../services/contentService";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
const site = contentService.getSite();
export function SiteLayout() {
  return (
    <>
      <Navbar site={site} />
      <main>
        <Outlet />
      </main>
      <Footer site={site} />
    </>
  );
}
