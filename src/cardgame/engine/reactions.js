const TABLE={
 'cryo:pyro':{name:'Melt',multiplier:1.5,effect:'damage'},'hydro:pyro':{name:'Vaporize',multiplier:1.5,effect:'damage'},
 'electro:pyro':{name:'Overloaded',multiplier:1.4,effect:'damage'},'electro:hydro':{name:'Electro-Charged',multiplier:1.15,effect:'dot'},
 'cryo:hydro':{name:'Frozen',multiplier:1,effect:'skip'},'cryo:electro':{name:'Superconduct',multiplier:1.1,effect:'weaken'},
 'dendro:pyro':{name:'Burning',multiplier:1.2,effect:'dot'},'dendro:hydro':{name:'Bloom',multiplier:1,effect:'shield'},
 'dendro:electro':{name:'Quicken',multiplier:1.15,effect:'dot'}
};
export function resolveReaction(a,b){if(!a||!b||a===b)return null;if(a==='anemo'||b==='anemo'){const other=a==='anemo'?b:a;return {name:`Swirl (${other})`,multiplier:1.2,effect:'damage',spreads:other};}if(a==='geo'||b==='geo')return {name:'Crystallize',multiplier:1,effect:'shield'};return TABLE[[a,b].sort().join(':')]||null;}
