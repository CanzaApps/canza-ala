const { ethers } = require("hardhat");

async function main() {

    const token = await (await (await ethers.getContractFactory("ERC20Mock")).deploy()).deployed();

    return token
}


module.exports = main