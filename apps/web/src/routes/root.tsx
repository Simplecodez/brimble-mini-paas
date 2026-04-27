import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

type DeploymentStatus =
  | "pending"
  | "building"
  | "deploying"
  | "running"
  | "failed";

type Deployment = {
  id: string;
  name: string;
  status: DeploymentStatus;
  sourceType: "git" | "upload";
  sourceRef: string;
  imageTag: string | null;
  containerName: string | null;
  hostname: string | null;
  publicUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type DeploymentLog = {
  id: number;
  deploymentId: string;
  stream: "system" | "stdout" | "stderr";
  message: string;
  createdAt: string;
};

type DeploymentDetail = {
  deployment: Deployment;
  logs: DeploymentLog[];
};

export function App() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/" });
  const search = useSearch({ from: "/" });
  const [sourceType, setSourceType] = useState<"git" | "upload">("git");
  const [gitUrl, setGitUrl] = useState(
    "https://github.com/vercel/next-learn-starter.git",
  );
  const [archive, setArchive] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deploymentsQuery = useQuery({
    queryKey: ["deployments"],
    queryFn: async () => {
      const response = await fetch("/api/deployments");
      if (!response.ok) {
        throw new Error("Failed to load deployments.");
      }

      const data = (await response.json()) as { deployments: Deployment[] };
      return data.deployments;
    },
  });

  const selectedDeploymentId = search.deploymentId;

  const detailQuery = useQuery({
    queryKey: ["deployment", selectedDeploymentId],
    enabled: Boolean(selectedDeploymentId),
    queryFn: async () => {
      const response = await fetch(`/api/deployments/${selectedDeploymentId}`);
      if (!response.ok) {
        throw new Error("Failed to load deployment detail.");
      }

      return (await response.json()) as DeploymentDetail;
    },
  });

  useEffect(() => {
    const source = new EventSource("/api/events");

    source.addEventListener("bootstrap", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        deployments: Deployment[];
      };
      queryClient.setQueryData(["deployments"], payload.deployments);
    });

    source.addEventListener("deployment.created", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        deployment: Deployment;
      };
      upsertDeployment(queryClient, payload.deployment);
    });

    source.addEventListener("deployment.updated", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        deployment: Deployment;
      };
      upsertDeployment(queryClient, payload.deployment);
      queryClient.setQueryData(
        ["deployment", payload.deployment.id],
        (current: DeploymentDetail | undefined) =>
          current
            ? {
                ...current,
                deployment: payload.deployment,
              }
            : current,
      );
    });

    source.addEventListener("log.appended", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        deploymentId: string;
        log: DeploymentLog;
      };

      queryClient.setQueryData(
        ["deployment", payload.deploymentId],
        (current: DeploymentDetail | undefined) => {
          if (!current) {
            return current;
          }

          if (current.logs.some((entry) => entry.id === payload.log.id)) {
            return current;
          }

          return {
            ...current,
            logs: [...current.logs, payload.log],
          };
        },
      );
    });

    return () => {
      source.close();
    };
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.set("sourceType", sourceType);

      if (sourceType === "git") {
        form.set("gitUrl", gitUrl);
      } else if (archive) {
        form.set("projectArchive", archive);
      }

      const response = await fetch("/api/deployments", {
        method: "POST",
        body: form,
      });

      const data = (await response.json()) as
        | { deployment: Deployment }
        | { error: string };

      if (!response.ok || "error" in data) {
        throw new Error(
          "error" in data ? data.error : "Unable to create deployment.",
        );
      }

      return data.deployment;
    },
    onSuccess: async (deployment) => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
      setError(null);
      await navigate({
        to: "/",
        search: { deploymentId: deployment.id },
      });
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Request failed.",
      );
    },
  });

  const deployments = deploymentsQuery.data ?? [];

  const selectedDeployment = useMemo(() => {
    if (detailQuery.data) {
      return detailQuery.data;
    }

    const deployment = deployments.find(
      (entry) => entry.id === selectedDeploymentId,
    );
    if (!deployment) {
      return null;
    }

    return {
      deployment,
      logs: [],
    } satisfies DeploymentDetail;
  }, [deployments, detailQuery.data, selectedDeploymentId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <main className="page-shell">
      <section className="intro">
        <div>
          <p className="eyebrow">Brimble take-home</p>
          <h1>Deployment pipeline</h1>
          <p className="lede">
            One page for source intake, Railpack builds, container startup,
            Caddy ingress, and live deployment logs over SSE.
          </p>
        </div>
        <div className="meta-card">
          <div>
            <span>Ingress</span>
            <strong>Caddy on :8081</strong>
          </div>
          <div>
            <span>Builder</span>
            <strong>Railpack + BuildKit</strong>
          </div>
          <div>
            <span>State</span>
            <strong>SQLite</strong>
          </div>
        </div>
      </section>

      {/* ✅ FIX: lock grid height + prevent infinite growth */}
      <section
        className="main-grid"
        style={{ height: "calc(100vh - 140px)", overflow: "hidden" }}
      >
        <div
          className="panel stack-lg"
          style={{ minHeight: 0, display: "flex", flexDirection: "column" }}
        >
          <div className="panel-header">
            <h2>New deployment</h2>
            <p>Submit a Git repository or upload a project archive.</p>
          </div>

          <form className="stack-md" onSubmit={handleSubmit}>
            <div className="segmented">
              <button
                type="button"
                className={sourceType === "git" ? "active" : ""}
                onClick={() => setSourceType("git")}
              >
                Git URL
              </button>
              <button
                type="button"
                className={sourceType === "upload" ? "active" : ""}
                onClick={() => setSourceType("upload")}
              >
                Upload project
              </button>
            </div>

            {sourceType === "git" ? (
              <label className="field">
                <span>Repository URL</span>
                <input
                  type="url"
                  value={gitUrl}
                  onChange={(event) => setGitUrl(event.target.value)}
                  placeholder="https://github.com/owner/repo.git"
                  required
                />
              </label>
            ) : (
              <label className="field">
                <span>Archive</span>
                <input
                  type="file"
                  accept=".zip,.tar,.tar.gz,.tgz"
                  onChange={(event) =>
                    setArchive(event.target.files?.[0] ?? null)
                  }
                  required
                />
                <small>Accepted: .zip, .tar, .tar.gz, .tgz</small>
              </label>
            )}

            {error ? <p className="error-banner">{error}</p> : null}

            <button
              className="primary-button"
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Starting..." : "Create deployment"}
            </button>
          </form>

          <div className="panel-header">
            <h2>Deployments</h2>
            <p>{deployments.length} total</p>
          </div>

          {/* ✅ FIX: this prevents left panel from growing infinitely */}
          <div
            className="deployment-list"
            style={{ overflowY: "auto", minHeight: 0, flex: 1 }}
          >
            {deployments.length === 0 ? (
              <div className="empty-state">
                No deployments yet. Upload the bundled sample app or point at a
                public Git repo.
              </div>
            ) : (
              deployments.map((deployment) => (
                <button
                  key={deployment.id}
                  type="button"
                  className={
                    deployment.id === selectedDeploymentId
                      ? "deployment-card selected"
                      : "deployment-card"
                  }
                  onClick={() =>
                    navigate({
                      to: "/",
                      search: { deploymentId: deployment.id },
                    })
                  }
                >
                  <div className="deployment-topline">
                    <strong>{deployment.name}</strong>
                    <StatusBadge status={deployment.status} />
                  </div>
                  <div className="deployment-meta">
                    <span>
                      {deployment.sourceType === "git" ? "git" : "upload"}
                    </span>
                    <span>{formatTime(deployment.createdAt)}</span>
                  </div>
                  <code>{deployment.imageTag ?? "build pending"}</code>
                  {deployment.publicUrl ? (
                    <a
                      href={deployment.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {deployment.publicUrl}
                    </a>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ================= RIGHT PANEL FIX ================= */}
        <div
          className="panel detail-panel"
          style={{
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {selectedDeployment ? (
            <>
              <div className="panel-header">
                <div>
                  <h2>{selectedDeployment.deployment.name}</h2>
                  <p>{selectedDeployment.deployment.sourceRef}</p>
                </div>
                <StatusBadge status={selectedDeployment.deployment.status} />
              </div>

              <div className="detail-grid">
                <DetailItem
                  label="Image tag"
                  value={selectedDeployment.deployment.imageTag ?? "pending"}
                />
                <DetailItem
                  label="Hostname"
                  value={selectedDeployment.deployment.hostname ?? "pending"}
                />
                <DetailItem
                  label="Container"
                  value={
                    selectedDeployment.deployment.containerName ?? "pending"
                  }
                />
                <DetailItem
                  label="Live URL"
                  value={selectedDeployment.deployment.publicUrl ?? "pending"}
                  href={selectedDeployment.deployment.publicUrl ?? undefined}
                />
              </div>

              {selectedDeployment.deployment.errorMessage ? (
                <p className="error-banner">
                  {selectedDeployment.deployment.errorMessage}
                </p>
              ) : null}

              <div className="panel-header log-header">
                <h2>Live logs</h2>
                <p>{selectedDeployment.logs.length} lines</p>
              </div>

              {/* 🔥 THIS IS THE KEY FIX */}
              <div
                className="log-console"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                }}
              >
                {selectedDeployment.logs.length === 0 ? (
                  <div className="log-line muted">
                    Waiting for log output...
                  </div>
                ) : (
                  selectedDeployment.logs.map((log) => (
                    <div key={log.id} className={`log-line ${log.stream}`}>
                      <span>
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                      <code>{log.message}</code>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="empty-detail">
              Select a deployment to see status, metadata, and the persisted
              live log stream.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function upsertDeployment(
  queryClient: ReturnType<typeof useQueryClient>,
  deployment: Deployment,
) {
  queryClient.setQueryData(
    ["deployments"],
    (current: Deployment[] | undefined) => {
      const next = current ? [...current] : [];
      const index = next.findIndex((entry) => entry.id === deployment.id);

      if (index >= 0) {
        next[index] = deployment;
      } else {
        next.unshift(deployment);
      }

      return next.sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      );
    },
  );
}

function StatusBadge({ status }: { status: DeploymentStatus }) {
  return <span className={`status-badge ${status}`}>{status}</span>;
}

function DetailItem({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}
