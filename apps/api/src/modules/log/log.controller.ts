import { NextFunction, Request, Response } from "express";
import { singleton } from "tsyringe";
import { DeploymentEvents } from "../../pipeline/events.pipeline";
import { DeploymentStore } from "../../db/deployment-store.db";

@singleton()
export class LogController {
  constructor(
    private readonly events: DeploymentEvents,
    private readonly store: DeploymentStore,
  ) {}

  streamEvent() {
    return (request: Request, response: Response, next: NextFunction) => {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });

      response.write(
        `event: bootstrap\ndata: ${JSON.stringify({
          deployments: this.store.listDeployments(),
        })}\n\n`,
      );

      const unsubscribe = this.events.subscribe((event) => {
        response.write(
          `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`,
        );
      });

      const keepAlive = setInterval(() => {
        response.write(": heartbeat\n\n");
      }, 15000);

      request.on("close", () => {
        clearInterval(keepAlive);
        unsubscribe();
      });
    };
  }
}
