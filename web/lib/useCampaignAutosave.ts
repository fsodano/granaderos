'use client';
import { useEffect, useRef } from 'react';
import { encodeSave } from '../../game/save.js';
import { createCampaignAutosave } from './campaign-autosave.js';
import { BrowserSaveWriter } from './browser-save-writer.ts';
import type { SaveStatus } from '../../game/application/get-save-status/get-save-status.repository.ts';
import saveWorkerUrl from './campaign-save-worker.ts?worker&url';

export function useCampaignAutosave(
  campaign: any,
  battle: any,
  key: (campaign: any) => string,
  onSaved: () => void,
  onError: (error: Error) => void,
  onStatus: (status: SaveStatus) => void = () => {},
) {
  const queue = useRef<ReturnType<typeof createCampaignAutosave> | null>(null);
  const callbacks = useRef({ key, onSaved, onError, onStatus });
  callbacks.current = { key, onSaved, onError, onStatus };
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(saveWorkerUrl, { type: 'module' });
    } catch {}
    const writer = new BrowserSaveWriter(window.navigator.locks, (key, text) =>
      localStorage.setItem(key, text),
    );
    const saver = createCampaignAutosave({
      worker,
      writer,
      encode: encodeSave,
      write: undefined,
      onSaved: () => callbacks.current.onSaved(),
      onError: (error: Error) => callbacks.current.onError(error),
      onStatus: (status: SaveStatus) => callbacks.current.onStatus(status),
    });
    queue.current = saver;
    const flush = () => saver.flush();
    const hide = () => {
      if (document.hidden) flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('focus', flush);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('focus', flush);
      document.removeEventListener('visibilitychange', hide);
      saver.flush();
      saver.close();
      if (queue.current === saver) queue.current = null;
    };
  }, []);
  useEffect(() => {
    queue.current?.submit(campaign, battle, callbacks.current.key(campaign));
  }, [campaign, battle]);
  return () => queue.current?.flush();
}
