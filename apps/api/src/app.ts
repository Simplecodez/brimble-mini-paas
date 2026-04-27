import express from "express";
import { singleton } from "tsyringe";
import { envSchema } from "@app/common/validators/env.validator";
import path from "path";
import fs from "fs";
import { GlobalErrorHandler } from "./utils/global-error.utils";

@singleton()
export class App {
  private readonly app = express();
  private readonly env: ReturnType<typeof envSchema.parse>;
  private uploadsDir: string;
  constructor() {
    this.env = envSchema.parse(process.env);
    this.uploadsDir = path.join(this.env.STORAGE_DIR, "uploads");
    this.initFileStore();
    this.initMiddleware();
    this.initializeGlobalRouteHandling();
    this.initializeErrorHandling();
  }

  private initMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private initializeGlobalRouteHandling() {
    this.app.use((req, res) => {
      res.status(404).json({
        status: "fail",
        message: `Cannot find ${req.originalUrl} on this server`,
      });
    });
  }

  private initializeErrorHandling() {
    this.app.use(GlobalErrorHandler.errorHandler());
  }

  private initFileStore() {
    fs.mkdirSync(this.env.STORAGE_DIR, { recursive: true });
    fs.mkdirSync(this.env.WORK_DIR, { recursive: true });
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  start(port: number) {
    this.app.listen(port, () => {
      console.log(`App running on port ${port}`);
    });
  }
}
