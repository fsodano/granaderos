#pragma once

// Standalone rules used directly by the JA2 integration, also executable in
// native unit tests without the Windows renderer. All AP values use 100 AP.
namespace granaderos {
constexpr int firstFirearm = 1800;
constexpr int lastFirearm = 1808;
constexpr int smokeItem = 1840;
constexpr int reprimeAP = 15;
constexpr int clamp(int n, int low, int high) { return n < low ? low : n > high ? high : n; }
constexpr bool isFirearm(int item) { return item >= firstFirearm && item <= lastFirearm; }
constexpr int fireAP(int item) {
    constexpr int costs[] = {12, 11, 16, 9, 10, 7, 6, 12, 8};
    return isFirearm(item) ? costs[item - firstFirearm] : 0;
}
constexpr int aimAP(int item) {
    constexpr int costs[] = {6, 5, 10, 4, 4, 3, 2, 5, 3};
    return isFirearm(item) ? costs[item - firstFirearm] : 0;
}
constexpr int reloadAP(int item, int missingRounds, int availableRounds, bool prone) {
    constexpr int costs[] = {45, 42, 70, 38, 35, 32, 28, 40, 55};
    if (!isFirearm(item) || missingRounds <= 0 || availableRounds <= 0) return 0;
    const int capacity = item == 1808 ? 2 : 1;
    const int rounds = clamp(missingRounds < availableRounds ? missingRounds : availableRounds, 0, capacity);
    const int base = (costs[item - firstFirearm] * rounds + capacity - 1) / capacity;
    return prone ? (base * 3 + 1) / 2 : base;
}
// Precipitation is a normalized 0..100 intensity, humidity an additive penalty.
// Tenths of a percent avoid truncating the condition term before adding it.
constexpr int misfirePercent(int condition, int precipitation, int humidity, int base = 2) {
    return clamp((clamp(base, 0, 100) * 10 + (100 - clamp(condition, 0, 100)) * 2
        + clamp(precipitation, 0, 100) * 5 + clamp(humidity, 0, 100) * 10 + 5) / 10, 0, 95);
}
// Ceiling on an otherwise computed shot: skill, wounds, cover and lighting
// still reduce chance below this ballistic limit. Rifled Baker keeps its range.
constexpr int rangeCeiling(int item, int tiles) {
    if (!isFirearm(item)) return 100;
    if (item == 1802) return tiles <= 45 ? 95 : tiles <= 50 ? 85 : clamp(85 - (tiles - 50) * 5, 1, 85);
    if (tiles <= 15) return 85;
    if (tiles <= 25) return 85 - (tiles - 15) * 5;
    if (tiles <= 35) return 35 - (tiles - 25) * 3;
    return clamp(5 - (tiles - 35), 1, 5);
}
}
