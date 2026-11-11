import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCw, Pause, Play } from 'lucide-react';
import MuscleMap, { MUSCLE_GROUPS } from './MuscleMap';
import { MUSCLE_PARTS, muscleTone } from '../../../shared/muscleModel';

type Props = { primary: string[]; secondary?: string[] };
export default function MuscleModel3D({ primary, secondary = [] }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<{ view: (back: boolean) => void; spin: (value: boolean) => void } | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const signature = primary.join(',') + '|' + secondary.join(',');
  useEffect(() => {
    let disposed = false; let destroy: (() => void) | undefined;
    setUnsupported(false); setSpinning(false);
    (async () => {
      try {
        const THREE = await import('three');
        if (disposed || !host.current) return;
        const el = host.current;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setClearColor(0x101b24, 1); renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.setAttribute('aria-label', '可拖動旋轉的 3D 肌群示意');
        renderer.domElement.style.touchAction = 'pan-y';
        el.appendChild(renderer.domElement);
        const scene = new THREE.Scene(); const body = new THREE.Group(); scene.add(body);
        const camera = new THREE.PerspectiveCamera(35, 1, .1, 20); camera.position.set(0, .48, 4.8); camera.lookAt(0, .48, 0);
        scene.add(new THREE.AmbientLight(0xffffff, 1.3));
        const key = new THREE.DirectionalLight(0xffe7c1, 3); key.position.set(3, 4, 4); scene.add(key);
        const rim = new THREE.DirectionalLight(0x81dce1, 2); rim.position.set(-3, 2, -3); scene.add(rim);
        const geometry = new THREE.SphereGeometry(1, 24, 16);
        const materials: import('three').MeshStandardMaterial[] = [];
        const shape = (p: number[], s: number[], color: number, rotation = 0) => {
          const material = new THREE.MeshStandardMaterial({ color, roughness: .45, metalness: .08 }); materials.push(material);
          const mesh = new THREE.Mesh(geometry, material); mesh.position.set(p[0],p[1],p[2]); mesh.scale.set(s[0],s[1],s[2]); mesh.rotation.z = rotation; body.add(mesh); return mesh;
        };
        shape([0,1.71,0],[.16,.22,.15],0xa4b4bd); shape([0,1.46,0],[.09,.12,.10],0x566674);
        shape([0,1.02,0],[.40,.48,.17],0x334451); shape([0,.50,0],[.32,.22,.17],0x455968);
        for(const side of [-1,1]) {
          shape([side*.60,.92,0],[.10,.27,.10],0x455968,-side*.15);
          shape([side*.69,.38,0],[.065,.095,.085],0x8b9ba7);
          shape([side*.20,-.18,0],[.08,.085,.085],0x8b9ba7);
          shape([side*.21,-.78,.07],[.09,.075,.18],0x8b9ba7);
        }
        for(const part of MUSCLE_PARTS) {
          const tone = muscleTone(part.group, primary, secondary);
          shape(part.position, part.scale, tone === 'primary' ? 0xf07351 : tone === 'secondary' ? 0xf0bd58 : 0x81929c, part.rotation);
        }
        let frame = 0; let spin = false; let visible = !document.hidden; let previous = 0;
        const render = () => { if (!disposed) renderer.render(scene,camera); };
        const tick = (now: number) => { frame=0; if (!spin || !visible || disposed) return; if(previous) body.rotation.y += Math.min((now-previous)/1000,.1)*.40; previous=now; render(); frame=requestAnimationFrame(tick); };
        const setSpin = (value:boolean) => { spin=value; previous=0; if(frame)cancelAnimationFrame(frame); frame=0; if(spin&&visible)frame=requestAnimationFrame(tick); };
        const resize = () => { const width=el.clientWidth||280; const height=el.clientHeight||320; renderer.setSize(width,height); camera.aspect=width/height;camera.updateProjectionMatrix();render(); };
        const ro = new ResizeObserver(resize); ro.observe(el); resize();
        let down = false; let x=0;
        const pointerDown=(e:PointerEvent)=>{down=true;x=e.clientX;};
        const pointerMove=(e:PointerEvent)=>{if(!down)return;body.rotation.y+=(e.clientX-x)*.012;x=e.clientX;render();};
        const pointerUp=()=>{down=false;};
        const visibility=()=>{visible=!document.hidden;setSpin(spin);};
        renderer.domElement.addEventListener('pointerdown',pointerDown); window.addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',pointerUp); document.addEventListener('visibilitychange',visibility);
        controls.current={view:(back)=>{body.rotation.y=back?Math.PI:0;render();},spin:setSpin};
        destroy=()=>{if(frame)cancelAnimationFrame(frame);ro.disconnect();renderer.domElement.removeEventListener('pointerdown',pointerDown);window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerup',pointerUp);document.removeEventListener('visibilitychange',visibility);geometry.dispose();materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();controls.current=null;};
      } catch { if(!disposed)setUnsupported(true); }
    })();
    return () => {disposed=true;destroy?.();};
  // Only anatomy selection changes rebuild the model, not timers or playback UI.
  }, [signature]);
  const label=(id:string)=>MUSCLE_GROUPS.find(m=>m.id===id)?.labelZh??id;
  return <section data-muscle-model="3d" className="overflow-hidden rounded-2xl border border-border/50 bg-card">
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><p className="text-xs font-semibold">3D 肌群檢視</p><div className="flex gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={()=>controls.current?.view(false)}>前面</Button>
      <Button type="button" variant="ghost" size="sm" onClick={()=>controls.current?.view(true)}>後面</Button>
      {!unsupported&&<Button type="button" variant="ghost" size="sm" aria-label={spinning?'暫停旋轉':'旋轉肌群模型'} onClick={()=>{controls.current?.spin(!spinning);setSpinning(!spinning);}}>{spinning?<Pause className="h-4 w-4"/>:<RotateCw className="h-4 w-4"/>}</Button>}
    </div></div>
    {unsupported?<div className="flex justify-center p-3" data-muscle-model-fallback><MuscleMap activeMuscles={primary}/></div>:<div ref={host} className="h-[320px] w-full"/>}
    <div className="space-y-1 p-3 text-xs"><p><span className="text-orange-600 font-semibold">主要：</span>{primary.map(label).join('、')||'全身有氧活動，未指定單一主肌'}</p>{secondary.length>0&&<p><span className="text-amber-600 font-semibold">輔助：</span>{secondary.map(label).join('、')}</p>}
      <p className="text-[10px] leading-relaxed text-muted-foreground">拖動或按前／後面查看。形狀為肌群概念示意；顏色不代表實測肌肉活化、疲勞或醫療解剖診斷。</p>
    </div>
  </section>;
}
