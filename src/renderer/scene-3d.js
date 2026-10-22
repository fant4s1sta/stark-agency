import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OfficeScene as Simulation, portrait as pixelPortrait } from './scene.js';
import { createCharacter, animateCharacter, createRoom } from './models-3d.js';
import { objects, stations, nearestFree } from './world.js';

const portraits = new Map();
let portraitRenderer;
function lighting(scene) {
  scene.add(new T.HemisphereLight('#fff6e1','#9cabaf',2.6));
  const sun=new T.DirectionalLight('#fff0d4',3.3);sun.position.set(-8,18,10);scene.add(sun);return sun;
}
export function portrait(id,className='') {
  try {
    if(!portraits.has(id)) {
      portraitRenderer ||= new T.WebGLRenderer({alpha:true,antialias:true});
      portraitRenderer.setSize(128,160);portraitRenderer.setPixelRatio(1);
      portraitRenderer.outputColorSpace=T.SRGBColorSpace;portraitRenderer.toneMapping=T.ACESFilmicToneMapping;portraitRenderer.toneMappingExposure=1.12;
      const scene=new T.Scene();lighting(scene);const rig=createCharacter(id);scene.add(rig.root);rig.root.rotation.y=-.35;
      const camera=new T.OrthographicCamera(-.95,.95,1.19,-1.19,.1,20);camera.position.set(0,1.7,5);camera.lookAt(0,.95,0);portraitRenderer.render(scene,camera);
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=160;canvas.getContext('2d').drawImage(portraitRenderer.domElement,0,0);portraits.set(id,canvas);
    }
    const result=document.createElement('canvas');result.width=128;result.height=160;result.className=className;result.getContext('2d').drawImage(portraits.get(id),0,0);return result;
  } catch { return pixelPortrait(id,className); }
}
export class OfficeScene extends Simulation {
  constructor(agents,onSelect,onAmbient) {
    let view;
    try { view=new OfficeView(); }
    catch(error) {
      console.warn('3D 场景未能启动，使用二维视图。',error);
      const canvas=document.querySelector('#office-game');canvas.replaceWith(canvas.cloneNode());
    }
    super(agents,onSelect,onAmbient,view);
    if(!view) {
      document.querySelector('#game-hint').textContent='3D 需要浏览器启用 WebGL 2，当前使用二维视图';
      document.querySelector('.scene-location').textContent='STARK AGENCY · 二维兼容视图';
      document.querySelector('#reset-camera').disabled=true;
    }
  }
}
class OfficeView {
  constructor() {
    this.canvas=document.querySelector('#office-game');
    this.renderer=new T.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.scene=new T.Scene();this.scene.background=new T.Color('#e7ebdf');
    const sun=lighting(this.scene);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-19;sun.shadow.camera.right=19;sun.shadow.camera.top=19;sun.shadow.camera.bottom=-19;sun.shadow.camera.far=60;sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;
    const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#e4e8dd',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.83;ground.receiveShadow=true;this.scene.add(ground);
    this.room=createRoom(this.scene);this.camera=new T.OrthographicCamera(-16,16,11,-11,.1,120);
    this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.09;this.controls.enablePan=false;this.controls.minPolarAngle=.22;this.controls.maxPolarAngle=Math.PI*.46;this.controls.minZoom=.65;this.controls.maxZoom=2.8;this.controls.rotateSpeed=.65;this.controls.zoomSpeed=.9;
    this.controls.touches.ONE=T.TOUCH.ROTATE;this.controls.touches.TWO=T.TOUCH.DOLLY_ROTATE;
    this.camera.position.set(14,22,28);this.controls.target.set(0,.15,0);this.controls.update();this.controls.saveState();
    this.raycaster=new T.Raycaster();this.pointer=new T.Vector2();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.hitPoint=new T.Vector3();this.projected=new T.Vector3();
    const ring=new T.Mesh(new T.RingGeometry(.38,.44,40),new T.MeshBasicMaterial({color:'#d8ac54',side:T.DoubleSide,transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;ring.position.y=.12;this.scene.add(ring);this.selection=ring;
    this.destination=ring.clone();this.destination.material=new T.MeshBasicMaterial({color:'#6caaa0',side:T.DoubleSide,transparent:true,opacity:.8});this.scene.add(this.destination);this.destination.visible=false;
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;document.querySelector('#game-hint').textContent='3D 画面连接中断，请刷新页面恢复';});
  }
  bind(sim,onSelect) {
    this.sim=sim;this.onSelect=onSelect;
    document.querySelector('#scene').classList.add('is-3d');
    this.rigs=new Map(sim.people.map(p=>{const rig=createCharacter(p.id);this.scene.add(rig.root);return[p.id,rig];}));
    this.controls.addEventListener('change',()=>{sim.zoom=this.camera.zoom;document.querySelector('#zoom-value').textContent=`${Math.round(sim.zoom*100)}%`;});
    const pointers=new Set();let origin=null,moved=false;
    this.canvas.addEventListener('pointerdown',e=>{if(!pointers.size){origin={x:e.clientX,y:e.clientY};moved=false;}pointers.add(e.pointerId);if(pointers.size>1)moved=true;this.canvas.focus({preventScroll:true});});
    this.canvas.addEventListener('pointermove',e=>{if(origin&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>5)moved=true;});
    this.canvas.addEventListener('pointerup',e=>{const click=pointers.size===1&&!moved&&e.button===0;pointers.delete(e.pointerId);if(click)this.pick(e);if(!pointers.size)origin=null;});
    this.canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);moved=true;origin=null;});
    document.querySelector('#reset-camera').onclick=()=>{
      // Drain residual orbit damping before restoring the saved camera pose.
      this.controls.enableDamping=false;this.controls.update();this.controls.reset();this.controls.enableDamping=true;sim.zoom=1;document.querySelector('#zoom-value').textContent='100%';sim.hint('视角已复位 · 拖动旋转，滚轮或双指缩放');};
    // Resize the drawing buffer to its CSS viewport, including panel and mobile changes.
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.canvas.parentElement);this.resize();
  }
  resize() {
    const r=this.canvas.parentElement.getBoundingClientRect();if(!r.width||!r.height)return;
    this.width=r.width;this.height=r.height;this.renderer.setSize(r.width,r.height,false);
    const aspect=r.width/r.height, halfHeight=Math.max(10.8,15.5/aspect);this.camera.left=-halfHeight*aspect;this.camera.right=halfHeight*aspect;this.camera.top=halfHeight;this.camera.bottom=-halfHeight;this.camera.updateProjectionMatrix();
  }
  setZoom(value) {this.camera.zoom=T.MathUtils.clamp(value,.65,2.8);this.camera.updateProjectionMatrix();this.sim.zoom=this.camera.zoom;return Math.round(this.camera.zoom*100);}
  pick(e) {
    const r=this.canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const hits=this.raycaster.intersectObjects([...this.rigs.values()].map(r=>r.root).concat(this.room.pickables),true);
    let target=hits[0]?.object;while(target&&!target.userData.agent&&!target.userData.object)target=target.parent;
    if(target?.userData.agent){this.onSelect(target.userData.agent);return;}
    const p=this.sim.people.find(p=>p.id===this.sim.selected);
    if(target?.userData.object) {
      const object=objects.find(o=>o.id===target.userData.object);let goal=Object.values(stations).find(s=>s.object===object.id);
      if(!goal){const tile=nearestFree(this.sim.grid,{x:object.x,y:object.y+object.h},this.sim.blocked(p));if(tile)goal={...tile,action:object.type==='plant'?'water':'idle',facing:'up',label:'看看这件小物件'};}
      if(goal)this.sim.command(p,goal);return;
    }
    if(this.raycaster.ray.intersectPlane(this.plane,this.hitPoint))this.sim.command(p,{x:Math.floor(this.hitPoint.x+13),y:Math.floor(this.hitPoint.z+10),action:'idle',label:'沿走道前往目的地'});
  }
  render(sim) {
    if(this.lost)return;
    this.controls.update();
    // Cut away the rear wall when orbiting behind it, so the office stays visible.
    this.room.backs.visible=this.camera.position.z>this.controls.target.z-2;
    for(const p of sim.people) {
      const rig=this.rigs.get(p.id);animateCharacter(rig,p,sim.time);
      this.projected.set(p.x/32-13,rig.height+.12,p.y/32-10).project(this.camera);
      const visible=Math.abs(this.projected.x)<1&&Math.abs(this.projected.y)<1&&this.projected.z<1;
      p.el.style.display=visible?'block':'none';p.el.style.left=`${(this.projected.x+1)*50}%`;p.el.style.top=`${(1-this.projected.y)*50}%`;
      p.el.style.zIndex=Math.round((1-this.projected.z)*1000);p.el.dataset.action=p.action;p.el.dataset.tile=`${p.tile.x},${p.tile.y}`;p.el.dataset.facing=p.facing;
      if(p.bubbleEnd&&sim.time>p.bubbleEnd){p.el.querySelector('.speech')?.remove();p.bubbleEnd=0;}
    }
    const selected=sim.people.find(p=>p.id===sim.selected);this.selection.position.set(selected.x/32-13,.12,selected.y/32-10);
    const dest=sim.destination;this.destination.visible=Boolean(dest&&Number.isFinite(dest.x)&&dest.until>sim.time);
    if(this.destination.visible)this.destination.position.set(dest.x+.5-13,.13,dest.y+.5-10);
    this.canvas.dataset.view='3d';this.canvas.dataset.zoom=this.camera.zoom.toFixed(2);this.canvas.dataset.azimuth=this.controls.getAzimuthalAngle().toFixed(3);
    this.renderer.render(this.scene,this.camera);
  }
}
