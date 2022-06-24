// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SmartFunding {
    enum STAGE {
        INACTIVE,
        ACTIVE,
        SUCESS,
        FAILED
    }
    STAGE public fundingStages;
    address public tokenAddress;
    uint256 public goal;
    uint256 public pool;
    uint256 public endTime;

    mapping(address => uint256) public investOf;
    mapping(address => uint256) public rewardOf;
    mapping(address => bool) public claimedOf;

    event Invest(address indexed from, uint256 amount);
    event ClaimReward(address indexed from, uint256 amount);
    event Refund(address indexed from, uint256 amount);

    constructor(address _tokenAddress) {
        tokenAddress = _tokenAddress;
        fundingStages = STAGE.INACTIVE;
    }

    function initialize(uint256 _goal, uint256 _endTimeInDay) external {
        goal = _goal;
        endTime = block.timestamp + (_endTimeInDay * 1 days);
        fundingStages = STAGE.ACTIVE;
    }

    function invest() external payable {
        require(fundingStages == STAGE.ACTIVE, "Funding is not active");
        require(block.timestamp < endTime, "Time is up");
        require(msg.value > 0, "Required amount of investment");
        require(msg.value <= goal, "Investment is too large");
        require(investOf[msg.sender] == 0, "Already invested");

        pool += msg.value;
        investOf[msg.sender] = msg.value;
        rewardOf[msg.sender] = _getReward();

        emit Invest(msg.sender, msg.value);
    }

    function refund() external {
        require(fundingStages == STAGE.ACTIVE, "Funding is not active");
        require(investOf[msg.sender] > 0, "No investment to refund");

        uint256 invertAmount = investOf[msg.sender];
        pool -= invertAmount;

        delete investOf[msg.sender];
        delete rewardOf[msg.sender];
        delete claimedOf[msg.sender];

        payable(msg.sender).transfer(invertAmount);

        emit Refund(msg.sender, invertAmount);
    }

    function claim() external {
        require(fundingStages == STAGE.SUCESS, "Funding is not successful");
        require(!claimedOf[msg.sender], "Already claimed");
        require(rewardOf[msg.sender] > 0, "No reward to claim");

        uint256 reward = rewardOf[msg.sender];

        rewardOf[msg.sender] = 0;
        claimedOf[msg.sender] = true;

        IERC20(tokenAddress).transfer(msg.sender, reward);

        emit ClaimReward(msg.sender, reward);
    }

    function _getReward() private view returns (uint256) {
        uint256 totalSupply = IERC20(tokenAddress).totalSupply();
        return (totalSupply / goal) * msg.value;
    }
}
