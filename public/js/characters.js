/* characters.js — Employee roster with DiceBear avatars (character-matched) */

var CHARS = [
  {
    id: 'wasde', name: 'Alice', role: 'WASDE 供需專家', model: 'OPUS', color: '#2e7d32', livePanel: true,
    bio: 'USDA報告解讀專家，數據控',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=AliceWasde&skinColor=f2d3b1&hairColor=6a4e35&backgroundColor=b6e3f4'
  },
  {
    id: 'news', name: 'Nina', role: '新聞分析師', model: 'SONNET', color: '#c62828', livePanel: true,
    bio: '全球新聞即時追蹤，消息靈通',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=NinaReporter&skinColor=f2d3b1&hairColor=ab2a18&backgroundColor=ffd5dc'
  },
  {
    id: 'cot', name: 'Vera', role: 'COT 持倉分析', model: 'SONNET', color: '#6a1b9a', livePanel: true,
    bio: 'CFTC數據解讀，看穿大戶動向',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=VeraCot&skinColor=f2d3b1&hairColor=0e0e0e&backgroundColor=c0aede'
  },
  {
    id: 'fx', name: 'Raj', role: '宏觀/外匯框架', model: 'OPUS', color: '#00838f', livePanel: true,
    bio: '央行政策、匯率、利率的大局觀',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=RajMacro&skinColor=ecad80&hairColor=0e0e0e&backgroundColor=d1d4f9'
  },
  {
    id: 'soft', name: 'Leo', role: '軟商品基本面', model: 'SONNET', color: '#5d4037', livePanel: true,
    bio: '咖啡、糖、棉花的供需專家',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=LeoTrader&skinColor=f2d3b1&hairColor=6a4e35&backgroundColor=ffdfbf'
  },
  {
    id: 'quant', name: 'Max', role: '量化驗證', model: 'OPUS', color: '#1565c0', livePanel: true,
    bio: '用回測和統計挑戰團隊共識',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=MaxQuant&skinColor=f2d3b1&hairColor=6a4e35&glassesProbability=100&backgroundColor=b6e3f4'
  },
  {
    id: 'tech', name: 'Hana', role: '技術分析', model: 'SONNET', color: '#37474f', livePanel: true,
    bio: 'K線、支撐壓力、趨勢判斷',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=HanaTech&skinColor=ecad80&hairColor=0e0e0e&backgroundColor=ffd5dc'
  },
  {
    id: 'energy', name: 'Kai', role: '能源/金屬', model: 'SONNET', color: '#e65100', livePanel: true,
    bio: '原油、天然氣、黃金基本面',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=KaiEnergy&skinColor=f2d3b1&hairColor=0e0e0e&backgroundColor=ffdfbf'
  },
  {
    id: 'dario', name: 'Dario Amodei', role: '機器學習顧問', model: 'SONNET', color: '#1565c0', livePanel: true,
    bio: '把 ML 模型搬進期貨市場的研究狂人',
    avatar: '/img/avatars/Dario.jpg'
  },
  {
    id: 'sam', name: 'Sam Altman', role: '業務開發主任', model: 'SONNET', color: '#212121', livePanel: true,
    bio: '開拓客戶的天才，能把任何策略賣出去',
    avatar: '/img/avatars/sam.jpg'
  },
  {
    id: 'slacker', name: 'Gary', role: '辦公室擺爛王', model: 'SONNET', color: '#8bc34a', livePanel: true,
    bio: '閃避工作的天才，偶爾冒出神洞見',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=GarySlacker&skinColor=f2d3b1&hairColor=796a45&backgroundColor=b6e3f4'
  },
  {
    id: 'luna', name: 'Luna', role: '英語教練', model: 'OPUS', color: '#9c27b0', livePanel: false,
    bio: '幫你練出自然的商務英文',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=LunaStar&skinColor=f2d3b1&hairColor=e5d7a3&backgroundColor=ffd5dc'
  },
  {
    id: 'intern', name: 'Ming', role: '實習生', model: 'SONNET', color: '#f9a825', livePanel: false,
    bio: '菜鳥一枚，但問的問題偶爾很天才',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=MingIntern&skinColor=ecad80&hairColor=0e0e0e&backgroundColor=ffdfbf'
  },
  {
    id: 'conspiracy', name: 'Felix', role: '反向指標專家', model: 'SONNET', color: '#b71c1c', livePanel: false,
    bio: '專找被忽略的異常訊號',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=FelixAnomaly&skinColor=ecad80&hairColor=0e0e0e&backgroundColor=ffd5dc'
  },
  {
    id: 'veteran', name: 'Zhang', role: '活歷史資料庫', model: 'SONNET', color: '#c8a415', livePanel: false,
    bio: '30年實戰經驗，用歷史照亮現在',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=ZhangVeteran&skinColor=ecad80&hairColor=afafaf&featuresProbability=100&features=mustache&backgroundColor=ffdfbf'
  },
  {
    id: 'risk', name: 'Sophie', role: '魔鬼代言人', model: 'SONNET', color: '#1a237e', livePanel: false,
    bio: '找出你策略最可能爆掉的地方',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=SophieRisk&skinColor=f2d3b1&hairColor=562306&backgroundColor=c0aede'
  },
  {
    id: 'dev', name: 'Dev', role: '程式碼產生器', model: 'SONNET', color: '#00695c', livePanel: false,
    bio: '說需求，直接給你可執行的Python',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=DevCoder&skinColor=ecad80&hairColor=0e0e0e&glassesProbability=100&backgroundColor=b6e3f4'
  },
  {
    id: 'poker', name: 'Ace', role: '撲克哲學家', model: 'SONNET', color: '#212121', livePanel: false,
    bio: '用賭桌智慧解讀市場',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=AcePoker&skinColor=f2d3b1&hairColor=0e0e0e&backgroundColor=d1d4f9'
  },
  {
    id: 'claude', name: 'Clawd', role: 'AI 助手', model: 'SONNET', color: '#d97757', livePanel: false,
    bio: '擅長打牌以及賭場遊戲',
    avatar: '/img/avatars/clawd.png', avatarContain: true
  },
];
