
  import { createRoot } from "react-dom/client";
  import { SentryErrorBoundary } from "./app/sentry";
  import { ErrorFallback } from "./app/errorFallback";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(
    <SentryErrorBoundary fallback={ErrorFallback}>
      <App />
    </SentryErrorBoundary>,
  );
