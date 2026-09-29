// Starting allocations are authoring data. Mutable amounts belong to operativeState.
export const DEFAULT_CHARACTER_SUPPLIES=Object.freeze({priming:50,flints:4,rations:2,torches:2,medkits:2,boleadoras:1});
export const CHARACTER_SUPPLY_LABELS=Object.freeze({priming:'Cargas de cebo',flints:'Pedernales',rations:'Raciones',torches:'Antorchas',medkits:'Vendas',boleadoras:'Boleadoras'});
export const CHARACTER_SUPPLY_LIMIT=1000;
export function startingCharacterSupplies(character){return {...DEFAULT_CHARACTER_SUPPLIES,...character.startingSupplies};}
export function validStartingSupplies(value){
  const fields=Object.keys(DEFAULT_CHARACTER_SUPPLIES);
  return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k)&&Number.isSafeInteger(value[k])&&value[k]>=0&&value[k]<=CHARACTER_SUPPLY_LIMIT);
}

// Deployment cartridges can move between soldiers without changing authored starting allocations.
export const TRANSFER_SUPPLY_LABELS=Object.freeze({ammo:'Cartuchos',...CHARACTER_SUPPLY_LABELS});

// Presentation only: existing supply keys and quantities remain save-compatible.
export const SUPPLY_PRESENTATION=Object.freeze(Object.fromEntries(Object.entries({
 ammo:'Cartucho de papel con pólvora y una bala de plomo. Es la munición de recarga.',
 priming:'Pólvora de cebado para encender la carga del arma. El número indica dosis, no frascos. El juego lleva esta reserva por separado.',
 flints:'Piedras de sílex que producen la chispa del arma. Se consumen al reparar su mecanismo.',
 rations:'Provisión de tasajo y lino. En el juego recupera fuerzas y detiene la hemorragia.',
 torches:'Antorchas para iluminar el entorno.',
 medkits:'Vendas de tela para atender heridas.',
 boleadoras:'Pesos unidos por tientos de cuero para trabar al objetivo.',
}).map(([key,description])=>[key,Object.freeze({art:`/art/supplies/${key}-v1.webp`,description})])));
