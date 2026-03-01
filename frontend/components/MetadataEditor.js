import { useState, useEffect } from 'react';
import { useI18n } from '../context/I18nContext';

export default function MetadataEditor({ value, onChange }) {
  const { t } = useI18n();
  const [globalTags, setGlobalTags] = useState({});
  const [streamTags, setStreamTags] = useState({});

  useEffect(() => {
    if (!value) {
      setGlobalTags({});
      setStreamTags({});
      return;
    }
    setGlobalTags(value.global || {});
    setStreamTags(value.streams || {});
  }, [value]);

  function updateGlobalKey(oldKey, newKey, newVal) {
    const clone = { ...globalTags };
    if (oldKey && oldKey !== newKey) delete clone[oldKey];
    if (newKey) clone[newKey] = newVal;
    setGlobalTags(clone);
    onChange?.({ global: clone, streams: streamTags });
  }

  function updateStreamTag(streamIdx, oldKey, newKey, newVal) {
    const sClone = { ...streamTags };
    sClone[streamIdx] = { ...(sClone[streamIdx] || {}) };
    if (oldKey && oldKey !== newKey) delete sClone[streamIdx][oldKey];
    if (newKey) sClone[streamIdx][newKey] = newVal;
    setStreamTags(sClone);
    onChange?.({ global: globalTags, streams: sClone });
  }

  function addGlobal() {
    const k = `new_${Date.now()}`;
    const clone = { ...globalTags, [k]: '' };
    setGlobalTags(clone);
    onChange?.({ global: clone, streams: streamTags });
  }

  function removeGlobalKey(key) {
    const clone = { ...globalTags };
    delete clone[key];
    setGlobalTags(clone);
    onChange?.({ global: clone, streams: streamTags });
  }

  function addStreamKey(idx) {
    const sClone = { ...streamTags };
    sClone[idx] = { ...(sClone[idx] || {}), [`new_${Date.now()}`]: '' };
    setStreamTags(sClone);
    onChange?.({ global: globalTags, streams: sClone });
  }

  function removeStreamKey(idx, key) {
    const sClone = { ...streamTags };
    if (!sClone[idx]) return;
    delete sClone[idx][key];
    setStreamTags(sClone);
    onChange?.({ global: globalTags, streams: sClone });
  }

  return (
    <div className="bg-white dark:bg-gray-700 p-4 rounded border border-gray-300 dark:border-gray-600 transition-colors">
      <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">✏️ {t('metadataEditor')}</h4>
      <div className="mb-3">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('globalTags')}</div>
        {Object.entries(globalTags).map(([k, v]) => (
          <div key={k} className="flex gap-2 mb-2 items-center">
            <input className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-500 dark:bg-gray-600 dark:text-white rounded" value={k} onChange={(e)=>updateGlobalKey(k, e.target.value, globalTags[k])} placeholder={t('key')} />
            <input className="flex-2 px-2 py-1 border border-gray-300 dark:border-gray-500 dark:bg-gray-600 dark:text-white rounded" value={v||''} onChange={(e)=>updateGlobalKey(k, k, e.target.value)} placeholder={t('value')} />
            <button type="button" onClick={()=>removeGlobalKey(k)} className="text-sm text-red-600 dark:text-red-400 hover:underline">{t('removeTag')}</button>
          </div>
        ))}
        <button type="button" onClick={addGlobal} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">+ {t('addTag')}</button>
      </div>

      <div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('streamTags', { index: '' })}</div>
        {Object.entries(streamTags).length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{t('noStreamTags')}</p>}
        {Object.entries(streamTags).map(([idx, tags]) => (
          <div key={idx} className="mb-3 p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-600 rounded transition-colors">
            <div className="text-xs text-gray-700 dark:text-gray-300 font-medium mb-2">{t('streamTags', { index: idx })}</div>
            {Object.entries(tags || {}).map(([k, v]) => (
              <div key={k} className="flex gap-2 mb-2 items-center">
                <input className="px-2 py-1 border border-gray-300 dark:border-gray-500 dark:bg-gray-600 dark:text-white rounded" value={k} onChange={(e)=>updateStreamTag(idx, k, e.target.value, tags[k])} placeholder={t('key')} />
                <input className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-500 dark:bg-gray-600 dark:text-white rounded" value={v||''} onChange={(e)=>updateStreamTag(idx, k, k, e.target.value)} placeholder={t('value')} />
                <button type="button" onClick={()=>removeStreamKey(idx, k)} className="text-sm text-red-600 dark:text-red-400 hover:underline">{t('removeTag')}</button>
              </div>
            ))}
            <button type="button" onClick={()=>addStreamKey(idx)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">+ {t('addTag')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
