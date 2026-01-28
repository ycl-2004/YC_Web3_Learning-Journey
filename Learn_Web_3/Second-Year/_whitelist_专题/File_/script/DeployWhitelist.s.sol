// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Whitelist.sol";

contract DeployWhitelist is Script {
    function run() external {
        // 從 .env 讀 PRIVATE_KEY（必須是 64 hex、無 0x）
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        Whitelist whitelist = new Whitelist(10);

        vm.stopBroadcast();

        // 讓 forge 明確把地址印出來
        whitelist;
    }
}
