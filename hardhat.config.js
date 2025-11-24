require("@nomicfoundation/hardhat-toolbox");


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      url: "https://twilight-restless-layer.ethereum-sepolia.quiknode.pro/5be8a21fab87a65bcfe131773b52ac85ce5d4e0f",
      accounts: ["fe8235155a368f9b5137e405622c58243c3ce329bf67ffa867121d6a0845b70c","1737fd13434fd08f9ef1aa96469e1502921610960a437a1dd25183b8ed310238"]
    }
  },
  // 关键修改：Etherscan V2 格式（去掉网络嵌套，直接填 API Key）
  etherscan: {
    apiKey: "FF3JIM6J96Y6N3FDW7J3WD8CKBXWY7XYZ7" // 直接写你的 Etherscan API Key
  },
  
};