# Troubleshooting

## No PocketBase records are published

Confirm that `POCKETBASE_USERNAME` and `POCKETBASE_PASSWORD` belong to the collection selected by `POCKETBASE_AUTH_COLLECTION`. Beszel keeps regular `users` and PocketBase `_superusers` credentials separate. The bridge signs in when synchronization starts and renews its session every 30 minutes. Failed initial logins use the normal synchronization retry; failed renewals are retried at the next interval.

Use the PocketBase server root for `POCKETBASE_URL`, for example `https://pocketbase.example.net`. Dashboard URLs ending in `/_/` are normalized automatically.

- Verify broker reachability and credentials from the bridge host.
- Confirm that the PocketBase user can list and view every configured collection. Beszel collection access depends on the associated user and system permissions.
- Subscribe to the configured MQTT tree with `mosquitto_sub -v -t '<topic>/#'`.
- Check bridge logs for PocketBase Realtime and MQTT connection errors. Do not include API tokens or passwords in logs or support requests.
- A successful `/health` response means the process is up, not that an external broker or PocketBase instance is reachable.
