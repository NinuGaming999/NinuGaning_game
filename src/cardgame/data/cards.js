export const RARITIES=['common','rare','epic','legendary','mythic'];
export const RARITY_INFO={
 common:{label:'Common',color:'#9aa5b1',pullChance:.50},rare:{label:'Rare',color:'#4fb0ff',pullChance:.30},
 epic:{label:'Epic',color:'#b06bff',pullChance:.13},legendary:{label:'Legendary',color:'#ffb84f',pullChance:.05},mythic:{label:'Mythic',color:'#ff4f8b',pullChance:.02}
};
export const ELEMENTS=['pyro','hydro','cryo','electro','anemo','geo','dendro'];
export const ELEMENT_INFO={
 pyro:{label:'Pyro',color:'#ff5e3a'},hydro:{label:'Hydro',color:'#3ab4ff'},cryo:{label:'Cryo',color:'#8fe8ff'},
 electro:{label:'Electro',color:'#b06bff'},anemo:{label:'Anemo',color:'#5df2c0'},geo:{label:'Geo',color:'#ffcb4f'},dendro:{label:'Dendro',color:'#8fd94f'}
};
const names={
 pyro:[['ember-pup','Ember Pup','Scorch',[4,3,3]],['cinder-fox','Cinder Fox','Flash Step',[6,4,5]],['magma-brute','Magma Brute','Eruption',[9,8,2]],['aurora-phoenix','Aurora Phoenix','Rebirth',[9,5,9]],['infernal-sovereign','Infernal Sovereign','Ashfall Crown',[11,9,8]]],
 hydro:[['tide-minnow','Tide Minnow','Slip Current',[3,4,4]],['tidecaller','Tidecaller','Surge',[5,6,4]],['abyssal-serpent','Abyssal Serpent','Undertow',[8,9,3]],['monsoon-empress','Monsoon Empress','Tidal Wrath',[8,8,7]],['leviathan-of-depths','Leviathan of Depths','Drowning Grasp',[10,11,6]]],
 cryo:[['frost-hare','Frost Hare','Chill Step',[3,3,5]],['glacier-lynx','Glacier Lynx','Numbing Claw',[6,5,4]],['permafrost-warden','Permafrost Warden','Bulwark',[7,10,2]],['winters-herald',"Winter's Herald",'Absolute Zero',[8,7,8]],['eternal-glacier-queen','Eternal Glacier Queen','Crown of Frost',[9,12,6]]],
 electro:[['spark-mouse','Spark Mouse','Static Nip',[4,2,5]],['stormtail-fox','Stormtail Fox','Chain Spark',[6,4,6]],['voltaic-golem','Voltaic Golem','Overcharge',[9,8,3]],['thunder-sovereign','Thunder Sovereign','Judgment Arc',[9,6,9]],['voidmaw','Voidmaw','Eclipse',[12,8,8]]],
 anemo:[['gust-sprite','Gust Sprite','Tailwind',[3,3,6]],['windrunner-owl','Windrunner Owl','Wide Swirl',[5,4,7]],['gale-djinn','Gale Djinn','Vacuum Wall',[7,6,8]],['skybound-sovereign','Skybound Sovereign','Eye of the Storm',[8,6,10]],['tempest-incarnate','Tempest Incarnate','Maelstrom Crown',[9,7,12]]],
 geo:[['pebble-golem','Pebble Golem','Steady Ground',[4,5,1]],['shardback-tortoise','Shardback Tortoise','Crystal Skin',[5,8,2]],['stoneheart-golem','Stoneheart Golem','Bulwark',[8,9,1]],['titan-of-the-range','Titan of the Range','Mountain’s Verdict',[10,10,2]],['sovereign-of-strata','Sovereign of Strata','Bedrock Throne',[10,14,2]]],
 dendro:[['sprout-imp','Sprout Imp','Bud',[3,3,4]],['thornback-boar','Thornback Boar','Bramble Guard',[6,5,4]],['verdant-treant','Verdant Treant','Bloomburst',[7,9,2]],['worldroot-avatar','Worldroot Avatar','Everseed',[8,8,6]],['genesis-bloom','Genesis Bloom','First Spring',[10,10,8]]]
};
export function getCardById(id){return CARDS.find(c=>c.id===id)||null;}
