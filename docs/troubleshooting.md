# Troubleshooting

- Verify broker reachability and credentials from the bridge host.
- Confirm that `POCKETBASE_API_KEY` can list and view every configured collection. Beszel collection access depends on the associated user and system permissions.
- Subscribe to the configured MQTT tree with `mosquitto_sub -v -t '<topic>/#'`.
- Check bridge logs for PocketBase Realtime and MQTT connection errors. Do not include API tokens or passwords in logs or support requests.
- A successful `/health` response means the process is up, not that an external broker or PocketBase instance is reachable.
