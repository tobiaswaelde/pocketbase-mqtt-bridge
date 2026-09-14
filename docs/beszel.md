# Beszel

Beszel stores the live data shown in its All Systems overview in the `systems` collection. Its `info` JSON field includes values such as CPU, memory, disk, network, load, and status. The default bridge configuration therefore uses `records` mode so every monitored system has an independent retained MQTT state topic.

```yaml
collections:
  - collection: systems
    topic: home/beszel/systems
    publish: records
    payload: both
```

This preserves the complete system record while also exposing overview values from the `info` JSON column as retained field topics such as `home/beszel/systems/records/<record-id>/fields/info/cpu/usage`.

Beszel stores the root disk utilization in `info.dp` and all additional disks in the `info.efs` map. With `payload: both`, the bridge publishes them for every system as retained topics:

```text
<topic>/records/<record-id>/fields/info/dp
<topic>/records/<record-id>/fields/info/efs/<disk-name>
```

For example, the extra disk `BACKUP` is available at `<topic>/records/<record-id>/fields/info/efs/BACKUP`. There is no need to publish the `system_stats` history collection for a current per-system disk snapshot.

Subscribe to all current systems and their field values:

```bash
mosquitto_sub -h mqtt.example.net -v -t 'home/beszel/systems/records/#'
```

Add `system_details` as a second `records` collection only when static host properties such as hostname, kernel, CPU model, operating system, and total memory are also needed. The PocketBase account used by the bridge must be permitted to list and view both collections.

The shipped configuration also publishes current details, containers, and the newest one-minute statistics:

```text
home/beszel/system-details/records/<system-id>
home/beszel/system-stats/latest/<system-id>
home/beszel/containers/records/<container-id>
home/beszel/container-stats/latest/<system-id>
```

`system_stats` and `container_stats` are filtered to `type = "1m"` and grouped by `system`. Each new sample replaces the retained snapshot for that system; older time-series records are neither published nor retained.
