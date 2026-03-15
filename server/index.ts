import "dotenv/config";
import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { sql } from "drizzle-orm";
import path from "path";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Serve uploaded profile photos as static files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Apply schema migrations idempotently; skip on timeout so server still boots
  await Promise.race([
    (async () => {
      try {
        await db.execute(sql`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false`);
        await db.execute(sql`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo text`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_code text`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at timestamp`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now()`);
        // Mark seeded demo accounts as verified so they can log in
        await db.execute(sql`UPDATE users SET email_verified = true WHERE email IN ('admin@university.edu','staff@university.edu','student@university.edu')`);
        console.log("[migrate] user profile columns ready");
      } catch (_) {}
    })(),
    new Promise<void>((resolve) => setTimeout(resolve, 8000)),
  ]);

  const { seed } = await import("./seed");
  await seed();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const isWindows = process.platform === "win32";
  httpServer.listen(
    isWindows
      ? { port, host: "127.0.0.1" }
      : { port, host: "0.0.0.0", reusePort: true },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
