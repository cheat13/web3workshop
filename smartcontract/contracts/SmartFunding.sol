// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";

contract SmartFunding is Ownable, Pausable, KeeperCompatibleInterface {
    uint256 public fundingStage; // 0 = INACTIVE, 1 = ACTIVE, 2 = SUCCESS, 3 = FAIL
    address public tokenAddress;
    uint256 public goal;
    uint256 public pool;
    uint256 public endTime;
    address upkeepAddress;

    mapping(address => uint256) public investOf;
    mapping(address => uint256) public rewardOf;
    mapping(address => bool) public claimedOf;

    event Invest(address indexed from, uint256 amount);
    event ClaimReward(address indexed from, uint256 amount);
    event Refund(address indexed from, uint256 amount);

    constructor(address _tokenAddress, address _upkeepAddress) {
        tokenAddress = _tokenAddress;
        fundingStage = 0;
        upkeepAddress = _upkeepAddress;
    }

    modifier atStage(uint256 stage) {
        require(fundingStage == stage);
        _;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function initialize(uint256 _goal, uint256 _endTimeInMinutes)
        external
        onlyOwner
    {
        goal = _goal;
        endTime = block.timestamp + (_endTimeInMinutes * 1 minutes);
        fundingStage = 1;
    }

    function invest() external payable atStage(1) whenNotPaused {
        require(msg.value > 0, "Required amount of investment");
        require(investOf[msg.sender] == 0, "Already invested");

        investOf[msg.sender] = msg.value;
        rewardOf[msg.sender] = calculateReward(msg.value);
        pool += msg.value;

        emit Invest(msg.sender, msg.value);
    }

    function claim() external atStage(2) whenNotPaused {
        require(fundingStage == 2, "Funding is not successful");
        require(!claimedOf[msg.sender], "Already claimed");
        require(rewardOf[msg.sender] > 0, "No reward to claim");

        uint256 reward = rewardOf[msg.sender];

        rewardOf[msg.sender] = 0;
        claimedOf[msg.sender] = true;

        IERC20(tokenAddress).transfer(msg.sender, reward);

        emit ClaimReward(msg.sender, reward);
    }

    function refund() external atStage(3) whenNotPaused {
        require(investOf[msg.sender] > 0, "No investment to refund");

        uint256 invertAmount = investOf[msg.sender];
        pool -= invertAmount;

        delete investOf[msg.sender];
        delete rewardOf[msg.sender];
        delete claimedOf[msg.sender];

        payable(msg.sender).transfer(invertAmount);

        emit Refund(msg.sender, invertAmount);
    }

    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        upkeepNeeded = fundingStage == 1 && block.timestamp >= endTime;
        performData = new bytes(0);
    }

    function performUpkeep(bytes calldata) external override {
        require(msg.sender == upkeepAddress, "Upkeep address is not correct");

        fundingStage = pool >= goal ? 2 : 3;
    }

    function calculateReward(uint256 amount) public view returns (uint256) {
        uint256 totalSupply = IERC20(tokenAddress).totalSupply();
        uint256 remaining = goal - pool;
        return
            (totalSupply / goal) * ((amount < remaining) ? amount : remaining);
    }
}
