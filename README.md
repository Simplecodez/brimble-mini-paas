# 🚀 Brimble Mini PaaS

A lightweight **Platform-as-a-Service (PaaS)** that enables application deployment, routing, and log streaming.

This project focuses on **core deployment mechanics** with minimal infrastructure, making it ideal for demonstrating backend architecture and system design fundamentals.

---

## ✨ Features

* ⚡ Deploy applications via API (file upload or git URL)
* 🌐 Dynamic routing using Caddy
* 📦 Docker-based container deployments
* 📡 Real-time log streaming (Server-Sent Events)
* 🔁 Lightweight async processing using `queueMicrotask`
* 🧠 Simple deployment orchestration
* ⚙️ Zero configuration required

---

## 🧱 Tech Stack

* Node.js (TypeScript)
* Express
* Docker
* Caddy
* Multer (file uploads)

---

## 🧠 Design Philosophy

This project intentionally avoids heavy infrastructure (like Redis or job queues) to keep the system:

* Simple
* Fast to run locally
* Focused on core PaaS concepts

Async work is handled using the native event loop:

```ts
queueMicrotask(() => {
  void this.deploymentManager.runDeployment(deployment.id, request);
});
```

This ensures non-blocking execution without introducing external dependencies.

---

## 🏗️ Architecture Overview

Client → API → Deployment Manager → Docker → Caddy → Deployed App

Logs → Server-Sent Events (SSE) → Client

---

## 🚀 Getting Started

### Prerequisites

* Node.js
* Docker

---

### Installation

```bash
git clone https://github.com/Simplecodez/brimble-mini-paas.git
cd brimble-mini-paas
sudo docker compose up -d
```

> No environment variables required — defaults are preconfigured.

---

## 📡 API Endpoints

### Deployments

| Method | Endpoint               | Description                          |
| ------ | ---------------------- | -------------------------------------|
| POST   | `/api/deployments`     | Upload (git url) & deploy a project |
| GET    | `/api/deployments`     | List all deployments                 |
| GET    | `/api/deployments/:id` | Get a single deployment              |

#### 📦 Upload Format

* Content-Type: `multipart/form-data`
* Field name: `projectArchive`
* Expected: zipped project directory

---

### Logs (Real-time)

| Method | Endpoint      | Description                  |
| ------ | ------------- | ---------------------------- |
| GET    | `/api/events` | Stream deployment logs (SSE) |

This endpoint uses **Server-Sent Events (SSE)** to stream logs in real time.

---

## 📦 Deployment Flow

1. Client uploads project archive or git url
2. Deployment record is created
3. Deployment runs asynchronously via `queueMicrotask`
4. Docker image is built
5. Container is started
6. Caddy dynamically routes traffic
7. Logs are streamed via SSE

---

## 🧩 Routing Structure

```ts
// Deployments
POST   /api/deployments
GET    /api/deployments
GET    /api/deployments/:id

// Logs (SSE)
GET    /api/events
```

---

## ⚠️ Limitations (Intentional for Assessment)

* No distributed queue system
* No authentication
* No autoscaling

These trade-offs were made to prioritize **clarity and core functionality**.

---

## 🚀 Future Improvements

* Introduce job queue (BullMQ / Redis or other job queues)
* Deployment logs history
* Custom domains & SSL
* Horizontal scaling

---

## 📄 License

MIT

---

## 👨‍💻 Author

Built by Simplecodez
