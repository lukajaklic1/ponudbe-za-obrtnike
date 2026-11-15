// RAL Classic colours: code → approximate screen colour (hex) and the Slovenian name of the
// colours window suppliers use most. Used to colour the swatch when a supplier types a RAL code.

const HEX: Record<string, string> = {
  // yellow / beige
  '1000': '#cdba88', '1001': '#d0b084', '1002': '#d2aa6d', '1003': '#f9a900', '1004': '#e49e00', '1005': '#cb8f00',
  '1006': '#e19000', '1007': '#e88c00', '1011': '#af8050', '1012': '#ddaf27', '1013': '#e3d9c6', '1014': '#ddc49a',
  '1015': '#e6d2b5', '1016': '#f1dd38', '1017': '#f6a950', '1018': '#faca30', '1019': '#a48f7a', '1020': '#a08f65',
  '1021': '#f6b600', '1023': '#f7b500', '1024': '#ba8f4c', '1026': '#ffff00', '1027': '#a77f0e', '1028': '#ff9b00',
  '1032': '#e2a300', '1033': '#f99a1c', '1034': '#eb9c52', '1035': '#908370', '1036': '#80643f', '1037': '#f09200',
  // orange
  '2000': '#da6e00', '2001': '#ba481b', '2002': '#bf3922', '2003': '#f67828', '2004': '#e25303', '2005': '#ff4d06',
  '2007': '#ffb200', '2008': '#ed6b21', '2009': '#de5307', '2010': '#d05d28', '2011': '#e26e0e', '2012': '#d5654d',
  '2013': '#923e25',
  // red
  '3000': '#a72920', '3001': '#9b2423', '3002': '#9b2321', '3003': '#861a22', '3004': '#6b1c23', '3005': '#59191f',
  '3007': '#3e2022', '3009': '#6d342d', '3011': '#782423', '3012': '#c5856d', '3013': '#972e25', '3014': '#cb7375',
  '3015': '#d8a0a6', '3016': '#a63d30', '3017': '#ca555d', '3018': '#c63f4a', '3020': '#bb1e10', '3022': '#cf6955',
  '3024': '#ff2d21', '3026': '#ff2a1c', '3027': '#ab273c', '3028': '#cc2c24', '3031': '#a63437', '3032': '#701d24',
  '3033': '#a53a2e',
  // violet
  '4001': '#816183', '4002': '#8d3c4b', '4003': '#c4618c', '4004': '#651e38', '4005': '#76689a', '4006': '#903373',
  '4007': '#47243c', '4008': '#844c82', '4009': '#9d8692', '4010': '#bc4077', '4011': '#6e6387', '4012': '#6b6b7f',
  // blue
  '5000': '#314f6f', '5001': '#0f4c64', '5002': '#00387b', '5003': '#1f3855', '5004': '#191e28', '5005': '#005387',
  '5007': '#376b8c', '5008': '#2b3a44', '5009': '#225f78', '5010': '#004f7c', '5011': '#1a2b3c', '5012': '#0089b6',
  '5013': '#193153', '5014': '#637d96', '5015': '#007cb0', '5017': '#005b8c', '5018': '#058b8c', '5019': '#005e83',
  '5020': '#00414b', '5021': '#007577', '5022': '#222d5a', '5023': '#42698c', '5024': '#6093ac', '5025': '#21697c',
  '5026': '#0f3052',
  // green
  '6000': '#3c7460', '6001': '#366735', '6002': '#325928', '6003': '#50533c', '6004': '#024442', '6005': '#114232',
  '6006': '#3c392e', '6007': '#2c3222', '6008': '#37342a', '6009': '#27352a', '6010': '#4d6f39', '6011': '#6b7c59',
  '6012': '#2f3d3a', '6013': '#7c765a', '6014': '#474135', '6015': '#3d3d36', '6016': '#00694c', '6017': '#587f40',
  '6018': '#60993b', '6019': '#b9ceac', '6020': '#37422f', '6021': '#8a9977', '6022': '#3a3327', '6024': '#008351',
  '6025': '#5e6e3b', '6026': '#005f4e', '6027': '#7ebab5', '6028': '#315442', '6029': '#006f3d', '6032': '#237f52',
  '6033': '#45877f', '6034': '#7aadac', '6035': '#194d25', '6036': '#04574b', '6037': '#008b29', '6038': '#00b51a',
  // grey
  '7000': '#7a888e', '7001': '#8c969d', '7002': '#817863', '7003': '#7a7669', '7004': '#9b9b9b', '7005': '#6c6e6b',
  '7006': '#766a5e', '7008': '#745e3d', '7009': '#5d6058', '7010': '#585c56', '7011': '#52595d', '7012': '#575d5e',
  '7013': '#575044', '7015': '#4f5358', '7016': '#383e42', '7021': '#2f3234', '7022': '#4c4a44', '7023': '#808076',
  '7024': '#45494e', '7026': '#374345', '7030': '#928e85', '7031': '#5b686d', '7032': '#b5b0a1', '7033': '#7f8274',
  '7034': '#92886f', '7035': '#c5c7c4', '7036': '#979392', '7037': '#7a7b7a', '7038': '#b0b0a9', '7039': '#6b665e',
  '7040': '#989ea1', '7042': '#8e9291', '7043': '#4f5250', '7044': '#b7b3a8', '7045': '#8d9295', '7046': '#7f868a',
  '7047': '#c8c8c7', '7048': '#817b73',
  // brown
  '8000': '#89693e', '8001': '#9d622b', '8002': '#794d3e', '8003': '#7e4b26', '8004': '#8d4931', '8007': '#70452a',
  '8008': '#724a25', '8011': '#5a3826', '8012': '#66332b', '8014': '#4a3526', '8015': '#5e2f26', '8016': '#4c2b20',
  '8017': '#442f29', '8019': '#3d3635', '8022': '#1a1718', '8023': '#a45729', '8024': '#795038', '8025': '#755847',
  '8028': '#513a2a', '8029': '#7f4031',
  // white / black
  '9001': '#e9e0d2', '9002': '#d7d5cb', '9003': '#ecece7', '9004': '#2b2b2c', '9005': '#0e0e10', '9006': '#a1a1a0',
  '9007': '#878581', '9010': '#f1ece1', '9011': '#27292b', '9016': '#f1f0ea', '9017': '#2a292a', '9018': '#c8cbc4',
  '9022': '#858583', '9023': '#797b7a',
}

