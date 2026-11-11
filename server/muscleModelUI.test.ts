// @vitest-environment jsdom
import React,{act}from'react';import{createRoot,type Root}from'react-dom/client';import{beforeEach,afterEach,describe,it,expect,vi}from'vitest';
vi.mock('three',()=>({WebGLRenderer:class{constructor(){throw new Error('WebGL disabled');}}}));
import MuscleModel3D from '../client/src/components/MuscleModel3D';
let root:Root;let host:HTMLDivElement;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
describe('3D anatomy progressive enhancement',()=>{
 it('shows local readable primary/secondary muscles when WebGL unavailable, without broken remote image proxies',async()=>{await act(async()=>{root.render(React.createElement(MuscleModel3D,{primary:['chest'],secondary:['triceps']}));await new Promise(r=>setTimeout(r,20));});expect(host.querySelector('[data-muscle-model-fallback]')).not.toBeNull();expect(host.querySelector('svg')).not.toBeNull();expect(host.textContent).toContain('胸肌');expect(host.textContent).toContain('三頭肌');expect(host.textContent).toContain('不代表實測肌肉活化');expect(host.querySelectorAll('img').length).toBe(0);});
 it('retains fallback and muscle labels during unrelated parent re-renders',async()=>{await act(async()=>{root.render(React.createElement(MuscleModel3D,{primary:['chest'],secondary:['triceps']}));await new Promise(r=>setTimeout(r,20));});const fallback=host.querySelector('[data-muscle-model-fallback]');await act(async()=>root.render(React.createElement(MuscleModel3D,{primary:['chest'],secondary:['triceps']})));expect(host.querySelector('[data-muscle-model-fallback]')).toBe(fallback);});
});
