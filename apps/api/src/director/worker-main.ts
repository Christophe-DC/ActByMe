import "reflect-metadata";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { DirectorWorker } from "./director.worker.js";
import { DirectorService } from "./director.service.js";
import { DirectorProviders } from "./director-providers.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(root, ".env"), resolve(root, "apps/api/.env")],
    }),
    DatabaseModule,
    StorageModule,
  ],
  providers: [DirectorWorker, DirectorService, DirectorProviders],
})
class DirectorWorkerModule {}
async function main() {
  const app = await NestFactory.createApplicationContext(DirectorWorkerModule);
  const worker = app.get(DirectorWorker),
    controller = new AbortController();
  process.once("SIGTERM", () => controller.abort());
  process.once("SIGINT", () => controller.abort());
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    await worker.verifyRuntime();
    heartbeat = setInterval(() => void worker.heartbeat().catch(() => controller.abort()), 5000);
    while (!controller.signal.aborted) {
      const worked = await worker.tick(controller.signal);
      if (!worked)
        await new Promise<void>((resolve) => {
          const timer = setTimeout(done, 1000);
          function done() {
            clearTimeout(timer);
            controller.signal.removeEventListener("abort", done);
            resolve();
          }
          controller.signal.addEventListener("abort", done, { once: true });
        });
    }
  } finally {
    clearInterval(heartbeat);
    await app.close();
  }
}
main().catch(() => {
  console.error("Director worker stopped. Check the database, private storage and FFmpeg runtime.");
  process.exitCode = 1;
});
