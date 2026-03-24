// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ITRKCore.sol";

contract TRKLuckyDraw is Ownable, ITRKLuckyDraw {
    IERC20 public usdtToken;
    ITRKRegistry public registry;
    ITRKTreasury public treasury;
    address public router;
    address public cashbackEngine;

    uint256 public maxTickets = 10000;
    uint256 public goldenTicketPrice = 10e18;
    uint256 public silverTicketPrice = 1e18;

    uint256[8] public goldenPrizes = [uint256(10000e18), 5000e18, 4000e18, 1000e18, 300e18, 120e18, 40e18, 20e18];
    uint256[8] public silverPrizes = [uint256(1000e18), 500e18, 400e18, 100e18, 30e18, 12e18, 4e18, 2e18];
    uint256[8] public winnerCounts = [uint256(1), 1, 1, 7, 40, 50, 400, 500];

    function setLuckyDrawSettings(
        uint256 _maxTickets,
        uint256 _goldenPrice,
        uint256 _silverPrice
    ) external onlyRouter {
        maxTickets = _maxTickets;
        goldenTicketPrice = _goldenPrice;
        silverTicketPrice = _silverPrice;
    }

    function setPrizes(
        uint256[8] calldata _golden,
        uint256[8] calldata _silver,
        uint256[8] calldata _counts
    ) external onlyRouter {
        goldenPrizes = _golden;
        silverPrizes = _silver;
        winnerCounts = _counts;
    }
    
    // DrawType: 0 = Silver (Default), 1 = Golden
    mapping(uint8 => uint256) private _currentDrawId;
    mapping(uint8 => uint256) private _ticketsSold;
    
    // Maps drawType => drawId => ticket number => user address
    mapping(uint8 => mapping(uint256 => mapping(uint256 => address))) public tickets;
    mapping(uint8 => mapping(address => uint256)) public userTicketCount;
    mapping(uint8 => address[]) public manualWinners;

    event TicketsBought(address indexed user, uint256 count, uint256 drawId, uint8 drawType);
    event DrawExecuted(uint256 indexed drawId, uint8 drawType, address jackpotWinner);

    modifier onlyRouter() {
        require(msg.sender == router || msg.sender == owner(), "Not authorized");
        _;
    }

    modifier onlyRouterOrEngine() {
        require(msg.sender == router || msg.sender == address(registry) || msg.sender == address(treasury) || msg.sender == address(cashbackEngine), "Not authorized");
        _;
    }

    constructor(address _usdtToken, address _registry) Ownable(msg.sender) {
        usdtToken = IERC20(_usdtToken);
        registry = ITRKRegistry(_registry);
        _currentDrawId[0] = 1;
        _currentDrawId[1] = 1;
    }

    function setAddresses(address _router, address _cashbackEngine, address _treasury) external onlyOwner {
        router = _router;
        cashbackEngine = _cashbackEngine;
        treasury = ITRKTreasury(_treasury);
    }

    /* =============================================================
                        TICKET PURCHASES
    ============================================================= */

    function buyTicket(address user, uint256 count, uint8 drawType) external override onlyRouter {
        require(drawType <= 1, "Invalid draw type");
        require(count > 0, "Must buy at least 1 ticket");
        
        uint256 remaining = maxTickets - _ticketsSold[drawType];
        if (remaining == 0) return; // All tickets sold, wait for draw
        
        uint256 actualCount = count > remaining ? remaining : count;
        uint256 price = drawType == 1 ? goldenTicketPrice : silverTicketPrice;
        uint256 totalCost = actualCount * price;
        
        require(usdtToken.transferFrom(user, address(this), totalCost), "USDT transfer failed");
        usdtToken.transfer(address(treasury), totalCost);
        treasury.distributeLuckyDrawFunds(totalCost, drawType);

        for (uint256 i = 0; i < actualCount; i++) {
            tickets[drawType][_currentDrawId[drawType]][_ticketsSold[drawType]] = user;
            _ticketsSold[drawType]++;
        }

        userTicketCount[drawType][user] += actualCount;
        emit TicketsBought(user, actualCount, _currentDrawId[drawType], drawType);

        if (_ticketsSold[drawType] == maxTickets) {
            _executeDraw(drawType);
        }
    }

    function buyTicketVirtual(address user, uint256 count, uint8 drawType) external override onlyRouterOrEngine {
        require(drawType <= 1, "Invalid draw type");
        require(count > 0, "Must buy at least 1 ticket");
        
        uint256 remaining = maxTickets - _ticketsSold[drawType];
        if (remaining == 0) return; // All tickets sold, wait for draw (though unlikely if _executeDraw is working)
        
        uint256 actualCount = count > remaining ? remaining : count;
        uint256 price = drawType == 1 ? goldenTicketPrice : silverTicketPrice;
        uint256 totalCost = actualCount * price;
        
        registry.deductLuckyDrawWallet(user, totalCost);
        treasury.distributeLuckyDrawFunds(totalCost, drawType);

        for (uint256 i = 0; i < actualCount; i++) {
            tickets[drawType][_currentDrawId[drawType]][_ticketsSold[drawType]] = user;
            _ticketsSold[drawType]++;
        }

        userTicketCount[drawType][user] += actualCount;
        emit TicketsBought(user, actualCount, _currentDrawId[drawType], drawType);

        if (_ticketsSold[drawType] == maxTickets) {
            _executeDraw(drawType);
        }
    }

    function _executeDraw(uint8 drawType) private {
        uint256 totalSold = _ticketsSold[drawType];
        if (totalSold == 0) return;

        uint256 drawId = _currentDrawId[drawType];
        uint256 randomSeed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, drawId, drawType)));
        

        uint256 totalWinnersSelected = 0;
        uint256 maxWinners = totalSold < 1000 ? totalSold : 1000;
        uint256 totalPrizePaid = 0;

        for (uint256 tier = 0; tier < 8; tier++) {
            if (totalWinnersSelected >= maxWinners) break;

            uint256 tierCount = winnerCounts[tier];
            if (totalWinnersSelected + tierCount > maxWinners) tierCount = maxWinners - totalWinnersSelected;

            for (uint256 w = 0; w < tierCount; w++) {
                address winnerAddress;
                
                // Top 50 Manual Winners
                if (totalWinnersSelected < 50 && totalWinnersSelected < manualWinners[drawType].length) {
                    winnerAddress = manualWinners[drawType][totalWinnersSelected];
                } 
                
                if (winnerAddress == address(0)) {
                    uint256 winningTicketIndex = uint256(keccak256(abi.encode(randomSeed, totalWinnersSelected))) % totalSold;
                    winnerAddress = tickets[drawType][drawId][winningTicketIndex];
                }

                if (winnerAddress != address(0)) {
                    uint256 prize = drawType == 1 ? goldenPrizes[tier] : silverPrizes[tier];
                    registry.addLuckyDrawIncome(winnerAddress, prize);
                    totalPrizePaid += prize;
                }
                totalWinnersSelected++;
            }
        }

        delete manualWinners[drawType];

        if (address(treasury) != address(0) && totalPrizePaid > 0) {
            uint256 poolBal = treasury.luckyDrawBalance(drawType);
            uint256 toDeduct = totalPrizePaid > poolBal ? poolBal : totalPrizePaid;
            if (toDeduct > 0) treasury.deductLuckyPool(toDeduct, drawType);
        }

        emit DrawExecuted(drawId, drawType, tickets[drawType][drawId][uint256(keccak256(abi.encode(randomSeed, 0))) % totalSold]);

        _currentDrawId[drawType]++;
        _ticketsSold[drawType] = 0;
    }

    function forceExecuteDraw(uint8 drawType) external override {
        require(msg.sender == owner() || msg.sender == router, "Not authorized");
        require(_ticketsSold[drawType] > 0, "No tickets sold yet");
        _executeDraw(drawType);
    }

    function setManualWinners(uint8 drawType, address[] calldata _winners) external override onlyOwner {
        require(drawType <= 1, "Invalid draw type");
        require(_winners.length <= 50, "Max 50 results");
        manualWinners[drawType] = _winners;
    }

    function getManualWinners(uint8 drawType) external view override returns (address[] memory) {
        return manualWinners[drawType];
    }

    function currentDrawId(uint8 drawType) external view override returns (uint256) {
        return _currentDrawId[drawType];
    }

    function ticketsSoldCurrentDraw(uint8 drawType) external view override returns (uint256) {
        return _ticketsSold[drawType];
    }

    function MAX_TICKETS() external view override returns (uint256) {
        return maxTickets;
    }

    // Required by interface for external manual execution if ever needed (fallback)
    function executeLuckyDraw(address[] calldata winners, uint256[] calldata amounts) external override onlyOwner {
        require(winners.length == amounts.length, "Mismatched arrays");
        for(uint i=0; i < winners.length; i++) {
             registry.addBalances(winners[i], amounts[i], 0, 0, 0, false);
             registry.addLuckyDrawIncome(winners[i], amounts[i]);
        }
    }
}