# Configuration

Secrets and connection details belong in `.env`; `config/config.yml` describes only the records that should be published.

## Environment

```dotenv
MQTT_PROTOCOL=mqtt
MQTT_HOST=mqtt.example.net
MQTT_PORT=1883
MQTT_CLIENT_ID=pocketbase-mqtt-bridge
MQTT_USERNAME=mqtt-user
MQTT_PASSWORD=change-me
POCKETBASE_URL=https://pocketbase.example.net
POCKETBASE_API_KEY=replace-with-pocketbase-api-token
```

`POCKETBASE_API_KEY` is sent as the PocketBase authorization token. Use a dedicated, read-only account or token with List and View access to every configured collection. Do not commit `.env`, paste it into issue reports, or place credentials in `config.yml`.

Leave `MQTT_CLIENT_ID` empty to generate a UUID at startup. `HOST`, `PORT`, and `CORS_ORIGIN` configure the HTTP health endpoint.

## Collections

```yaml
collections:
  - collection: audit_log
    topic: home/audit
    publish: events
  - collection: systems
    topic: home/beszel/systems
    publish: records
  - collection: measurements
    topic: home/measurements
    publish: latest
    sort: -created,-id
```

- `collection` is the PocketBase collection name.
- `topic` is the MQTT base topic and must be unique. MQTT wildcards are rejected.
- `publish` is one of `events`, `latest`, or `records`.
- `sort` is optional and only valid with `latest`. Its default is `-updated,-id`.

Collections and topics must be unique. Version 1 intentionally does not support PocketBase filters or field projections; every payload remains a complete PocketBase record.
