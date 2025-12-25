import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "server is running" });
});

const PORT = 5050;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
