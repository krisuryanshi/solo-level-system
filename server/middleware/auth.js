import jwt from "jsonwebtoken";

export default function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [kind, token] = header.split(" ");

    if (kind !== "Bearer" || !token) {
      return res.status(401).json({ ok: false, message: "Missing auth token" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    req.username = payload.username;

    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid or expired token" });
  }
}
