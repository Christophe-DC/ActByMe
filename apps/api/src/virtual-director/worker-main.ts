import "reflect-metadata";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { VirtualDirectorWorker } from "./virtual-director.worker.js";
import { FalSeedanceProvider, VIDEO_PROVIDER } from "./video-provider.js";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: resolve(repositoryRoot, ".env") }),
    DatabaseModule,
    StorageModule,
  ],
  providers: [VirtualDirectorWorker, { provide: VIDEO_PROVIDER, useClass: FalSeedanceProvider }],
})
class VideoWorkerModule {}
async function main() {
  const app = await NestFactory.createApplicationContext(VideoWorkerModule);
  const worker = app.get(VirtualDirectorWorker);
  const control = new AbortController();
  process.once("SIGTERM", () => control.abort());
  process.once("SIGINT", () => control.abort());
  try {
    await worker.verifyRuntime();
  } catch (error) {
    await app.close();
    throw error;
  }
  const heartbeat = setInterval(() => void worker.heartbeat().catch(() => control.abort()), 5000);
  try {
    while (!control.signal.aborted) {
      const worked = await worker.tick(control.signal);
      if (!worked)
        await new Promise<void>((resolve) => {
          const timer = setTimeout(done, 1500);
          function done() {
            clearTimeout(timer);
            control.signal.removeEventListener("abort", done);
            resolve();
          }
          control.signal.addEventListener("abort", done, { once: true });
        });
    }
  } finally {
    clearInterval(heartbeat);
    await app.close();
  }
}
main().catch(() => {
  console.error(
    "Video worker stopped. Check database, private storage, FFmpeg and Blender configuration.",
  );
  process.exitCode = 1;
});
