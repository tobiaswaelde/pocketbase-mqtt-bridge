# MQTT contract

Payloads are UTF-8 JSON. State topics are retained so a new MQTT consumer receives the most recently published state immediately.

## Events mode

`events` publishes every PocketBase Realtime action as a non-retained message:

```text
<topic>/events/create
<topic>/events/update
<topic>/events/delete
```

Each payload has this shape:

```json
{
  "action": "update",
  "record": { "id": "record-id", "updated": "2026-09-07 10:00:00.000Z" }
}
```

Events are at-most-once across a PocketBase Realtime interruption. Use `latest` or `records` when a consumer needs an eventually resynchronized state view.

## Latest mode

`latest` stores only the first record returned by the configured sort expression:

```text
<topic>/latest
<topic>/get
```

`<topic>/latest` is retained. Publish any non-retained payload to `<topic>/get` to fetch it again:

```bash
mosquitto_pub -h mqtt.example.net -t home/measurements/get -n
mosquitto_sub -h mqtt.example.net -v -t home/measurements/latest
```

Retained `get` messages are ignored to prevent reconnect replays.

## Records mode

`records` retains one complete state record per PocketBase ID:

```text
<topic>/records/<record-id>
```

The bridge loads every record at startup and after a Realtime reconnect. A delete clears the corresponding retained topic with an empty retained payload.
