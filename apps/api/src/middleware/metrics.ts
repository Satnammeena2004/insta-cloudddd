import type { NextFunction, Request, Response } from "express";
import client from "prom-client";
import { env } from "../env.js";

client.collectDefaultMetrics();

const duration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const end = duration.startTimer();
  res.on("finish", () => {
    end({ method: req.method, route: req.route ? req.baseUrl + req.route.path : "unmatched", status: res.statusCode });
  });
  next();
}

/** Prometheus scrape endpoint for Grafana Cloud (Alloy / agent). Optional bearer protection. */
export async function metricsHandler(req: Request, res: Response) {
  if (env.METRICS_TOKEN && req.headers.authorization !== `Bearer ${env.METRICS_TOKEN}`) {
    return res.status(401).end();
  }
  res.setHeader("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
}
