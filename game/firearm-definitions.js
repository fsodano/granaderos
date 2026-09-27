// Shared base firearm data; independent of campaign and tactical execution.
export const WEAPONS = Object.fromEntries(
  [
    [1800, "Brown Bess", 58, 12, 6, 45, 18, 1],
    [1801, "Charleville", 52, 11, 5, 42, 22, 1],
    [1802, "Fusil Baker", 64, 16, 10, 70, 45, 1],
    [1803, "Tercerola", 44, 9, 4, 38, 12, 1],
    [1804, "Escopeta Criolla", 48, 10, 4, 35, 10, 1],
    [1805, "Pistola de Arzón", 42, 7, 3, 32, 8, 1],
    [1806, "Pistola de Duelo de Oficial", 38, 6, 2, 28, 12, 1],
    [1807, "Trabuco Naranjero", 75, 12, 5, 40, 6, 1],
    [1808, "Pistola Doble Cañón", 40, 8, 3, 55, 9, 2],
  ].map(([id, name, damage, fireAP, aimAP, reloadAP, range, capacity]) => [
    id,
    { id, name, damage, fireAP, aimAP, reloadAP, range, capacity },
  ]),
);
