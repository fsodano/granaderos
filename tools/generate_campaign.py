#!/usr/bin/env python3
"""Generate complete JA2 table overlays from pinned upstream data, never partial patches."""
import argparse
import copy
import hashlib
import json
import re
import struct
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'engine/gamedir/Data-1.13/TableData'
DEST = ROOT / 'mod/Data-Granaderos/TableData'
# HEA AGI DEX STR LEA WIS MRK MEC EXP MED. EXP here is explosives, NOT level.
ROSTER = [
(0,'Martín Miguel de Güemes','Güemes', [82,90,85,78,95,88,81,35,40,30],400,[7,4,19],1803,1813),
(1,'Juana Azurduy','Azurduy',[88,89,86,80,91,82,77,20,45,52],300,[7,11,14],1803,1809),
(2,'Fray Luis Beltrán','Beltrán',[76,65,94,84,72,96,50,99,90,45],200,[8,8,2],1805,1813),
(3,'Juan Bautista Cabral','Cabral',[96,84,80,92,60,70,68,40,25,35],150,[6,15,16],1809,1811),
(4,'Manuel Dorrego','Dorrego',[84,92,88,74,80,78,89,30,35,20],600,[5,4,19],1808,1813),
(5,'Guillermo Brown','Brown',[85,72,80,86,92,90,75,78,85,40],900,[2,2,7],1805,1809),
(6,'Hipólito Bouchard','Bouchard',[86,85,87,85,76,84,78,60,75,30],800,[13,11,17],1807,1810),
(7,'Lorenzo Barcala','Barcala',[85,80,91,79,78,85,84,72,80,35],180,[2,2,8],1801,1811),
(8,'Macacha Güemes','Macacha',[70,88,86,55,89,94,65,45,20,65],250,[20,20,19],1806,1813),
(9,'Facundo Quiroga','Quiroga',[92,87,76,94,86,68,55,30,20,25],350,[11,16,7],1812,1813),
(10,'James Paroissien','Paroissien',[72,70,89,62,65,95,60,68,65,98],550,[9,9,8],1806,1813),
(11,'José María Paz','Paz',[78,82,88,72,82,92,91,65,70,30],450,[3,7,10],1802,1810),
(57,'José de San Martín','San Martín',[88,88,90,84,99,98,92,65,60,50],0,[7,7,18],1808,1809),
]
# id/name/caliber/capacity/damage/ready/aim/reload/range tiles; exact fire AP requires engine support.
GUNS = [
(1800,'Brown Bess modelo India','Bala de plomo .75',1,58,12,6,45,18),
(1801,'Charleville Modèle 1777','Bala de plomo .69',1,52,11,5,42,22),
(1802,'Fusil Baker 1800','Bala con parche .62',1,64,16,10,70,45),
(1803,'Tercerola de Caballería','Bala corta .65',1,44,9,4,38,12),
(1804,'Escopeta Criolla','Perdigón calibre 16',1,48,10,4,35,10),
(1805,'Pistola de Arzón','Bala de plomo .69',1,42,7,3,32,8),
(1806,'Pistola de Duelo','Bala de precisión .50',1,38,6,2,28,12),
(1807,'Trabuco Naranjero','Metralla',1,75,12,5,40,6),
(1808,'Pistola Doble Cañón','Bala de plomo .54',2,40,8,3,55,9),
]
BLADES = [(1809,'Sable Corvo Sanmartiniano',46,12,11),(1810,'Sable de Caroya',42,14,13),(1811,'Bayoneta de Cubo',50,16,5),(1812,'Lanza de Tacuara',56,18,22),(1813,'Facón Gaucho',32,8,6)]

def setv(node, key, value):
    field = node.find(key)
    if field is None: field = ET.SubElement(node, key)
    field.text = str(value)

def indexed(root, key='uiIndex'):
    return {int(x.findtext(key)):x for x in root}

def read(name): return ET.parse(SOURCE/name).getroot()
def write(name, root, dest):
    path=dest/name; path.parent.mkdir(parents=True,exist_ok=True)
    ET.indent(root, space='\t')
    ET.ElementTree(root).write(path,encoding='utf-8',xml_declaration=True)

