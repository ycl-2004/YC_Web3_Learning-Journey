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

/*
============================================================
           Solidity 權限管理與結構 Gas 優化筆記
============================================================

1. 為什麼 OpenZeppelin 的 Ownable 比較貴？
------------------------------------------------------------
- 繼承開銷：它包含了許多檢查、事件聲明（OwnershipTransferred）和多餘的功能。
- 儲存開銷：它使用了一個位址變數 (address _owner) 儲存在 Storage 中，
  每次讀取或寫入 Storage 都是最昂貴的操作。

1. 核心優化思路
------------------------------------------------------------
■ 使用 immutable：
  將 owner 存在合約代碼中，而非 Storage（節省 2100+ Gas）。
■ 使用 Custom Errors：
  比 require(..., "string") 省下約 50-100 Gas。
■ 使用 bitwise (位元運算) 進行地址比對：
  在 Assembly 中比對地址最快。
■ 使用 external：
  函數不需內部調用時，external 永遠比 public 省錢。

2. 終極省錢代碼範例
------------------------------------------------------------
pragma solidity ^0.8.20;

contract UltraGasSaver {
    // 1. 使用 immutable，部署後不可修改，讀取極快
    address public immutable OWNER;

    // 2. 自定義錯誤，節省部署與執行的字串存儲成本
    error NotOwner();

    constructor() {
        OWNER = msg.sender;
    }

    // 3. 核心權限檢查：使用 Assembly 達到極致速度
    modifier onlyOwner() {
        address _owner = OWNER;
        assembly {
            // caller() 即 msg.sender
            // 如果 caller 不等於 _owner，直接報錯並退回
            if iszero(eq(caller(), _owner)) {
                // 4. 使用自定義錯誤的 Selector 報錯
                mstore(0x00, 0x30f882da) // NotOwner() 的 Hash 前四位
                revert(0x1c, 0x04)       // 只退回 4 bytes 的錯誤代碼
            }
        }
        _;
    }

    // 範例：只有 Owner 能執行的函數
    function restrictedAction() external view onlyOwner {
        // 邏輯內容...
    }
}

3. 為什麼這是「最省」？
------------------------------------------------------------
- 部署時：代碼量極小，沒有冗餘的事件 (Events) 和函數。
- 讀取時：不需要從 Slot 讀取資料，直接從代碼片段 (Constants) 抓取。
- 報錯時：不傳送長長的字串 "Only owner can call this"，只傳送 4 bytes。

============================================================
5. 綜合對比
------------------------------------------------------------
| 方法                 | 部署 Gas | 執行檢查 Gas | 適用場景               |
|--------------------|----------|-------------|----------------------|
| OZ Ownable         | 最高     | 高          | 企業級專案、安全性優先 |
| Immutable + Error  | 中       | 極低        | 不需要轉讓權限的場景   |
| Solady Ownable     | 低       | 低          | 極致 Gas 優化、需轉讓  |

============================================================
*/