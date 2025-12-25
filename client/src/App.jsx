import { useEffect, useState } from "react";

export default function App() {
  const [msg, setMsg] = useState("loading...");

  useEffect(() => {
    fetch("http://localhost:5050/health")
      .then((r) => r.json())
      .then((data) => setMsg(data.message))
      .catch(() => setMsg("failed to reach backend"));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Solo Level System</h1>
      <p>Backend says: {msg}</p>
    </div>
  );
}
