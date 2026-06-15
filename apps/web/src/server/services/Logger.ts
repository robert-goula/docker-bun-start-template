import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "password",
      "*.password",
      "user.password",
      "req.body.password",
      "req.headers.cookie",
      "req.headers.authorization",
      "email",
      "*.email",
      "user.email",
      "hash",
      "*.hash",
    ],
    censor: "[REDACTED]",
    remove: false,
  },
});
