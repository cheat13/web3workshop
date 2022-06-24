// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

const UPKEEP_ADDRESS = "0x4Cb093f226983713164A62138C3F718A5b595F73";
const GOAL = ethers.utils.parseEther("1");
const END_TIME_IN_MINUTES = 5;

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const KSNToken = await ethers.getContractFactory("KSNToken");
  const tokenContract = await KSNToken.deploy();
  await tokenContract.deployTransaction.wait(5);
  await tokenContract.deployed();

  const SmartFunding = await ethers.getContractFactory("SmartFunding");
  const fundingContract = await SmartFunding.deploy(tokenContract.address, UPKEEP_ADDRESS);
  await fundingContract.deployTransaction.wait(5);
  await fundingContract.deployed();

  const tx = await fundingContract.initialize(GOAL, END_TIME_IN_MINUTES);
  await tx.wait();

  console.log("KSNToken deployed to:", tokenContract.address);
  console.log("SmartFunding deployed to:", fundingContract.address);

  await hre.run("verify:verify", {
    address: tokenContract.address,
    contract: "contracts/KSNToken.sol:KSNToken",
  });

  await hre.run("verify:verify", {
    address: fundingContract.address,
    constructorArguments: [
      tokenContract.address,
      UPKEEP_ADDRESS,
    ],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
