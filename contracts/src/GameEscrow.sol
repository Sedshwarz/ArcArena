// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract GameEscrow is ReentrancyGuard {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    address public immutable serverSigner;
    address public constant TREASURY_ADDRESS = 0x3aE8a149D4aca7d1C4fc85De84Faa509aED4a418;

    struct Game {
        address player1;
        address player2;
        uint256 betAmount;
        bool isResolved;
    }

    mapping(bytes32 => Game) public games;

    error GameAlreadyResolved();
    error GameFull();
    error InvalidBetAmount();
    error InvalidSignature();
    error NotAPlayer();
    error NotTheCreator();
    error OpponentJoined();

    constructor(address _usdcToken, address _serverSigner) {
        usdcToken = IERC20(_usdcToken);
        serverSigner = _serverSigner;
    }

    function lockBet(bytes32 gameId, uint256 amount) external nonReentrant {
        Game storage game = games[gameId];
        
        if (game.isResolved) revert GameAlreadyResolved();

        if (game.player1 == address(0)) {
            game.player1 = msg.sender;
            game.betAmount = amount;
        } else if (game.player2 == address(0)) {
            if (game.betAmount != amount) revert InvalidBetAmount();
            game.player2 = msg.sender;
        } else {
            revert GameFull();
        }

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function claimPrize(bytes32 gameId, address winner, bytes calldata signature) external nonReentrant {
        Game storage game = games[gameId];

        if (game.isResolved) revert GameAlreadyResolved();
        if (game.player1 == address(0) || game.player2 == address(0)) revert GameFull(); 
        if (winner != game.player1 && winner != game.player2) revert NotAPlayer();

        bytes32 messageHash = keccak256(abi.encodePacked(gameId, winner));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        
        if (ethSignedMessageHash.recover(signature) != serverSigner) revert InvalidSignature();

        game.isResolved = true;

        uint256 totalPrize = game.betAmount * 2;
        usdcToken.safeTransfer(winner, totalPrize);
    }

    function reclaimBet(bytes32 gameId) external nonReentrant {
        Game storage game = games[gameId];

        if (game.player1 != msg.sender) revert NotTheCreator();
        if (game.player2 != address(0)) revert OpponentJoined();
        if (game.isResolved) revert GameAlreadyResolved();

        // Mark as resolved to prevent further actions
        game.isResolved = true;

        usdcToken.safeTransfer(game.player1, game.betAmount);
    }

    function leaveGame(bytes32 gameId) external nonReentrant {
        Game storage game = games[gameId];

        if (game.isResolved) revert GameAlreadyResolved();
        if (msg.sender != game.player1 && msg.sender != game.player2) revert NotAPlayer();

        // Mark as resolved
        game.isResolved = true;

        if (game.player2 == address(0)) {
            usdcToken.safeTransfer(game.player1, game.betAmount);
        } else {
            uint256 totalPenalty = (game.betAmount * 5) / 100; // 5% total penalty
            uint256 treasuryShare = totalPenalty / 2;
            uint256 stayerShare = totalPenalty - treasuryShare;
            
            uint256 leaverAmount = game.betAmount - totalPenalty;
            uint256 stayerAmount = game.betAmount + stayerShare;

            address stayer = msg.sender == game.player1 ? game.player2 : game.player1;

            usdcToken.safeTransfer(msg.sender, leaverAmount);
            usdcToken.safeTransfer(stayer, stayerAmount);
            usdcToken.safeTransfer(TREASURY_ADDRESS, treasuryShare);
        }
    }
}