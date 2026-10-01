import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

class Erro extends React.Component {
  state = { e: null };
  static getDerivedStateFromError(e) { return { e }; }
  render() {
    if (this.state.e)
      return (
        <div style={{ background: "#15171b", color: "#f3f0ea", minHeight: "100vh", padding: 24, fontFamily: "system-ui,sans-serif" }}>
          <h2 style={{ color: "#f28c0f" }}>Erro no app</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.e?.message || this.state.e)}</pre>
        </div>
      );
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(<Erro><App /></Erro>);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
