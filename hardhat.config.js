require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("@nomiclabs/hardhat-etherscan");
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.18",
  networks: {
    fuji: {
      url: `https://omniscient-restless-thunder.avalanche-testnet.discover.quiknode.pro/933a2d24cf1a762fd73a569be25bdec21cb60a9f/ext/bc/C/rpc`,
      accounts: [
        `c2932e22e9adc658dcbb64f57b0e6672d25a93595afe06478109039cb96890a1`,
      ],
      chainId: 43113,
    },
  },
};
