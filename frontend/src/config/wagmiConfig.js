import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arcTestnet } from './viemConfig';

export const config = getDefaultConfig({
  appName: 'ArcArena',
  projectId: process.env.REACT_APP_WC_PROJECT_ID,
  chains: [arcTestnet],
  ssr: false,
});