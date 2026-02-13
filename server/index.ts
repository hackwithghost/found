import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";

const app = express();
const httpServer = createServer(app);

/**
 * Extend IncomingMessage to store rawBody (for webhooks if needed)
 */
declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

/**
 * Extend Express User type (if using auth)
 */
import { User as AppUser } from "../shared/schema";

declare global {
  namespace Express {
    interface User extends AppUser {}
  }
}

/**
 * Body Parsing Middleware
 */
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: true }));

/**
 * Logger Utility
 */
export function log(message: string, source = "server") {
  const time = new Date().toISOString();
  console.log(`[${time}] [${source}] ${message}`);
}

/**
 * API Request Logger
 */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  const originalJson = res.json.bind(res);
  let responseBody: unknown;

  res.json = (body: any) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      const duration = Date.now() - start;
      log(`${req.method} ${path} ${res.statusCode} - ${duration}ms`);
    }
  });

  next();
});

/**
 * Bootstrap App
 */
async function bootstrap() {
  try {
    // Register API routes
    await registerRoutes(httpServer, app);

    /**
     * Global Error Handler
     */
    app.use(
      (err: any, _req: Request, res: Response, next: NextFunction) => {
        console.error("Unhandled Error:", err);

        if (res.headersSent) {
          return next(err);
        }

        const status = err.status || err.statusCode || 500;
        res.status(status).json({
          message: err.message || "Internal Server Error",
        });
      }
    );

    /**
     * Serve frontend in production
     */
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    /**
     * Start Server
     */
    const port = Number(process.env.PORT) || 5000;

    httpServer.listen(port, () => {
      log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

bootstrap();
