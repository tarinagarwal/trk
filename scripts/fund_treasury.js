const hre = require("hardhat");

async function main() {
    const { ethers } = hre;
    const [deployer] = await ethers.getSigners();
    
    // Addresses
    const USDT_ADDR = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const TREASURY_ADDR = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';

    const usdt = await ethers.getContractAt("MockUSDT", USDT_ADDR);
    
    // Fund Treasury
    const fundAmount = ethers.parseEther("10000"); // 10k USDT
    console.log(`Funding Treasury with 10,000 USDT...`);
    
    await usdt.transfer(TREASURY_ADDR, fundAmount);
    console.log("✅ Treasury Funded!");
    
    const newBal = await usdt.balanceOf(TREASURY_ADDR);
    console.log(`New Treasury Balance: ${ethers.formatEther(newBal)} USDT`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
