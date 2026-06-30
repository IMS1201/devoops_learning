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
5. [GitHub — clone and pull your code](#5-github--clone-and-pull-your-code)
6. [Docker Hub — build, push, and private image access](#6-docker-hub--build-push-and-private-image-access)
7. [Level 3 — Kubernetes with Minikube](#7-level-3--kubernetes-with-minikube)
8. [Level 4 — AWS EC2 + Docker Compose (recommended first cloud step)](#8-level-4--aws-ec2--docker-compose-recommended-first-cloud-step)
9. [Level 5 — AWS EC2 + Kubernetes (k3s)](#9-level-5--aws-ec2--kubernetes-k3s)
10. [Level 6 — CI/CD with Jenkins](#10-level-6--cicd-with-jenkins)
11. [Level 7 — Advanced AWS (production patterns)](#11-level-7--advanced-aws-production-patterns)
12. [Verification checklist](#12-verification-checklist)
13. [Troubleshooting](#13-troubleshooting)

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
| `git: command not found` | `sudo apt-get install -y git` |

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
docker build -t raghuk8/frontend-application:v1 ./frontend
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
- Prefer read-only tokens on production pull-only servers (EC2 / k3s)
- Rotate tokens if exposed

---

## 7. Level 3 — Kubernetes with Minikube

### One-time setup

```bash
minikube start
minikube addons enable ingress
```

### Deploy all manifests

If using **private** images on Docker Hub, create the pull secret first — see [§6.5](#65-kubernetes--imagepullsecret-for-private-images).

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

## 8. Level 4 — AWS EC2 + Docker Compose (recommended first cloud step)

This section replaces and corrects the original PDF guide for **your actual project**.

### 8.1 Create the EC2 instance

1. Log in to [AWS Console](https://aws.amazon.com) → search **EC2** → **Launch instance**.
2. **Name:** `devoops-learning-server`
3. **AMI:** Ubuntu Server 22.04 LTS (HVM), SSD
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

```bash
cd ~/Downloads
chmod 400 devoops-key.pem
ssh -i "devoops-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
```

Type `yes` when prompted.

### 8.4 Install software on EC2

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

```bash
sudo apt-get install -y nginx
sudo cp deploy/nginx/basic-full-stack-app.conf /etc/nginx/sites-available/basic-full-stack-app
sudo ln -sf /etc/nginx/sites-available/basic-full-stack-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
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

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yourdomain.com
```

Certbot updates Nginx for HTTPS and auto-renewal.

### 8.9 Production fix — frontend API URL

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

## 9. Level 5 — AWS EC2 + Kubernetes (k3s)

Run the **same `YAML/` manifests** on EC2 using [k3s](https://k3s.io/) (lightweight Kubernetes).

### 9.1 Instance requirements

- **Instance type:** at least `t3.medium` (2 vCPU, 4 GB RAM)
- Security group: open **80, 443** (and **6443** only if you need remote kubectl)

### 9.2 Install k3s on EC2

```bash
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes
```

k3s includes Traefik ingress by default. Either use Traefik or disable it and install nginx ingress:

```bash
# Optional: use nginx ingress (closer to Minikube setup)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.1/deploy/static/provider/cloud/deploy.yaml
```

### 9.3 Deploy your app

```bash
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning
# or if already cloned: git pull origin main
kubectl apply -f YAML/
```

### 9.4 Access

```bash
# Get node IP (EC2 public IP)
kubectl get ingress -n frontend-namespace

# With host rule foo.bar1.com — add to /etc/hosts on your laptop:
# <EC2_PUBLIC_IP>  foo.bar1.com

curl -H "Host: foo.bar1.com" http://YOUR_EC2_PUBLIC_IP/bar
```

> On a single-node k3s EC2 instance, ensure the ingress controller Service exposes port 80 (NodePort or hostNetwork). For learning, Nginx on the host (Level 4) is simpler; k3s is the bridge to EKS.

---

## 10. Level 6 — CI/CD with Jenkins

Your repo includes `Jenkinsfile.backend` and `Jenkinsfile.frontend`.

### Pipeline stages (backend example)

1. **Checkout** — `git clone` / pull from GitHub (`checkout scm` in Jenkins)
2. **Docker Build** — `docker build ./backend`
3. **Trivy Scan** — security scan (optional)
4. **Push to Registry** — Docker Hub (`raghuk8/backendapplication:...`)
5. **Deploy to VM** — SSH to EC2, `docker login`, then `docker compose pull && up -d`

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

The frontend uses `/bar` as API base in production. Rebuild the frontend image after code changes.

### EC2 IP changed after stop/start

Unless you use an **Elastic IP**, the public IP changes when the instance restarts. Update DNS or `/etc/hosts`.

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
docker build -t raghuk8/frontend-application:v1 ./frontend
docker push raghuk8/backendapplication:v1
docker push raghuk8/frontend-application:v1

# === K8s private image secret ===
kubectl create secret docker-registry my-registry-key1 \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_ACCESS_TOKEN \
  --docker-email=YOUR_EMAIL@example.com \
  -n frontend-namespace

# === LOCAL ===
docker compose up -d --build
kubectl apply -f YAML/

# === EC2 SSH ===
ssh -i devoops-key.pem ubuntu@<EC2_IP>

# === EC2 DEPLOY (pull code + images from Hub) ===
cd ~
git clone https://github.com/IMS1201/devoops_learning.git
cd devoops_learning
echo "YOUR_ACCESS_TOKEN" | docker login -u YOUR_DOCKERHUB_USERNAME --password-stdin
docker compose pull && docker compose up -d
sudo cp deploy/nginx/basic-full-stack-app.conf /etc/nginx/sites-available/basic-full-stack-app
sudo ln -sf /etc/nginx/sites-available/basic-full-stack-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl restart nginx

# === TEST ===
curl http://<EC2_IP>/bar
curl http://<EC2_IP>/bar1
```

---

*Document version: 2.0 — aligned with Basic-Full-Stack-App (`IMS1201/devoops_learning`)*
