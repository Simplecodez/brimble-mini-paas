import { Router } from "express";
import { singleton } from "tsyringe";
import { DeploymentController } from "./deployment.controller";
import multer from "multer";

@singleton()
export class DeploymentRouter {
  private router = Router();
  private uploadsDir!: string;
  constructor(private readonly deploymentController: DeploymentController) {}

  setUploadsDir(dir: string) {
    this.uploadsDir = dir;
    this.initialize();
  }

  private initialize() {
    this.router
      .route("/")
      .post(
        multer({ dest: this.uploadsDir }).single("projectArchive"),
        this.deploymentController.createDeployment(),
      )
      .get(this.deploymentController.getDeployments());
    this.router.get("/:id", this.deploymentController.getDeployment());
  }

  get getRouter() {
    return this.router;
  }
}
