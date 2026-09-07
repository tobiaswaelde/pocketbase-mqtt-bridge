---
layout: home

hero:
  name: PocketBase MQTT Bridge
  text: PocketBase collections, retained MQTT state
  tagline: Synchronize selected PocketBase collections to MQTT with events, latest-record views, or full per-record state.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: MQTT contract
      link: /mqtt

features:
  - title: Per-collection modes
    details: Choose events, the latest record, or retained state for every record in a collection.
  - title: Realtime synchronization
    details: PocketBase Realtime subscriptions publish creates, updates, and deletes as they happen.
  - title: Beszel ready
    details: The included example keeps all current Beszel systems available to MQTT consumers.
---

# PocketBase MQTT Bridge

Use one bridge process to publish selected PocketBase collections to one MQTT broker. The bridge has no write access requirement: configure a PocketBase token with only the list and view permissions required by the selected collections.
