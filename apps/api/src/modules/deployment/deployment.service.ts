import { singleton } from "tsyringe";
import { randomUUID } from "crypto";
import { DeploymentStore } from "../../db/deployment-store.db";
import { DeploymentEvents } from "../../pipeline/events.pipeline";
import { DeploymentManager } from "../../pipeline/deployment-manager.pipeline";
import { createRequestSchema } from "../../common/validators/create-request.validator";
import { DeploymentSourceType } from "../../common/types";

@singleton()
export class DeploymentService {
  constructor(
    private readonly store: DeploymentStore,
    private readonly events: DeploymentEvents,
    private readonly deploymentManager: DeploymentManager,
  ) {}

  createDeployment(rawRequest: unknown) {
    const request = createRequestSchema.parse(rawRequest);
    const id = randomUUID().slice(0, 8);
    const sourceRef =
      request.sourceType === "git"
        ? request.gitUrl
        : request.uploadOriginalName;

    const deployment = this.store.createDeployment({
      id,
      name: this.deriveDeploymentName(sourceRef, request.sourceType),
      status: "pending",
      sourceType: request.sourceType,
      sourceRef,
    });

    this.events.publish("deployment.created", { deployment });

    queueMicrotask(() => {
      void this.deploymentManager.runDeployment(deployment.id, request);
    });

    return deployment;
  }

  // updateDeployment(id: string, update: Partial<Deployment>) {
  //   return updateDeployment(id, update);
  // }

  getDeployments() {
    return this.store.listDeployments();
  }

  getDeployment(id: string) {
    return this.store.getDeploymentDetail(id);
  }

  deriveDeploymentName(
    sourceRef: string,
    sourceType: DeploymentSourceType,
  ): string {
    if (sourceType === "git") {
      const trimmed = sourceRef.replace(/\/+$/, "");
      const repoSegment = trimmed.split("/").pop() ?? "repo";
      return repoSegment.replace(/\.git$/, "");
    }

    return sourceRef.replace(/\.(zip|tar|tar\.gz|tgz)$/i, "");
  }
}
