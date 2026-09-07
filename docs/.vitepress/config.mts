import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'PocketBase MQTT Bridge',
  description: 'Publish PocketBase collection state and events to MQTT.',
  base: '/pocketbase-mqtt-bridge/',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'MQTT Contract', link: '/mqtt' },
      { text: 'Deployment', link: '/deployment' },
    ],
    sidebar: [
      { text: 'Overview', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'MQTT Contract', link: '/mqtt' },
      { text: 'Beszel', link: '/beszel' },
      { text: 'Deployment', link: '/deployment' },
      { text: 'Troubleshooting', link: '/troubleshooting' },
    ],
    editLink: {
      pattern: 'https://github.com/tobiaswaelde/pocketbase-mqtt-bridge/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/tobiaswaelde/pocketbase-mqtt-bridge' }],
  },
});
