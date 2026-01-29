// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StringComparisonContract {
 
    function compareStrings(string memory str1, string memory str2) external pure returns (bool) {
       // 步驟：
        // 1. 使用 abi.encodePacked 將 string 轉為 bytes
        // 2. 使用 keccak256 計算哈希值
        // 3. 比對兩個 bytes32 的哈希結果
        return keccak256(abi.encodePacked(str1)) == keccak256(abi.encodePacked(str2));

    }
}

/*
function compareStringsEfficient(string memory str1, string memory str2) external pure returns (bool) {
    // 如果長度不等，內容一定不等，直接回傳 false
    if (bytes(str1).length != bytes(str2).length) {
        return false;
    }
    // 長度相等時才進行昂貴的哈希比對
    return keccak256(abi.encodePacked(str1)) == keccak256(abi.encodePacked(str2));
}
*/// @title A title that should describe the contract/interface
/// @author The name of the author
/// @notice Explain to an end user what this does
/// @dev Explain to a developer any extra details