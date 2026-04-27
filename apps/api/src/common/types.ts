export type DeploymentStatus =
  | "pending"
  | "building"
  | "deploying"
  | "running"
  | "failed";

export type DeploymentSourceType = "git" | "upload";

export type LogStream = "system" | "stdout" | "stderr";

export interface Deployment {
  id: string;
  name: string;
  status: DeploymentStatus;
  sourceType: DeploymentSourceType;
  sourceRef: string;
  imageTag: string | null;
  containerName: string | null;
  hostname: string | null;
  publicUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentLog {
  id: number;
  deploymentId: string;
  stream: LogStream;
  message: string;
  createdAt: string;
}

export interface DeploymentDetail {
  deployment: Deployment;
  logs: DeploymentLog[];
}

export interface GlobalEventPayloads {
  bootstrap: {
    deployments: Deployment[];
  };
  "deployment.created": {
    deployment: Deployment;
  };
  "deployment.updated": {
    deployment: Deployment;
  };
  "log.appended": {
    deploymentId: string;
    log: DeploymentLog;
  };
}

export type DeploymentRow = {
  id: string;
  name: string;
  status: DeploymentStatus;
  source_type: DeploymentSourceType;
  source_ref: string;
  image_tag: string | null;
  container_name: string | null;
  hostname: string | null;
  public_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type LogRow = {
  id: number;
  deployment_id: string;
  stream: LogStream;
  message: string;
  created_at: string;
};

export type DeploymentInsert = {
  id: string;
  name: string;
  status: DeploymentStatus;
  sourceType: DeploymentSourceType;
  sourceRef: string;
};

export type DeploymentUpdate = Partial<{
  name: string;
  status: DeploymentStatus;
  imageTag: string | null;
  containerName: string | null;
  hostname: string | null;
  publicUrl: string | null;
  errorMessage: string | null;
  sourceRef: string;
}>;
