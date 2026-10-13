const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.JWT_SECRETE ||
  "development-secret-change-me";

function requireRole(role) {
  return (req, res, next) => {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      return res.status(401).json({ message: "Bearer token is required" });
    }

    try {
      req.user = jwt.verify(match[1], JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (
      role === "user" &&
      !req.user.id &&
      !req.user.sub &&
      !req.user.email
    ) {
      return res.status(401).json({ message: "Token is missing a user identity" });
    }
    next();
  };
}

module.exports = requireRole;
