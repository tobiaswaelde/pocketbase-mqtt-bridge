# Getting started

Copy the tracked examples and then replace every placeholder with your own deployment values:

```bash
cp .env.example .env
cp config/config.example.yml config/config.yml
```

Start the bridge with Docker Compose:

```bash
docker compose up -d
```

The health endpoint is available at `http://localhost:3000/health` by default. It only proves that the bridge process is running; inspect the logs to confirm access to MQTT and PocketBase.

Use `mosquitto_sub -v -t 'home/beszel/#'` to inspect the included Beszel topic tree.
