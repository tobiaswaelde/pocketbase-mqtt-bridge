# PocketBase MQTT Bridge

[![CI](https://img.shields.io/github/actions/workflow/status/tobiaswaelde/pocketbase-mqtt-bridge/ci.yml?style=for-the-badge&label=CI)](https://github.com/tobiaswaelde/pocketbase-mqtt-bridge/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/github/actions/workflow/status/tobiaswaelde/pocketbase-mqtt-bridge/docs.yml?style=for-the-badge&label=Docs)](https://github.com/tobiaswaelde/pocketbase-mqtt-bridge/actions/workflows/docs.yml)
[![Deploy](https://img.shields.io/github/actions/workflow/status/tobiaswaelde/pocketbase-mqtt-bridge/deploy.yml?style=for-the-badge&label=Deploy)](https://github.com/tobiaswaelde/pocketbase-mqtt-bridge/actions/workflows/deploy.yml)

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-tobiaswaelde-FFDD00?style=for-the-badge&logo=buymeacoffee)](https://www.buymeacoffee.com/tobiaswaelde)

Publish selected PocketBase collections to MQTT as non-retained events, a retained latest record, or retained state per record. Full documentation is published at [tobiaswaelde.github.io/pocketbase-mqtt-bridge](https://tobiaswaelde.github.io/pocketbase-mqtt-bridge/).

## Quick start

```bash
cp .env.example .env
cp config/config.example.yml config/config.yml
docker compose up -d
```

The included Beszel configuration publishes each current `systems` record and its nested `info` JSON values below `home/beszel/systems/records/<record-id>`.

## Documentation

- [Getting started](https://tobiaswaelde.github.io/pocketbase-mqtt-bridge/getting-started)
- [Configuration](https://tobiaswaelde.github.io/pocketbase-mqtt-bridge/configuration)
- [MQTT contract](https://tobiaswaelde.github.io/pocketbase-mqtt-bridge/mqtt)
- [Beszel](https://tobiaswaelde.github.io/pocketbase-mqtt-bridge/beszel)
- [Docker deployment](https://tobiaswaelde.github.io/pocketbase-mqtt-bridge/deployment)
- [Changelog](CHANGELOG.md)
