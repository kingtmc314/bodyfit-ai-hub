// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({ instances: [] as any[], factory: vi.fn() }));
vi.mock('youtube-player', () => ({ default: mocked.factory }));
import OfficialExerciseVideo, { officialVideoError, officialVideoFrameUrl } from '../client/src/components/OfficialExerciseVideo';
let root: Root; let host: HTMLDivElement;
const sourceUrl = 'https://www.youtube.com/watch?v=abcdefghijk';
const render = async (id = 'abcdefghijk') => { await act(async () => root.render(React.createElement(OfficialExerciseVideo, { videoId: id, exerciseName: 'Chest Press Machine', sourceUrl }))); };
const button = (text: string) => Array.from(host.querySelectorAll('button')).find(node => node.textContent?.includes(text))!;
const activate = async () => { await act(async () => button('開啟官方影片').click()); };
const ready = async () => { await act(async () => mocked.instances.at(-1).events.ready({})); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  mocked.instances.length = 0;
  mocked.factory.mockReset().mockImplementation((frame: HTMLIFrameElement) => {
    const events: Record<string, (event: any) => void> = {};
    const api = { frame, events, on: vi.fn((name, callback) => { events[name] = callback; }),
      playVideo: vi.fn(async () => events.stateChange?.({ data: 1 })),
      pauseVideo: vi.fn(async () => events.stateChange?.({ data: 2 })),
      destroy: vi.fn(async () => {}),
      getAvailablePlaybackRates: vi.fn(async () => [.25, .5, 1, 1.5, 2]),
      setPlaybackRate: vi.fn(async (data: number) => events.playbackRateChange?.({ data })),
    };
    mocked.instances.push(api); return api;
  });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('official inline machine demos', () => {
  it('does not contact third-party media or auto-play before explicit activation', async () => {
    await render(); expect(host.querySelector('iframe')).toBeNull(); expect(mocked.factory).not.toHaveBeenCalled();
    expect(host.textContent).toContain('不自動播放'); expect(host.querySelector('a')?.href).toBe(sourceUrl);
  });
  it('uses a nocookie fixed-origin frame, identification referrer and inline non-autoplay options', async () => {
    await render(); await activate(); const frame = host.querySelector('iframe')!; const url = new URL(frame.src);
    expect(url.origin).toBe('https://www.youtube-nocookie.com'); expect(url.pathname).toBe('/embed/abcdefghijk');
    expect(url.searchParams.get('origin')).toBe(window.location.origin); expect(url.searchParams.get('autoplay')).toBe('0');
    expect(url.searchParams.get('playsinline')).toBe('1'); expect(frame.referrerPolicy).toBe('strict-origin-when-cross-origin');
    expect(frame.width).toBe('100%'); expect(frame.allowFullscreen).toBe(true);
    expect(mocked.instances[0].playVideo).not.toHaveBeenCalled();
  });
  it('has real play/pause and advertised half speed controls without recreating a frame', async () => {
    await render(); await activate(); await ready(); const api = mocked.instances[0]; const frame = host.querySelector('iframe');
    await act(async () => button('播放示範').click()); expect(api.playVideo).toHaveBeenCalledOnce();
    await act(async () => button('暫停示範').click()); expect(api.pauseVideo).toHaveBeenCalledOnce();
    await act(async () => { const select = host.querySelector('select')!; select.value = '0.5'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(api.setPlaybackRate).toHaveBeenCalledWith(.5); expect(host.querySelector('iframe')).toBe(frame);
    await render(); expect(mocked.factory).toHaveBeenCalledOnce();
  });
  it('exposes embed refusal and a valid official-source link instead of a blank player or wrong exercise', async () => {
    await render(); await activate(); await ready(); await act(async () => mocked.instances[0].events.error({ data: 150 }));
    expect(host.querySelector('[role=alert]')?.textContent).toContain('原作者'); expect(host.querySelector('a')?.href).toBe(sourceUrl);
    await act(async () => button('重試官方影片').click()); expect(mocked.factory).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role=alert]')).toBeNull();
  });
  it('bounds loading, then retries without reloading the app', async () => {
    vi.useFakeTimers(); await render(); await activate(); await act(async () => vi.advanceTimersByTime(20001));
    expect(host.querySelector('[role=alert]')).not.toBeNull();
    await act(async () => button('重試官方影片').click()); expect(mocked.factory).toHaveBeenCalledTimes(2);
    await ready(); await act(async () => vi.advanceTimersByTime(20001)); expect(host.querySelector('[role=alert]')).toBeNull();
  });
  it('bounds a ready player that buffers but never starts actual media', async () => {
    vi.useFakeTimers(); await render(); await activate(); await ready();
    await act(async () => mocked.instances[0].events.stateChange({ data: 3 }));
    await act(async () => vi.advanceTimersByTime(20001));
    expect(host.querySelector('[role=alert]')?.textContent).toContain('影片未能開始播放');
    expect(mocked.instances[0].pauseVideo).toHaveBeenCalled();
    expect(host.querySelector('a')?.href).toBe(sourceUrl);
  });
  it('clears buffer timeout once real playback starts', async () => {
    vi.useFakeTimers(); await render(); await activate(); await ready();
    await act(async () => mocked.instances[0].events.stateChange({ data: 3 }));
    await act(async () => vi.advanceTimersByTime(1000));
    await act(async () => mocked.instances[0].events.stateChange({ data: 1 }));
    await act(async () => vi.advanceTimersByTime(20001));
    expect(host.querySelector('[role=alert]')).toBeNull();
    expect(button('暫停示範')).toBeDefined();
  });
  it('synchronously removes iframe on unmount and destroys ready players', async () => {
    await render(); await activate(); await ready(); const api = mocked.instances[0]; const frame = host.querySelector('iframe')!;
    await act(async () => root.render(null)); expect(frame.isConnected).toBe(false); expect(api.destroy).toHaveBeenCalledOnce();
  });
  it('does not create an arbitrary URL for malformed video ids or origins', () => {
    expect(() => officialVideoFrameUrl('../attack', 'https://bodyfit-ai-hub.vercel.app')).toThrow();
    expect(() => officialVideoFrameUrl('abcdefghijk', 'javascript:alert(1)')).toThrow();
    expect(officialVideoError(153)).toContain('來源資料'); expect(officialVideoError(100)).toContain('私人影片');
  });
});
