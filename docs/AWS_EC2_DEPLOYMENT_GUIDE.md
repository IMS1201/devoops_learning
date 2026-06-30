# AWS EC2 Deployment Guide — Basic-Full-Stack-App

**A beginner-to-advanced DevOps manual** for deploying the `Basic-Full-Stack-App` project from local development to a production-style AWS EC2 environment.

| | |
|---|---|
| **Repository** | https://github.com/IMS1201/devoops_learning |
| **Stack** | React (Vite) frontend + Express backend |
| **Local K8s** | Minikube + `YAML/` manifests |
| **Cloud target** | AWS EC2 (Ubuntu 22.04) |

---

## Table of Contents

1. [DevOps learning path (basic → advanced)](#1-devops-learning-path-basic--advanced)
2. [Project architecture](#2-project-architecture)
3. [Level 1 — Local development](#3-level-1--local-development)
4. [Level 2 — Docker on your laptop](#4-level-2--docker-on-your-laptop)
5. [Level 3 — Kubernetes with Minikube](#5-level-3--kubernetes-with-minikube)
6. [Level 4 — AWS EC2 + Docker Compose (recommended first cloud step)](#6-level-4--aws-ec2--docker-compose-recommended-first-cloud-step)
7. [Level 5 — AWS EC2 + Kubernetes (k3s)](#7-level-5--aws-ec2--kubernetes-k3s)
8. [Level 6 — CI/CD with Jenkins](#8-level-6--cicd-with-jenkins)
9. [Level 7 — Advanced AWS (production patterns)](#9-level-7--advanced-aws-production-patterns)
10. [Verification checklist](#10-verification-checklist)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. DevOps learning path (basic → advanced)

Use this project as a **progressive ladder**. Each level reuses concepts from the previous one.

```
Level 1  Local dev (npm)           → understand the app
Level 2  Docker / Compose         → package & run anywhere
Level 3  Minikube + YAML/         → pods, services, ingress
Level 4  EC2 + Compose + Nginx    → first real cloud deploy  ★ start here for AWS
Level 5  EC2 + k3s                → same YAML/ on a cloud VM
Level 6  Jenkins pipelines        → build, scan, push, deploy
Level 7  EKS / ALB / Route53      → managed production AWS
```

**Skills you practice at each level**

| Level | Tools | DevOps skills |
|-------|-------|---------------|
| 1 | Node, npm, Vite | App structure, ports, APIs |
| 2 | Docker, Compose | Images, containers, networking |
| 3 | kubectl, Minikube | Deployments, Services, Ingress |
| 4 | EC2, Security Groups, Nginx | Cloud VMs, firewall, reverse proxy |
| 5 | k3s, Helm (optional) | Lightweight cluster on VM |
| 6 | Jenkins, Docker Hub | CI/CD, credentials, rollback |
| 7 | EKS, ALB, IAM, Terraform | Enterprise AWS patterns |

---

## 2. Project architecture

### Application components

| Component | Source | Container port | K8s service port | Ingress path |
|-----------|--------|----------------|------------------|--------------|
| **Frontend** | `frontend/` (React + Vite) | 80 | 6789 | `/bar1` |
| **Backend** | `backend/` (Express) | 8000 | 7890 | `/bar` |

### Routing (same everywhere)

Your ingress and Nginx both follow this pattern:

```
http://<host>/bar1  →  frontend (static React UI)
http://<host>/bar   →  backend API  (GET/POST → {"message":"..."})
```

**Important:** The backend only defines routes on `/`, not `/bar`. Ingress and Nginx must **rewrite** the path (strip `/bar` or `/bar1`) before forwarding — same as `nginx.ingress.kubernetes.io/rewrite-target: /` in `YAML/ingress.yaml`.

### Repository layout

```
Basic-Full-Stack-App/
├── backend/              Express API (port 8000)
│   ├── Dockerfile
│   └── app.js
├── frontend/             React UI (built, served on port 80)
│   ├── Dockerfile
│   └── src/App.jsx
├── YAML/                 Kubernetes manifests
│   ├── name-space.yaml
│   ├── simple-backend.yaml
│   ├── simple-backend-svc.yaml
│   ├── simple-frontend.yaml
│   ├── simple-frontend-svc.yaml
│   └── ingress.yaml
├── docker-compose.yml    EC2 / local multi-container run
├── deploy/nginx/         Nginx config for EC2
├── Jenkinsfile.backend
└── Jenkinsfile.frontend
```

### Pre-built images (Docker Hub)

```text
raghuk8/frontend-application:v1
raghuk8/backendapplication:v1
```

You can build locally with `docker compose build` or pull these in Kubernetes.

---

## 3. Level 1 — Local development

### Backend

```bash
cd backend
npm install
npm start          # nodemon, listens on :8000
curl http://localhost:8000/
# {"message":"get"}
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # Vite dev server (usually :5173)
```

> **Note:** `frontend/src/App.jsx` calls `http://localhost:8000/` directly. That works locally but **not** through ingress or Nginx. For cloud/K8s, change API calls to a relative path like `/bar` (documented in Level 4).

---

## 4. Level 2 — Docker on your laptop

### Build and run individually

```bash
# Backend
docker build -t raghuk8/backendapplication:local ./backend
docker run -d --name backend -p 7890:8000 raghuk8/backendapplication:local

# Frontend
docker build -t raghuk8/frontend-application:local ./frontend
docker run -d --name frontend -p 6789:80 raghuk8/frontend-application:local
```

### Docker Compose (recommended)

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:7890/          # backend
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:6789/   # frontend → 200
```

---

## 5. Level 3 — Kubernetes with Minikube

### One-time setup

```bash
minikube start
minikube addons enable ingress
```

### Deploy all manifests

```bash
kubectl apply -f YAML/name-space.yaml
kubectl apply -f YAML/simple-backend.yaml
kubectl apply -f YAML/simple-backend-svc.yaml
kubectl apply -f YAML/simple-frontend.yaml
kubectl apply -f YAML/simple-frontend-svc.yaml
kubectl apply -f YAML/ingress.yaml
```

### Access

```bash
minikube ip
# Example: 192.168.49.2

# Option A — Host header (ingress rule: foo.bar1.com)
curl -H "Host: foo.bar1.com" http://$(minikube ip)/bar

# Option B — Add to /etc/hosts:  <minikube-ip>  foo.bar1.com
# Then open http://foo.bar1.com/bar and http://foo.bar1.com/bar1

# Option C — Fallback rule in ingress.yaml (no host) allows bare IP:
curl http://$(minikube ip)/bar
```

### Useful commands

```bash
kubectl get all -n frontend-namespace
kubectl describe ingress ingress-example -n frontend-namespace
kubectl logs -n frontend-namespace -l app=backend1
```

---

## 6. Level 4 — AWS EC2 + Docker Compose (recommended first cloud step)

This section replaces and corrects the original PDF guide for **your actual project**.

### 6.1 Create the EC2 instance

1. Log in to [AWS Console](https://aws.amazon.com) → search **EC2** → **Launch instance**.
2. **Name:** `devoops-learning-server`
3. **AMI:** Ubuntu Server 22.04 LTS (HVM), SSD
4. **Instance type:** `t2.micro` or `t3.micro` (Free Tier). Use `t3.small` or `t3.medium` if builds are slow.
5. **Key pair:** Create `devoops-key.pem` (RSA). Download and store safely.

### 6.2 Security group (firewall)

| Rule | Protocol | Port | Source | Purpose |
|------|----------|------|--------|---------|
| SSH | TCP | 22 | **My IP** | Remote admin (never use 0.0.0.0/0 for SSH in production) |
| HTTP | TCP | 80 | 0.0.0.0/0 | Public web via Nginx |
| HTTPS | TCP | 443 | 0.0.0.0/0 | TLS (after Certbot) |

> **Do not open 6789/7890 publicly** if Nginx handles routing on port 80. Those ports stay on `localhost` only.

6. **Storage:** 20–30 GB gp3 (enough for Docker images).
7. **Launch** → wait until **Status checks: 2/2 passed** → copy **Public IPv4 address**.

### 6.3 Connect via SSH

```bash
cd ~/Downloads
chmod 400 devoops-key.pem
ssh -i "devoops-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
```

Type `yes` when prompted.

### 6.4 Install software on EC2

Run on the EC2 instance:

```bash
# System updates
sudo apt-get update && sudo apt-get upgrade -y

# Git
sudo apt-get install -y git
git --version

# Docker Engine
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow ubuntu user to run docker without sudo
sudo usermod -aG docker ubuntu
exit
```

Reconnect SSH (required after `usermod`):

```bash
ssh -i "devoops-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
docker --version
docker compose version
```

### 6.5 Clone and start the application

```bash
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning

# Build and run (uses docker-compose.yml in repo root)
docker compose up -d --build
docker compose ps
```

Expected:

```text
backend   running   0.0.0.0:7890->8000/tcp
frontend  running   0.0.0.0:6789->80/tcp
```

Quick test on the server:

```bash
curl http://localhost:7890/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:6789/
```

### 6.6 Install Nginx reverse proxy (port 80)

This mirrors your Kubernetes Ingress (`/bar` → backend, `/bar1` → frontend).

```bash
sudo apt-get install -y nginx
sudo cp deploy/nginx/basic-full-stack-app.conf /etc/nginx/sites-available/basic-full-stack-app
sudo ln -sf /etc/nginx/sites-available/basic-full-stack-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

### 6.7 Test from your laptop

Replace `YOUR_EC2_PUBLIC_IP`:

```bash
curl http://YOUR_EC2_PUBLIC_IP/bar
# {"message":"get"}

curl -s -o /dev/null -w "%{http_code}\n" http://YOUR_EC2_PUBLIC_IP/bar1
# 200
```

In a browser:

- Backend: `http://YOUR_EC2_PUBLIC_IP/bar`
- Frontend: `http://YOUR_EC2_PUBLIC_IP/bar1`

### 6.8 HTTPS with Let's Encrypt (optional, requires a domain)

Point a DNS **A record** (e.g. `app.yourdomain.com`) to your EC2 public IP, then:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yourdomain.com
```

Certbot updates Nginx for HTTPS and auto-renewal.

### 6.9 Production fix — frontend API URL

`frontend/src/App.jsx` currently calls `http://localhost:8000/`. In cloud/K8s, update to the ingress path:

```javascript
const API_BASE = "/bar";   // works behind Nginx and K8s ingress

const getHandler = async () => {
  const data = await axios.get(`${API_BASE}/`);
  setText(data.data.message);
};

const postHandler = async () => {
  const data = await axios.post(`${API_BASE}/`, { user: "Shani" });
  setText(data.data.message);
};
```

Rebuild and redeploy after this change:

```bash
docker compose up -d --build
```

---

## 7. Level 5 — AWS EC2 + Kubernetes (k3s)

Run the **same `YAML/` manifests** on EC2 using [k3s](https://k3s.io/) (lightweight Kubernetes).

### 7.1 Instance requirements

- **Instance type:** at least `t3.medium` (2 vCPU, 4 GB RAM)
- Security group: open **80, 443** (and **6443** only if you need remote kubectl)

### 7.2 Install k3s on EC2

```bash
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes
```

k3s includes Traefik ingress by default. Either use Traefik or disable it and install nginx ingress:

```bash
# Optional: use nginx ingress (closer to Minikube setup)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.1/deploy/static/provider/cloud/deploy.yaml
```

### 7.3 Deploy your app

```bash
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning
kubectl apply -f YAML/
```

### 7.4 Access

```bash
# Get node IP (EC2 public IP)
kubectl get ingress -n frontend-namespace

# With host rule foo.bar1.com — add to /etc/hosts on your laptop:
# <EC2_PUBLIC_IP>  foo.bar1.com

curl -H "Host: foo.bar1.com" http://YOUR_EC2_PUBLIC_IP/bar
```

> On a single-node k3s EC2 instance, ensure the ingress controller Service exposes port 80 (NodePort or hostNetwork). For learning, Nginx on the host (Level 4) is simpler; k3s is the bridge to EKS.

---

## 8. Level 6 — CI/CD with Jenkins

Your repo includes `Jenkinsfile.backend` and `Jenkinsfile.frontend`.

### Pipeline stages (backend example)

1. **Checkout** — clone from GitHub
2. **Docker Build** — `docker build ./backend`
3. **Trivy Scan** — security scan (optional)
4. **Push to Registry** — Docker Hub (`pav30/basic-full-stack-app-backend:...`)
5. **Deploy to VM** — SSH to EC2, update `docker-compose.yml`, `docker compose pull && up -d`

### Setup checklist

| Item | Action |
|------|--------|
| Jenkins server | Install Jenkins (Docker or VM) |
| Docker socket | Mount `/var/run/docker.sock` for builds |
| Credentials | Docker Hub user/pass, EC2 SSH private key |
| EC2 prep | Clone repo to `~/devpilot-app`, initial `docker compose up` |
| Multibranch job | Point to `Jenkinsfile.backend` / `Jenkinsfile.frontend` |

### Manual deploy after Jenkins push

On EC2:

```bash
cd ~/devpilot-app
docker compose pull
docker compose up -d
```

---

## 9. Level 7 — Advanced AWS (production patterns)

When you are ready to move beyond a single EC2 VM:

| Pattern | AWS service | Benefit |
|---------|-------------|---------|
| Managed Kubernetes | **EKS** | HA control plane, AWS integrations |
| Load balancing | **ALB** + Ingress | SSL termination, path routing |
| DNS | **Route 53** | `foo.bar1.com` → ALB |
| Container registry | **ECR** | Private images, IAM auth |
| Secrets | **Secrets Manager** / SSM | No keys in YAML |
| Infrastructure as Code | **Terraform** / **CloudFormation** | Repeatable environments |
| Monitoring | **CloudWatch**, Prometheus, Grafana | Logs and metrics |
| GitOps | **Argo CD** | Declarative deploys from Git |

### Typical production flow

```text
Git push → GitHub Actions / Jenkins → build image → push ECR
       → Argo CD / kubectl → EKS → ALB Ingress → Route 53
```

---

## 10. Verification checklist

Use this after any deployment:

```bash
# On EC2 — containers running
docker compose ps

# Backend direct
curl http://localhost:7890/

# Frontend direct
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:6789/

# Through Nginx (public paths)
curl http://localhost/bar
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/bar1

# From laptop
curl http://YOUR_EC2_PUBLIC_IP/bar
```

Kubernetes (Minikube or k3s):

```bash
kubectl get pods,svc,ingress -n frontend-namespace
kubectl describe ingress ingress-example -n frontend-namespace
```

---

## 11. Troubleshooting

### nginx 404 Not Found

| Cause | Fix |
|-------|-----|
| Opening `http://IP/` (root) | Use `/bar` or `/bar1` — no rule for `/` |
| Ingress host `foo.bar1.com` but browser uses IP | Add `/etc/hosts` entry or use fallback rule in `ingress.yaml` |
| Missing `rewrite-target` | Keep `nginx.ingress.kubernetes.io/rewrite-target: /` in ingress |

### Express: `Cannot GET /bar`

Nginx/Ingress is forwarding `/bar` without rewriting. Use `deploy/nginx/basic-full-stack-app.conf` or the ingress rewrite annotation.

### `docker compose` not found

```bash
sudo apt-get install -y docker-compose-plugin
docker compose version
```

### Permission denied on Docker

```bash
sudo usermod -aG docker ubuntu
exit   # reconnect SSH
```

### Security group blocks traffic

- Port **80** must allow `0.0.0.0/0` for public HTTP
- App ports **6789/7890** do not need to be public if Nginx proxies on 80

### Frontend buttons do nothing in browser

`App.jsx` still points to `localhost:8000`. Change API base to `/bar` (see §6.9).

### EC2 IP changed after stop/start

Unless you use an **Elastic IP**, the public IP changes when the instance restarts. Update DNS or `/etc/hosts`.

---

## Quick reference — command cheat sheet

```bash
# === LOCAL ===
docker compose up -d --build
kubectl apply -f YAML/

# === EC2 SSH ===
ssh -i devoops-key.pem ubuntu@<EC2_IP>

# === EC2 DEPLOY ===
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning
docker compose up -d --build
sudo cp deploy/nginx/basic-full-stack-app.conf /etc/nginx/sites-available/basic-full-stack-app
sudo ln -sf /etc/nginx/sites-available/basic-full-stack-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl restart nginx

# === TEST ===
curl http://<EC2_IP>/bar
curl http://<EC2_IP>/bar1
```

---

*Document version: 2.0 — aligned with Basic-Full-Stack-App (`IMS1201/devoops_learning`)*
