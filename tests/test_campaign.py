"""Data contract checks against actual JA2 index relationships; no runtime claim."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('campaign',ROOT/'tools/generate_campaign.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

class CampaignTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();cls.dest=Path(cls.tmp.name)/'TableData';c.generate(cls.dest)
    @classmethod
    def tearDownClass(cls):cls.tmp.cleanup()
    def table(self,name,key='uiIndex'):return c.indexed(ET.parse(self.dest/name).getroot(),key)
    def test_generated_files_are_current(self):
        for p in self.dest.rglob('*.xml'):
            self.assertEqual(p.read_bytes(),(c.DEST/p.relative_to(self.dest)).read_bytes(),str(p))
    def test_preserves_baseline_tables(self):
        for f in ['Items/Items.xml','Items/Weapons.xml','Items/Magazines.xml','MercProfiles.xml']:
            old=c.indexed(c.read(f));new=self.table(f)
            self.assertTrue(old.keys()<=new.keys())
    def test_profile_stats_and_recruitment(self):
        p=self.table('MercProfiles.xml');a=self.table('AIMAvailability.xml')
        self.assertEqual([int(x.findtext('ProfilId')) for x in a.values() if x.findtext('ProfilId')!='255'],list(range(12)))
        for n,name,nick,stats,pay,traits,primary,blade in c.ROSTER:
            self.assertEqual(p[n].findtext('zName'),name)
            self.assertEqual(int(p[n].findtext('bExplosive')),stats[8])
            self.assertEqual(int(p[n].findtext('uiWeeklySalary')),pay)
        self.assertEqual(p[57].findtext('Type'),c.indexed(c.read('MercProfiles.xml'))[57].findtext('Type'))
    def test_ammunition_links_and_capacities(self):
        items=self.table('Items/Items.xml');guns=self.table('Items/Weapons.xml');mags=self.table('Items/Magazines.xml')
        for n,_,_,capacity,damage,_,_,reload,tiles in c.GUNS:
            g=guns[n];cal=g.findtext('ubCalibre')
            self.assertEqual(int(g.findtext('ubImpact')),damage)
            self.assertEqual(int(g.findtext('APsToReload')),reload)
            self.assertEqual(int(g.findtext('usRange')),tiles*10)
            self.assertEqual(int(g.findtext('ubMagSize')),capacity)
            for cap in (capacity,20):
                compatible=[m for m in mags.values() if m.findtext('ubCalibre')==cal and int(m.findtext('ubMagSize'))==cap]
                self.assertTrue(compatible)
                self.assertTrue(any(int(i.findtext('usItemClass'))==1024 and i.findtext('ubClassIndex') in {m.findtext('uiIndex') for m in compatible} for i in items.values()))
    def test_historical_gear_references(self):
        items=self.table('Items/Items.xml');gears=self.table('Inventory/MercStartingGear.xml','mIndex')
        for n,*_ in c.ROSTER:
            kits=gears[n].findall('GEARKIT');self.assertEqual(len(kits),1)
            for k in ['mWeapon','mBig0','mBig1','mBig2']:
                i=int(kits[0].findtext(k));self.assertIn(i,items)
                self.assertEqual(items[i].findtext('NotBuyable'),'0')
    def test_modern_store_inventory_disabled(self):
        for i,x in self.table('Items/Items.xml').items():
            if i<1800 and i not in (201,202,203):
                self.assertEqual(x.findtext('NotBuyable'),'1')
                self.assertEqual(x.findtext('BR_NewInventory'),'0')
    def test_smoke_is_nonlethal(self):
        item=self.table('Items/Items.xml')[1840]
        smoke=self.table('Items/Explosives.xml')[int(item.findtext('ubClassIndex'))]
        for k,v in {'ubType':'6','ubDamage':'0','ubStunDamage':'0','ubDuration':'3','ubRadius':'2'}.items():self.assertEqual(smoke.findtext(k),v)

if __name__=='__main__':unittest.main()
