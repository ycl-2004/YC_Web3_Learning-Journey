// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EvenOddContract {
  
    function isEven(uint256 number) external pure returns (bool) {
       return number%2==0;
    }
}
