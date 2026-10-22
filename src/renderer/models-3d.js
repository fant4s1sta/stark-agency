import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { objects } from './world.js';

const materials = new Map();
const cube = new RoundedBoxGeometry(1, 1, 1, 3, .12);
const ball = new T.SphereGeometry(1, 16, 12);
const tube = new T.CylinderGeometry(1, 1, 1, 16);
export function material(color, metal = 0) {
  const key = `${color}:${metal}`;
  if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness: .65, metalness: metal }));
  return materials.get(key);
}
function mesh(parent, geometry, color, pos, scale, metal = 0) {
  const m = new T.Mesh(geometry, material(color, metal)); m.position.set(...pos); m.scale.set(...scale); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export function box(p, color, x, y, z, w, h, d, metal = 0) { return mesh(p, cube, color, [x,y,z], [w,h,d], metal); }
export function sphere(p, color, x, y, z, w, h = w, d = w) { return mesh(p, ball, color, [x,y,z], [w,h,d]); }
export function cylinder(p, color, x, y, z, r, h, metal = 0) { return mesh(p, tube, color, [x,y,z], [r,h,r], metal); }
function group(parent, x=0,y=0,z=0) { const g = new T.Group(); g.position.set(x,y,z); parent.add(g); return g; }
function link(p, color, from, to, radius) {
  const a = new T.Vector3(...from), b = new T.Vector3(...to), delta = b.clone().sub(a);
  const m = cylinder(p,color,0,0,0,radius,delta.length(),.35); m.position.copy(a.add(b).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()); return m;
}
function ring(p, color, x,y,z,r,thickness=.025) {
  const m = new T.Mesh(new T.TorusGeometry(r,thickness,6,20), material(color)); m.position.set(x,y,z); m.castShadow=true; p.add(m); return m;
}
function label(p, text, x,y,z,w,h, color='#42645a', background='#f5f0df') {
  const canvas = document.createElement('canvas'); canvas.width=512;canvas.height=128;
  const c=canvas.getContext('2d');c.fillStyle=background;c.fillRect(0,0,512,128);c.fillStyle=color;c.font='600 44px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,64);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map}));m.position.set(x,y,z);p.add(m);return m;
}
const colors={vision:['#e8e6d5','#e3e9dd','#a9c5ad','#d1ac50'],jarvis:['#eac7a1','#627994','#bfc2b3','#dab973'],friday:['#f2c9a8','#66a992','#b85b37','#ecd4a2'],ultron:['#abbcc3','#8199a5','#637b88','#f06961'],edith:['#e6bb9d','#ad7897','#453b51','#a8d6c7']};
export function createCharacter(id) {
  const root=new T.Group();root.userData.agent=id;
  const body=group(root); const rig={root,body,id};
  if(id==='dume'||id==='u') {
    const big=id==='dume', shell=big?'#586870':'#b4c1ba', dark='#34454c', gold='#d4ae4d';
    box(body,dark,0,.17,0,.82,.24,.61);box(body,shell,0,.31,0,.72,.12,.55);
    for(const x of [-.35,.35]) for(const z of [-.21,0,.21]) { const wheel=cylinder(body,dark,x,.13,z,.11,.10);wheel.rotation.z=Math.PI/2; }
    cylinder(body,shell,0,.5,0,.22,.35,.45);cylinder(body,dark,0,.36,0,.28,.07);
    box(body,shell,-.2,.67,-.04,.25,.26,.3);
    const shoulder=group(body,0,.7,0); const joint=cylinder(shoulder,dark,0,0,0,.21,.34);joint.rotation.x=Math.PI/2;
    const cap=cylinder(shoulder,gold,0,0,.19,.145,.04);cap.rotation.x=Math.PI/2;
    const arm=group(shoulder);arm.rotation.z=big?.42:-.46;
    link(arm,shell,[0,0,0],[0,.65,0],.105);link(arm,'#d2d8cf',[.15,.02,0],[.15,.51,0],.035);
    const elbow=group(arm,0,.65,0);sphere(elbow,dark,0,0,0,.14);ring(elbow,'#c0c9bd',0,0,.105,.075,.02);
    const fore=group(elbow);fore.rotation.z=big?-.95:1.35;
    link(fore,shell,[0,0,0],[0,.62,0],.075);link(fore,'#d0d7c9',[-.035,.02,.05],[-.035,.6,.05],.018);
    const cable=new T.CatmullRomCurve3([new T.Vector3(.09,.03,-.07),new T.Vector3(.23,.25,-.14),new T.Vector3(.17,.5,-.08),new T.Vector3(0,.6,0)]);
    const wire=new T.Mesh(new T.TubeGeometry(cable,12,.018,5,false),material(dark));fore.add(wire);
    const wrist=group(fore,0,.66,0);sphere(wrist,'#92a29f',0,0,0,.1);const claws=[];
    for(const side of [-1,1]) {const claw=group(wrist,side*.07,.04,0);box(claw,shell,side*.03,.08,0,.05,.18,.065);box(claw,'#d9ded2',0,.16,0,.12,.045,.065);claws.push(claw);}
    rig.arm=arm;rig.fore=fore;rig.claws=claws;rig.armAngle=arm.rotation.z;rig.foreAngle=fore.rotation.z;
    if(!big) body.scale.setScalar(.77); else body.scale.setScalar(.95);
    rig.height=big?1.95:1.45; return rig;
  }
  const [skin,coat,hair,accent]=colors[id];
  // Shared toy proportions; separate head and limb pivots animate without deforming faces.
  const legs=[]; for(const x of [-.16,.16]) { const g=group(body,x,.48,0); box(g,'#455866',0,-.16,0,.22,.36,.25);box(g,'#364851',0,-.36,.055,.26,.15,.36);legs.push(g); }
  box(body,coat,0,.78,0,.64,.67,.4);box(body,'#f0ead8',0,.92,.218,.18,.35,.03);
  box(body,accent,0,.83,.242,.055,.26,.025); for(const x of [-.2,.2]) box(body,coat,x,.91,.22,.13,.36,.035);
  const arms=[]; for(const x of [-.39,.39]) {const a=group(body,x,1.02,0);box(a,coat,0,-.19,0,.19,.43,.22);sphere(a,skin,0,-.42,0,.105,.13,.11);arms.push(a);}
  const head=group(body,0,1.48,0);
  if(id==='ultron') box(head,skin,0,0,0,.81,.73,.66);
  else sphere(head,skin,0,0,0,.46,.43,.39);
  if(id==='vision') {
    box(head,'#b7cbbf',-.35,.01,0,.07,.49,.65);box(head,'#b7cbbf',.35,.01,0,.07,.49,.65);
    const gem=box(head,'#edbd56',0,.19,.35,.13,.16,.055);gem.rotation.z=Math.PI/4;
    box(body,'#d1dbbd',0,.82,-.24,.67,.73,.08);
  } else if(id==='ultron') {
    box(head,hair,0,.24,-.02,.77,.2,.64);box(head,'#738b98',0,-.26,.26,.53,.13,.17);
    for(const x of [-.4,.4]) box(head,hair,x,.14,-.02,.1,.34,.25);
    box(body,'#ef9980',0,.88,.22,.14,.14,.04);
  } else {
    mesh(head,new T.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI/2),hair,[0,.18,-.035],[.48,.29,.41]);
    sphere(head,hair,0,.09,-.23,.43,.35,.19);
    for(const x of [-.36,.36]) box(head,hair,x,id==='edith'?-.02:.09,0,.13,id==='edith'?.65:.33,.58);
    box(head,hair,-.17,.22,.29,.42,.17,.12);
    if(id==='friday'){sphere(head,hair,.42,.2,-.14,.22);box(head,'#e5bb70',.37,.14,-.04,.1,.12,.13);}
    if(id==='jarvis') for(const x of [-.18,.18]) box(head,'#929d9b',x,.09,.35,.14,.035,.025);
  }
  for(const x of [-.18,.18]) {
    sphere(head,id==='ultron'?'#ee6c5e':'#273c43',x,-.035,.344,.052,.075,.025);
    if(id!=='ultron') sphere(head,'#f7f2df',x-.013,-.01,.367,.015);
    if(id!=='ultron'&&id!=='vision') sphere(head,'#e3a494',x*1.48,-.15,.34,.075,.03,.012);
  }
  box(head,id==='ultron'?'#415964':'#ac7e71',0,-.23,.345,.10,.025,.02);
  if(id==='edith') {for(const x of [-.18,.18]) ring(head,'#5c5167',x,-.035,.385,.115,.018);box(head,'#5c5167',0,-.02,.389,.14,.025,.023);}
  const cup=group(arms[1],0,-.40,.12);mug(cup,0,0,0);cup.scale.setScalar(.8);cup.visible=false;
  const book=group(body,0,.66,.37);box(book,'#e5cf9a',0,0,0,.52,.06,.3);box(book,'#fff0d2',0,.04,0,.47,.025,.27);book.visible=false;
  rig.cup=cup;rig.book=book;rig.head=head;rig.legs=legs;rig.arms=arms;rig.height=1.95;return rig;
}
export function animateCharacter(rig,p,time) {
  const walking=p.action==='walk', phase=p.walkClock*9;
  rig.root.position.set(p.x/32-13,0,p.y/32-10);
  const angles={down:0,right:Math.PI/2,up:Math.PI,left:-Math.PI/2}, desired=angles[p.facing]||0;
  const difference=Math.atan2(Math.sin(desired-rig.root.rotation.y),Math.cos(desired-rig.root.rotation.y));rig.root.rotation.y+=difference*.2;
  if(rig.arm) {
    const working=['repair','work','talk','water'].includes(p.action);
    rig.arm.rotation.z=rig.armAngle+(working?Math.sin(time*2)*.13:walking?Math.sin(phase)*.035:0);
    rig.fore.rotation.z=rig.foreAngle+(working?Math.cos(time*2)*.18:0);
    rig.claws.forEach((claw,i)=>{claw.rotation.z=(i?1:-1)*(working?.12+.12*Math.sin(time*3):.08);});
  } else {
    const sitting=['work','rest','read'].includes(p.action);rig.cup.visible=p.action==='coffee';rig.book.visible=p.action==='read';
    rig.body.position.y=walking?Math.abs(Math.sin(phase))*.045:sitting?-.16:Math.sin(time*1.7)*.012;
    rig.legs.forEach((leg,i)=>leg.rotation.x=sitting?-1.1:walking?Math.sin(phase+i*Math.PI)*.45:0);
    rig.arms.forEach((arm,i)=>{arm.rotation.x=walking?-Math.sin(phase+i*Math.PI)*.5:['work','read'].includes(p.action)?-.8+Math.sin(time*5+i)*.08:p.action==='coffee'&&i===1?-1.7:p.action==='talk'?-0.45+Math.sin(time*2+i)*.2:0;});
    rig.head.rotation.z=p.action==='talk'?Math.sin(time*2)*.045:0;
  }
}
function mug(p,x,y,z) {cylinder(p,'#faf1d8',x,y,z,.10,.19);cylinder(p,'#876349',x,y+.098,z,.077,.006);const handle=ring(p,'#f3e8d0',x+.11,y,z,.065,.018);handle.rotation.y=Math.PI/2;}
function plant(p,x,y,z,size=1) {
  const g=group(p,x,y,z);g.scale.setScalar(size);cylinder(g,'#c99e80',0,.22,0,.24,.44);cylinder(g,'#705d4c',0,.445,0,.20,.015);
  for(let i=0;i<6;i++){const a=i*2.4, h=.65+(i%3)*.18;link(g,'#78946a',[0,.4,0],[Math.cos(a)*.22,h,Math.sin(a)*.22],.018);const leaf=sphere(g,i%2?'#7baf8c':'#5b947b',Math.cos(a)*.24,h,Math.sin(a)*.24,.17,.3,.08);leaf.rotation.z=Math.cos(a)*.6;leaf.rotation.y=-a;}
}
function monitor(p,x,y,z,accent='#91d2bc') {
  box(p,'#526b72',x,y+.30,z,.95,.65,.10);box(p,'#254c5a',x,y+.30,z+.056,.83,.53,.01);
  for(let i=0;i<4;i++) box(p,i%2?accent:'#e6cc91',x-.22+(i%2)*.07,y+.44-i*.095,z+.066,.28+i*.08,.025,.005);
  cylinder(p,'#6f8987',x,y-.10,z,.045,.20);box(p,'#6f8987',x,y-.2,z,.4,.035,.26);
}
function chair(p,x,z,color='#789f95') {
  const g=group(p,x,0,z);cylinder(g,'#657d78',0,.28,0,.05,.48);box(g,color,0,.51,0,.6,.17,.58);box(g,color,0,.78,.22,.6,.57,.12);
  for(const r of [0,Math.PI/2]) {const b=box(g,'#657d78',0,.09,0,.6,.04,.08);b.rotation.y=r;}
}
export function createRoom(scene) {
  const room=group(scene),pickables=[],backs=group(room);
  box(room,'#c8bca7',0,-.42,0,25,.75,15.8);box(room,'#f5efdf',0,-.12,0,24.7,.2,15.5);
  for(let x=0;x<24;x++) for(let z=0;z<7;z++) box(room,((x+z)%3===0?'#d7b895':'#dfc4a2'),x-11.5,.005,z*2-6, .985,.08,1.98);
  box(backs,'#dce3ce',0,1.3,-7.45,24.5,2.7,.22);box(backs,'#a6bba6',0,.18,-7.26,24.4,.22,.12);
  for(const x of [-8.8,-3.4,3.4,8.8]) {
    box(backs,'#f5f0dc',x,1.65,-7.28,3.4,1.8,.15);box(backs,'#a5ccce',x,1.65,-7.18,3.12,1.52,.025);
    box(backs,'#eff1dc',x,1.65,-7.10,.075,1.55,.09);box(backs,'#eff1dc',x,1.65,-7.10,3.15,.075,.09);box(backs,'#f2e6ca',x,.76,-7.05,3.65,.1,.36);
  }
  box(room,'#b4c9b4',-12.25,.33,0,.20,.75,15);box(room,'#b4c9b4',12.25,.33,0,.20,.75,15);
  label(backs,'Stark Agency',0,2.06,-7.30,2.8,.7);
  const rug=(x,z,w,d,c)=>{box(room,'#eee8ce',x,.075,z,w,.025,d);box(room,c,x,.095,z,w-.14,.025,d-.14);};
  rug(-8.8,2.9,5.2,4.4,'#a0b8a5');rug(3.8,2.3,6.8,4.8,'#a9bac4');
  for(const o of objects) {
    const x=o.x+o.w/2-13,z=o.y+o.h/2-10,g=group(room,x,0,z);g.userData.object=o.id;pickables.push(g); const w=o.w,d=o.h;
    if(['desk','coffee','tools'].includes(o.type)) {
      box(g,'#e7c599',0,.85,0,w-.06,.18,d-.04);for(const px of [-w/2+.18,w/2-.18]) for(const pz of [-.30,.30])box(g,'#7d9990',px,.4,pz,.09,.8,.09);
      if(o.type==='desk') {
        if(o.paper){box(g,'#fff1cc',0,.96,0,.9,.04,.6);box(g,'#ceb784',0,.985,0,.025,.01,.59);}
        else {monitor(g,0,1.16,-.20,o.color);box(g,'#e5e6d4',0,.97,.25,.8,.045,.24);for(let i=0;i<6;i++)box(g,'#a5b5a7',-.28+i*.11,1.0,.25,.07,.005,.1);}
        mug(g,-w/2+.30,1.03,.18);box(g,o.color,w/2-.30,.97,.05,.35,.04,.47);
        chair(room,x,z+1);
      } else if(o.type==='coffee') {
        box(g,'#586f6c',-.65,1.25,-.06,.65,.64,.5);box(g,'#b9c5b4',-.65,1.47,.21,.52,.13,.03);box(g,'#263f43',-.65,1.19,.21,.45,.37,.02);mug(g,-.65,1.05,.24);mug(g,.45,1.03,.1);mug(g,.85,1.03,.1);
      } else {box(g,'#bda47f',0,1.53,-.4,w-.15,1.15,.10);for(let i=0;i<6;i++){box(g,'#72878a',-1.05+i*.4,1.55,-.31,.07,.46,.08);box(g,'#c4c9b2',-1.05+i*.4,1.75,-.31,.25,.09,.11);}box(g,'#698e7e',-.6,1.07,.08,.65,.3,.4);}
    } else if(o.type==='board') {
      for(const px of [-w/2+.25,w/2-.25]) box(g,'#819b91',px,.85,0,.07,1.7,.08);
      box(g,'#bba478',0,1.55,0,w-.1,1.45,.14);box(g,'#faf4dd',0,1.55,.081,w-.25,1.3,.025);
      for(let i=0;i<3;i++)box(g,['#edcc88','#b2cbbc','#e4b2a0'][i],-.9+i*.9,1.5+(i%2)*.3,.11,.55,.32,.02);
      box(g,'#8fb4a4',0,1.36,.13,2.0,.025,.02);box(g,'#9f967b',0,.85,.13,w-.12,.09,.24);
    } else if(o.type==='books'||o.type==='cabinet') {
      box(g,'#c2a582',0,.96,0,w-.1,1.9,d-.1);
      for(let row=0;row<3;row++) {
        box(g,'#9c826a',0,.38+row*.54,d/2-.04,w-.25,.46,.02);
        if(o.type==='books')for(let i=0;i<10;i++) {const h=.29+(i%3)*.04;box(g,['#6b9e91','#e5bd7f','#b77e6d','#8b9bb4'][i%4],-w/2+.27+i*(w-.45)/10,.19+row*.54+h/2,d/2+.005,.14,h,.25);}
        else {box(g,'#e4c99e',0,.38+row*.54,d/2+.025,w-.22,.44,.06);box(g,'#8c9e8f',0,.38+row*.54,d/2+.065,.28,.06,.07);}
      }
      if(o.type==='cabinet')plant(g,0,1.95,0,.6);
    } else if(o.type==='server') {
      box(g,'#475f68',0,1.0,0,w-.15,2,d-.1);for(let i=0;i<7;i++){box(g,'#69848a',0,.22+i*.25,.46,w-.35,.17,.03);for(let k=0;k<3;k++)sphere(g,k===0?'#a4dcca':'#dac58a',.45+k*.14,.22+i*.25,.49,.03);}
    } else if(o.type==='plant')plant(g,0,0,0,1.15);
    else if(o.type==='sofa') {
      box(g,'#6e9690',0,.35,0,w,.5,.95);box(g,'#87aaa0',0,.85,-.35,w,.9,.22);
      for(let i=0;i<3;i++)box(g,'#b1c7b0',-1.2+i*1.2,.65,.03,1.12,.25,.77);
      for(const side of [-1,1]){box(g,'#86aaa0',side*(w/2-.1),.65,0,.25,.7,1.1);const cushion=box(g,side===1?'#d8b880':'#bad0c0',side*1.25,.98,-.10,.6,.55,.20);cushion.rotation.z=side*.15;}
    } else if(o.type==='meeting'||o.type==='lowtable') {
      const h=o.type==='meeting'?.83:.43;box(g,'#e6c9a0',0,h,0,w-.06,.16,d-.06);for(const px of [-w/2+.3,w/2-.3])for(const pz of [-d/2+.23,d/2-.23])box(g,'#8da394',px,h/2,pz,.12,h,.12);
      mug(g,w/2-.35,h+.18,.12);box(g,'#fff0ce',-.6,h+.10,.1,.6,.025,.45);
      if(o.type==='meeting'){box(g,'#7e9c99',.3,h+.15,-.1,.7,.07,.5);const lid=box(g,'#365d68',.3,h+.42,-.32,.7,.5,.045);lid.rotation.x=-.12;}
    }
  }
  return {room,pickables,backs};
}
