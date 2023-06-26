const { expect } = require("chai");
const BigNumber = require("bignumber.js");
const { ethers, assert } = require("hardhat");
const erc20Token = require("./PrepareERC20");

const LIQUIDATION_PERCENTAGE = 0.25; // Fractional premium
const INIT_EPOCH = 2;
const INIT_MATURITY_DATE = Math.round(Date.now()/1000) + 86400;
const ENTITY_NAME = "UbeSwap";


console.log("help")
let acc0;
let acc1;
let acc2;
let acc3;

describe("PoolContract", async () => {

    // 

    let contract;
    let depositToken;
    let liquidityToken;
    
    
    describe("Constructor", async () => {
        

        context("Happy path", () => {

            it("Should deploy and set global variables", async function() {
                signers = await ethers.getSigners();
                acc0 = signers[0]
                acc1 = signers[1]
                depositToken = await erc20Token();
                liquidityToken = await erc20Token()
                console.log({acc0, acc1})

                contract = await (await (await ethers.getContractFactory("PoolContract")).deploy(
                    
                    (LIQUIDATION_PERCENTAGE * 10000).toString(),
                    depositToken.address,
                    liquidityToken.address
                )).deployed();

                const currencyDeposit = await contract.currencyDeposit()
                const currencyLiquidation = await contract.currencyLiquidation()
                
                const liquidationPercentage = (await contract.liquidationPercentage()).toString()

                // assert(currencyDeposit == depositToken.address, "Deposit Token Mismatch")
                // assert(currencyLiquidation == liquidityToken.address, "Liquidation Token Mismatch")
                // assert(liquidationPercentage == (LIQUIDATION_PERCENTAGE * 10000).toString(), "Liquidation Percentage Mismatch")

                expect(currencyDeposit).to.equal(depositToken.address)
                expect(currencyLiquidation).to.equal(liquidityToken.address)
                expect(liquidationPercentage).to.equal((LIQUIDATION_PERCENTAGE * 10000).toString())

            })

            it("Should set owner on deployment", async function() {

                expect(await contract.owner()).to.be.equal(acc0.address);
            })
        })

    })

    describe("Deposit", function() {
        let previousParticipantDeposit;
        let previousTotalDeposit;
        let previousParticipantTokenBalance;
        let previousContractTokenBalance;
        const depositAmount = 100;
        const amtInWei = ethers.utils.parseEther(depositAmount.toString())

        context("Happy path", function () {
            console.log({acc0, acc1})

            it("Should emit Deposit event", async() => {

                await depositToken.connect(acc1.address).mint(acc0.address, amtInWei)
                await depositToken.connect(acc1.address).approve(contract.address, amtInWei)
                previousParticipantTokenBalance = await depositToken.balanceOf(acc1.address);
                previousContractTokenBalance = await depositToken.balanceOf(contract.address);
                previousParticipantDeposit = await contract.depositUser(acc1.address);
                previousTotalDeposit = await contract.depositTotal();

                const depositTx = contract.connect(acc1.address).deposit(amtInWei);

                await expect(depositTx).to.emit(contract, "Deposit").withArgs(acc1.address, amtInWei);
            })

            it("Should update the seller deposited amount", async () => {

                const finalParticipantDeposit = await contract.depositUser(acc1.address);
                
                expect(+finalParticipantDeposit.toString() - (+previousParticipantDeposit.toString())).to.equal(+amtInWei.toString())

            })

            it("Should update the global total deposit data", async () => {
                const finalTotalDeposit = await contract.depositTotal();

                expect(+finalTotalDeposit.toString() - (+previousTotalDeposit.toString())).to.equal(+amtInWei.toString())

            })

            it("Should reduce token balance of seller by deposit amount and increase balance of contract by same amount", async () => {

                const finalParticipantTokenBalance = await depositToken.balanceOf(acc1.address);
                const finalContractTokenBalance = await depositToken.balanceOf(contract.address);

                expect(+previousParticipantTokenBalance.toString() - (+finalParticipantTokenBalance.toString())).to.equal(+amtInWei.toString())
                expect(+finalContractTokenBalance.toString() - (+previousContractTokenBalance.toString())).to.equal(+amtInWei.toString())

            })
        })
    })


    describe("Withdraw", function () {
        let previousParticipantDeposit;
        let previousTotalDeposit;
        let previousParticipantTokenBalance;
        let previousContractTokenBalance;
        const withdrawAmount = 100;
        const amtInWei = ethers.utils.parseEther(withdrawAmount.toString())

        context("Happy path", function () {

            it("should emit withdraw event", async () => {
                previousParticipantTokenBalance = await depositToken.balanceOf(acc1.address);
                previousContractTokenBalance = await depositToken.balanceOf(contract.address);
                previousParticipantDeposit = await contract.depositUser(acc1.address);
                previousTotalDeposit = await contract.depositTotal();

                const withdrawTx = contract.connect(acc1.address).withdraw(amtInWei);

                await expect(withdrawTx).to.emit(contract, "Withdraw").withArgs(acc1.address, amtInWei);
            })

            it("Should decrease the participant deposited amount", async () => {

                const finalParticipantDeposit = await contract.depositUser(acc1.address);
                
                expect(+previousParticipantDeposit.toString() - (+finalParticipantDeposit.toString())).to.equal(+amtInWei.toString())
            })

            it("Should decrease the global total deposit data", async () => {
                const finalTotalDeposit = await contract.depositTotal();

                expect(+previousTotalDeposit.toString() - (+finalTotalDeposit.toString())).to.equal(+amtInWei.toString())

            })

            it("Should increase token balance of participant by withdraw amount and reduce balance of contract by same amount", async () => {

                const finalParticipantTokenBalance = await depositToken.balanceOf(acc1.address);
                const finalContractTokenBalance = await depositToken.balanceOf(contract.address);

                expect(+finalParticipantTokenBalance.toString() - (+previousParticipantTokenBalance.toString())).to.equal(+amtInWei.toString())
                expect(+previousContractTokenBalance.toString() - (+finalContractTokenBalance.toString())).to.equal(+amtInWei.toString())

            })

        })

        context("Edge cases", () => {

            it("Should not withdraw if amount exceeds participants's available deposit", async () => {
                const depositedAmt = await contract.depositUser(acc1.address);

                const availableDeposit = ethers.utils.formatEther(depositedAmt);
                const withdrawAmtInWei = ethers.utils.parseEther((+availableDeposit + 10).toString())

                const depositTx = contract.connect(acc1.address).withdraw(withdrawAmtInWei);

                await expect(depositTx).to.be.revertedWith("Not enough deposit");

            })
        })
    })

})

