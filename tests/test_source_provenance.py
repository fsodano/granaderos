"""Check recipe identity and tamper rejection after the repository relocation."""
from pathlib import Path
import importlib.util
import json
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
TOOL_DIRECTORY = ROOT / 'tools/characters-3d'
sys.path.insert(0, str(TOOL_DIRECTORY))
from source_provenance import (published_source_digests, published_source_reference,
                               published_source_sha256, relocation_records, source_path)


def load_tool(filename):
    spec = importlib.util.spec_from_file_location(filename.replace('-', '_'), TOOL_DIRECTORY / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SourceProvenanceTests(unittest.TestCase):
    def test_all_registered_sources_keep_their_published_identity(self):
        for reference, record in relocation_records().items():
            with self.subTest(reference=reference):
                self.assertEqual(source_path(ROOT, reference), ROOT / record['path'])
                self.assertEqual(published_source_reference(record['path']), reference)
                self.assertEqual(published_source_sha256(ROOT, reference), record['publishedSha256'])
                self.assertEqual(published_source_sha256(ROOT, record['path']), record['publishedSha256'])

    def test_changed_registered_source_is_rejected(self):
        reference, record = next(iter(relocation_records().items()))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / record['path']
            path.parent.mkdir(parents=True)
            path.write_bytes(source_path(ROOT, reference).read_bytes() + b'\n')
            with self.assertRaisesRegex(AssertionError, 'Unrecorded source change'):
                published_source_sha256(directory, reference)

    def test_windows_published_and_current_paths_keep_their_identity(self):
        for reference, record in relocation_records().items():
            for path in (reference, record['path']):
                windows_reference = path.replace('/', '\\')
                with self.subTest(reference=windows_reference):
                    self.assertEqual(source_path(ROOT, windows_reference), ROOT / record['path'])
                    self.assertEqual(published_source_reference(windows_reference), reference)
                    self.assertEqual(published_source_sha256(ROOT, windows_reference), record['publishedSha256'])
                    self.assertEqual(published_source_digests(ROOT, [windows_reference]),
                                     {reference: record['publishedSha256']})

    def test_windows_path_cannot_bypass_changed_source_rejection(self):
        reference, record = next(iter(relocation_records().items()))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / record['path']
            path.parent.mkdir(parents=True)
            path.write_bytes(source_path(ROOT, reference).read_bytes() + b'\n')
            for form in (reference, record['path']):
                with self.subTest(reference=form):
                    with self.assertRaisesRegex(AssertionError, 'Unrecorded source change'):
                        published_source_sha256(directory, form.replace('/', '\\'))

    def test_relocated_recipes_match_actual_published_model_receipts(self):
        manifest = json.loads((ROOT / 'apps/web/public/models/characters/manifest.json').read_bytes())
        apparel = load_tool('build-apparel-surfaces.py').recipe_for(ROOT)[1]
        family = load_tool('build-family-cloth-depth.py').recipe_for(ROOT)[1]
        coarse = load_tool('build-coarse-garment-surfaces.py').recipe_for(ROOT)
        standing = load_tool('build-standing-free-arm-rest.py').recipe(ROOT)
        recipes = {'apparelSurface': apparel, 'familyClothDepth': family,
                   'coarseGarmentSurface': coarse, 'standingFreeArmRest': standing}
        found = set()

        def check(value):
            if isinstance(value, dict):
                for field, recipe in recipes.items():
                    if field in value:
                        self.assertEqual(value[field]['recipe'], recipe)
                        found.add(field)
                for child in value.values():
                    check(child)
            elif isinstance(value, list):
                for child in value:
                    check(child)

        check(manifest)
        self.assertEqual(found, set(recipes))

    def test_approved_pixel_catalog_admits_relocated_installer(self):
        catalog, images = load_tool('apparel_png_replay.py').approved_images(ROOT)
        self.assertEqual(catalog['legacyInstallerSha256'],
                         published_source_sha256(ROOT, 'tools/characters-3d/build-apparel-surfaces.py'))
        self.assertTrue(images)


if __name__ == '__main__':
    unittest.main()
