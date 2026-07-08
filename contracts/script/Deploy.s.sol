// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {GameEscrow} from "../src/GameEscrow.sol";

contract Deploy is Script {
    function run() external {
        address usdcToken = 0x3600000000000000000000000000000000000000;

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address serverSignerAddress = vm.envAddress("SERVER_SIGNER_ADDRESS");

        if (deployerPrivateKey == 0) {
            revert("Hata: .env dosyasinda PRIVATE_KEY eksik veya gecersiz.");
        }
        if (serverSignerAddress == address(0)) {
            revert("Hata: .env dosyasinda SERVER_SIGNER_ADDRESS eksik veya gecersiz.");
        }

        vm.startBroadcast(deployerPrivateKey);

        GameEscrow gameEscrow = new GameEscrow(usdcToken, serverSignerAddress);

        vm.stopBroadcast();

        console.log(unicode"✅ GameEscrow deployed to:", address(gameEscrow));
    }
}