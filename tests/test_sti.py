"""Format contract tests, including an independent upstream engine fixture."""
import struct
import hashlib
import json
import unittest
from pathlib import Path
from tools.sti import encode_rgb565, encode_etrle, decode

ROOT = Path(__file__).resolve().parents[1]

class STCITest(unittest.TestCase):
    def test_rgb_primary_colors_golden_bytes(self):
        encoded = encode_rgb565(3, 1, bytes([255,0,0, 0,255,0, 0,0,255]))
        self.assertEqual(encoded[64:], b'\x00\xf8\xe0\x07\x1f\x00')
        self.assertEqual(encoded[16:24], b'\x04\x00\x00\x00\x01\x00\x03\x00')
        self.assertEqual(decode(encoded), (3, 1, bytes([255,0,0,255, 0,255,0,255, 0,0,255,255])))

    def test_etrle_transparent_runs_split_at_127(self):
        palette = b'\x00\x00\x00\xff\x00\x00' + bytes(762)
        indices = bytes(130) + bytes([1]) * 130
        encoded = encode_etrle(260, 1, indices, palette)
        self.assertEqual(encoded[848:852], bytes([255,131,127,1]))
        w,h,rgba = decode(encoded)
        self.assertEqual((w,h), (260,1))
        self.assertEqual(rgba, bytes(130*4) + bytes([255,0,0,255])*130)

    def test_reject_bad_input_dimensions(self):
        with self.assertRaises(ValueError): encode_rgb565(2,2,b'')
        with self.assertRaises(ValueError): encode_etrle(1,1,b'\x01',b'')
        with self.assertRaises(ValueError): encode_rgb565(0,0,b'')

    def test_reject_truncated_and_oversized_runs(self):
        valid = encode_etrle(2,1,b'\x01\x01',bytes(768))
        with self.assertRaises(ValueError): decode(valid[:-1])
        corrupt = bytearray(valid); corrupt[848] = 127
        with self.assertRaises(ValueError): decode(bytes(corrupt))

    def test_independent_upstream_rgb_fixture_header(self):
        path = ROOT/'engine/gamedir/Data-UB/loadscreens/LS_TUNNELS.STI'
        if not path.exists(): self.skipTest('Recursive upstream gamedir checkout unavailable')
        fixture = path.read_bytes()
        w,h,rgba = decode(fixture)
        self.assertEqual((w,h), (640,480))
        # Byte-for-byte header compatibility with an original engine-loaded asset.
        ours = encode_rgb565(w,h,bytes(w*h*3))
        self.assertEqual(ours[:64], fixture[:64])

    def test_independent_upstream_multiframe_portrait(self):
        path = ROOT/'engine/gamedir/Base/faces/167.STI'
        if not path.exists(): self.skipTest('Recursive upstream gamedir checkout unavailable')
        fixture = path.read_bytes()
        self.assertEqual(decode(fixture)[:2], (48,43))
        for frame in range(8):
            w,h,rgba = decode(fixture,frame)
            self.assertEqual(len(rgba), w*h*4)

    def test_shipped_assets_are_decodable(self):
        paths = list((ROOT/'assets/engine').glob('*.sti'))
        self.assertGreaterEqual(len(paths), 4)
        for path in paths:
            w,h,rgba = decode(path.read_bytes())
            self.assertEqual(len(rgba), w*h*4, path)

    def test_installed_assets_match_recorded_source_and_output(self):
        manifest = json.loads((ROOT/'assets/manifest.json').read_text())
        for asset in manifest['assets']:
            source = (ROOT/asset['source']).read_bytes()
            output = (ROOT/asset['output']).read_bytes()
            self.assertEqual(hashlib.sha256(source).hexdigest(), asset['source_sha256'])
            self.assertEqual(hashlib.sha256(output).hexdigest(), asset['sha256'])
            self.assertEqual((ROOT/asset['installed']).read_bytes(), output)
            self.assertEqual(list(decode(output)[:2]), asset['dimensions'])

if __name__ == '__main__': unittest.main()
