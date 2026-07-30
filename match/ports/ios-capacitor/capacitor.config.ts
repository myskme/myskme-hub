import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myskme.gemfall',
  appName: '灵石远征',
  webDir: 'www',
  bundledWebRuntime: false,
  ios: {
    backgroundColor: '#0a0a0c',
    preferredContentMode: 'mobile',
  },
};

export default config;
