// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OwnerContract {
   
    address public owner;

    constructor() {
        // 將部署合約的人存為 owner
        owner = msg.sender;
    }

    // 修正後的函數
    function getOwner() external view returns (address) {
        return owner; // 使用 return 回傳變數
    }
}

//----------------------------最專業--------------------
//-----------------------------------------------------
/*
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 1. 導入庫
import "@openzeppelin/contracts/access/Ownable.sol";

// 2. 必須加上 "is Ownable" 進行繼承
contract OwnerContract is Ownable {
   
    // 3. 初始化時將部署者傳給父合約 Ownable
    constructor() Ownable(msg.sender) {
        
    }

    // 雖然 Ownable 已經內建 owner() 函數，
    // 但如果你想自定義名稱，可以這樣寫：
    function getOwner() external view returns (address) {
        return owner(); // 呼叫父合約的 owner() 函數
    }
}

*/

//----------------------------END----------------------
//-----------------------------------------------------
// Method 2 
/*
pragma solidity ^0.8.20;

contract OwnerContract {
  
    function getOwner() external view returns (address) {
        return msg.sender;// 使用 return 回傳變數
    }
}
*/// @title A title that should describe the contract/interface
/// @author The name of the author
/// @notice Explain to an end user what this does
/// @dev Explain to a developer any extra details
