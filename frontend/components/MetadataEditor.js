import { useState, useEffect } from 'react';

export default function MetadataEditor({ value, onChange }) {
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
    <div className="bg-white p-4 rounded border">
      <h4 className="font-semibold mb-2">✏️ Metadata Editor</h4>
      <div className="mb-3">
        <div className="text-sm text-gray-600 mb-1">Global Tags</div>
        {Object.entries(globalTags).map(([k, v]) => (
          <div key={k} className="flex gap-2 mb-2 items-center">
            <input className="flex-1 px-2 py-1 border" value={k} onChange={(e)=>updateGlobalKey(k, e.target.value, globalTags[k])} />
            <input className="flex-2 px-2 py-1 border" value={v||''} onChange={(e)=>updateGlobalKey(k, k, e.target.value)} />
            <button type="button" onClick={()=>removeGlobalKey(k)} className="text-sm text-red-600">Remove</button>
          </div>
        ))}
        <button type="button" onClick={addGlobal} className="text-sm text-indigo-600">+ Add global tag</button>
      </div>

      <div>
        <div className="text-sm text-gray-600 mb-1">Stream Tags</div>
        {Object.entries(streamTags).length === 0 && <p className="text-xs text-gray-500">No stream tags.</p>}
        {Object.entries(streamTags).map(([idx, tags]) => (
          <div key={idx} className="mb-3 p-2 border rounded">
            <div className="text-xs text-gray-700 font-medium mb-2">Stream {idx}</div>
            {Object.entries(tags || {}).map(([k, v]) => (
              <div key={k} className="flex gap-2 mb-2 items-center">
                <input className="px-2 py-1 border" value={k} onChange={(e)=>updateStreamTag(idx, k, e.target.value, tags[k])} />
                <input className="flex-1 px-2 py-1 border" value={v||''} onChange={(e)=>updateStreamTag(idx, k, k, e.target.value)} />
                <button type="button" onClick={()=>removeStreamKey(idx, k)} className="text-sm text-red-600">Remove</button>
              </div>
            ))}
            <button type="button" onClick={()=>addStreamKey(idx)} className="text-sm text-indigo-600">+ Add stream tag</button>
          </div>
        ))}
      </div>
    </div>
  );
}
