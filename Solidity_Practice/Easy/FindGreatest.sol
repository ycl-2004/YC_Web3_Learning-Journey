// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MaxNumberContract {

    function findMaxNumber(uint256[] memory numbers) external pure returns (uint256) {
       
       //require(numbers.length > 0);

       uint256 rt = numbers[0];

       for(uint256 i = 1; i < numbers.length; i++){
            if(numbers[i] > rt){
                rt = numbers[i];
            }
       }

       return rt;
    }
}

/*
// 優化版本：使用 unchecked 節省迴圈內的算術
============================================================
           Solidity 陣列尋找最大值 Gas 優化筆記
============================================================

1. 核心優化策略
------------------------------------------------------------
在處理迴圈時，每一行程式碼都會被執行多次，因此微小的優化都會被放大。

■ 優化點 A：緩存陣列長度 (Cache Array Length)
  原版：i < numbers.length
  問題：每一輪迴圈都會去讀取一次 numbers.length（從 Memory 中讀取數據也是要花 Gas 的）。
  解決：先用一個變數存起來。

■ 優化點 B：unchecked 迴圈計數器 (i++)
  在迴圈中，i 不太可能加到溢位 (2^256)，因此使用 `unchecked` 包裹 i++ 
  可以省下每輪的溢位檢查 Gas。

■ 優化點 C：使用 Calldata 替代 Memory (最推薦)
  如果這個函數是給外部調用的 (external)，將參數標記為 `calldata` 而非 `memory`。
  `calldata` 是唯讀的，且不需要把資料拷貝到記憶體，能省下極大的費用。

2. 優化後的程式碼範例
------------------------------------------------------------
pragma solidity ^0.8.20;

contract MaxNumberContract {

    function findMaxNumber(uint256[] calldata numbers) external pure returns (uint256) {
        // 先檢查陣列是否為空，避免讀取 numbers[0] 時出錯
        uint256 len = numbers.length;
        if (len == 0) return 0; 

        uint256 rt = numbers[0];

        // 1. 緩存長度到 len
        // 2. 使用 unchecked 優化計數器
        for (uint256 i = 1; i < len; ) {
            uint256 currentNum = numbers[i];
            if (currentNum > rt) {
                rt = currentNum;
            }
            
            unchecked { i++; }
        }

        return rt;
    }
}

3. Gas 節省對比 (為何這樣做？)
------------------------------------------------------------
| 優化手段         | 節省項目                     | 效果等級 |
|------------------|------------------------------|----------|
| calldata         | 減少數據拷貝費用             | 極高     |
| len cache        | 減少 MLOAD 指令調用          | 中       |
| unchecked {i++}  | 減少溢位檢查指令             | 中       |
| if (len == 0)    | 預防報錯並提前結束交易       | 安全必備 |

4. 進階思維
------------------------------------------------------------
如果這個陣列非常大（例如上萬個數字），在區塊鏈上直接計算最大值可能不是好主意，
因為會遇到「區塊 Gas 上限」問題。這種情況通常建議在「鏈下」計算好，
再把結果傳回鏈上驗證。

============================================================
*/

/*
============================================================
           Yul (Assembly) 陣列遍歷底層邏輯解析
============================================================

1. 基礎背景知識
------------------------------------------------------------
- 在 EVM 中，calldata 的數據是按 32 位元組 (32 bytes) 對齊的。
- numbers.length: 陣列的長度。
- numbers.offset: 陣列第一個元素在 calldata 中的「起始記憶體位址」。

2. 逐行程式碼解釋
------------------------------------------------------------
■ let len := numbers.length
  -> 取得陣列長度，並存入一個 Stack 變數 len 中。

■ if gt(len, 0) { ... }
  -> 使用 gt (Greater Than) 檢查長度是否大於 0。如果是空陣列則跳過。

■ rt := calldataload(numbers.offset)
  -> calldataload(p) 會從位址 p 讀取 32 位元組的數據。
  -> 這裡直接從陣列開頭 (offset) 讀取第一個數字，賦值給回傳值 rt。

■ let end := add(numbers.offset, mul(len, 32))
  -> 計算陣列「結束位址」。
  -> 算法：起始位址 + (長度 * 32 每個元素的位元組數)。這定義了邊界。

■ for { let i := add(numbers.offset, 32) } lt(i, end) { i := add(i, 32) }
  -> 這是彙編中的 for 迴圈結構：
     1. 初始化：i := add(numbers.offset, 32)。因為第一個元素讀過了，
        所以從「起始位址 + 32」開始看第二個元素。
     2. 條件：lt(i, end)。只要目前的位址 i 小於 結束位址 end，就繼續跑。
     3. 步進：i := add(i, 32)。每次移動 32 位元組，跳到下一個數字。

■ let curr := calldataload(i)
  -> 讀取目前位址 i 指向的那個 32 位元組數字，存入 curr。

■ if gt(curr, rt) { rt := curr }
  -> 如果目前的數字大於我們記錄的最大值，就更新 rt。

3. 為什麼這比純 Solidity 快得多？
------------------------------------------------------------
1. 跳過邊界檢查：
   純 Solidity 每次寫 numbers[i]，EVM 都會先執行一段程式碼檢查 i 是否
   超出了 length。Assembly 直接看記憶體位址，不檢查。

2. 減少 JUMP 指令：
   Assembly 的迴圈結構非常精簡，生成的字節碼 (Bytecode) 數量極少。

3. 直接操作指標 (Pointer)：
   不需要透過索引計算 (Index Calculation)，而是直接加法位移。

============================================================
*/// @title A title that should describe the contract/interface
/// @author The name of the author
/// @notice Explain to an end user what this does
/// @dev Explain to a developer any extra details