def encode_edt(text, length):
    """Inverse of Utils/Encrypted File.cpp DecodeString; fixed UTF-16LE record."""
    units=list(struct.unpack('<'+'H'*(len(text.encode('utf-16le'))//2),text.encode('utf-16le')))
    if len(units)>=length: raise ValueError('Biography exceeds engine record size')
    return struct.pack('<'+'H'*length,*([x+1 if x>33 else x for x in units]+[0]*(length-len(units))))

def generate(dest=DEST):
    items=read('Items/Items.xml'); item=indexed(items)
    weapons=read('Items/Weapons.xml'); weapon=indexed(weapons)
    mags=read('Items/Magazines.xml'); ammo=read('Items/AmmoStrings.xml')
    calibers={}; nextcal=max(indexed(ammo))+1; nextmag=max(indexed(mags))+1
    allowed=set(range(1800,1814)) | {201,202,203}
    # Retain all indices for legacy engine/map references; suppress stores and progression.
    for x in items:
        for k,v in {'NotBuyable':1,'BR_NewInventory':0,'BR_UsedInventory':0,'ubCoolness':0}.items():setv(x,k,v)
    def newitem(n,name,template,cls):
        x=copy.deepcopy(item[template]); items.append(x)
        for k,v in {'uiIndex':n,'ubClassIndex':cls,'szItemName':name[:19],'szLongItemName':name,'szBRName':name,'szItemDesc':name+'. Equipo del ejército patriota, Río de la Plata, 1812–1820.','szBRDesc':name+'. Disponible en las maestranzas del ejército.','NotBuyable':0,'BR_NewInventory':5,'BR_UsedInventory':0,'ubCoolness':1,'DefaultAttachment':0,'BloodiedItem':0,'Attachment':0}.items():setv(x,k,v)
        item[n]=x
        return x
    gunammo={}
    for n,name,cal,cap,dmg,ready,aim,reload,rng in GUNS:
        if cal not in calibers:
            calibers[cal]=nextcal; nextcal+=1
            a=ET.SubElement(ammo,'AMMO')
            for k,v in {'uiIndex':calibers[cal],'AmmoCaliber':cal,'BRCaliber':cal,'NWSSCaliber':'blackpowder'}.items():setv(a,k,v)
        x=newitem(n,name,1,n)
        for k,v in {'ubWeight':40 if n<1805 else 13,'ItemSize':7 if n<1805 else 1,'TwoHanded':int(n<1805),'bReliability':-2,'DirtIncreaseFactor':60}.items():setv(x,k,v)
        w=copy.deepcopy(weapon[1]); weapons.append(w)
        for k,v in {'uiIndex':n,'szWeaponName':name,'ubWeaponClass':1 if n>=1805 else 2,'ubWeaponType':1 if n>=1805 else 6,'ubCalibre':calibers[cal],'ubMagSize':cap,'ubImpact':dmg,'ubReadyTime':ready,'ubShotsPer4Turns':16,'usRange':rng*10,'APsToReload':reload,'SwapClips':0,'ubShotsPerBurst':0,'bAutofireShotsPerFiveAP':0,'ubAimLevels':4,'nAccuracy':80 if n==1802 else 20,'sSound':299,'sReloadSound':100}.items():setv(w,k,v)
        # Loaded-capacity magazine needed by DefaultMagazine; 20-round supply packet for inventory.
        for size in sorted({cap,20}):
            m=ET.SubElement(mags,'MAGAZINE')
            for k,v in {'uiIndex':nextmag,'ubCalibre':calibers[cal],'ubMagSize':size,'ubAmmoType':0,'ubMagType':0}.items():setv(m,k,v)
            ni=1900+(n-1800)*2+(1 if size==20 else 0)
            a=newitem(ni,f'{cal} cartuchos de papel ({size})',73,nextmag)
            setv(a,'ubWeight',8 if size==20 else 1); setv(a,'usPrice',size*2)
            allowed.add(ni); nextmag+=1
            if size==20:gunammo[n]=ni
    for n,name,dmg,ap,weight in BLADES:
        x=newitem(n,name,37,n);setv(x,'ubWeight',weight)
        w=copy.deepcopy(weapon[37]);weapons.append(w)
        for k,v in {'uiIndex':n,'szWeaponName':name,'ubImpact':dmg,'ubShotsPer4Turns':round(400/ap,2)}.items():setv(w,k,v)
    for n,name in [(201,'Vendas de Lino'),(202,'Instrumental Quirúrgico'),(203,'Herramientas de Armero')]:
        for k,v in {'szItemName':name[:19],'szLongItemName':name,'szItemDesc':name+' para el ejército patriota.','szBRName':name,'szBRDesc':name,'NotBuyable':0,'BR_NewInventory':5,'ubCoolness':1}.items():setv(item[n],k,v)
    explosives=read('Items/Explosives.xml')
    smokeclass=max(indexed(explosives))+1
    smoke=copy.deepcopy(indexed(explosives)[20]);explosives.append(smoke)
    for k,v in {'uiIndex':smokeclass,'ubRadius':2,'ubDuration':3,'ubStartRadius':1}.items():setv(smoke,k,v)
    x=newitem(1840,'Humo de pólvora negra',151,smokeclass)
    for k,v in {'NotBuyable':1,'BR_NewInventory':0,'NotInEditor':1,'ubCoolness':0}.items():setv(x,k,v)
    write('Items/Explosives.xml',explosives,dest)
    for name,r in [('Items/Items.xml',items),('Items/Weapons.xml',weapons),('Items/Magazines.xml',mags),('Items/AmmoStrings.xml',ammo)]:write(name,r,dest)
    biographies=json.loads((ROOT/'mod/biographies.es.json').read_text(encoding='utf-8'))
    records=bytearray()
    for n in range(255):
        bio,extra=biographies.get(str(n),['',''])
        records.extend(encode_edt(bio,400)+encode_edt(extra,160))
    binary=dest.parent/'BinaryData';binary.mkdir(parents=True,exist_ok=True)
    (binary/'aimbios.edt').write_bytes(records)
    profiles=read('MercProfiles.xml'); prof=indexed(profiles)
    gear=read('Inventory/MercStartingGear.xml'); gears=indexed(gear,'mIndex')
    statkeys=['bLifeMax','bAgility','bDexterity','bStrength','bLeadership','bWisdom','bMarksmanship','bMechanical','bExplosive','bMedical']
    for n,name,nick,stats,pay,traits,primary,blade in ROSTER:
        p=prof[n]
        for k,v in zip(statkeys,stats):setv(p,k,v)
        for k,v in {'zName':name,'zNickname':nick,'bLife':stats[0],'sSalary':round(pay/7),'uiWeeklySalary':pay,'uiBiWeeklySalary':pay*2,'bMedicalDeposit':0,'sMedicalDepositAmount':0,'usOptionalGearCost':0,'bDisability':0,'bSex':int(n in [1,8]),'ubBodyType':3 if n in [1,8] else 0,'bExpLevel':8 if n==57 else 5,'PANTS':'BLUEPANTS','VEST':'BLUEVEST','usBackground':255,'bSexist':0,'bRacist':0,'bHatedNationality':-1}.items():setv(p,k,v)
        for i in range(1,5):setv(p,f'bNewSkillTrait{i}',traits[i-1] if i<=len(traits) else 0)
        for k in ['bBuddy1','bBuddy2','bBuddy3','bBuddy4','bBuddy5','bLearnToLike','bHated1','bHated2','bHated3','bHated4','bHated5','bLearnToHate']:setv(p,k,255)
        g=gears[n]
        for child in list(g):
            if child.tag=='GEARKIT':g.remove(child)
        setv(g,'mName',nick); kit=ET.SubElement(g,'GEARKIT')
        values={'mGearKitName':'Equipo de Campaña','mAbsolutePrice':0,'mWeapon':primary,'mWeaponStatus':100,'mBig0':blade,'mBig0Status':100,'mBig0Quantity':1,'mBig1':gunammo.get(primary,201),'mBig1Status':100,'mBig1Quantity':3 if primary in gunammo else 1,'mBig2':202 if n==10 else 203 if n==2 else 201,'mBig2Status':100,'mBig2Quantity':1}
        for k,v in values.items():setv(kit,k,v)
    write('MercProfiles.xml',profiles,dest);write('Inventory/MercStartingGear.xml',gear,dest)
    availability=read('AIMAvailability.xml')
    for a in availability:
        n=int(a.findtext('uiIndex'));setv(a,'ProfilId',n if n<12 else 255)
        if n<12:setv(a,'description',ROSTER[n][1])
    write('AIMAvailability.xml',availability,dest)
    merc=read('MercAvailability.xml')
    for m in merc:
        setv(m,'StartMercsAvailable',0);setv(m,'NewMercsAvailable',0)
    write('MercAvailability.xml',merc,dest)
    for path in (SOURCE/'Inventory').glob('*Choices*.xml'):
        if path.name=='IMPItemChoices.xml':continue
        r=read('Inventory/'+path.name)
        for row in r:
            if row.find('ubChoices') is None:continue
            guns='GunChoices' in path.name
            choices=[1800,1801,1803,1804] if guns else ([1813] if row.findtext('name') in ['Knives','Knife'] else [])
            setv(row,'ubChoices',len(choices))
            for field in row:
                if field.tag.startswith('bItemNo'):
                    i=int(field.tag[7:])-1;field.text=str(choices[i] if i<len(choices) else 0)
        write('Inventory/'+path.name,r,dest)
    # Full INI prevents omitted upstream keys silently reverting to compiled defaults.
    options=(ROOT/'engine/gamedir/Base/Ja2_Options.INI').read_text(encoding='utf-8-sig')
    for key in ['ASD_ACTIVE','ASD_ASSIGNS_TANKS','ASD_ASSIGNS_JEEPS','ASD_ASSIGNS_ROBOTS','ROBOT_UPGRADEABLE']:
        options=re.sub(r'(?m)^'+key+r'\s*=.*$',key+' = FALSE',options)
    (dest.parent/'Ja2_Options.INI').write_text(options,encoding='utf-8')
    hashes={str(p.relative_to(SOURCE)):hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCE.rglob('*.xml') if (dest/p.relative_to(SOURCE)).exists()}
    manifest={'schema':1,'smoke_item':1840,'smoke_explosive_class':smokeclass,'upstream_commit':'ddb691318eb3dd0cdc6eab42139739b6d498c645','source_sha256':hashes,'profiles':[{'id':r[0],'name':r[1]} for r in ROSTER],'allowed_items':sorted(allowed),'calibers':calibers,'gun_ammunition':gunammo}
    (dest.parent/'campaign-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=DEST)
    generate(parser.parse_args().output)
