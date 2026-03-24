const { ethers } = require("ethers");
const RPC_URL = "https://bsc-dataseed.binance.org/";
const USDT_ADDR = "0x55d398326f99059fF775485246999027B3197955";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abi = ["function balanceOf(address) view returns (uint256)"];
    const usdt = new ethers.Contract(USDT_ADDR, abi, provider);

    const check = async (name, addr) => {
        const bal = await usdt.balanceOf(addr);
        console.log(`${name} (${addr}): ${ethers.formatUnits(bal, 18)} USDT`);
    };

    console.log("Checking balances for last 5 commits...\n");

    console.log("Commit 5 (134b451) architecture...");
    await check("C5 Registry  ", "0x61741A41D1424A5792E8B9f9c65a6c028F32670E");
    await check("C5 Cashback  ", "0x7f782742b0856fD738188ecba21b98a4e9F992Ac");
    await check("C5 GameEngine", "0xDD0f0791B052879315Ab5F7E788191CE81DCFc85");
    await check("C5 Treasury  ", "0x1217d39589Ae44E9f5Bb3c545380f19588f56F75");
    await check("C5 LuckyDraw ", "0x4E8326424Ca49e02E0cB8AE84aeD4b82F13B4494");
    await check("C5 Router    ", "0xA9BCE2470f81a74d3113ECf6A6de3d678202E38F");

    console.log("\nCommit 4 (3dcc200) architecture...");
    await check("C4 Registry  ", "0xD4C93B9530a26f0D57f9B8b3F4fE184B9184b589");
    await check("C4 Cashback  ", "0x8c7CCd6992D43B0Aa73e98B21bE826E6c696B9f0");
    await check("C4 GameEngine", "0x79acA7eD3Ae6EF9f8e28D01676F6821E4f0D9Aec");
    await check("C4 Treasury  ", "0xAE84DF31FbB4d0F7995282dEB37C565eA3877aBe");
    await check("C4 LuckyDraw ", "0xd4AbdCF9d1E3a8018427BBbcBbF808512a63B895");
    await check("C4 Router    ", "0x8644973d3274C222F88017ec991c615c7E48ae47");

    console.log("\nCommit 3 (81ca61d) architecture...");
    await check("C3 Registry  ", "0x8CFEc57CC87Ff9B91E02B0Ed284fe41c2Ba48b3c");
    await check("C3 Cashback  ", "0xbd0eecb67ca654e82DAbDB1a586249DE90177fff");
    await check("C3 GameEngine", "0x7245F470f05aE1Be9103183116d03C8f9029C696");
    await check("C3 Treasury  ", "0x438C50F54Da417fAe18a0D2150379F195D27F1bb");
    await check("C3 LuckyDraw ", "0x0a6aa1D608b2d2bA7885737b7ce9B0D1a32750CB");
    await check("C3 Router    ", "0xFD9c404A50F28451e6089C90C14e1932Ea0194c9");

    console.log("\nCommit 2 (022489d) architecture...");
    await check("C2 Registry  ", "0x64565b4085aEeaEA4C2Ae744a4e7B6086Cf0B991");
    await check("C2 Cashback  ", "0x41Beef964F4e38028Cd3edb7B7cb43E10AaD21c6");
    await check("C2 GameEngine", "0x6Cf151A3A5ECf3D914f418533a92efed64050303");
    await check("C2 Treasury  ", "0x860333F3673bd81D9B58Fa65AcF944a3D34647a6");
    await check("C2 LuckyDraw ", "0xa7A5377c8E427aAC178eBbe6d622e45B085926F4");
    await check("C2 Router    ", "0xEd64541c0b0273D01Fc80e1Be0D258A3fFF3255c");

    console.log("\nCommit 1 (Active) architecture...");
    await check("Active Registry  ", "0x63C8FAC7554883E7653b2A10d87356Fa7f92Db7e");
    await check("Active Cashback  ", "0x0A587662F830D5193712d83C5CB18A29F254eDD0");
    await check("Active GameEngine", "0x5ed5c07CBe411B7edB0a5934aAE4175621E05833");
    await check("Active Treasury  ", "0x5AF9Da8Dc9D2B215D6C7Bf181219e7eDa33d3091");
    await check("Active LuckyDraw ", "0xed3C844a4e150C5C16d4bffFcEFabdc0Ce3b32F4");
    await check("Active Router    ", "0x0f65c1E389D5D6dbe7836121cCBeE7781D40d213");

}

main();
