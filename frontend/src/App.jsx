import { BrowserRouter, Route, Routes } from "react-router-dom";
import { SiteLayout } from "./layouts/SiteLayout";
import { HomePage } from "./pages/HomePage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import "./App.css";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route
            path="about"
            element={<PlaceholderPage title="About PITF" />}
          />
          <Route
            path="editions"
            element={<PlaceholderPage title="PITF Editions" />}
          />
          <Route path="news" element={<PlaceholderPage title="News" />} />
          <Route path="contact" element={<PlaceholderPage title="Contact" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
