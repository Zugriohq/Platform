import "reflect-metadata";
import { ConsoleLogger, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import type { Express, Request, Response } from "express";
import { AppModule } from "./app.module.js";
import { API_VERSION, type ApiConfig } from "./config.js";
import type { DecisionCaseStore } from "./persistence/decision-case-store.js";

export interface CreateAppOptions {
  readonly store?: DecisionCaseStore;
  readonly logger?: false;
}

export async function createApp(config: ApiConfig, options: CreateAppOptions = {}): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(config, options.store), {
    logger: options.logger ?? new ConsoleLogger({ json: config.jsonLogs }),
  });
  (app.getHttpAdapter().getInstance() as Express).disable("x-powered-by");
  app.enableCors({
    origin: config.corsOrigins === "*" ? "*" : [...config.corsOrigins],
    methods: ["GET", "POST"],
    credentials: false,
  });
  app.enableShutdownHooks();

  const document = createOpenApiDocument(app);
  (app.getHttpAdapter().getInstance() as Express).get("/openapi.json", (_request: Request, response: Response) => {
    response.json(document);
  });
  return app;
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Zugrio API — private validation alpha")
    .setDescription(
      "Validation-only control plane. Every response carries NO_LIVE_CAPITAL / VALIDATION_ONLY metadata. " +
        "No live market data, broker connection or trade execution exists behind this API.",
    )
    .setVersion(API_VERSION)
    .addServer("https://api.zugrio.xyz")
    .build();
  return orderPathParameters(SwaggerModule.createDocument(app, config));
}

/**
 * Decorator evaluation order differs between compilers (tsc vs esbuild), so parameter
 * order is normalized to the order the parameters appear in the path template.
 */
function orderPathParameters(document: OpenAPIObject): OpenAPIObject {
  for (const [path, item] of Object.entries(document.paths)) {
    for (const operation of Object.values(item)) {
      const parameters = (operation as { parameters?: { name: string; in: string }[] }).parameters;
      parameters?.sort((a, b) => position(path, a) - position(path, b) || a.name.localeCompare(b.name));
    }
  }
  return document;
}

function position(path: string, parameter: { name: string; in: string }): number {
  const index = parameter.in === "path" ? path.indexOf(`{${parameter.name}}`) : -1;
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
