import fs from "fs";
import path from "path";

import { singleton } from "tsyringe";
import {
  CreateDeploymentRequest,
  Deployment,
  DeploymentStatus,
  LogStream,
  PipelineEnv,
} from "../common/types";
import { DeploymentStore } from "../db/deployment-store.db";
import { DeploymentEvents } from "./events.pipeline";
import { addRoute } from "../utils/caddy";
import {
  buildCacheKey,
  buildPublicUrl,
  captureCommand,
  extractArchive,
  runCommand,
  sleep,
  unwrapSingleDirectory,
} from "../utils/pipeline.utils";

@singleton()
export class DeploymentManager {
  private env!: PipelineEnv;
  constructor(
    private readonly store: DeploymentStore,
    private readonly events: DeploymentEvents,
  ) {}

  setEnv(env: PipelineEnv) {
    this.env = env;
  }

  async syncIngress(deployment: Partial<Deployment>): Promise<void> {
    await addRoute({
      adminUrl: this.env.caddyBaseUrl,
      host: deployment.hostname as string,
      upstream: `${deployment.containerName}:3000`,
    });
  }

  async runDeployment(
    deploymentId: string,
    request: CreateDeploymentRequest,
  ): Promise<void> {
    const deployment = this.store.getDeployment(deploymentId);
    if (!deployment) {
      return;
    }

    const workspaceRoot = path.join(this.env.workDir, deployment.id);
    const sourceRoot = path.join(workspaceRoot, "source");
    const imageTag = `brimble-${deployment.id}:latest`;
    const containerName = `brimble-app-${deployment.id}`;
    const hostname = `d-${deployment.id}.localhost`;
    const publicUrl = buildPublicUrl(hostname, this.env.publicBaseUrl);

    try {
      fs.mkdirSync(workspaceRoot, { recursive: true });
      this.writeLog(
        deployment.id,
        "system",
        `Deployment ${deployment.id} queued.`,
      );

      const buildRoot = await this.acquireSource(
        deployment.id,
        request,
        sourceRoot,
      );

      this.updateDeployment(deployment.id, {
        status: "building",
        imageTag,
        errorMessage: null,
      });

      this.writeLog(
        deployment.id,
        "system",
        `Starting Railpack build for image ${imageTag}.`,
      );

      await runCommand(
        "railpack",
        [
          "build",
          "--name",
          imageTag,
          "--progress",
          "plain",
          "--cache-key",
          buildCacheKey(deployment),
          buildRoot,
        ],
        {
          env: {
            ...process.env,
          },
          onLine: (stream, line) => this.writeLog(deployment.id, stream, line),
        },
      );

      this.updateDeployment(deployment.id, {
        status: "deploying",
        imageTag,
        containerName,
        hostname,
        publicUrl,
      });

      this.writeLog(
        deployment.id,
        "system",
        `Launching container ${containerName} on network ${this.env.dockerNetwork}.`,
      );

      await this.removeContainerIfExists(containerName, deployment.id);
      console.log(this.env.appPort, "this.env.appPort");
      await runCommand(
        "docker",
        [
          "run",
          "-d",
          "--name",
          containerName,
          "--network",
          this.env.dockerNetwork,
          "-e",
          `PORT=${this.env.appPort}`,
          "--label",
          `com.brimble.deployment-id=${deployment.id}`,
          imageTag,
        ],
        {
          onLine: (stream, line) => this.writeLog(deployment.id, stream, line),
        },
      );

      await this.waitForRunning(containerName, deployment.id);
      await this.syncIngress({ ...deployment, hostname, containerName });

      this.updateDeployment(deployment.id, {
        status: "running",
        publicUrl,
      });

      this.writeLog(
        deployment.id,
        "system",
        `Deployment is live at ${publicUrl}.`,
      );
    } catch (error) {
      await this.removeContainerIfExists(containerName, deployment.id).catch(
        () => {
          return;
        },
      );

      const message =
        error instanceof Error
          ? error.message
          : "Deployment failed unexpectedly.";

      this.writeLog(deployment.id, "stderr", message);
      this.updateDeployment(deployment.id, {
        status: "failed",
        errorMessage: message,
      });
    }
  }

  private async acquireSource(
    deploymentId: string,
    request: CreateDeploymentRequest,
    sourceRoot: string,
  ): Promise<string> {
    fs.rmSync(sourceRoot, { recursive: true, force: true });
    fs.mkdirSync(sourceRoot, { recursive: true });

    if (request.sourceType === "git") {
      this.writeLog(
        deploymentId,
        "system",
        `Cloning ${request.gitUrl} into workspace.`,
      );

      await runCommand(
        "git",
        ["clone", "--depth", "1", request.gitUrl, sourceRoot],
        {
          onLine: (stream, line) => this.writeLog(deploymentId, stream, line),
        },
      );

      return sourceRoot;
    }

    this.writeLog(
      deploymentId,
      "system",
      `Extracting upload ${request.uploadOriginalName}.`,
    );

    await extractArchive(
      request.uploadPath,
      request.uploadOriginalName,
      sourceRoot,
      (stream, line) => {
        this.writeLog(deploymentId, stream, line);
      },
    );

    fs.rmSync(request.uploadPath, { force: true });

    const buildRoot = unwrapSingleDirectory(sourceRoot);
    if (buildRoot !== sourceRoot) {
      this.writeLog(
        deploymentId,
        "system",
        `Using nested source directory ${path.basename(buildRoot)}.`,
      );
    }

    return buildRoot;
  }

  private async waitForRunning(
    containerName: string,
    deploymentId: string,
  ): Promise<void> {
    await sleep(5000);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const status = await captureCommand("docker", [
        "inspect",
        "--format",
        "{{.State.Status}}",
        containerName,
      ]);

      const state = status.trim();

      if (state === "running") {
        return;
      }

      if (state === "exited" || state === "dead") {
        const logs = await captureCommand("docker", [
          "logs",
          containerName,
        ]).catch(() => "");

        if (logs.trim()) {
          for (const line of logs.split(/\r?\n/)) {
            if (line.trim()) {
              this.writeLog(deploymentId, "stderr", line);
            }
          }
        }

        throw new Error(
          `Container ${containerName} exited before becoming healthy.`,
        );
      }

      await sleep(1000);
    }

    throw new Error(
      `Timed out waiting for container ${containerName} to start.`,
    );
  }

  private async removeContainerIfExists(
    containerName: string,
    deploymentId: string,
  ): Promise<void> {
    const exists = await captureCommand("docker", [
      "inspect",
      "--format",
      "{{.Id}}",
      containerName,
    ]).catch(() => "");

    if (!exists.trim()) {
      return;
    }

    this.writeLog(
      deploymentId,
      "system",
      `Removing stale container ${containerName}.`,
    );

    await runCommand("docker", ["rm", "-f", containerName], {
      onLine: (stream, line) => this.writeLog(deploymentId, stream, line),
    });
  }

  private updateDeployment(
    deploymentId: string,
    input: Partial<{
      status: DeploymentStatus;
      imageTag: string | null;
      containerName: string | null;
      hostname: string | null;
      publicUrl: string | null;
      errorMessage: string | null;
    }>,
  ): void {
    const deployment = this.store.updateDeployment(deploymentId, input);
    this.events.publish("deployment.updated", { deployment });
  }

  private writeLog(
    deploymentId: string,
    stream: LogStream,
    message: string,
  ): void {
    if (!message.trim()) {
      return;
    }

    const log = this.store.appendLog(deploymentId, stream, message);
    this.events.publish("log.appended", { deploymentId, log });
  }
}
