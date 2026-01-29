// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StorageContract {

    uint256 private value;
    // Function to store a new value
    function storeValue(uint256 _newValue) public {
        value = _newValue;
    }

    // Function to read the stored value
    function readValue() public view returns (uint256) {
       return value;
    }
}
