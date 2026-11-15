import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="error-screen">
          <h1>Core-aura could not open</h1>
          <p>Your saved sessions remain on this device.</p>
          <button onClick={() => location.reload()}>Try again</button>
          <a href="/update.html">Update player</a>
        </main>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
