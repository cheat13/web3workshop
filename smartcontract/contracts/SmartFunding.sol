// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SmartFunding {
    address public tokenAddress;
    uint256 public goal;
    uint256 public pool;
    uint256 public endTime;

    mapping(address => uint256) public investOf;
    mapping(address => uint256) public rewardOf;

    event Invest(address indexed from, uint256 amount);

    constructor(address _tokenAddress) {
        tokenAddress = _tokenAddress;
    }

    function initialize(uint256 _goal, uint256 _endTimeInDay) external {
        goal = _goal;
        endTime = block.timestamp + (_endTimeInDay * 1 days);
    }

    function invest() external payable {
        require(block.timestamp < endTime, "Time is up");
        require(msg.value > 0, "Required amount of investment");
        require(msg.value <= goal, "Investment is too large");
        require(investOf[msg.sender] == 0, "Already invested");

        pool += msg.value;
        investOf[msg.sender] = msg.value;
        rewardOf[msg.sender] = getReward();

        emit Invest(msg.sender, msg.value);
    }

    function getReward() internal view returns (uint256) {
        uint256 totalSupply = IERC20(tokenAddress).totalSupply();
        return (totalSupply / goal) * msg.value;
    }
}
