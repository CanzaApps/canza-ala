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
let acc4;

describe("PoolContract", async () => {

    // 

    let contract;
    let depositToken;
    let liquidityToken;
    
    
    describe("Constructor", async () => {
        

        context("Happy path", () => {

            it("Should deploy and set global variables", async function() {

                [acc0, acc1, acc2, acc3, acc4] = await ethers.getSigners();
                
                depositToken = await erc20Token();
                liquidityToken = await erc20Token()

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

            it("Should emit Deposit event", async() => {

                await depositToken.connect(acc1).mint(acc1.address, amtInWei)
                await depositToken.connect(acc1).approve(contract.address, amtInWei)
                previousParticipantTokenBalance = await depositToken.balanceOf(acc1.address);
                previousContractTokenBalance = await depositToken.balanceOf(contract.address);
                previousParticipantDeposit = await contract.depositUser(acc1.address);
                previousTotalDeposit = await contract.depositTotal();

                const depositTx = contract.connect(acc1).deposit(amtInWei);

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
        const withdrawAmount = 5;
        const amtInWei = ethers.utils.parseEther(withdrawAmount.toString())

        context("Happy path", function () {

            it("should emit withdraw event", async () => {
                previousParticipantTokenBalance = await depositToken.balanceOf(acc1.address);
                previousContractTokenBalance = await depositToken.balanceOf(contract.address);
                previousParticipantDeposit = await contract.depositUser(acc1.address);
                previousTotalDeposit = await contract.depositTotal();

                const withdrawTx = contract.connect(acc1).withdraw(amtInWei);

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

                const depositTx = contract.connect(acc1).withdraw(withdrawAmtInWei);

                await expect(depositTx).to.be.revertedWith("Not enough deposit");

            })
        })
    })

    describe("release deposits", function () {
        let contractOwner;
        let previousParticipantDeposit;
        let previousTotalDeposit;
        let previousOwnerTokenBalance;
        let previousContractTokenBalance;
        let liquidationAmount = 70;
        const amtInWei = ethers.utils.parseEther(liquidationAmount.toString())

        context("Happy path", function() {

            it("Should trnsfer liquidation amount of deposit tokens from contract to owner", async () => {
                contractOwner = await contract.owner();
                previousOwnerTokenBalance = await depositToken.balanceOf(contractOwner);
                previousContractTokenBalance = await depositToken.balanceOf(contract.address);

                await contract.releaseDeposits(amtInWei);
                const finalOwnerTokenBalance = await depositToken.balanceOf(contractOwner);
                const finalContractTokenBalance = await depositToken.balanceOf(contract.address);

                expect(+finalOwnerTokenBalance.toString() - (+previousOwnerTokenBalance.toString())).to.equal(+amtInWei.toString())
                expect(+previousContractTokenBalance.toString() - (+finalContractTokenBalance.toString())).to.equal(+amtInWei.toString())

            })

            it("Should only release less than or equal to the total deposits", async () => {

                const totalDeposit = await contract.depositTotal();

                const totalDepositNoDecimals = ethers.utils.formatEther(totalDeposit);

                liquidationAmount = liquidationAmount > +totalDepositNoDecimals ? liquidationAmount : liquidationAmount + (+totalDepositNoDecimals);

                const liquidationWei = ethers.utils.parseEther(liquidationAmount.toString())

                const releaseTx = contract.releaseDeposits(liquidationWei);

                await expect(releaseTx).to.emit(depositToken, "Transfer").withArgs(contract.address, contractOwner, totalDeposit);
                expect((await contract.depositTotal()).toString()).to.equal('0');

            })
        })

        context("Edge cases", function () {
            it("Should revert if called by non owner", async() => {

                contractOwner = await contract.owner();

                const releaseTx = contract.connect(acc1).releaseDeposits(amtInWei);

                expect(acc1.address).to.not.equal(contractOwner);
                await expect(releaseTx).to.be.revertedWith("Ownable: caller is not the owner");
            })
        })
    })

    describe("Calculate payout", function() {

        context("Happy path", function() {

            it("Should calculate and return the expected payout based on the liquidity percentage", async () => {

                const amountToLiquidate = 100;

                const expectedPayout = 100 * (1 + LIQUIDATION_PERCENTAGE);

                const calculatedPayout = await contract.calculatePayout(ethers.utils.parseEther(amountToLiquidate.toString()));

                const calculatedPayoutNoDecimals = ethers.utils.formatEther(calculatedPayout);

                expect(+calculatedPayoutNoDecimals).to.equal(expectedPayout);
            })
        })
    })

    describe("Pay collateral", function() {
        let previousTotalClaimable;
        let previousTotalLiquidations;

        const liquidationAmount = 60;
        const expectedPayout = liquidationAmount * (1 + LIQUIDATION_PERCENTAGE);

        context("Happy path", function() {

            it("Should prorate collateral payment to each participant available", async () => {
                console.log(await contract.depositTotal())
                const deposit1 = 105;
                const deposit2 = 120;
                const deposit3 = 75;
                const totalDeposits = deposit1 + deposit2 + deposit3;

                const firstParticipantDeposit = ethers.utils.parseEther(deposit1.toString());
                const secondParticipantDeposit = ethers.utils.parseEther(deposit2.toString());
                const thirdParticipantDeposit = ethers.utils.parseEther(deposit3.toString());

                await depositToken.connect(acc4).mint(acc4.address, firstParticipantDeposit)
                await depositToken.connect(acc4).approve(contract.address, firstParticipantDeposit)
                await depositToken.connect(acc2).mint(acc2.address, secondParticipantDeposit)
                await depositToken.connect(acc2).approve(contract.address, secondParticipantDeposit)
                await depositToken.connect(acc3).mint(acc3.address, thirdParticipantDeposit)
                await depositToken.connect(acc3).approve(contract.address, thirdParticipantDeposit)

                await contract.connect(acc4).deposit(firstParticipantDeposit);
                await contract.connect(acc2).deposit(secondParticipantDeposit);
                await contract.connect(acc3).deposit(thirdParticipantDeposit);

                previousTotalClaimable = ethers.utils.formatEther(await contract.claimableTotal());
                // previousTotalLiquidations = ethers.utils.formatEther(await contract.liquidationsTotal());

                const userAccounts = [acc4, acc2, acc3]
                
                let previousClaimableUserAmounts = []
                let previousUserDeposits = []

                for (const acc of userAccounts) {
                    // console.log(acc)
                    previousClaimableUserAmounts.push(ethers.utils.formatEther(await contract.claimableUser(acc.address)));
                    previousUserDeposits.push(ethers.utils.formatEther(await contract.depositUser(acc.address)))
                }

                console.log(previousUserDeposits)

                // await liquidityToken.mint(contract.address, ethers.utils.parseEther(liquidationAmount.toString()));
                const expectedPayouts = [deposit1, deposit2, deposit3].map(dep =>((dep * expectedPayout)/totalDeposits))
                const expectedCollaterals = [deposit1, deposit2, deposit3].map(dep =>((dep * liquidationAmount)/totalDeposits))
                console.log(expectedPayouts)

                await contract.payCollateral(ethers.utils.parseEther(liquidationAmount.toString()));
                console.log("After pay")
                let finalClaimableUserAmounts = []
                let finalUserDeposits = []

                for (const acc of userAccounts) {
                    finalClaimableUserAmounts.push(ethers.utils.formatEther(await contract.claimableUser(acc.address)));
                    finalUserDeposits.push(ethers.utils.formatEther(await contract.depositUser(acc.address)))
                }
            
                console.log(finalUserDeposits)

                userAccounts.forEach((acc, index) => {
                    let userDepositChange = +finalUserDeposits[index] - (+previousUserDeposits[index]);
                    let userClaimableChange = +finalClaimableUserAmounts[index] - (+previousClaimableUserAmounts[index]);
                    let expectedUserPayout = expectedPayouts[index];
                    let expectedUserCollateral = expectedCollaterals[index];
                    expect(userDepositChange).to.equal(0 - expectedUserCollateral);
                    expect(userClaimableChange).to.equal(expectedUserPayout);
                })

            })

            it("Should update liquidations and claimables state", async () => {

                finalTotalClaimable = ethers.utils.formatEther(await contract.claimableTotal());
                // finalTotalLiquidations = ethers.utils.formatEther(await contract.liquidationsTotal());

                expect(+finalTotalClaimable - (+previousTotalClaimable)).to.equal(expectedPayout);
                // expect(+finalTotalLiquidations - (+previousTotalLiquidations)).to.equal(expectedPayout);
            })
        })

    })

})