/** Slovenian names of the RAL colours most used for windows (others are named by their code). */
const NAME_SL: Record<string, string> = {
  '1013': 'Biserno bela', '1015': 'Svetla slonovina', '3000': 'Ognjeno rdeča', '3003': 'Rubinasto rdeča', '3004': 'Purpurno rdeča',
  '3005': 'Vinsko rdeča', '3009': 'Oksidno rdeča', '3011': 'Rjavo rdeča', '5002': 'Ultramarin modra', '5003': 'Safirno modra',
  '5004': 'Črno modra', '5008': 'Sivo modra', '5010': 'Encijan modra', '5011': 'Jekleno modra', '5014': 'Golobje modra',
  '6005': 'Mahovo zelena', '6009': 'Jelkasto zelena', '6011': 'Rezedino zelena', '6021': 'Bledo zelena',
  '7001': 'Srebrno siva', '7004': 'Signalno siva', '7005': 'Mišje siva', '7011': 'Železno siva', '7012': 'Bazaltno siva',
  '7015': 'Skrilasto siva', '7016': 'Antracit', '7021': 'Črno siva', '7022': 'Umbra siva', '7024': 'Grafitno siva',
  '7030': 'Kamnito siva', '7032': 'Prodnato siva', '7035': 'Svetlo siva', '7036': 'Platinasto siva', '7037': 'Prašno siva',
  '7038': 'Ahatno siva', '7039': 'Kvarčno siva', '7040': 'Okensko siva', '7042': 'Prometno siva A', '7043': 'Prometno siva B',
  '7044': 'Svileno siva', '7047': 'Telesiva', '8003': 'Glinasto rjava', '8011': 'Orehovo rjava', '8014': 'Sepia rjava',
  '8016': 'Mahagonij rjava', '8017': 'Čokoladno rjava', '8019': 'Sivo rjava', '8022': 'Črno rjava', '8028': 'Zemeljsko rjava',
  '9001': 'Kremno bela', '9002': 'Sivo bela', '9003': 'Signalno bela', '9004': 'Signalno črna', '9005': 'Črna',
  '9006': 'Bela aluminijasta', '9007': 'Siva aluminijasta', '9010': 'Čisto bela', '9011': 'Grafitno črna', '9016': 'Prometno bela',
  '9017': 'Prometno črna', '9018': 'Papirus bela',
}

/** A RAL code in free text ("RAL 7016", "ral7016", "7016") → its four digits, when it is a known RAL colour. */
export function ralCode(text: string | null | undefined): string | null {
  const m = /(?:^|\b)(?:ral\s*)?(\d{4})\b/i.exec((text ?? '').trim())
  return m && HEX[m[1]] ? m[1] : null
}
/** Screen colour of a RAL code, or null when unknown. */
export const ralHex = (text: string | null | undefined) => { const c = ralCode(text); return c ? HEX[c] : null }
/** The RAL colour closest to a screen colour (weighted RGB distance), e.g. for a colour picked by hand. */
export function ralNearest(hex: string): { code: string; hex: string } {
  const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
  const [r, g, b] = rgb(hex)
  let best = '9016', bestD = Infinity
  for (const [code, h] of Object.entries(HEX)) {
    const [r2, g2, b2] = rgb(h)
    const rm = (r + r2) / 2
    const d = (2 + rm / 256) * (r - r2) ** 2 + 4 * (g - g2) ** 2 + (2 + (255 - rm) / 256) * (b - b2) ** 2
    if (d < bestD) { bestD = d; best = code }
  }
  return { code: best, hex: HEX[best] }
}
/** Name of a RAL colour: the Slovenian name when known, otherwise "RAL 1234". */
export const ralName = (text: string | null | undefined) => { const c = ralCode(text); return c ? NAME_SL[c] ?? `RAL ${c}` : null }
