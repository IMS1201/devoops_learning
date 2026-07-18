# AWS EC2 Deployment Guide — Basic-Full-Stack-App

**A beginner-to-advanced DevOps manual** for deploying the `Basic-Full-Stack-App` project from local development to a production-style AWS EC2 environment.

| | |
|---|---|
| **Repository** | https://github.com/IMS1201/devoops_learning |
| **Stack** | React (Vite) frontend + Express backend |
| **Local K8s** | Minikube + `YAML/` manifests |
| **Cloud target** | AWS EC2 (Ubuntu 22.04 **or** Amazon Linux 2023 / RHEL family) |

---

## Table of Contents

1. [DevOps learning path (basic → advanced)](#1-devops-learning-path-basic--advanced)
2. [Project architecture](#2-project-architecture)
3. [Level 1 — Local development](#3-level-1--local-development)
4. [Level 2 — Docker on your laptop](#4-level-2--docker-on-your-laptop)
5. [GitHub — clone and pull your code](#5-github--clone-and-pull-your-code)
6. [Docker Hub — build, push, and private image access](#6-docker-hub--build-push-and-private-image-access)
7. [Level 3 — Kubernetes with Minikube](#7-level-3--kubernetes-with-minikube)
8. [Level 4 — AWS EC2 + Docker Compose (recommended first cloud step)](#8-level-4--aws-ec2--docker-compose-recommended-first-cloud-step)
9. [Level 5 — AWS EC2 + Kubernetes (kubeadm)](#9-level-5--aws-ec2--kubernetes-kubeadm)
10. [Level 6 — CI/CD with Jenkins](#10-level-6--cicd-with-jenkins)
11. [Level 7 — Advanced AWS (production patterns)](#11-level-7--advanced-aws-production-patterns)
12. [Verification checklist](#12-verification-checklist)
13. [Troubleshooting](#13-troubleshooting)
14. [Pre-deploy checklist (nothing missing)](#14-pre-deploy-checklist-nothing-missing)

---

## 1. DevOps learning path (basic → advanced)

Use this project as a **progressive ladder**. Each level reuses concepts from the previous one.

```
Level 1  Local dev (npm)           → understand the app
Level 2  Docker / Compose         → package & run anywhere
Level 3  Minikube + YAML/         → pods, services, ingress
Level 4  EC2 + Compose + Nginx    → first real cloud deploy  ★ start here for AWS
Level 5  EC2 + Kubernetes (kubeadm) → same YAML/ on a cloud VM
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
| 5 | kubeadm, kubectl | Self-managed Kubernetes cluster on EC2 |
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
http://<host>/bar1  →  frontend (React CRUD UI)
http://<host>/bar   →  backend API  (health + `/items` CRUD)
```

**Backend API (CRUD):**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/items` | List all items |
| GET | `/items/:id` | Get one item |
| POST | `/items` | Create |
| PUT | `/items/:id` | Update |
| DELETE | `/items/:id` | Delete |

Through ingress/Nginx use `/bar/items` (rewritten to `/items` on the backend).

**Important:** Backend routes live on `/` and `/items`, not `/bar`. Ingress and Nginx must **rewrite** the path (strip `/bar` or `/bar1`) before forwarding — same as `nginx.ingress.kubernetes.io/rewrite-target: /` in `YAML/ingress.yaml`.

### Repository layout

```
Basic-Full-Stack-App/
├── backend/              Express API (port 8000)
│   ├── Dockerfile
│   ├── app.js
│   └── routes/items.js   CRUD API
├── frontend/             React UI (built, served on port 80)
│   ├── Dockerfile
│   └── src/App.jsx       CRUD UI; API_BASE=/bar in production
├── YAML/                 Kubernetes manifests
│   ├── name-space.yaml
│   ├── simple-backend.yaml
│   ├── simple-backend-svc.yaml
│   ├── simple-frontend.yaml
│   ├── simple-frontend-svc.yaml
│   └── ingress.yaml
├── docker-compose.yml    EC2 / local multi-container run
├── deploy/nginx/         Nginx config for EC2
├── docs/                 This deployment guide
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

### Get the code from GitHub (first time)

```bash
# HTTPS (easiest — works on laptop and EC2)
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning
ls -la
```

If the repo is **private**, GitHub will ask for credentials. Use your GitHub username and a **Personal Access Token (PAT)** as the password — not your GitHub account password. See [§5.3](#53-clone-a-private-github-repo).

### Backend

```bash
cd backend
npm install
npm start          # nodemon, listens on :8000
curl http://localhost:8000/
curl http://localhost:8000/items
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # Vite dev server (usually :5173)
```

> **Note:** In dev, the frontend calls `http://localhost:8000/items`. In production builds (Docker/K8s), `App.jsx` uses `API_BASE=/bar` so requests go to `/bar/items` through ingress or Nginx.

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

## 5. GitHub — clone and pull your code

All deployment paths start by getting source code from GitHub.

| | |
|---|---|
| **Repository URL (HTTPS)** | `https://github.com/IMS1201/devoops_learning.git` |
| **Default branch** | `main` |
| **Used on** | Your laptop, EC2, Jenkins, Minikube host |

### 5.1 First-time clone (HTTPS)

**On your laptop:**

```bash
cd ~/workspace    # or any folder you use for projects
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning
git branch
git log --oneline -5
```

**On EC2 (after SSH in, installing git, and cloning — see §8.4 and §5.1):**

```bash
cd ~
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning
ls -la
```

You should see `backend/`, `frontend/`, `YAML/`, `docker-compose.yml`, etc.

### 5.2 Pull latest changes (after code is updated on GitHub)

When you or your team push new commits, update your local or server copy:

```bash
cd devoops_learning

git status                  # see if you have local changes
git pull origin main        # download latest from GitHub
```

Then rebuild/redeploy depending on where you run:

```bash
# Local Docker
docker compose up -d --build

# Kubernetes
kubectl apply -f YAML/
kubectl rollout restart deployment backend1 -n frontend-namespace
kubectl rollout restart deployment frontend1 -n frontend-namespace

# EC2 with Nginx
docker compose up -d --build
sudo systemctl reload nginx
```

### 5.3 Clone a private GitHub repo

If `IMS1201/devoops_learning` is private:

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token** → enable scope **`repo`**
3. Copy the token

Clone using the token:

```bash
git clone https://github.com/IMS1201/devoops_learning.git
# Username: your-github-username
# Password: paste the PAT (not your GitHub password)
```

Or embed the token in the URL (avoid on shared machines — token visible in shell history):

```bash
git clone https://YOUR_GITHUB_USERNAME:YOUR_GITHUB_PAT@github.com/IMS1201/devoops_learning.git
```

### 5.4 Clone with SSH (optional)

**One-time setup on your machine:**

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub
# Copy output → GitHub → Settings → SSH and GPG keys → New SSH key
```

**Clone:**

```bash
git clone git@github.com:IMS1201/devoops_learning.git
cd devoops_learning
```

SSH is common on EC2 and Jenkins so you do not store passwords in scripts.

### 5.5 Useful Git commands

```bash
git status                        # changed files
git branch -a                     # list branches
git checkout main                 # switch to main branch
git pull origin main              # fetch + merge latest main
git fetch origin                  # download without merging
git log --oneline -10             # recent commits
git diff                          # unstaged changes
git remote set-url origin https://github.com/IMS1201/devoops_learning
```

### 5.6 Typical workflow (dev → GitHub → server)

```text
1. Edit code on laptop
2. git add . && git commit -m "message" && git push origin main
3. On EC2:  cd devoops_learning && git pull origin main
4. Rebuild: docker compose up -d --build
5. Test:    curl http://YOUR_EC2_IP/bar
```

Jenkins automates steps 3–4 when you push — see [§10](#10-level-6--cicd-with-jenkins).

### 5.7 If `git pull` fails on EC2

| Error | Fix |
|-------|-----|
| `Authentication failed` | Use PAT for HTTPS or set up SSH keys |
| `local changes would be overwritten` | `git stash` then `git pull`, or `git reset --hard origin/main` (discards local edits) |
| `not a git repository` | Run `git clone` first — you are not inside the repo folder |
| `git: command not found` | Ubuntu: `sudo apt-get install -y git` · Amazon Linux / RHEL: `dnf install -y git` (omit `sudo` if root) |

---

## 6. Docker Hub — build, push, and private image access

Your project images are published to **Docker Hub** under the `raghuk8` account:

| Image | Repository | Visibility |
|-------|------------|------------|
| Backend | `raghuk8/backendapplication` | **Private** (needs token/login) |
| Frontend | `raghuk8/frontend-application` | Public or private |

Kubernetes manifests in `YAML/` reference these images and use `imagePullSecrets: my-registry-key1` when a repo is private.

### 6.1 Create a Docker Hub access token (one-time)

Use a **token**, not your account password, for `docker login` and CI/CD.

1. Log in at [https://hub.docker.com](https://hub.docker.com)
2. Click your profile → **Account Settings** → **Security**
3. Click **New Access Token**
4. Description: `devoops-k8s-ec2`
5. Permissions: **Read & Write** (to push images) or **Read-only** (pull only on servers)
6. Copy the token — it is shown **once**. Store it safely (password manager / Jenkins credentials).

```text
Example token (do not commit this): dckr_pat_xxxxxxxxxxxxxxxxxxxx
```

### 6.2 Log in to Docker Hub (local machine)

Replace `YOUR_DOCKERHUB_USERNAME` and paste your token when prompted for password:

```bash
docker login -u YOUR_DOCKERHUB_USERNAME
# Password: paste your access token (not your Docker Hub account password)
```

Non-interactive login (scripts / CI):

```bash
echo "YOUR_ACCESS_TOKEN" | docker login -u YOUR_DOCKERHUB_USERNAME --password-stdin
```

Verify:

```bash
docker info | grep Username
```

### 6.3 Build, tag, and push images

From the project root:

```bash
# Backend
docker build -t raghuk8/backendapplication:v1 ./backend
docker build -t raghuk8/backendapplication:latest ./backend
docker push raghuk8/backendapplication:v1
docker push raghuk8/backendapplication:latest

# Frontend
# Frontend for EC2/Nginx/K8s (subpath /bar1)
docker build --build-arg VITE_BASE=/bar1/ -t raghuk8/frontend-application:v1 ./frontend
docker build -t raghuk8/frontend-application:latest ./frontend
docker push raghuk8/frontend-application:v1
docker push raghuk8/frontend-application:latest
```

Bump the tag when you release a new version (e.g. `v2`, `v3`) and update `YAML/simple-backend.yaml` / `YAML/simple-frontend.yaml` to match.

Quick pull test:

```bash
docker pull raghuk8/backendapplication:v1
docker pull raghuk8/frontend-application:v1
```

### 6.4 Pull private images on EC2

After SSH into your EC2 instance, log in before `docker compose pull` or `docker pull`:

```bash
echo "YOUR_ACCESS_TOKEN" | docker login -u YOUR_DOCKERHUB_USERNAME --password-stdin

docker pull raghuk8/backendapplication:v1
docker pull raghuk8/frontend-application:v1
```

To run from Hub instead of building on EC2, update `docker-compose.yml` to use Hub tags:

```yaml
services:
  backend:
    image: raghuk8/backendapplication:v1
    # remove or comment out: build: ./backend
  frontend:
    image: raghuk8/frontend-application:v1
    # remove or comment out: build: ./frontend
```

Then:

```bash
docker compose pull
docker compose up -d
```

Credentials are stored in `~/.docker/config.json` on the EC2 instance after login.

### 6.5 Kubernetes — imagePullSecret for private images

When a pod uses a **private** image, the cluster needs a pull secret. Your deployments already reference `my-registry-key1`.

**Step 1 — Log in on your machine (or any host with kubectl access):**

```bash
docker login -u YOUR_DOCKERHUB_USERNAME
# use access token as password
```

**Step 2 — Create the secret in your namespace:**

```bash
kubectl create secret docker-registry my-registry-key1 \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_ACCESS_TOKEN \
  --docker-email=YOUR_EMAIL@example.com \
  -n frontend-namespace
```

Or create from your local Docker config (after `docker login`):

```bash
kubectl create secret generic my-registry-key1 \
  --from-file=.dockerconfigjson=$HOME/.docker/config.json \
  --type=kubernetes.io/dockerconfigjson \
  -n frontend-namespace
```

**Step 3 — Verify and deploy:**

```bash
kubectl get secret my-registry-key1 -n frontend-namespace
kubectl apply -f YAML/
kubectl get pods -n frontend-namespace
```

If a pod stays in `ImagePullBackOff`, check events:

```bash
kubectl describe pod -n frontend-namespace -l app=backend1
```

Common fixes:

- Token expired → create a new token and update the secret
- Wrong username or repo name → verify `raghuk8/backendapplication:v1`
- Secret in wrong namespace → must be in `frontend-namespace`

**Update an existing secret:**

```bash
kubectl delete secret my-registry-key1 -n frontend-namespace

kubectl create secret docker-registry my-registry-key1 \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=NEW_ACCESS_TOKEN \
  --docker-email=YOUR_EMAIL@example.com \
  -n frontend-namespace

kubectl rollout restart deployment backend1 -n frontend-namespace
kubectl rollout restart deployment frontend1 -n frontend-namespace
```

### 6.6 Minikube — use the same secret

```bash
minikube start
docker login -u YOUR_DOCKERHUB_USERNAME   # token as password

kubectl apply -f YAML/name-space.yaml

kubectl create secret docker-registry my-registry-key1 \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_ACCESS_TOKEN \
  --docker-email=YOUR_EMAIL@example.com \
  -n frontend-namespace

kubectl apply -f YAML/simple-backend.yaml
kubectl apply -f YAML/simple-backend-svc.yaml
kubectl apply -f YAML/simple-frontend.yaml
kubectl apply -f YAML/simple-frontend-svc.yaml
kubectl apply -f YAML/ingress.yaml
```

> **Public vs private:** If only the backend is private, you still need `imagePullSecrets` on both deployments if both YAML files declare it — or remove `imagePullSecrets` from the frontend deployment when that repo is public.

### 6.7 Security reminders

- Never commit tokens or passwords to Git
- Use Jenkins **Credentials** (`usernamePassword`) for pipeline `docker login`
- Prefer read-only tokens on production pull-only servers (EC2 / Kubernetes)
- Rotate tokens if exposed

---

## 7. Level 3 — Kubernetes with Minikube

### One-time setup

```bash
minikube start
minikube addons enable ingress
```

### Deploy all manifests

If using **private** images on Docker Hub, create the pull secret **before** applying deployments:

```bash
kubectl apply -f YAML/name-space.yaml

kubectl create secret docker-registry my-registry-key1 \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_ACCESS_TOKEN \
  --docker-email=YOUR_EMAIL@example.com \
  -n frontend-namespace
```

Then apply the rest:

```bash
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
curl http://$(minikube ip)/bar/items

# Frontend UI + CRUD (browser or curl):
# http://$(minikube ip)/bar1
```

### Useful commands

```bash
kubectl get all -n frontend-namespace
kubectl describe ingress ingress-example -n frontend-namespace
kubectl logs -n frontend-namespace -l app=backend1
```

---

## 8. Level 4 — AWS EC2 + Docker Compose (recommended first cloud step)

This section replaces and corrects the original PDF guide for **your actual project**.

### 8.1 Create the EC2 instance

1. Log in to [AWS Console](https://aws.amazon.com) → search **EC2** → **Launch instance**.
2. **Name:** `devoops-learning-server`
3. **AMI:** Ubuntu Server 22.04 LTS (HVM), SSD — **or** Amazon Linux 2023 if you prefer `dnf` / RHEL-family tooling
4. **Instance type:** `t2.micro` or `t3.micro` (Free Tier). Use `t3.small` or `t3.medium` if builds are slow.
5. **Key pair:** Create `devoops-key.pem` (RSA). Download and store safely.

### 8.2 Security group (firewall)

| Rule | Protocol | Port | Source | Purpose |
|------|----------|------|--------|---------|
| SSH | TCP | 22 | **My IP** | Remote admin (never use 0.0.0.0/0 for SSH in production) |
| HTTP | TCP | 80 | 0.0.0.0/0 | Public web via Nginx |
| HTTPS | TCP | 443 | 0.0.0.0/0 | TLS (after Certbot) |

> **Do not open 6789/7890 publicly** if Nginx handles routing on port 80. Those ports stay on `localhost` only.

6. **Storage:** 20–30 GB gp3 (enough for Docker images).
7. **Launch** → wait until **Status checks: 2/2 passed** → copy **Public IPv4 address**.

### 8.3 Connect via SSH

**SSH username depends on the AMI:**

| AMI | SSH user |
|-----|----------|
| Ubuntu | `ubuntu` |
| Amazon Linux / Rocky / RHEL | `ec2-user` (or `root` if you are already root) |

```bash
cd ~/Downloads
chmod 400 devoops-key.pem
ssh -i "devoops-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP      # Ubuntu
# ssh -i "devoops-key.pem" ec2-user@YOUR_EC2_PUBLIC_IP  # Amazon Linux / RHEL family
```

Type `yes` when prompted.

> **Package manager tip:** Ubuntu / Debian use `apt-get`. Amazon Linux, Rocky Linux, and RHEL use **`dnf`** (or `yum` on older versions). If you see `apt-get: command not found`, you are on a Red Hat–family AMI — use the **Amazon Linux / RHEL** commands below. If your prompt is `[root@... #]`, you are already root and can omit `sudo`.

Confirm the OS once after SSH:

```bash
cat /etc/os-release
# ID=ubuntu  → use apt-get sections
# ID=amzn / rhel / rocky  → use dnf sections
```

### 8.4 Install software on EC2

#### Option A — Ubuntu (apt-get)

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

#### Option B — Amazon Linux 2023 / Rocky / RHEL (dnf)

Omit `sudo` if you are already logged in as **root**.

> **Known issue:** On Amazon Linux 2023, `dnf install docker` often leaves a **broken** `docker-buildx` binary under `/usr/libexec/docker/cli-plugins/`. Builds (`docker compose up --build`, `docker buildx`) fail until you replace it with an official release. Do **not** rely only on `dnf install docker-compose-plugin` — install buildx (and compose if needed) manually as below.

```bash
# System updates
dnf update -y

# Git
dnf install -y git
git --version

# Docker Engine
dnf install -y docker
systemctl enable --now docker

# Fix broken docker-buildx shipped with Amazon Linux Docker (x86_64 / amd64)
mkdir -p /usr/libexec/docker/cli-plugins
rm -f /usr/libexec/docker/cli-plugins/docker-buildx
curl -SL "https://github.com/docker/buildx/releases/download/v0.17.1/buildx-v0.17.1.linux-amd64" \
  -o /usr/libexec/docker/cli-plugins/docker-buildx
chmod +x /usr/libexec/docker/cli-plugins/docker-buildx

# Docker Compose plugin (v2: `docker compose`) — install manually if dnf package is missing/broken
# Try package first; if `docker compose version` fails, use the curl install below.
dnf install -y docker-compose-plugin || true
if ! docker compose version >/dev/null 2>&1; then
  curl -SL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64" \
    -o /usr/libexec/docker/cli-plugins/docker-compose
  chmod +x /usr/libexec/docker/cli-plugins/docker-compose
fi

# Allow ec2-user to run docker without sudo (skip if you always use root)
usermod -aG docker ec2-user
exit
```

For **aarch64 / Graviton** instances, swap the buildx URL to `buildx-v0.17.1.linux-arm64` and the compose URL to `docker-compose-linux-aarch64`.

Reconnect as `ec2-user` if you used `usermod`:

```bash
ssh -i "devoops-key.pem" ec2-user@YOUR_EC2_PUBLIC_IP
docker --version
docker buildx version
docker compose version
```

### 8.5 Clone and start the application

Pull code from GitHub first — see [§5 GitHub](#5-github--clone-and-pull-your-code).

**Option A — Build on EC2 from source:**

```bash
cd ~
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning

docker compose up -d --build
docker compose ps
```

**Option B — Pull pre-built images from Docker Hub (private backend needs login first):**

```bash
cd ~
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning

# Log in with Docker Hub username + access token (see §6.1–6.2)
echo "YOUR_ACCESS_TOKEN" | docker login -u YOUR_DOCKERHUB_USERNAME --password-stdin

docker compose pull
docker compose up -d
```

**Option C — Already cloned? Pull latest code and redeploy:**

```bash
cd ~/devoops_learning
git pull origin main
docker compose up -d --build
```

See [§6 Docker Hub](#6-docker-hub--build-push-and-private-image-access) for token creation, push, and `imagePullSecrets`.

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

### 8.6 Install Nginx reverse proxy (port 80)

This mirrors your Kubernetes Ingress (`/bar` → backend, `/bar1` → frontend).

#### Ubuntu

```bash
sudo apt-get install -y nginx
sudo cp deploy/nginx/basic-full-stack-app.conf /etc/nginx/sites-available/basic-full-stack-app
sudo ln -sf /etc/nginx/sites-available/basic-full-stack-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

#### Amazon Linux / Rocky / RHEL

Amazon Linux uses `/etc/nginx/conf.d/` (not `sites-available` / `sites-enabled`):

```bash
dnf install -y nginx
cp deploy/nginx/basic-full-stack-app.conf /etc/nginx/conf.d/basic-full-stack-app.conf
# Remove or comment out the default server block if it conflicts on port 80
nginx -t
systemctl enable nginx
systemctl restart nginx
```

### 8.7 Test from your laptop

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

### 8.8 HTTPS with Let's Encrypt (optional, requires a domain)

Point a DNS **A record** (e.g. `app.yourdomain.com`) to your EC2 public IP, then:

**Ubuntu:**

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yourdomain.com
```

**Amazon Linux / Rocky / RHEL:**

```bash
dnf install -y certbot python3-certbot-nginx
certbot --nginx -d app.yourdomain.com
nslookup vemuris.info
```

Certbot updates Nginx for HTTPS and auto-renewal.

### 8.9 Frontend build for `/bar1` subpath (EC2 + Nginx / K8s ingress)

The frontend is served under **`/bar1`**, not at the domain root. The production Docker image must be built with Vite `base: '/bar1/'` so JS/CSS load correctly.

The `frontend/Dockerfile` defaults to this:

```dockerfile
ARG VITE_BASE=/bar1/
ENV VITE_BASE=$VITE_BASE
RUN npm run build
```

**EC2 / Hub push (ingress path):**

```bash
docker build -t raghuk8/frontend-application:v1 --build-arg VITE_BASE=/bar1/ ./frontend
docker push raghuk8/frontend-application:v1
```

**Local docker-compose** (direct `http://localhost:6789` without Nginx) uses `VITE_BASE=/` in `docker-compose.yml`.

After any frontend code change, **rebuild and redeploy** the image — pulling old Hub tags will not include your changes.

### 8.10 Rebuild after code changes (important)

If you changed `backend/`, `frontend/`, or `YAML/`:

```bash
# Option 1 — build on EC2
git pull origin main
docker compose up -d --build

# Option 2 — build locally, push to Hub, pull on EC2
docker build -t raghuk8/backendapplication:v2 ./backend
docker push raghuk8/backendapplication:v2
# update image tag in YAML/ or docker-compose, then redeploy
```

Kubernetes: bump `image:` tag in `YAML/simple-backend.yaml` / `YAML/simple-frontend.yaml`, then `kubectl apply -f YAML/` and rollout restart.

---

## 9. Level 5 — AWS EC2 + Kubernetes (kubeadm)

Run the **same `YAML/` manifests** on EC2 using a standard **Kubernetes** cluster installed with **kubeadm** — the same tooling used in production and CKA/CKAD learning paths (not k3s).

This mirrors your local Minikube setup (nginx ingress + `YAML/`), but on a real EC2 VM.

### 9.1 Instance requirements

| Setting | Recommendation |
|---------|----------------|
| **Instance type** | `t3.medium` minimum (2 vCPU, 4 GB RAM). Use `t3.large` if pods stay `Pending`. |
| **AMI** | Ubuntu Server 22.04 LTS **or** Amazon Linux 2023 (Rocky / RHEL also work) |
| **Storage** | 30 GB+ gp3 |
| **Security group** | SSH **22** (My IP), **80**, **443** (0.0.0.0/0), **30080** (ingress NodePort), **6443** (optional — remote `kubectl`) |

| AMI | Package manager | Typical SSH user |
|-----|-----------------|------------------|
| Ubuntu 22.04 | `apt-get` | `ubuntu` |
| Amazon Linux 2023 / Rocky / RHEL | `dnf` (or `yum` on older versions) | `ec2-user` or `root` |

> If you see `sudo: apt-get: command not found`, the instance is **not** Ubuntu — use the **Amazon Linux / RHEL** steps (`dnf`). If your prompt is `[root@... #]`, drop `sudo` from every command.

Confirm OS before installing anything:

```bash
cat /etc/os-release
```

### 9.2 Prepare the EC2 node

SSH into the instance, then run the block that matches your AMI.

#### Ubuntu (apt-get)

```bash
# System prep (Kubernetes requires swap off)
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y git curl apt-transport-https ca-certificates gnupg

sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# Kernel modules & sysctl
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay
sudo modprobe br_netfilter

cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system
```

#### Amazon Linux / Rocky / RHEL (dnf)

Omit `sudo` when logged in as **root**.

```bash
# System prep (Kubernetes requires swap off)
dnf update -y
dnf install -y git curl ca-certificates gnupg2 yum-utils

swapoff -a
sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# Kernel modules & sysctl
cat <<EOF | tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
modprobe overlay
modprobe br_netfilter

cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sysctl --system
```

### 9.3 Install containerd

#### Ubuntu

```bash
sudo apt-get install -y containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml > /dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
sudo systemctl restart containerd
sudo systemctl enable containerd
```

#### Amazon Linux / Rocky / RHEL

```bash
dnf install -y containerd
mkdir -p /etc/containerd
containerd config default | tee /etc/containerd/config.toml > /dev/null
sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
systemctl restart containerd
systemctl enable containerd
```

### 9.4 Install kubeadm, kubelet, kubectl

#### Ubuntu (deb packages)

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
```

#### Amazon Linux / Rocky / RHEL (rpm packages)

```bash
cat <<EOF | tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/
enabled=1
gpgcheck=1
gpgkey=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/repodata/repomd.xml.key
exclude=kubelet kubeadm kubectl cri-tools kubernetes-cni
EOF

dnf install -y kubelet kubeadm kubectl --disableexcludes=kubernetes
systemctl enable --now kubelet
```

Verify (both OS families):

```bash
kubeadm version
kubectl version --client
```

### 9.5 Initialize the Kubernetes cluster

Replace `YOUR_EC2_PRIVATE_IP` with the instance **private IP** from the AWS console (e.g. `172.31.x.x`):

```bash
# Add sudo on Ubuntu if you are not root
kubeadm init --pod-network-cidr=192.168.0.0/16 --apiserver-advertise-address=YOUR_EC2_PRIVATE_IP
```

Save the `kubeadm join ...` output if you add worker nodes later.

Configure kubectl for your login user (`ubuntu`, `ec2-user`, or `root`):

```bash
mkdir -p $HOME/.kube
cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
# If you used sudo for kubeadm init, copy with: sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
chown $(id -u):$(id -g) $HOME/.kube/config

kubectl get nodes
# STATUS: NotReady until CNI is installed
```

### 9.6 Install CNI (Calico) and allow pods on control plane

For a **single-node** learning cluster, remove the control-plane taint so app pods can schedule:

```bash
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/calico.yaml

kubectl taint nodes --all node-role.kubernetes.io/control-plane-
```

Wait until the node is Ready:

```bash
kubectl get nodes -w
# STATUS should become Ready
```

### 9.7 Install nginx Ingress Controller

Same ingress controller family as Minikube:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.1/deploy/static/provider/baremetal/deploy.yaml

kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

kubectl get pods -n ingress-nginx
```

For EC2, patch the ingress Service to expose HTTP on the node (bare-metal manifest uses NodePort by default):

```bash
kubectl patch svc ingress-nginx-controller -n ingress-nginx -p \
  '{"spec":{"ports":[{"name":"http","port":80,"protocol":"TCP","targetPort":"http","nodePort":30080}]}}'

# Or use hostPort / LoadBalancer on cloud — for learning, access via:
# http://YOUR_EC2_PUBLIC_IP:30080/bar
```

> **Tip:** Minikube exposes ingress on port 80 via `minikube ip`. On kubeadm EC2, ingress is often on **NodePort 30080** unless you configure a cloud LoadBalancer or host Nginx in front.

### 9.8 Clone code and deploy your app

```bash
cd ~
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning
# or if already cloned: git pull origin main
```

Create Docker Hub pull secret if backend image is private — see [§6.5](#65-kubernetes--imagepullsecret-for-private-images):

```bash
kubectl apply -f YAML/name-space.yaml

kubectl create secret docker-registry my-registry-key1 \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_ACCESS_TOKEN \
  --docker-email=YOUR_EMAIL@example.com \
  -n frontend-namespace

kubectl apply -f YAML/simple-backend.yaml
kubectl apply -f YAML/simple-backend-svc.yaml
kubectl apply -f YAML/simple-frontend.yaml
kubectl apply -f YAML/simple-frontend-svc.yaml
kubectl apply -f YAML/ingress.yaml
```

Verify:

```bash
kubectl get pods,svc,ingress -n frontend-namespace
kubectl describe ingress ingress-example -n frontend-namespace
```

### 9.9 Access the application

**Option A — Ingress NodePort (default after §9.7):**

```bash
curl -H "Host: foo.bar1.com" http://YOUR_EC2_PUBLIC_IP:30080/bar
curl -H "Host: foo.bar1.com" http://YOUR_EC2_PUBLIC_IP:30080/bar1
```

Add to `/etc/hosts` on your laptop for browser access:

```text
YOUR_EC2_PUBLIC_IP  foo.bar1.com
```

Then open `http://foo.bar1.com:30080/bar1` (include NodePort if not using port 80).

**Option B — Match Minikube (port 80 on node IP):**

Patch ingress controller to bind host port 80 (single-node lab only):

```bash
kubectl patch deployment ingress-nginx-controller -n ingress-nginx --type='json' -p='[
  {"op":"add","path":"/spec/template/spec/containers/0/ports/0/hostPort","value":80}
]'
```

Ensure security group allows **80**. Then:

```bash
curl -H "Host: foo.bar1.com" http://YOUR_EC2_PUBLIC_IP/bar
```

### 9.10 Useful Kubernetes commands on EC2

```bash
kubectl get all -n frontend-namespace
kubectl logs -n frontend-namespace -l app=backend1
kubectl logs -n frontend-namespace -l app=frontend1
kubectl describe pod -n frontend-namespace <pod-name>
kubectl rollout restart deployment backend1 -n frontend-namespace
kubectl delete -f YAML/ingress.yaml
kubectl apply -f YAML/ingress.yaml
```

### 9.11 Update deployment after Git push

```bash
cd ~/devoops_learning
git pull origin main
kubectl apply -f YAML/
kubectl rollout restart deployment backend1 -n frontend-namespace
kubectl rollout restart deployment frontend1 -n frontend-namespace
```

To deploy a new image tag, update `image:` in `YAML/simple-backend.yaml` / `YAML/simple-frontend.yaml`, then `kubectl apply -f YAML/`.

### 9.12 Minikube vs EC2 Kubernetes

| | Minikube (Level 3) | EC2 kubeadm (Level 5) |
|--|-------------------|------------------------|
| Install | `minikube start` | kubeadm + Calico + nginx ingress |
| Ingress access | `http://$(minikube ip)/bar` | `http://EC2_IP:30080/bar` or patch port 80 |
| Manifests | Same `YAML/` folder | Same `YAML/` folder |
| Production path | Local learning | Leads to multi-node kubeadm or **EKS** (Level 7) |

> For the simplest first cloud deploy, use **Level 4** (Docker Compose + Nginx). Use **Level 5** when you want real Kubernetes on EC2 with the same manifests you already use in Minikube.

---

## 10. Level 6 — CI/CD with Jenkins

Your repo includes `Jenkinsfile.backend` and `Jenkinsfile.frontend`.

### Jenkins vs project image names

The repo `Jenkinsfile.*` files may reference **`pav30/basic-full-stack-app-*`** from an earlier DevPilot setup. Your Kubernetes YAML and this guide use **`raghuk8/backendapplication`** and **`raghuk8/frontend-application`**. Align Jenkins push tags with whatever is in `YAML/` and `docker-compose.yml`.

### Pipeline stages (backend example)

1. **Checkout** — `git clone` / pull from GitHub (`checkout scm` in Jenkins)
2. **Docker Build** — `docker build ./backend`
3. **Trivy Scan** — security scan (optional)
4. **Push to Registry** — Docker Hub (`raghuk8/backendapplication:...`)
5. **Deploy to VM** — SSH to EC2, `docker login`, then `docker compose pull && up -d` (Compose path; for K8s use `kubectl apply` instead)

> Jenkins in this repo deploys **Docker Compose on EC2**, not kubectl. For Kubernetes deploy, add a pipeline stage with `kubectl apply -f YAML/` or use a separate job.

### Docker login in Jenkins (push stage)

Store Docker Hub credentials in Jenkins as **Username with password** (`credentialsId` in your Jenkinsfile). The pipeline uses:

```bash
echo $REG_PASS | docker login -u $REG_USER --password-stdin
docker tag $DOCKER_IMAGE:$DOCKER_TAG raghuk8/backendapplication:$DOCKER_TAG
docker push raghuk8/backendapplication:$DOCKER_TAG
```

Use the **access token** as `$REG_PASS`, not your Docker Hub account password.

### Docker login on EC2 (deploy stage)

Before pull on the server:

```bash
echo $REG_PASS | docker login -u $REG_USER --password-stdin
cd ~/devpilot-app
docker compose pull
docker compose up -d
```

### Setup checklist

| Item | Action |
|------|--------|
| Jenkins server | Install Jenkins (Docker or VM) |
| Docker socket | Mount `/var/run/docker.sock` for builds |
| Credentials | Docker Hub username + **access token**, EC2 SSH private key |
| EC2 prep | Clone repo to `~/devpilot-app`, initial `docker compose up` |
| Multibranch job | Point to `Jenkinsfile.backend` / `Jenkinsfile.frontend` |

### Manual deploy after Jenkins push

On EC2 (must be logged in if images are private):

```bash
echo "YOUR_ACCESS_TOKEN" | docker login -u YOUR_DOCKERHUB_USERNAME --password-stdin
cd ~/devpilot-app
docker compose pull
docker compose up -d
```

---

## 11. Level 7 — Advanced AWS (production patterns)

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

## 12. Verification checklist

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
curl http://localhost/bar/items
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/bar1

# From laptop
curl http://YOUR_EC2_PUBLIC_IP/bar
curl http://YOUR_EC2_PUBLIC_IP/bar/items
```

Open in browser: `http://YOUR_EC2_PUBLIC_IP/bar1` (CRUD UI).

Kubernetes (Minikube or EC2 kubeadm):

```bash
kubectl get pods,svc,ingress -n frontend-namespace
kubectl describe ingress ingress-example -n frontend-namespace
curl -H "Host: foo.bar1.com" http://$(minikube ip)/bar/items    # Minikube
curl -H "Host: foo.bar1.com" http://YOUR_EC2_IP:30080/bar/items # kubeadm NodePort
```

---

## 13. Troubleshooting

### ImagePullBackOff (Kubernetes private image)

| Cause | Fix |
|-------|-----|
| No `imagePullSecrets` | Create `my-registry-key1` — see [§6.5](#65-kubernetes--imagepullsecret-for-private-images) |
| Wrong or expired token | Create new Docker Hub token and update the secret |
| Secret in wrong namespace | Secret must exist in `frontend-namespace` |

```bash
kubectl describe pod -n frontend-namespace -l app=backend1
kubectl delete secret my-registry-key1 -n frontend-namespace
# recreate secret with new token, then:
kubectl rollout restart deployment backend1 -n frontend-namespace
```

### nginx 404 Not Found

| Cause | Fix |
|-------|-----|
| Opening `http://IP/` (root) | Use `/bar` or `/bar1` — no rule for `/` |
| Ingress host `foo.bar1.com` but browser uses IP | Add `/etc/hosts` entry or use fallback rule in `ingress.yaml` |
| Missing `rewrite-target` | Keep `nginx.ingress.kubernetes.io/rewrite-target: /` in ingress |

### Express: `Cannot GET /bar`

Nginx/Ingress is forwarding `/bar` without rewriting. Use `deploy/nginx/basic-full-stack-app.conf` or the ingress rewrite annotation.

### `sudo: apt-get: command not found`

Your EC2 AMI is from the **Red Hat family** (Amazon Linux, Rocky Linux, or RHEL), not Ubuntu. Those systems use **`dnf`** (or `yum` on older releases), not `apt-get`.

```bash
cat /etc/os-release          # confirm ID=amzn / rhel / rocky
dnf update -y                # instead of apt-get update
# Omit sudo if your prompt is [root@... #]
```

Use the **Amazon Linux / RHEL** command blocks in [§8.4](#84-install-software-on-ec2) and [§9.2](#92-prepare-the-ec2-node)–[§9.4](#94-install-kubeadm-kubelet-kubectl).

### `docker compose` not found

**Ubuntu:**

```bash
sudo apt-get install -y docker-compose-plugin
docker compose version
```

**Amazon Linux / Rocky / RHEL:**

```bash
dnf install -y docker-compose-plugin
# If that still fails:
mkdir -p /usr/libexec/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64" \
  -o /usr/libexec/docker/cli-plugins/docker-compose
chmod +x /usr/libexec/docker/cli-plugins/docker-compose
docker compose version
```

### Amazon Linux: `docker buildx` / build fails after `dnf install docker`

Amazon Linux often ships a broken buildx plugin. Replace it with a known-good release:

```bash
rm -f /usr/libexec/docker/cli-plugins/docker-buildx
curl -SL "https://github.com/docker/buildx/releases/download/v0.17.1/buildx-v0.17.1.linux-amd64" \
  -o /usr/libexec/docker/cli-plugins/docker-buildx
chmod +x /usr/libexec/docker/cli-plugins/docker-buildx
docker buildx version
```

### Permission denied on Docker

**Ubuntu:**

```bash
sudo usermod -aG docker ubuntu
exit   # reconnect SSH
```

**Amazon Linux / Rocky / RHEL:**

```bash
usermod -aG docker ec2-user
exit   # reconnect SSH
```
### Security group blocks traffic

- Port **80** must allow `0.0.0.0/0` for public HTTP
- App ports **6789/7890** do not need to be public if Nginx proxies on 80

### Frontend blank page at `/bar1` (no CSS/JS)

| Cause | Fix |
|-------|-----|
| Vite built with `base: '/'` but served under `/bar1` | Rebuild: `docker build --build-arg VITE_BASE=/bar1/ -t raghuk8/frontend-application:v1 ./frontend` |
| Old image on Hub / K8s | Push new tag, update YAML, rollout restart |

### Frontend CRUD buttons fail in browser

| Cause | Fix |
|-------|-----|
| API calls wrong URL | Production uses `API_BASE=/bar` → calls `/bar/items` |
| Old frontend image | Rebuild and redeploy frontend container |

### EC2 IP changed after stop/start

Unless you use an **Elastic IP**, the public IP changes when the instance restarts. Update DNS or `/etc/hosts`.

---

## 14. Pre-deploy checklist (nothing missing)

| Step | Local | EC2 Compose | K8s (Minikube/kubeadm) |
|------|-------|-------------|-------------------------|
| Code from GitHub | `git clone` / `git pull` | same on EC2 | same on node |
| Docker Hub login | if pushing/pulling private | `docker login` + token | `imagePullSecrets` created |
| Images built/pushed | optional | `docker compose build` or pull Hub tags | `raghuk8/*:v1` in YAML matches Hub |
| Frontend `VITE_BASE` | `/` for `npm run dev` | `/bar1/` for Nginx/K8s image | `--build-arg VITE_BASE=/bar1/` |
| Backend CRUD | `curl localhost:8000/items` | `curl .../bar/items` via Nginx | `curl .../bar/items` via ingress |
| Routing rewrite | n/a | Nginx `deploy/nginx/` installed | `rewrite-target: /` in ingress |
| Firewall | n/a | SG: 22, 80, 443 | SG: + **30080** for kubeadm ingress |
| After code change | restart npm | `docker compose up -d --build` | rebuild image, bump tag, `kubectl apply` |

**Common gaps:**

1. Code pushed to GitHub but **Docker images never rebuilt** on EC2/K8s  
2. Private backend without **`docker login`** or **`my-registry-key1`**  
3. Using `http://IP/` instead of **`/bar`** or **`/bar1`**  
4. Blank UI at `/bar1` — missing **`VITE_BASE=/bar1/`** in frontend build  
5. Jenkins **`pav30/...`** tags vs **`raghuk8/...`** in YAML  
6. No **Elastic IP** — public IP changes when instance stops  

---

## Quick reference — command cheat sheet

```bash
# === GITHUB — clone & pull ===
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning
git pull origin main

# === DOCKER HUB — login & push ===
docker login -u YOUR_DOCKERHUB_USERNAME
# password: paste access token

echo "YOUR_ACCESS_TOKEN" | docker login -u YOUR_DOCKERHUB_USERNAME --password-stdin

docker build -t raghuk8/backendapplication:v1 ./backend
# Frontend for EC2/Nginx/K8s (subpath /bar1)
docker build --build-arg VITE_BASE=/bar1/ -t raghuk8/frontend-application:v1 ./frontend
docker push raghuk8/backendapplication:v1
docker push raghuk8/frontend-application:v1

# === K8s private image secret ===
kubectl create secret docker-registry my-registry-key1 \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_ACCESS_TOKEN \
  --docker-email=YOUR_EMAIL@example.com \
  -n frontend-namespace

# === LOCAL K8s (Minikube) ===
minikube start && minikube addons enable ingress
kubectl apply -f YAML/

# === EC2 K8s (kubeadm) — after cluster init + Calico + ingress ===
kubectl apply -f YAML/name-space.yaml
kubectl apply -f YAML/
curl -H "Host: foo.bar1.com" http://<EC2_IP>:30080/bar

# === LOCAL Docker ===
docker compose up -d --build

# === EC2 SSH ===
ssh -i devoops-key.pem ubuntu@<EC2_IP>      # Ubuntu
# ssh -i devoops-key.pem ec2-user@<EC2_IP>  # Amazon Linux / RHEL

# === EC2 DEPLOY — Docker Compose + Nginx (Ubuntu) ===
cd ~
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning
echo "YOUR_ACCESS_TOKEN" | docker login -u YOUR_DOCKERHUB_USERNAME --password-stdin
docker compose pull && docker compose up -d
sudo cp deploy/nginx/basic-full-stack-app.conf /etc/nginx/sites-available/basic-full-stack-app
sudo ln -sf /etc/nginx/sites-available/basic-full-stack-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl restart nginx

# === EC2 DEPLOY — Docker Compose + Nginx (Amazon Linux / RHEL; omit sudo if root) ===
# dnf install -y nginx
# cp deploy/nginx/basic-full-stack-app.conf /etc/nginx/conf.d/basic-full-stack-app.conf
# nginx -t && systemctl enable --now nginx

# === TEST ===
curl http://<EC2_IP>/bar
curl http://<EC2_IP>/bar1
```

---

*Document version: 3.1 — Ubuntu + Amazon Linux / RHEL (`dnf`) paths for EC2 Compose and kubeadm*
