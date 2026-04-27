import express from "express";
import { singleton } from "tsyringe";
import path from "path";
import fs from "fs";
import { GlobalErrorHandler } from "./utils/global-error.utils";
import { DeploymentRouter } from "./modules/deployment/deployments.routes";
import { LogRouter } from "./modules/log/log.router";
import { DeploymentManager } from "./pipeline/deployment-manager.pipeline";
import { envSchema } from "./common/validators/env.validator";
import { DeploymentStore } from "./db/deployment-store.db";

@singleton()
export class App {
  private readonly app = express();
  private readonly env: ReturnType<typeof envSchema.parse>;
  private uploadsDir: string;
  constructor(
    private readonly deploymentRouter: DeploymentRouter,
    private readonly logRouter: LogRouter,
    private readonly deploymentManager: DeploymentManager,
    private readonly deploymentStore: DeploymentStore,
  ) {
    this.env = envSchema.parse(process.env);
    this.deploymentManager.setEnv({
      workDir: this.env.WORK_DIR,
      dockerNetwork: this.env.DOCKER_NETWORK,
      appPort: this.env.APP_PORT,
      buildkitHost: this.env.BUILDKIT_HOST,
      caddyAdminUrl: this.env.CADDY_ADMIN_URL,
      publicBaseUrl: this.env.PUBLIC_BASE_URL,
      caddyBaseUrl: this.env.CADDY_BASE_URL,
    });

    this.uploadsDir = path.join(this.env.STORAGE_DIR, "uploads");
    this.initFileStore();
    this.deploymentRouter.setUploadsDir(this.uploadsDir);
    this.deploymentStore.setupDbStore(this.env.STORAGE_DIR);
    this.initMiddleware();
    this.registerRoutes();
    this.initializeGlobalRouteHandling();
    this.initializeErrorHandling();
  }

  private initMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private registerRoutes() {
    this.app.use("/api/events", this.logRouter.getRouter);
    this.app.use("/api/deployments", this.deploymentRouter.getRouter);
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

  start() {
    this.app.listen(this.env.PORT, () => {
      console.log(`App running on port ${this.env.PORT}`);
    });
  }
}
