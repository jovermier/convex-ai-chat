# Docker & Infrastructure - Self-Hosted Convex Research

## Research Overview

This document compiles research findings about Docker and infrastructure issues in self-hosted Convex deployments.

**Sources:**

- [Self-Hosted Convex README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Docker Compose Configuration](https://github.com/get-convex/convex-backend/blob/main/self-hosted/docker/docker-compose.yml)
- [Hosting on Own Infrastructure](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/hosting_on_own_infra.md)

---

## Question 25: Why does mounting `/convex:ro` fail with "read-only file system"?

### Answer

This error occurs when trying to mount the wrong directory or using incorrect mount syntax.

### Root Causes

#### 1. Mounting Wrong Directory

```yaml
# Wrong (mounting internal directory)
volumes:
  - ./convex:/convex:ro

# Error: Cannot mount to /convex (internal binary location)
```

#### 2. Missing Directory

```yaml
# Wrong (directory doesn't exist)
volumes:
  - ./convex:/app/convex:ro

# Error: Directory ./convex doesn't exist
```

### Correct Mounts

#### For Data Persistence

```yaml
# Correct (data volume)
volumes:
  - data:/convex/data
```

#### For Development Hot Reload

```yaml
# Correct (mount local convex directory)
volumes:
  - ./convex:/app/convex:ro
```

### Volume Types

#### Named Volumes (Recommended for Data)

```yaml
volumes:
  data:
  # Managed by Docker
  # Persists across container restarts
  # Backed by /var/lib/docker/volumes/
```

#### Bind Mounts (For Development)

```yaml
volumes:
  - ./convex:/app/convex:ro
  # Maps host directory to container
  - ./data:/convex/data
  # Maps host directory to container
```

#### Tmpfs Mounts (For Caching)

```yaml
volumes:
  - cache:/tmp:tmpfs
  # In-memory filesystem
  # Fast but non-persistent
```

---

## Question 26: What's the correct way to mount the `convex/` directory?

### Answer

The correct mount depends on your use case: development vs production.

### Development Mode (Hot Reload)

#### docker-compose.dev.yml

```yaml
services:
  backend:
    image: ghcr.io/get-convex/convex-backend:latest
    volumes:
      # Mount local convex directory for hot reload
      - ./convex:/app/convex:ro
      # Persist data
      - data-dev:/convex/data
    environment:
      - CONVEX_DEV_MODE=true
```

**Directory Structure:**

```
project/
├── convex/
│   ├── schema.ts
│   ├── messages.ts
│   └── documents.ts
├── docker-compose.dev.yml
└── .env.local
```

### Production Mode (Deployed Functions)

#### docker-compose.prod.yml

```yaml
services:
  backend:
    image: ghcr.io/get-convex/convex-backend:latest
    volumes:
      # Only persist data
      - data-prod:/convex/data
    # No function mount - functions deployed via CLI
```

**Deployment:**

```bash
# Deploy functions via CLI
npx convex deploy
```

### Hybrid Approach

```yaml
services:
  backend-dev:
    image: ghcr.io/get-convex/convex-backend:latest
    ports:
      - "3210:3210"
    volumes:
      - ./convex:/app/convex:ro
      - data-dev:/convex/data
    environment:
      - CONVEX_DEV_MODE=true

  backend-prod:
    image: ghcr.io/get-convex/convex-backend:latest
    ports:
      - "3211:3210"
    volumes:
      - data-prod:/convex/data
```

### Best Practices

#### 1. Use Read-Only Mounts for Functions

```yaml
volumes:
  - ./convex:/app/convex:ro # :ro prevents container from writing
```

#### 2. Use Named Volumes for Data

```yaml
volumes:
  - data:/convex/data # Named volume, not bind mount
```

#### 3. Separate Development and Production

```yaml
# docker-compose.yml (base)
services:
  backend:
    image: ghcr.io/get-convex/convex-backend:latest

# docker-compose.dev.yml (override)
services:
  backend:
    volumes:
      - ./convex:/app/convex:ro
```

---

## Question 27: How does Docker volume persistence affect Convex state?

### Answer

Docker volumes are critical for persisting Convex state across container restarts.

### What Gets Persisted

#### In `/convex/data` Volume

- SQLite database (if using SQLite)
- Instance secret
- Deployed functions (if not using hot reload)
- File storage (if not using S3)
- Search indexes
- Snapshots

#### What Does NOT Get Persisted

- Environment variables (in container configuration)
- Temporary files
- Logs (unless configured)

### Volume Persistence Scenarios

#### Scenario 1: No Persistence (Bad)

```yaml
# Missing volumes section
services:
  backend:
    image: ghcr.io/get-convex/convex-backend:latest
    # No volumes!
```

**Result:**

- All data lost on container restart
- New instance secret each time
- Admin keys invalidated
- ❌ Not usable

#### Scenario 2: Named Volume (Good)

```yaml
volumes:
  - data:/convex/data

volumes:
  data:
```

**Result:**

- Data persists across restarts
- Instance secret preserved
- Admin keys remain valid
- ✅ Recommended

#### Scenario 3: Bind Mount (Also Good)

```yaml
volumes:
  - ./data:/convex/data
```

**Result:**

- Data persists across restarts
- Instance secret preserved
- Data accessible on host filesystem
- ✅ Good for local development

### Checking Volume Persistence

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect <project>_data

# Check contents
docker run --rm -v <project>_data:/data alpine ls -la /data

# Backup volume
docker run --rm -v <project>_data:/data -v $(pwd):/backup alpine tar czf /backup/convex-backup.tar.gz /data
```

### Backup Strategy

#### Automated Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

# Backup volume
docker run --rm \
  -v convex_data:/data \
  -v $(pwd)/$BACKUP_DIR:/backup \
  alpine tar czf /backup/convex-$(date +%Y%m%d-%H%M%S).tar.gz /data

echo "Backup completed"
```

#### Restore from Backup

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1

# Stop backend
docker compose down

# Restore volume
docker run --rm \
  -v convex_data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/$BACKUP_FILE -C /"

# Start backend
docker compose up -d

echo "Restore completed"
```

---

## Question 28: Can self-hosted Convex run without persistent volumes?

### Answer

**Technically yes, but it's not recommended** for any serious use case.

### Ephemeral Mode (No Persistence)

```yaml
services:
  backend:
    image: ghcr.io/get-convex/convex-backend:latest
    # No volumes
```

**Characteristics:**

- ✅ Fast startup
- ✅ Good for testing
- ❌ Data lost on restart
- ❌ New instance secret each time
- ❌ Must regenerate admin keys
- ❌ Cannot deploy functions

### Use Cases for Ephemeral Mode

#### 1. Testing

```yaml
# docker-compose.test.yml
services:
  backend-test:
    image: ghcr.io/get-convex/convex-backend:latest
    # No volumes - fresh instance each time
```

```bash
# Run tests
docker compose -f docker-compose.test.yml up --abort-on-container-exit
```

#### 2. CI/CD

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    docker run --rm ghcr.io/get-convex/convex-backend:latest
    # Run tests against ephemeral instance
```

### Recommended: Always Use Persistent Volumes

Even for development, persistent volumes provide:

- Consistent admin keys
- Deployed functions persist
- Database state preserved
- Faster restart (no migrations)

---

## Question 29: What ports does self-hosted Convex require and why?

### Answer

Self-hosted Convex requires three ports for different purposes.

### Port Overview

| Port     | Purpose      | Protocol | Required          |
| -------- | ------------ | -------- | ----------------- |
| **3210** | Backend API  | HTTP     | ✅ Yes            |
| **3211** | HTTP Actions | HTTP     | ✅ Yes (if using) |
| **6791** | Dashboard    | HTTP     | ✅ Yes (if using) |

### Port 3210 - Backend API

**Purpose:** Main Convex backend API endpoint

**Usage:**

- Client queries and mutations
- Function deployment via CLI
- Admin operations

**Configuration:**

```yaml
services:
  backend:
    ports:
      - "3210:3210"
```

**Example URLs:**

```
http://127.0.0.1:3210/api/messages
http://127.0.0.1:3210/api/check_admin_key
```

### Port 3211 - HTTP Actions

**Purpose:** Convex HTTP actions (custom HTTP endpoints)

**Usage:**

- HTTP action functions
- Webhooks
- Custom API endpoints

**Configuration:**

```yaml
services:
  backend:
    ports:
      - "3211:3211"
    environment:
      - CONVEX_SITE_ORIGIN=http://127.0.0.1:3211
```

**Example URLs:**

```
http://127.0.0.1:3211/myAction
http://127.0.0.1:3211/webhooks/github
```

### Port 6791 - Dashboard

**Purpose:** Convex dashboard for management

**Usage:**

- View database
- Deploy functions
- Manage environment variables
- Monitor logs

**Configuration:**

```yaml
services:
  dashboard:
    image: ghcr.io/get-convex/convex-dashboard:latest
    ports:
      - "6791:6791"
    environment:
      - NEXT_PUBLIC_DEPLOYMENT_URL=http://127.0.0.1:3210
```

**Access:**

```
http://localhost:6791
```

### Port Mapping

#### Default Ports

```yaml
ports:
  - "3210:3210" # Backend API
  - "3211:3211" # HTTP Actions
  - "6791:6791" # Dashboard
```

#### Custom Ports

```yaml
ports:
  - "8080:3210" # Backend on port 8080
  - "8081:3211" # HTTP Actions on port 8081
  - "3000:6791" # Dashboard on port 3000
```

**Environment Variables:**

```yaml
environment:
  - CONVEX_CLOUD_ORIGIN=http://your-domain.com:8080
  - CONVEX_SITE_ORIGIN=http://your-domain.com:8081
  - NEXT_PUBLIC_DEPLOYMENT_URL=http://your-domain.com:8080
```

### Firewall Configuration

```bash
# Allow backend API
sudo ufw allow 3210/tcp

# Allow HTTP actions
sudo ufw allow 3211/tcp

# Allow dashboard (restrict to internal only)
sudo ufw allow from 192.168.1.0/24 to any port 6791
```

### Reverse Proxy Configuration

#### Nginx

```nginx
# Backend API
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:3210;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# HTTP Actions
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3211;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Dashboard
server {
    listen 80;
    server_name dashboard.your-domain.com;

    location / {
        proxy_pass http://localhost:6791;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Traefik

```yaml
services:
  backend:
    image: ghcr.io/get-convex/convex-backend:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.convex-backend.rule=Host(`api.your-domain.com`)"
      - "traefik.http.services.convex-backend.loadbalancer.server.port=3210"

  dashboard:
    image: ghcr.io/get-convex/convex-dashboard:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.convex-dashboard.rule=Host(`dashboard.your-domain.com`)"
      - "traefik.http.services.convex-dashboard.loadbalancer.server.port=6791"
```

---

## Common Docker Issues

### Issue: Container Restarts Continuously

**Cause:** Volume permission issues or missing directories.

**Solution:**

```bash
# Fix permissions
sudo chown -R $USER:$USER ./data

# Or run as specific user
user: "${UID}:${GID}"
```

### Issue: "Permission Denied" on Volume

**Cause:** Container runs as root, host files owned by user.

**Solution:**

```yaml
services:
  backend:
    user: "${UID}:${GID}"
    volumes:
      - ./convex:/app/convex:ro
```

### Issue: Out of Disk Space

**Cause:** Volume growing unbounded.

**Solution:**

```yaml
services:
  backend:
    volumes:
      - data:/convex/data
    # Limit log size
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Best Practices

### 1. Use Named Volumes for Production

```yaml
volumes:
  data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/convex-data
```

### 2. Separate Development and Production

```yaml
# docker-compose.dev.yml
services:
  backend:
    volumes:
      - ./convex:/app/convex:ro
      - data-dev:/convex/data

# docker-compose.prod.yml
services:
  backend:
    volumes:
      - data-prod:/convex/data
```

### 3. Monitor Disk Usage

```bash
# Check volume size
docker system df -v

# Clean up unused volumes
docker volume prune
```

### 4. Regular Backups

```bash
# Automated daily backups
0 2 * * * /path/to/backup.sh
```

---

## Summary

| Question                                 | Key Finding                                                |
| ---------------------------------------- | ---------------------------------------------------------- |
| **Q25: Why /convex:ro fails?**           | Wrong directory or missing - use /app/convex for functions |
| **Q26: Correct way to mount convex/?**   | /app/convex:ro for dev, no mount for prod                  |
| **Q27: Volume persistence effects?**     | Critical for instance secret and data                      |
| **Q28: Run without persistent volumes?** | Yes, but not recommended (ephemeral only)                  |
| **Q29: What ports required?**            | 3210 (API), 3211 (HTTP actions), 6791 (dashboard)          |

---

## References

- [Self-Hosted Convex README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Docker Compose Configuration](https://github.com/get-convex/convex-backend/blob/main/self-hosted/docker/docker-compose.yml)
- [Hosting on Own Infrastructure](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/hosting_on_own_infra.md)

---

**Last Updated:** January 16, 2026
**Research Date:** January 16, 2026
**Convex Backend Version:** Latest (as of research date)
