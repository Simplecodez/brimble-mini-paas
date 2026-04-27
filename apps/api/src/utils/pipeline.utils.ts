import { spawn } from "child_process";
import { Deployment, LogStream, SpawnOptions } from "../common/types";
import fs from "fs";
import path from "path";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildPublicUrl(
  hostname: string,
  publicBaseUrl: string,
): string {
  const base = new URL(publicBaseUrl);
  const port = base.port ? `:${base.port}` : "";
  return `${base.protocol}//${hostname}${port}/`;
}

export async function runCommand(
  command: string,
  args: string[],
  options: SpawnOptions,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    attachStream(child.stdout, "stdout", options.onLine);
    attachStream(child.stderr, "stderr", options.onLine);

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Command failed (${code ?? "unknown"}): ${command} ${args.join(" ")}`,
        ),
      );
    });
  });
}

export async function extractArchive(
  archivePath: string,
  originalName: string,
  destination: string,
  onLine: (stream: LogStream, line: string) => void,
): Promise<void> {
  const normalizedName = originalName.toLowerCase();

  if (normalizedName.endsWith(".zip")) {
    await runCommand("unzip", ["-q", archivePath, "-d", destination], {
      onLine,
    });
    return;
  }

  if (normalizedName.endsWith(".tar.gz") || normalizedName.endsWith(".tgz")) {
    await runCommand("tar", ["-xzf", archivePath, "-C", destination], {
      onLine,
    });
    return;
  }

  if (normalizedName.endsWith(".tar")) {
    await runCommand("tar", ["-xf", archivePath, "-C", destination], {
      onLine,
    });
    return;
  }

  throw new Error("Unsupported upload type. Use .zip, .tar, .tar.gz, or .tgz.");
}

export function unwrapSingleDirectory(root: string): string {
  const entries = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."));

  if (entries.length !== 1 || !entries[0]?.isDirectory()) {
    return root;
  }

  return path.join(root, entries[0].name);
}

export function attachStream(
  stream: NodeJS.ReadableStream | null,
  kind: LogStream,
  onLine: (stream: LogStream, line: string) => void,
): void {
  if (!stream) {
    return;
  }

  let buffer = "";

  stream.on("data", (chunk: Buffer | string) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      console.log(line, "kjbcjknxkjzvnc"); //kmm;m;llm;
      onLine(kind, line);
    }
  });

  stream.on("end", () => {
    if (buffer.trim()) {
      onLine(kind, buffer);
    }
  });
}

export async function captureCommand(
  command: string,
  args: string[],
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          stderr.trim() || `Command failed (${code ?? "unknown"}): ${command}`,
        ),
      );
    });
  });
}

export function buildCacheKey(deployment: Deployment): string {
  return (
    deployment.sourceRef
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || deployment.id
  );
}
