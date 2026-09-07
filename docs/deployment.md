# Docker deployment

`compose.yml` loads connection settings from `.env` and mounts your writable configuration directory at `/app/config`.

```yaml
services:
  pocketbase-mqtt-bridge:
    image: ghcr.io/tobiaswaelde/pocketbase-mqtt-bridge:latest
    env_file: .env
    volumes:
      - ./config:/app/config:ro
    ports:
      - '3000:3000'
```

Pin a versioned image tag in production. The container runs as an unprivileged user and exposes `/health`; remove the port mapping if health checks are performed inside the Docker network.
