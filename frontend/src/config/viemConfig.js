import { defineChain } from 'viem';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arcscan Testnet',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
});

export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";