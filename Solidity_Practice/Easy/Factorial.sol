// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FactorialContract {

    function calculateFactorial(uint256 n) public pure returns (uint256) {
        uint256 rt = 1;

        while(n>1){
            rt = rt*n;
            n = n-1;
        }

        return rt;
     
    }
}

/*
============================================================
           Solidity 階乘運算 Gas 優化筆記
============================================================

1. 核心優化手段：unchecked 區塊
------------------------------------------------------------
從 Solidity 0.8.0 版本開始，編譯器預設會對所有算術運算進行「溢位檢查」
(Overflow/Underflow check)。雖然安全，但每一輪迴圈都會多花一點 Gas。

■ 為什麼這裡可以優化？
  在計算階乘時，如果我們確定運算結果不會超過 uint256 的最大值，
  我們可以使用 `unchecked` 關鍵字來關閉檢查，節省 Gas。

2. 優化後的程式碼範例
------------------------------------------------------------
pragma solidity ^0.8.20;

contract FactorialContract {

    function calculateFactorial(uint256 n) public pure returns (uint256) {
        if (n == 0) return 1; // 階乘定義 0! = 1
        
        uint256 rt = 1;

        // 使用 unchecked 節省迴圈內的算術檢查費用
        unchecked {
            while (n > 1) {
                rt *= n;
                n--; // 這裡減少 n 也是算術運算，同樣可省 Gas
            }
        }

        return rt;
    }
}

3. 進階 Gas 優化技巧 (Advanced Tips)
------------------------------------------------------------
除了 unchecked，還有幾點可以微調：

■ 遞減迴圈 vs 遞增迴圈：
  在處理這類運算時，遞減 (n--) 通常比遞增 (i++) 稍微省一點點，
  因為「與零比較」或「與 1 比較」在 EVM 底層通常比較便宜。

■ 記憶體變數 (Memory Variables)：
  目前的 `rt` 是局部變數 (Stack variable)，這已經是非常快且省的了。
  
■ 提前返回 (Early Return)：
  處理邊界情況（如 n=0 或 n=1）時，直接返回 1，不要進入迴圈。

4. 總結
------------------------------------------------------------
- 原版：每一輪迴圈都有額外的隱形程式碼在檢查「rt 會不會爆掉」。
- 優化版：直接執行乘法，省去檢查步驟。
- 注意：使用 unchecked 時，開發者必須確保結果不會溢位（uint256 最大約可存到 57!）。

============================================================
*/