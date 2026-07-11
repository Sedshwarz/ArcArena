import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arcTestnet } from './viemConfig';

export const config = getDefaultConfig({
  appName: 'ArcArena',
  projectId: "436bee830dba7f77496c0c3d5bcd64ad",
  chains: [arcTestnet],
  ssr: false,
});