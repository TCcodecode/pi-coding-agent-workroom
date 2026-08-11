import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./styles.css";

// Keep the default theme on the document as well as the workspace root so
// Radix portals (menus and dialogs mounted under body) use the light palette.
document.documentElement.classList.add("theme-light");
document.body.classList.add("theme-light");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
