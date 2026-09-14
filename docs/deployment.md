# Docker deployment

`compose.yml` loads connection settings from `.env` and mounts the local configuration directory read-only at `/app/config`.

```yaml
services:
  pocketbase-mqtt-bridge:
    build: .
    image: ghcr.io/tobiaswaelde/pocketbase-mqtt-bridge:latest
    env_file: .env
    volumes:
      - ./config:/app/config:ro
    ports:
      - '3000:3000'
```

Use `docker compose up -d --build` to run local source changes. Without `--build`, Compose can use the configured published image.

Pin a versioned image tag in production. The container runs as an unprivileged user and exposes `/health`; remove the port mapping if health checks are performed inside the Docker network.
