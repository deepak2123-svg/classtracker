import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { onAuth } from "./firebase";
import { Spinner } from "./shared.jsx";
import Auth from "./Auth";
import ClassTracker from "./ClassTracker";

function App() {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => onAuth(setUser), []);

  if (user === undefined) return <Spinner text="Loading…" />;
  if (!user) return <Auth />;
  return <ClassTracker user={user} />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode><App /></StrictMode>
);
