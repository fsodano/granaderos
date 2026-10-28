"""Regenerate tintable CC0 skin maps. Requires Pillow; does not fetch assets."""
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance

vendor = Path(__file__).resolve().parent / "vendor" / "makehuman"
image = Image.open(vendor / "Aksel_Skin_diffuse.png").convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
gray = ImageEnhance.Contrast(ImageOps.grayscale(image)).enhance(.66)
gray.point([min(255, max(0, int((value - 128) * .78 + 222))) for value in range(256)]).convert("RGB").save(vendor / "skin-detail-neutral.png")
Image.open(vendor / "Aksel_Skin_NRM.png").convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS).save(vendor / "skin-normal-1024.png")
