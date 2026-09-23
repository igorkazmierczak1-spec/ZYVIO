import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { WebhookHandlers, WebhookSignatureError } from "./webhookHandlers";

const app: Express = express();
const clerkSecretKey = process.env.CLERK_SECRET_KEY?.trim();
const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY?.trim();

function originCandidates() {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const replDomains = [
    process.env.REPLIT_DEV_DOMAIN,
    process.env.REPLIT_EXPO_DEV_DOMAIN,
    ...(process.env.REPLIT_DOMAINS ?? "").split(","),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .map((value) => (value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`));
  return new Set([...configured, ...replDomains]);
}

function isAllowedOrigin(origin: string) {
  if (originCandidates().has(origin)) return true;
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/localhost:\d+$/.test(origin)) return true;
  return false;
}

app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) {
    res.status(400).json({ error: "Missing or invalid stripe-signature" });
    return;
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: "Stripe webhook is not configured" });
    return;
  }
  try {
    await WebhookHandlers.processWebhook(req.body as Buffer, signature);
    res.status(200).json({ received: true });
  } catch (error) {
    logger.warn({ err: error }, "Stripe webhook rejected");
    if (error instanceof WebhookSignatureError) {
      res.status(400).json({ error: "Webhook signature verification failed" });
      return;
    }
    // Stripe retries non-2xx responses. Processing/database/Stripe API
    // failures must therefore remain retryable instead of being acknowledged.
    res.status(500).json({ error: "Webhook processing failed" });
  }
});
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed"));
  },
}));
app.use((req, res, next) => {
  const stateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const origin = req.headers.origin;
  if (stateChanging && origin && !isAllowedOrigin(origin)) {
    res.status(403).json({ error: "Request origin is not allowed" });
    return;
  }
  next();
});
app.use(express.json({ limit: "1mb", strict: true }));
app.use(express.urlencoded({ extended: true, limit: "100kb", parameterLimit: 100 }));
app.use(
  clerkMiddleware((req) => ({
    secretKey: clerkSecretKey,
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      clerkPublishableKey,
    ),
  })),
);

app.use("/api", router);

const apiErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const status =
    typeof error?.status === "number" && error.status >= 400 && error.status < 500
      ? error.status
      : typeof error?.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500
        ? error.statusCode
        : 500;
  logger.error({ err: error, method: req.method, url: req.url }, "Unhandled API error");
  if (res.headersSent) return;
  res.status(status).json({
    error: status === 500 ? "Internal server error" : "Request could not be completed",
  });
};

app.use(apiErrorHandler);

export default app;
