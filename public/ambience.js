/** Original procedural profiles: no third-party recordings or sampled performances. */
export const ambienceCatalog = {
  stream: {name:"Gentle stream",family:"Water",kind:"water",cutoff:1800,speed:1.4,detail:"Flowing wash with small bubbling droplets"},
  river: {name:"Flowing river",family:"Water",kind:"water",cutoff:900,speed:.7,detail:"Broad, steady moving-water texture"},
  waterfall: {name:"Waterfall",family:"Water",kind:"water",cutoff:3800,speed:.3,detail:"Continuous falling-water noise"},
  spring: {name:"Bubbling spring",family:"Water",kind:"water",cutoff:1500,speed:2.8,detail:"Frequent rounded water bubbles"},
  fountain: {name:"Garden fountain",family:"Water",kind:"water",cutoff:2400,speed:2,detail:"Light splash and trickling texture"},
  droplets: {name:"Water droplets",family:"Water",kind:"drops",cutoff:1800,speed:1.2,detail:"Separated, rounded synthetic droplets"},
  cave: {name:"Cave droplets",family:"Water",kind:"drops",cutoff:800,speed:.45,detail:"Slow drops with a resonant tail"},
  drizzle: {name:"Light drizzle",family:"Rain",kind:"rain",cutoff:2000,speed:.6,detail:"Soft, light rainfall texture"},
  rain: {name:"Steady rain",family:"Rain",kind:"rain",cutoff:4200,speed:1.4,detail:"Even rain with scattered small droplets"},
  downpour: {name:"Heavy rain",family:"Rain",kind:"rain",cutoff:6000,speed:3.5,detail:"Dense rainfall and a broad noise wash"},
  leaves: {name:"Rain on leaves",family:"Rain",kind:"rain",cutoff:3000,speed:2.3,detail:"Soft rain with irregular leaf-like taps"},
  roof: {name:"Rain on a roof",family:"Rain",kind:"rain",cutoff:1500,speed:4.8,detail:"A darker wash with short resonant taps"},
  shore: {name:"Gentle ocean shore",family:"Ocean",kind:"ocean",cutoff:1500,speed:.065,detail:"Slow rising and falling surf"},
  surf: {name:"Rolling surf",family:"Ocean",kind:"ocean",cutoff:3000,speed:.09,detail:"Stronger wave swells and retreating hiss"},
  coast: {name:"Distant coast",family:"Ocean",kind:"ocean",cutoff:650,speed:.045,detail:"Low, distant wave movement"},
  breeze: {name:"Soft breeze",family:"Wind",kind:"wind",cutoff:550,speed:.075,detail:"A slowly moving filtered-air texture"},
  forest: {name:"Wind through trees",family:"Wind",kind:"wind",cutoff:1600,speed:.12,detail:"Air movement with a brighter rustling layer"},
  bamboo: {name:"Bamboo breeze",family:"Wind",kind:"wind",cutoff:2400,speed:.17,detail:"Light rustling with hollow accents"},
  birds: {name:"Garden bird-like calls",family:"Wildlife",kind:"birds",cutoff:4500,speed:.8,detail:"Original synthetic chirps; not a species recording"},
  dawn: {name:"Dawn-like chorus",family:"Wildlife",kind:"birds",cutoff:6000,speed:1.8,detail:"Layered synthetic chirp phrases"},
  crickets: {name:"Cricket-like pulses",family:"Wildlife",kind:"insects",cutoff:4500,speed:2.4,detail:"Soft, regular synthetic insect-like pulses"},
  fireplace: {name:"Gentle fireplace",family:"Fire",kind:"fire",cutoff:600,speed:2.3,detail:"Low movement with occasional crackles"},
  campfire: {name:"Campfire",family:"Fire",kind:"fire",cutoff:1300,speed:5,detail:"A brighter fire-like wash and crackling texture"},
  white: {name:"White noise",family:"Textures",kind:"white",cutoff:8000,speed:1,detail:"Broadband generated noise"},
  pink: {name:"Pink-style noise",family:"Textures",kind:"pink",cutoff:3500,speed:1,detail:"A generated noise blend weighted toward lower frequencies"},
  brown: {name:"Brown-style noise",family:"Textures",kind:"brown",cutoff:500,speed:1,detail:"A deep, smoothly varying generated noise texture"},
  rainstick: {name:"Rainstick",family:"Textures",kind:"rain",cutoff:2200,speed:7,detail:"A moving granular rainstick-style texture"},
  ocean_drum: {name:"Ocean drum",family:"Textures",kind:"ocean",cutoff:2100,speed:.16,detail:"Faster rolling, ocean-drum-style movement"},
};
export const ambienceIds = Object.keys(ambienceCatalog);
export function isAmbience(id) {return Object.prototype.hasOwnProperty.call(ambienceCatalog,id);}
function random(a) {a.seed=(Math.imul(a.seed,1664525)+1013904223)>>>0;return a.seed/2147483648-1;}
function initial(id) {
  let seed=2166136261;for(const char of String(id))seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  return {seed:seed||1,low:0,brown:0,p1:0,p2:0,p3:0,next:0,age:100,phase:0,frequency:800,filter:[0,0,0,0],blend:0};
}
export function ambienceSample(state,rate) {
  const p=ambienceCatalog[state.sound],a=state.ambience||(state.ambience=initial(state.id));
  const intensity=state.intensity??.5,dt=1/rate,n=random(a);
  if(a.rate!==rate){a.rate=rate;a.lowAlpha=1-Math.exp(-2*Math.PI*p.cutoff/rate);a.brownLeak=Math.exp(-2*Math.PI*35/rate);}
  a.low+=(n-a.low)*a.lowAlpha;
  a.brown=(a.brown+.02*n)*a.brownLeak;
  a.p1+=(n-a.p1)*.055;a.p2+=(n-a.p2)*.0055;a.p3+=(n-a.p3)*.00055;
  const movement=.65+.18*Math.sin(state.time*2*Math.PI*p.speed)+.12*Math.sin(state.time*2*Math.PI*p.speed*.43);
  if(state.time>=a.next){
    a.age=0;a.phase=0;a.frequency=600+(random(a)+1)*1100;
    a.next=state.time+(p.kind==="birds"?.4:.12)+(random(a)+1)/(Math.max(.1,p.speed)*(.5+intensity));
  }
  a.age+=dt;
  const envelope=Math.min(1,a.age/.006)*Math.exp(-a.age*(p.kind==="drops"?8:p.kind==="birds"?10:65));
  const birdPitch=1800+a.frequency*.7+850*Math.sin(a.age*24);
  a.phase+=2*Math.PI*(p.kind==="birds"?birdPitch:a.frequency*Math.exp(-a.age*3))*dt;
  if(a.phase>2*Math.PI*10000)a.phase%=2*Math.PI*10000;
  const drop=Math.sin(a.phase)*envelope;
  let value;
  switch(p.kind){
    case "water":value=(n*.18+a.low*1.4)*movement+drop*.13;break;
    case "drops":value=drop*.62+a.low*.035;break;
    case "rain":value=(n*.32+a.low*.65)*(.65+intensity*.35)+drop*.16;break;
    case "ocean":{const wave=.12+.8*Math.pow((Math.sin(2*Math.PI*p.speed*state.time)+1)/2,1.8);value=(a.low*1.8+n*.13)*wave;break;}
    case "wind":value=(a.low*1.9+n*.025)*movement;break;
    case "birds":value=drop*.42*Math.sin(Math.min(1,a.age/.23)*Math.PI)+a.low*.025;break;
    case "insects":value=Math.sin(2*Math.PI*3400*state.time)*Math.max(0,Math.sin(2*Math.PI*p.speed*state.time))**8*.35+a.low*.025;break;
    case "fire":value=a.low*.8+a.brown*.3+n*envelope*.35;break;
    case "white":value=n*.45;break;
    case "pink":value=(n*.1+a.p1*1.2+a.p2*2+a.p3*3)*.7;break;
    case "brown":value=a.brown*2.4;break;
    default:value=0;
  }
  value*=.65+intensity*.35;
  if(state.focus){
    const hz=Math.max(80,Math.min(rate*.4,state.hz)),q=state.focusQ??.7;
    if(a.hz!==hz||a.q!==q||a.filterRate!==rate){
      const w=2*Math.PI*hz/rate,alpha=Math.sin(w)/(2*q),den=1+alpha;
      a.coefficients=[alpha/den,-alpha/den,-2*Math.cos(w)/den,(1-alpha)/den];a.hz=hz;a.q=q;a.filterRate=rate;
    }
    const [b0,b2,c1,c2]=a.coefficients,[x1,x2,y1,y2]=a.filter;
    const y=b0*value+b2*x2-c1*y1-c2*y2;
    a.filter[0]=value;a.filter[1]=x1;a.filter[2]=y;a.filter[3]=y1;a.blend+=(1-a.blend)*Math.min(1,dt/.025);
    value=value*(1-a.blend)+y*a.blend;
  } else a.blend=0;
  return Math.tanh(value);
}
