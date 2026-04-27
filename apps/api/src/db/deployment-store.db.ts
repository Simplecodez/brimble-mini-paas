import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

import type {
  Deployment,
  DeploymentDetail,
  DeploymentInsert,
  DeploymentLog,
  DeploymentRow,
  DeploymentUpdate,
  LogRow,
  LogStream,
} from "../common/types";
import { mapDeployment, mapLog } from "../utils/db.utils";
import { singleton } from "tsyringe";

@singleton()
export class DeploymentStore {
  private db!: Database.Database;
  private readonly storageDir!: string;

  constructor() {}

  setupDbStore(storageDir: string) {
    const dbPath = path.join(storageDir, "deployments.sqlite");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deployments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_ref TEXT NOT NULL,
        image_tag TEXT,
        container_name TEXT,
        hostname TEXT,
        public_url TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS deployment_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id TEXT NOT NULL,
        stream TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(deployment_id) REFERENCES deployments(id)
      );
    `);
  }

  markInFlightDeploymentsFailed(): void {
    this.db
      .prepare(
        `
        UPDATE deployments
        SET status = 'failed',
            error_message = COALESCE(error_message, 'API restarted before the deployment completed.'),
            updated_at = ?
        WHERE status IN ('pending', 'building', 'deploying')
      `,
      )
      .run(new Date().toISOString());
  }

  listDeployments(): Deployment[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM deployments
        ORDER BY datetime(created_at) DESC
      `,
      )
      .all() as DeploymentRow[];

    return rows.map(mapDeployment);
  }

  listRunningDeployments(): Deployment[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM deployments
        WHERE status = 'running' AND container_name IS NOT NULL AND hostname IS NOT NULL
        ORDER BY datetime(created_at) DESC
      `,
      )
      .all() as DeploymentRow[];

    return rows.map(mapDeployment);
  }

  getDeployment(id: string): Deployment | null {
    const row = this.db
      .prepare(
        `
        SELECT *
        FROM deployments
        WHERE id = ?
      `,
      )
      .get(id) as DeploymentRow | undefined;

    return row ? mapDeployment(row) : null;
  }

  getDeploymentDetail(id: string): DeploymentDetail | null {
    const deployment = this.getDeployment(id);

    if (!deployment) {
      return null;
    }

    return {
      deployment,
      logs: this.getLogs(id),
    };
  }

  getLogs(id: string): DeploymentLog[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM deployment_logs
        WHERE deployment_id = ?
        ORDER BY id ASC
      `,
      )
      .all(id) as LogRow[];

    return rows.map(mapLog);
  }

  createDeployment(input: DeploymentInsert): Deployment {
    const timestamp = new Date().toISOString();

    this.db
      .prepare(
        `
        INSERT INTO deployments (
          id,
          name,
          status,
          source_type,
          source_ref,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        input.id,
        input.name,
        input.status,
        input.sourceType,
        input.sourceRef,
        timestamp,
        timestamp,
      );

    const created = this.getDeployment(input.id);
    if (!created) {
      throw new Error(`Failed to create deployment ${input.id}`);
    }

    return created;
  }

  updateDeployment(id: string, input: DeploymentUpdate): Deployment {
    const current = this.getDeployment(id);
    if (!current) {
      throw new Error(`Deployment ${id} not found`);
    }

    const next = {
      name: input.name ?? current.name,
      status: input.status ?? current.status,
      sourceRef: input.sourceRef ?? current.sourceRef,
      imageTag: input.imageTag ?? current.imageTag,
      containerName: input.containerName ?? current.containerName,
      hostname: input.hostname ?? current.hostname,
      publicUrl: input.publicUrl ?? current.publicUrl,
      errorMessage:
        input.errorMessage === undefined
          ? current.errorMessage
          : input.errorMessage,
    };

    this.db
      .prepare(
        `
        UPDATE deployments
        SET name = ?,
            status = ?,
            source_ref = ?,
            image_tag = ?,
            container_name = ?,
            hostname = ?,
            public_url = ?,
            error_message = ?,
            updated_at = ?
        WHERE id = ?
      `,
      )
      .run(
        next.name,
        next.status,
        next.sourceRef,
        next.imageTag,
        next.containerName,
        next.hostname,
        next.publicUrl,
        next.errorMessage,
        new Date().toISOString(),
        id,
      );

    const updated = this.getDeployment(id);
    if (!updated) {
      throw new Error(`Failed to update deployment ${id}`);
    }

    return updated;
  }

  appendLog(
    deploymentId: string,
    stream: LogStream,
    message: string,
  ): DeploymentLog {
    const timestamp = new Date().toISOString();
    const info = this.db
      .prepare(
        `
        INSERT INTO deployment_logs (
          deployment_id,
          stream,
          message,
          created_at
        ) VALUES (?, ?, ?, ?)
      `,
      )
      .run(deploymentId, stream, message, timestamp);

    return {
      id: Number(info.lastInsertRowid),
      deploymentId,
      stream,
      message,
      createdAt: timestamp,
    };
  }
}
