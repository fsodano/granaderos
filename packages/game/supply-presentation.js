// Presentation only: existing supply keys and quantities remain save-compatible.
export const SUPPLY_PRESENTATION=Object.freeze(Object.fromEntries(Object.entries({
 ammo:'Cartucho de papel con pólvora y una bala de plomo. Es la munición de recarga.',
 rations:'Provisión de tasajo para recuperar fuerzas. Las heridas requieren vendas.',
 torches:'Antorchas para iluminar el entorno.',
 medkits:'Vendas de tela para atender heridas.',
 boleadoras:'Pesos unidos por tientos de cuero para trabar al objetivo.',
}).map(([key,description])=>[key,Object.freeze({art:`/art/supplies/${key}-v1.webp`,description})])));
