const { createPublicClient, http } = require('viem');
const { bsc } = require('viem/chains');

const publicClient = createPublicClient({
  chain: bsc,
  transport: http()
});
publicClient.getBlockNumber().then(console.log).catch(console.error);
