try { require("dotenv").config(); } catch (e) {}
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.get("/health", (req, res) =>
  res.json({ status: "ok", project: "Team D: Link Shortener + Analytics", stack: "node" })
);

app.post("/api/shorten", (req, res) => {
  // TODO: Body: {url, alias?} -> {code}
  res.status(501).json({ error: "Not implemented", todo: "Body: {url, alias?} -> {code}" });
});

app.get("/r/:code", (req, res) => {
  // TODO: Redirect to the original URL
  res.status(501).json({ error: "Not implemented", todo: "Redirect to the original URL" });
});

app.get("/api/stats/:code", (req, res) => {
  // TODO: Click analytics for a link
  res.status(501).json({ error: "Not implemented", todo: "Click analytics for a link" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Team D server running on http://localhost:${PORT}`));
