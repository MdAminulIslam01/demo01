// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

//1.创建一个收款函数
//2.记录投资人并且查看 
//3.在锁定期内，达到目标值，生产商可以提款
//4.在锁定期内，没有达到目标值，投资人在锁定期以后退款

contract FundMe{
    AggregatorV3Interface internal dataFeed;

    constructor(uint256 _lockTime) {
        owner=msg.sender;
        dataFeed = AggregatorV3Interface(0x694AA1769357215DE4FAC081bf1f309aDC325306);
        startTime=block.timestamp;
        lockTime=_lockTime;
    }

    mapping (address=>uint256) public funderToAmounts;

    uint256 constant MINIMUM_VALUE = 10;

    uint256 constant TARGET =100;

    address public owner;

    address erc20Addr;

    bool public getFundSuccess =false;

    uint256 startTime;
    uint256 lockTime;

    function fund() external payable {
        require(convertETHtoUSDT(msg.value) >= MINIMUM_VALUE,"send more eth");
        require(block.timestamp<startTime+lockTime,"windos is closed");
        if (funderToAmounts[msg.sender]==0) {
            funderToAmounts[msg.sender]=msg.value;
        }
        else {
            funderToAmounts[msg.sender]+=msg.value;
        }
    }

    function getChainlinkDataFeedLatestAnswer() public view returns (int256) {
        // prettier-ignore
        (
        /* uint80 roundId */
        ,
        int256 answer,
        /*uint256 startedAt*/
        ,
        /*uint256 updatedAt*/
        ,
        /*uint80 answeredInRound*/
        ) = dataFeed.latestRoundData();
        return answer;
    }
    //转换eth到usdt
    function convertETHtoUSDT(uint256 ethamount)internal view returns (uint256) {
        uint256 ethprice =uint256(getChainlinkDataFeedLatestAnswer());
        return ethamount*ethprice/(10**18 * 10**8);
    }
    //获取资产
    function getFund() external   {
        require(convertETHtoUSDT(address(this).balance)>=TARGET,"target is not reached");
        require(msg.sender == owner,"this function can only be called by owner");
        require(block.timestamp>=startTime+lockTime,"windos is closed");
        (bool success, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(success,"transfer failed");
        funderToAmounts[msg.sender]=0;
        getFundSuccess=true;
    }

    function transferOwnership(address newOwner) public    {
        require(msg.sender == owner,"this function can only be called by owner");
        owner=newOwner;
    }

    function refund() external {
        require(convertETHtoUSDT(address(this).balance)<TARGET,"target is reached");
        require(funderToAmounts[msg.sender]!=0,"there is no fund for you");
        require(block.timestamp>=startTime+lockTime,"windos is closed");
        (bool success, ) = payable(msg.sender).call{value: funderToAmounts[msg.sender]}("");
        require(success,"transfer failed");
        funderToAmounts[msg.sender]=0;
    }

    function setfunderToAmounts(address funder,uint256 amountToUpdate) external {
        require(msg.sender==erc20Addr,"you do not have permission to call function");
        funderToAmounts[funder]=amountToUpdate;
    }
    function setERC20Addr(address _erc20Addr) public {
        require(msg.sender == owner,"this function can only be called by owner");
        erc20Addr=_erc20Addr;
    }
}