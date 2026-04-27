import {
  Deployment,
  DeploymentLog,
  DeploymentRow,
  LogRow,
} from "../common/types";

export function mapDeployment(row: DeploymentRow): Deployment {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    imageTag: row.image_tag,
    containerName: row.container_name,
    hostname: row.hostname,
    publicUrl: row.public_url,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLog(row: LogRow): DeploymentLog {
  return {
    id: row.id,
    deploymentId: row.deployment_id,
    stream: row.stream,
    message: row.message,
    createdAt: row.created_at,
  };
}
