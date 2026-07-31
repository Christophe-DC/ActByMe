import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const allowedOrigins = getAllowedOrigins(config);

  app.enableCors({
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || isAllowedOrigin(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`), false);
    },
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("ActByMe API")
    .setDescription(
      "Actor-first MVP API for public profiles, onboarding, agency access, and admin review.",
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .addApiKey(
      {
        in: "header",
        name: "x-user-id",
        type: "apiKey",
      },
      "x-user-id",
    )
    .addApiKey(
      {
        in: "header",
        name: "x-user-role",
        type: "apiKey",
      },
      "x-user-role",
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = Number(process.env.PORT ?? config.get<number>("API_PORT", 4000));
  await app.listen(port, "0.0.0.0");
}

void bootstrap();

function getAllowedOrigins(config: ConfigService) {
  return [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://actbyme.com",
    "https://www.actbyme.com",
    "https://actbyme-web.vercel.app",
    config.get<string>("NEXT_PUBLIC_WEB_URL"),
    config.get<string>("WEB_ORIGIN"),
    config.get<string>("CORS_ORIGINS"),
  ]
    .flatMap((value) => (value ? value.split(",") : []))
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string, allowedOrigins: string[]) {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return (
    /^https:\/\/([a-z0-9-]+\.)?actbyme\.com$/i.test(origin) ||
    /^https:\/\/actbyme-web-[a-z0-9-]+\.vercel\.app$/i.test(origin)
  );
}
