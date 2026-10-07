import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const node = document.getElementById("root");
if (!node) throw new Error("root element missing");

createRoot(node).render(<StrictMode><App /></StrictMode>);
