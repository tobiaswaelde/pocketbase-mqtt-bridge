# Beszel

Beszel stores the live data shown in its All Systems overview in the `systems` collection. Its `info` JSON field includes values such as CPU, memory, disk, network, load, and status. The default bridge configuration therefore uses `records` mode so every monitored system has an independent retained MQTT state topic.

```yaml
collections:
  - collection: systems
    topic: home/beszel/systems
    publish: records
```

Subscribe to all current systems:

```bash
mosquitto_sub -h mqtt.example.net -v -t 'home/beszel/systems/records/#'
```

Add `system_details` as a second `records` collection only when static host properties such as hostname, kernel, CPU model, operating system, and total memory are also needed. The PocketBase account used by the bridge must be permitted to list and view both collections.
