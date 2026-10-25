import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { TravelProvider } from "./lib/TravelContext.jsx";
import "./index.css";

class BootBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <p style={{ margin: 24, fontFamily: "system-ui, sans-serif", color: "#f6efe4" }}>
          {this.state.error.message || "Safar could not start."}
        </p>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BootBoundary>
      <BrowserRouter>
        <TravelProvider>
          <App />
        </TravelProvider>
      </BrowserRouter>
    </BootBoundary>
  </StrictMode>,
);
