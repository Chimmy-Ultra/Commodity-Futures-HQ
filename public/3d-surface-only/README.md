# 3D Surface — standalone

單一 HTML 檔，整個 3D 選擇權權利金曲面塞在裡面：
- inline CSS、inline ES module
- Three.js 從 unpkg CDN 載入（importmap）
- Black-Scholes + Bull Call Spread 範例 (TXO 23,750 / IV 18.5% / 5DTE)

## 用途

1. **直接看效果** — 雙擊或丟到任何靜態主機（raw.githack.com 也行）
2. **搬到 claude.ai 設計新 UI** — 整檔複製貼到 artifact，請 Claude 圍繞這塊 3D 重做 UI
3. **未來移植** — 把 `<script type="module">` 裡的內容拆成 React component（搭配 react-three-fiber）

## 開來看的連結

```
https://raw.githack.com/Chimmy-Ultra/Commodity-Futures-HQ/claude/refactor-options-calculator-WvvVd/public/3d-surface-only/index.html
```

## 給 Claude design 的建議起手 prompt

> 附上單檔 HTML，是一個用 Three.js 畫的選擇權權利金 3D 曲面（Black-Scholes / Bull Call Spread）。
>
> 我要請你幫我以這塊 3D 為中心，用 React + Tailwind + shadcn/ui 重新設計整個交易計算機 UI。
> 目標商品：台指選擇權 (TXO)。
> 視覺風格：深色霓虹（teal / magenta），玻璃感卡片，金融儀表板質感。
>
> 必須功能：
> - 策略選單（Bull Call / Bear Put / Straddle / Iron Condor 等）
> - 即時 ticker（spot / 漲跌 / IV）
> - 到期日選擇（日期膠囊）
> - Spot 與 IV 的拖桿 scrubber
> - 軸切換（x / y / z / color 各自能選不同維度）
> - 點選擇權鏈組合策略
>
> 請先用 artifact 給我設計提案 (mock UI)，跟我確認方向後再寫 code。
> 數學邏輯保留我這份的 Black-Scholes，不要改。
