export async function addRoute({
  host,
  upstream,
  adminUrl,
}: {
  host: string;
  upstream: string;
  adminUrl: string;
}) {
  if (!host || !upstream) {
    throw new Error(`Invalid route: host=${host}, upstream=${upstream}`);
  }

  const route = {
    "@id": `deployment-${host}`,
    match: [{ host: [host] }],
    handle: [
      {
        handler: "reverse_proxy",
        upstreams: [{ dial: upstream }],
      },
    ],
    terminal: true,
  };

  // prepend route to existing routes
  await caddyRequest(
    adminUrl,
    "/config/apps/http/servers/srv0/routes/0",
    "PUT",
    route,
  );
}

export async function caddyRequest(
  adminUrl: string,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body: any,
) {
  const res = await fetch(`${adminUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Caddy API error: ${res.status} → ${text}`);
  }

  const text = await res.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from Caddy: ${text}`);
  }
}
