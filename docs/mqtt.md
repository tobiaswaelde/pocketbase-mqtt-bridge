# MQTT contract

Payloads are UTF-8 JSON. State topics are retained so a new MQTT consumer receives the most recently published state immediately. Each collection's `payload` setting selects complete records, field topics, or both.

## Events mode

`events` publishes every PocketBase Realtime action as a non-retained message:

```text
<topic>/events/create
<topic>/events/update
<topic>/events/delete
```

With `payload: record` or `payload: both`, each payload has this shape:

```json
{
  "action": "update",
  "record": { "id": "record-id", "updated": "2026-09-07 10:00:00.000Z" }
}
```

With `payload: fields` or `payload: both`, each field in `record` is published separately below the action and record ID:

```text
<topic>/events/update/<record-id>/fields/<field-path>
```

For example, a `record.info.cpu.usage` value is published to `<topic>/events/update/<record-id>/fields/info/cpu/usage`.

Events are at-most-once across a PocketBase Realtime interruption. Use `latest` or `records` when a consumer needs an eventually resynchronized state view.

## Latest mode

`latest` stores only the first record returned by the configured sort expression:

```text
<topic>/latest
<topic>/get
```

`<topic>/latest` is retained when `payload` includes `record`. When `payload` includes `fields`, retained field values use this shape:

```text
<topic>/latest/fields/<field-path>
```

Publish any non-retained payload to `<topic>/get` to fetch it again:

```bash
mosquitto_pub -h mqtt.example.net -t home/measurements/get -n
mosquitto_sub -h mqtt.example.net -v -t home/measurements/latest
```

Retained `get` messages are ignored to prevent reconnect replays.

## Records mode

`records` retains one complete state record per PocketBase ID when `payload` includes `record`:

```text
<topic>/records/<record-id>
```

When `payload` includes `fields`, each record field has its own retained topic:

```text
<topic>/records/<record-id>/fields/<field-path>
```

Nested JSON objects use nested topic segments. Scalar arrays remain one JSON array at their field topic, so `disks` is published to `fields/disks` with a payload such as `["nvme0n1"]`. Arrays containing objects use array indices as segments, so `interfaces[0].name` is published below `fields/interfaces/0/name`. Updates clear retained field topics that no longer exist; a delete clears both the complete-record and field topics selected by the payload configuration.
