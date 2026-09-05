#include "../native/Granaderos/BlackPowder.h"
#include <cassert>
#include <iostream>

int main() {
    using namespace granaderos;
    // Published specification values and loaded/full/partial inventory cases.
    assert(reloadAP(1800, 1, 20, false) == 45);
    assert(reloadAP(1801, 1, 1, false) == 42);
    assert(reloadAP(1802, 1, 1, true) == 105);
    assert(reloadAP(1808, 2, 20, false) == 55);
    assert(reloadAP(1808, 2, 1, false) == 28);
    assert(reloadAP(1808, 1, 2, false) == 28);
    assert(reloadAP(1800, 0, 20, false) == 0);
    assert(reloadAP(1800, 1, 0, false) == 0);
    assert(reloadAP(1799, 1, 20, false) == 0);
    assert(fireAP(1800) == 12 && aimAP(1800) == 6);
    assert(fireAP(1802) == 16 && aimAP(1802) == 10);
    assert(misfirePercent(100, 0, 0) == 2);
    assert(misfirePercent(50, 40, 5) == 37);
    assert(misfirePercent(-20, 200, 100) == 95);
    for (int condition = 0; condition < 100; ++condition)
        assert(misfirePercent(condition, 40, 5) >= misfirePercent(condition + 1, 40, 5));
    for (int rain = 0; rain < 100; ++rain)
        assert(misfirePercent(80, rain, 0) <= misfirePercent(80, rain + 1, 0));
    assert(rangeCeiling(1800, 15) == 85);
    assert(rangeCeiling(1800, 25) == 35);
    assert(rangeCeiling(1800, 36) < 10);
    assert(rangeCeiling(1802, 50) == 85);
    for (int range = 0; range < 100; ++range)
        assert(rangeCeiling(1800, range) >= rangeCeiling(1800, range + 1));
    assert(rangeCeiling(1, 100) == 100); // non-Granaderos weapons unchanged
    std::cout << "Black-powder rules: all assertions passed\n";
}
