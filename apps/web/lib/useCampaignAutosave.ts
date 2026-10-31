'use client';
// eslint-disable-next-line import/default -- Vite supplies this virtual worker URL; native URL workers break the static export.
import saveWorkerUrl from './campaign-save-worker.ts?worker&url';

import type { CampaignSnapshot } from '../../../packages/game/public/campaign-types.ts';
import type { BattleSnapshot } from '../../../packages/game/public/compatibility-types.ts';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { encodeSave } from '../../../packages/game/save.ts';
import { createCampaignAutosave } from './campaign-autosave.ts';
import { BrowserSaveWriter } from './browser-save-writer.ts';
import type { SaveStatus } from '../../../packages/game/application/get-save-status/get-save-status.repository.ts';

export function useCampaignAutosave(
  campaign: CampaignSnapshot | null,
  battle: BattleSnapshot | null,
  key: (campaign: CampaignSnapshot) => string,
  onSaved: () => void,
  onError: (error: Error) => void,
  onStatus: (status: SaveStatus) => void = () => {},
) {
  const queue = useRef<ReturnType<typeof createCampaignAutosave> | null>(null);
  const callbacks = useRef({ key, onSaved, onError, onStatus });
  useLayoutEffect(() => {
    callbacks.current = { key, onSaved, onError, onStatus };
  }, [key, onSaved, onError, onStatus]);
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
      onSaved: () => callbacks.current.onSaved(),
      onError: (error: Error) => callbacks.current.onError(error),
      onStatus: (status: SaveStatus) => callbacks.current.onStatus(status),
    });
    queue.current = saver;
    const flush = () => saver.flush();
    const hide = () => {
      if (document.hidden) {
        flush();
      }
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
      if (queue.current === saver) {
        queue.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (campaign) {
      queue.current?.submit(campaign, battle, callbacks.current.key(campaign));
    }
  }, [campaign, battle]);
  return () => queue.current?.flush();
}
