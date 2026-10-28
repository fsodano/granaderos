"""Regenerate tintable CC0 skin maps. Requires Pillow; does not fetch assets."""
from pathlib import Path
import math
from PIL import Image, ImageOps

vendor = Path(__file__).resolve().parent / "vendor" / "makehuman"

def save_if_changed(image, path):
    # Pillow versions can encode identical pixels to different PNG bytes.
    # Keep a verified existing file when its decoded content is unchanged.
    if path.exists():
        with Image.open(path) as existing:
            if existing.mode == image.mode and existing.size == image.size and existing.tobytes() == image.tobytes():
                return
    image.save(path)

image = Image.open(vendor / "Aksel_Skin_diffuse.png").convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
gray = ImageOps.grayscale(image)
# The previous contrast/offset recipe clipped most skin pixels to white. Keep
# the source's actual pore, eyelid, lip and hand detail with a soft highlight
# shoulder. The map remains neutral so all runtime skin palettes can tint it.
def neutral_value(value):
    linear = value * .70 + 109.6
    if linear > 230:
        linear = 230 + 24 * (1 - math.exp(-(linear - 230) / 24))
    return round(linear)

save_if_changed(gray.point([neutral_value(value) for value in range(256)]).convert("RGB"), vendor / "skin-detail-neutral.png")
save_if_changed(Image.open(vendor / "Aksel_Skin_NRM.png").convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS), vendor / "skin-normal-1024.png")
