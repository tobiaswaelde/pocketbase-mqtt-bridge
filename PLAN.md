# PocketBase MQTT Bridge – Initial Implementation

## Summary

Set up a standalone TypeScript/NestJS bridge following the conventions of the existing MQTT bridges, including Docker, a health check, VitePress documentation, CI, and a Changesets-based release flow.

The Beszel example configuration monitors `systems`: its `info` JSON holds the live overview metrics, while `system_details` contains static host data.

## Configuration and MQTT Contract

- Load all connection details and secrets exclusively from `.env`: `MQTT_PROTOCOL`, `MQTT_HOST`, `MQTT_PORT`, `MQTT_CLIENT_ID`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `POCKETBASE_URL`, and `POCKETBASE_API_KEY`. Document them in `.env.example` and ignore the actual `.env` file.
- Define only the monitored collections, their MQTT base topics, and publishing modes in `config/config.yml`:

  ```yaml
  collections:
    - collection: systems
      topic: home/beszel/systems
      publish: records
  ```

- Require `publish` and support these modes:
  - `events`: Publish non-retained JSON to `<topic>/events/{create|update|delete>`.
  - `latest`: Publish retained JSON to `<topic>/latest`, using `-updated,-id` by default and an optional `sort` override.
  - `records`: Publish retained JSON per record to `<topic>/records/<record-id>`.
- In `records` mode, load all existing records at startup. Updates replace the retained state and deletes clear the corresponding retained topic.
- In `latest` mode, publish the newest record at startup. Creates and updates refresh it; deletes trigger a new lookup and clear the topic when the collection is empty.
- For each `latest` collection, any non-retained publish to `<topic>/get` fetches the newest record again and updates `<topic>/latest`. Ignore retained commands.
- Keep state payloads as complete PocketBase records in JSON. Event payloads include `action` and `record`, keeping the contract generic for arbitrary collections.
- Validate unique collections and topics, safe topic segments, allowed modes, and optional sort expressions with Zod. Version 1 deliberately excludes filtering and field projection.

## Runtime Behavior

- Authenticate with PocketBase through `POCKETBASE_API_KEY` as an authorization token and never log it. The configured service account requires at least list and view access to every monitored collection.
- Create a PocketBase Realtime `*` subscription for every configured collection to receive create, update, and delete events.
- Subscribe before retrieving the initial snapshot so that changes are not missed during startup; when data races, prefer the record with the newer `updated` value.
- On reconnect, restore subscriptions and resynchronize stateful modes (`latest` and `records`). `events` intentionally remain at-most-once; interruptions are logged and documented.
- Extend the shared MQTT service with retained publishing and command metadata handling. Close PocketBase and MQTT connections cleanly during shutdown.
- Provide a Nest health endpoint, Compose configuration, and a multi-stage Node Dockerfile matching the sibling bridges.

## Beszel Documentation

- Ship `config.example.yml` with `systems` in `records` mode at `home/beszel/systems`, keeping every monitored Beszel system available as current retained MQTT state.
- Document setup, `.env`, required permissions, every publishing mode, retained semantics, the `get` command, and concrete `mosquitto_sub` and `mosquitto_pub` examples in the README and VitePress site.
- Explain that `systems.info` contains overview data such as CPU, memory, disk, network, load, and status values, and that users can add `system_details` separately for static data.

## Tests and Automation

- Add unit tests for environment and YAML validation, topic creation, sorting, retained deletes, and all three publishing modes.
- Add Realtime tests for create, update, delete, the startup snapshot, `latest` refreshes, reconnect resynchronization, and ignored retained `get` commands.
- Add MQTT service tests for payloads, retained flags, and subscription forwarding.
- Run linting, type checking, tests, application and documentation builds, plus a Docker health-check smoke test in CI.
- Adopt the standardized Dependabot, CodeQL, Pages, Changesets, GitHub Release, and GHCR publishing workflows used by the sibling bridges.

## Assumptions

- The currently empty repository will become a standalone Node 24+/pnpm/NestJS bridge.
- Reuse the existing `main` branch and GHCR naming conventions of the other bridges.
- Use `records` as the Beszel default because it keeps all systems current; configure `latest` and `events` independently for other collections.
