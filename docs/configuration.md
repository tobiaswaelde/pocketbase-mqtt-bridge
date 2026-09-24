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
POCKETBASE_AUTH_COLLECTION=users
POCKETBASE_USERNAME=bridge@example.net
POCKETBASE_PASSWORD=change-me
```

The bridge signs in through the PocketBase auth collection selected by `POCKETBASE_AUTH_COLLECTION` and renews its session every 30 minutes. It defaults to `users`; use `_superusers` for PocketBase superuser credentials. Prefer a dedicated, read-only user whenever possible. Do not commit `.env`, paste credentials into issue reports, or place them in `config.yml`.

Leave `MQTT_CLIENT_ID` empty to generate a UUID at startup. `HOST`, `PORT`, and `CORS_ORIGIN` configure the HTTP health endpoint.

## Collections

```yaml
collections:
  - collection: audit_log
    topic: home/audit
    publish: events
    payload: record
  - collection: systems
    topic: home/beszel/systems
    publish: records
    payload: both
    publishIds: true
  - collection: measurements
    topic: home/measurements
    publish: latest
    payload: fields
    sort: -created,-id
    groupBy: system
    filter: type = "1m"
```

- `collection` is the PocketBase collection name.
- `topic` is the MQTT base topic and must be unique. MQTT wildcards are rejected.
- `publish` is one of `events`, `latest`, or `records`.
- `payload` is `record`, `fields`, or `both`. It defaults to `record` for backwards compatibility.
- `publishIds` is an optional boolean for `records`. When enabled, a retained JSON array of all record IDs is published to `<topic>/records`.
- `sort` is optional and only valid with `latest`. Its default is `-updated,-id`.
- `groupBy` is optional and only valid with `latest`. It publishes the newest record separately for every distinct value of the named top-level field.
- `filter` is optional and only valid with `latest`. It is passed to PocketBase when selecting the current record or records.

`record` publishes the existing complete JSON payload. `fields` publishes every record field separately, including nested JSON object keys. String fields are published without surrounding quotes. Other scalar values, scalar arrays, and empty containers retain their JSON representation, while arrays containing objects use array indices as topic segments. `both` emits both representations. Field topic path segments are URL-encoded when a source key contains MQTT-reserved characters.

Collections and topics must be unique. Field projections are not supported.
