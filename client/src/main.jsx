import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { TravelProvider } from "./lib/TravelContext.jsx";
import "./index.css";

function MarkBooted() {
  useEffect(() => {
    document.getElementById("root")?.setAttribute("data-booted", "1");
  }, []);
  return null;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <TravelProvider>
        <MarkBooted />
        <App />
      </TravelProvider>
    </BrowserRouter>
  </StrictMode>,
);
