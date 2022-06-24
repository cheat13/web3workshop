const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { utils } = ethers;
const { provider } = waffle;

const DECIMAL = 18;
const TOTAL_SUPPLY = utils.parseUnits("1000000", DECIMAL);
const GOAL = utils.parseEther("1");
const END_TIME_IN_DAY = 7;

describe("Deploy smart funding contract", function () {
  let owner;
  let tokenContract;
  let fundingContract;

  beforeEach(async function () {
    owner = await ethers.getSigner();

    const KSNToken = await ethers.getContractFactory("KSNToken");
    tokenContract = await KSNToken.deploy();
    await tokenContract.deployed();

    const SmartFunding = await ethers.getContractFactory("SmartFunding");
    fundingContract = await SmartFunding.deploy(tokenContract.address);
    await fundingContract.deployed();
  });

  it("Should deploy smartfunding", async function () {
    expect(await fundingContract.tokenAddress()).to.equal(tokenContract.address);
    expect(await tokenContract.totalSupply()).to.equal(TOTAL_SUPPLY);
  });

  it("Should transfer from tokenContract to fundingContract", async function () {
    expect(await tokenContract.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY);

    await tokenContract.connect(owner).transfer(fundingContract.address, TOTAL_SUPPLY);

    expect(await tokenContract.balanceOf(owner.address)).to.equal(0);
    expect(await tokenContract.balanceOf(fundingContract.address)).to.equal(TOTAL_SUPPLY);
  });

  it("Should initialize", async function () {
    await fundingContract.initialize(GOAL, END_TIME_IN_DAY);
    expect(await fundingContract.goal()).to.equal(GOAL);
  });
});

describe("SmartFunding operations", function () {
  let owner;
  let invester1;
  let invester2;
  let invester3;
  let tokenContract;
  let fundingContract;

  beforeEach(async function () {
    [owner, invester1, invester2, invester3] = await ethers.getSigners();

    const KSNToken = await ethers.getContractFactory("KSNToken");
    tokenContract = await KSNToken.deploy();
    await tokenContract.deployed();

    // const SmartFunding = await ethers.getContractFactory("SmartFunding");
    const SmartFunding = await smock.mock("SmartFunding");
    fundingContract = await SmartFunding.deploy(tokenContract.address);
    await fundingContract.deployed();

    await tokenContract.connect(owner).transfer(fundingContract.address, TOTAL_SUPPLY);

    await fundingContract.initialize(GOAL, END_TIME_IN_DAY);
  });

  it("Should invest success", async function () {
    const tx1 = await fundingContract.connect(invester1).invest({ value: utils.parseEther("0.1") });
    const tx2 = await fundingContract.connect(invester2).invest({ value: utils.parseEther("0.2") });
    await tx1.wait();
    await tx2.wait();

    expect(await fundingContract.pool()).to.equal(utils.parseEther("0.3"));
    expect(await provider.getBalance(fundingContract.address)).to.equal(utils.parseEther("0.3"));

    expect(await fundingContract.investOf(invester1.address)).to.equal(utils.parseEther("0.1"));
    expect(await fundingContract.investOf(invester2.address)).to.equal(utils.parseEther("0.2"));

    expect(await fundingContract.rewardOf(invester1.address)).to.equal(utils.parseUnits("100000", DECIMAL));
    expect(await fundingContract.rewardOf(invester2.address)).to.equal(utils.parseUnits("200000", DECIMAL));

    // expect(tx1).to.emit(fundingContract, "Invest").withArgs(invester1.address, utils.parseEther("0.1"));
    // expect(tx2).to.emit(fundingContract, "Invest").withArgs(invester2.address, utils.parseEther("0.1"));
  })

  it("Should invest fail", async function () {
    const tx = fundingContract.connect(invester3).invest({ value: utils.parseEther("0") });
    await expect(tx).to.be.revertedWith("Required amount of investment");
  });

  it("Should Claim reward success", async function () {
    const tx1 = await fundingContract.connect(invester1).invest({ value: utils.parseEther("0.9") });
    const tx2 = await fundingContract.connect(invester2).invest({ value: utils.parseEther("0.1") });
    await tx1.wait();
    await tx2.wait();

    await fundingContract.setVariable("fundingStage", 2);
    const txClaim1 = await fundingContract.connect(invester1).claim();
    const txClaim2 = await fundingContract.connect(invester2).claim();
    await txClaim1.wait();
    await txClaim2.wait();

    expect(await fundingContract.rewardOf(invester1.address)).to.equal(0);
    expect(await fundingContract.rewardOf(invester2.address)).to.equal(0);

    expect(await fundingContract.claimedOf(invester1.address)).to.equal(true);
    expect(await fundingContract.claimedOf(invester2.address)).to.equal(true);

    expect(await tokenContract.balanceOf(invester1.address)).to.equal(utils.parseUnits("900000", DECIMAL));
    expect(await tokenContract.balanceOf(invester2.address)).to.equal(utils.parseUnits("100000", DECIMAL));
    expect(await tokenContract.balanceOf(fundingContract.address)).to.equal(0);

    // expect(tx1).to.emit(fundingContract, "ClaimReward").withArgs(invester1.address, utils.parseUnits("900000", DECIMAL));
    // expect(tx1).to.emit(fundingContract, "ClaimReward").withArgs(invester2.address, utils.parseUnits("100000", DECIMAL));

    // expect(tx1).to.emit(tokenContract, "Transfer").withArgs(fundingContract.address, invester1.address, utils.parseUnits("900000", DECIMAL));
    // expect(tx2).to.emit(tokenContract, "Transfer").withArgs(fundingContract.address, invester2.address, utils.parseUnits("100000", DECIMAL));
  });

  it("Should Claim fail with 'No reward to claim'", async function () {
    await fundingContract.setVariable("fundingStage", 2);
    const tx = fundingContract.connect(invester3).claim();
    await expect(tx).to.be.revertedWith("No reward to claim");
  });

  it("Should Claim fail with 'Already claimed'", async function () {
    const tx = await fundingContract.connect(invester3).invest({ value: utils.parseEther("0.9") });
    await tx.wait();

    await fundingContract.setVariable("fundingStage", 2);
    const txClaim = await fundingContract.connect(invester3).claim();
    await txClaim.wait();

    const txClaimAgain = fundingContract.connect(invester3).claim();
    await expect(txClaimAgain).to.be.revertedWith("Already claimed");
  });

  it("Shold Refund success", async function () {
    const txInvest = await fundingContract.connect(invester1).invest({ value: utils.parseEther("0.1") });
    await txInvest.wait();

    await fundingContract.setVariable("fundingStage", 3);
    const txRefund = await fundingContract.connect(invester1).refund();
    await txRefund.wait();

    expect(await fundingContract.pool()).to.equal(0);
    expect(await fundingContract.investOf(invester1.address)).to.equal(0);
    expect(await fundingContract.rewardOf(invester1.address)).to.equal(0);
    expect(await fundingContract.claimedOf(invester1.address)).to.equal(false);
    expect(await provider.getBalance(fundingContract.address)).to.equal(0);
  });

  it("Should Claim fail with 'No investment to refund'", async function () {
    const txInvest = await fundingContract.connect(invester1).invest({ value: utils.parseEther("0.1") });
    await txInvest.wait();

    await fundingContract.setVariable("fundingStage", 3);
    const txRefund = await fundingContract.connect(invester1).refund();
    await txRefund.wait();

    const txRefundAgain = fundingContract.connect(invester3).refund();
    await expect(txRefundAgain).to.be.revertedWith("No investment to refund");
  });
});
