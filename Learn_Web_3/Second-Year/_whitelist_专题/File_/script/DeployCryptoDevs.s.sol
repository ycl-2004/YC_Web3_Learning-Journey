// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/CryptoDevs.sol";

contract DeployCryptoDevs is Script {
    function run() external {
        // 從 .env 讀 PRIVATE_KEY（必須是 0x 開頭）
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        // 你已部署完成的 Whitelist 合約地址
        address whitelistAddress = 0x3219661B4C1d64BE2Eb1877E43C613C86301774D;

        vm.startBroadcast(deployerKey);

        CryptoDevs cryptoDevs = new CryptoDevs(whitelistAddress);

        vm.stopBroadcast();

        // 讓 forge 明確印出部署後的地址
        cryptoDevs;
    }
}
