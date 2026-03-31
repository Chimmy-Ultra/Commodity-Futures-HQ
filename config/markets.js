const LIVE_MARKETS = {
  wasde: [
    { symbol: 'ZC=F', label: 'Corn', unit: 'c/bu', precision: 2 },
    { symbol: 'ZS=F', label: 'Soybeans', unit: 'c/bu', precision: 2 },
    { symbol: 'ZW=F', label: 'Wheat', unit: 'c/bu', precision: 2 },
  ],
  news: [
    { symbol: 'ZC=F', label: 'Corn', unit: 'c/bu', precision: 2 },
    { symbol: 'ZS=F', label: 'Soybeans', unit: 'c/bu', precision: 2 },
    { symbol: 'CL=F', label: 'WTI', unit: 'USD/bbl', precision: 2 },
    { symbol: 'GC=F', label: 'Gold', unit: 'USD/oz', precision: 2 },
  ],
  cot: [
    { symbol: 'ZC=F', label: 'Corn', unit: 'c/bu', precision: 2 },
    { symbol: 'ZS=F', label: 'Soybeans', unit: 'c/bu', precision: 2 },
    { symbol: 'ZW=F', label: 'Wheat', unit: 'c/bu', precision: 2 },
    { symbol: 'GC=F', label: 'Gold', unit: 'USD/oz', precision: 2 },
  ],
  fx: [
    { symbol: 'JPY=X', label: 'USD/JPY', unit: 'JPY per USD', precision: 3 },
    { symbol: 'GC=F', label: 'Gold', unit: 'USD/oz', precision: 2 },
    { symbol: 'CL=F', label: 'WTI', unit: 'USD/bbl', precision: 2 },
  ],
  soft: [
    { symbol: 'KC=F', label: 'Coffee', unit: 'USd/lb', precision: 2 },
    { symbol: 'SB=F', label: 'Sugar', unit: 'c/lb', precision: 2 },
    { symbol: 'CT=F', label: 'Cotton', unit: 'c/lb', precision: 2 },
  ],
  quant: [
    { symbol: 'ZC=F', label: 'Corn', unit: 'c/bu', precision: 2 },
    { symbol: 'ZS=F', label: 'Soybeans', unit: 'c/bu', precision: 2 },
    { symbol: 'CL=F', label: 'WTI', unit: 'USD/bbl', precision: 2 },
    { symbol: 'GC=F', label: 'Gold', unit: 'USD/oz', precision: 2 },
  ],
  tech: [
    { symbol: 'ZC=F', label: 'Corn', unit: 'c/bu', precision: 2 },
    { symbol: 'ZS=F', label: 'Soybeans', unit: 'c/bu', precision: 2 },
    { symbol: 'CL=F', label: 'WTI', unit: 'USD/bbl', precision: 2 },
    { symbol: 'GC=F', label: 'Gold', unit: 'USD/oz', precision: 2 },
  ],
  energy: [
    { symbol: 'NG=F', label: 'Natural Gas', unit: 'USD/mmBtu', precision: 3 },
    { symbol: 'CL=F', label: 'WTI', unit: 'USD/bbl', precision: 2 },
    { symbol: 'GC=F', label: 'Gold', unit: 'USD/oz', precision: 2 },
    { symbol: 'SI=F', label: 'Silver', unit: 'USD/oz', precision: 3 },
    { symbol: 'PA=F', label: 'Palladium', unit: 'USD/oz', precision: 2 },
  ],
  dario: [
    { symbol: 'ZC=F', label: 'Corn', unit: 'c/bu', precision: 2 },
    { symbol: 'ZS=F', label: 'Soybeans', unit: 'c/bu', precision: 2 },
    { symbol: 'ZW=F', label: 'Wheat', unit: 'c/bu', precision: 2 },
  ],
  sam: [
    { symbol: 'ZC=F', label: 'Corn', unit: 'c/bu', precision: 2 },
    { symbol: 'CL=F', label: 'WTI', unit: 'USD/bbl', precision: 2 },
    { symbol: 'GC=F', label: 'Gold', unit: 'USD/oz', precision: 2 },
  ],
  slacker: [
    { symbol: 'KC=F', label: 'Coffee', unit: 'USd/lb', precision: 2 },
    { symbol: 'CL=F', label: 'WTI', unit: 'USD/bbl', precision: 2 },
  ],
  sidebar: [
    { symbol: 'ZC=F', label: 'Corn', unit: 'c/bu', precision: 2 },
    { symbol: 'ZS=F', label: 'Soybeans', unit: 'c/bu', precision: 2 },
    { symbol: 'ZW=F', label: 'Wheat', unit: 'c/bu', precision: 2 },
    { symbol: 'CL=F', label: 'WTI', unit: 'USD/bbl', precision: 2 },
    { symbol: 'NG=F', label: 'Nat Gas', unit: 'USD/MMBtu', precision: 3 },
    { symbol: 'GC=F', label: 'Gold', unit: 'USD/oz', precision: 2 },
    { symbol: 'SI=F', label: 'Silver', unit: 'USD/oz', precision: 3 },
    { symbol: 'KC=F', label: 'Coffee', unit: 'USd/lb', precision: 2 },
    { symbol: 'SB=F', label: 'Sugar', unit: 'c/lb', precision: 2 },
    { symbol: 'CT=F', label: 'Cotton', unit: 'c/lb', precision: 2 },
    { symbol: 'PA=F', label: 'Palladium', unit: 'USD/oz', precision: 2 },
    { symbol: 'JPY=X', label: 'USD/JPY', unit: 'JPY', precision: 3 },
    { symbol: 'DX-Y.NYB', label: 'DXY', unit: 'index', precision: 2 },
  ],
};

module.exports = { LIVE_MARKETS };
