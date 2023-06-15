const { ethers, upgrades } = require("hardhat");

// Current Address of the Baki Oracle
const controllerAddress = "0xAcEc0dfda6Ae783d46283bfadF07cafB82e2B42b";

async function main() {
  const upgradedCtl = await ethers.getContractFactory("Controller");

  const ctrl = await upgrades.upgradeProxy(controllerAddress, upgradedCtl);

  console.log("controller upgraded", ctrl.address);
}

main();
