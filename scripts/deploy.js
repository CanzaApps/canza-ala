const { ethers, upgrades } = require("hardhat");

async function main() {
  const Controller = await ethers.getContractFactory("Controller");

  const controller = await upgrades.deployProxy(Controller, [], {
    initializer: "init",
  });

  await controller.deployed();

  await controller.createAuction(
    200,
    5,
    "0x685ef2812d550eeb662890d3ff7614ae0ff2a334",
    "0xf4b95520519894cfbffce3a36532090f292812b5"
  );
  console.log("controller deployed to:", controller.address);
}

main();
