// 关键修改：直接引入 hardhat 作为 hre，再从中获取 ethers
const hre = require("hardhat");
const { ethers } = hre; // 从 hre 中解构 ethers（更规范）

async function main() {
    // 1. 部署合约（不变）
    const fundMeFactory = await ethers.getContractFactory("FundMe");
    const fundMe = await fundMeFactory.deploy(120);
    await fundMe.waitForDeployment();
    const contractAddress = fundMe.target;
    console.log(`FundMe合约部署地址：${contractAddress}`);

    const [firstAccount,secondAccount] = await ethers.getSigners();
    // 2. 使用第一个账户进行捐款
    const fenTX = await fundMe.fund({value:ethers.parseEther("0.01")});
    await fenTX.wait();
    //查看余额
    const balance = await ethers.provider.getBalance(contractAddress);
    console.log(`合约余额：${balance} `);
    // 3. 使用第二个账户进行捐款
    const fundMeConnectedSecond = fundMe.connect(secondAccount);
    const fenTX2 = await fundMeConnectedSecond.fund({value:ethers.parseEther("0.01")});
    await fenTX2.wait();
    const balance2 = await ethers.provider.getBalance(contractAddress);
    console.log(`合约余额：${balance2} `);
    
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 部署/验证失败：", error);
        process.exit(1);
    });