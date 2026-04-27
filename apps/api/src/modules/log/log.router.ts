import { Router } from "express";
import { singleton } from "tsyringe";
import { LogController } from "./log.controller";

@singleton()
export class LogRouter {
  private router = Router();
  constructor(private readonly logController: LogController) {
    this.initialize();
  }

  private initialize() {
    this.router.route("/").get(this.logController.streamEvent());
  }

  get getRouter() {
    return this.router;
  }
}
