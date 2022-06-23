const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils } = ethers;

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

    const SmartFunding = await ethers.getContractFactory("SmartFunding");
    fundingContract = await SmartFunding.deploy(tokenContract.address);
    await fundingContract.deployed();

    await tokenContract.connect(owner).transfer(fundingContract.address, TOTAL_SUPPLY);

    await fundingContract.initialize(GOAL, END_TIME_IN_DAY);
  });

  it("Should invest success", async function () {
    const tx1 = await fundingContract.connect(invester1).invest({ value: utils.parseEther("0.1") });
    await tx1.wait();
    const tx2 = await fundingContract.connect(invester2).invest({ value: utils.parseEther("0.2") });
    await tx2.wait();

    expect(await fundingContract.pool()).to.equal(utils.parseEther("0.3"));

    expect(await fundingContract.investOf(invester1.address)).to.equal(utils.parseEther("0.1"));
    expect(await fundingContract.investOf(invester2.address)).to.equal(utils.parseEther("0.2"));

    expect(await fundingContract.rewardOf(invester1.address)).to.equal(utils.parseUnits("100000", DECIMAL));
    expect(await fundingContract.rewardOf(invester2.address)).to.equal(utils.parseUnits("200000", DECIMAL));

    // expect(tx1).to.emit(fundingContract, "Invest").withArgs(invester1.address, utils.parseEther("0.1"));
    // expect(tx2).to.emit(fundingContract, "Invest").withArgs(invester2.address, utils.parseEther("0.1"));
  })

  it("Should fail on invest 0", async function () {
    const tx3 = fundingContract.connect(invester3).invest({ value: utils.parseEther("0") });
    await expect(tx3).to.be.revertedWith("Required amount of investment");
  });
});
