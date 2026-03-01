import { useState, useRef, useEffect } from 'react';
import MetadataEditor from '../components/MetadataEditor';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';

function Home() {
  const { t, locale, changeLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [sidecarUrl, setSidecarUrl] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [metadataEdits, setMetadataEdits] = useState(null);
  const [polling, setPolling] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [artworkFile, setArtworkFile] = useState(null);
  const [formats, setFormats] = useState({});
  const [currentFormat, setCurrentFormat] = useState(null);
  const [formData, setFormData] = useState({
    format: 'mp3',
    codec: '',
    sampleRate: '',
    bitrate: '',
    bitDepth: '',
    channels: '',
    compression: '',
    normalize: false
  });
  const audioRef = useRef();

  // Load available formats on mount
  useEffect(() => {
    fetchFormats();
  }, []);

  // Update format-specific defaults when format changes
  useEffect(() => {
    if (formats[formData.format]) {
      const fmt = formats[formData.format];
      const newFormData = { ...formData };
      
      // Set default values for this format
      if (fmt.options.codec) {
        newFormData.codec = fmt.codec;
      }
      if (fmt.options.bitrate) {
        newFormData.bitrate = String(fmt.options.bitrate.default || '');
      }
      if (fmt.options.bitDepth) {
        newFormData.bitDepth = String(fmt.options.bitDepth.default || '');
      }
      if (fmt.options.sampleRate) {
        newFormData.sampleRate = String(fmt.options.sampleRate.default || '');
      }
      if (fmt.options.channels) {
        newFormData.channels = String(fmt.options.channels.default || '2');
      }
      if (fmt.options.compression) {
        newFormData.compression = String(fmt.options.compression.default || '');
      }
      
      setFormData(newFormData);
      setCurrentFormat(fmt);
    }
  }, [formData.format, formats]);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  async function fetchFormats() {
    try {
      const res = await fetch(`${API_BASE}/api/formats`);
      const data = await res.json();
      setFormats(data.formats);
      setFormData(prev => ({ ...prev, format: 'mp3' }));
    } catch (err) {
      console.error('Failed to load formats:', err);
    }
  }

  function detectFormatFromCodec(codecName) {
    if (!codecName) return 'mp3';
    const lower = codecName.toLowerCase();
    if (lower.includes('mp3') || lower.includes('libmp3')) return 'mp3';
    if (lower.includes('aac')) return 'aac';
    if (lower.includes('flac')) return 'flac';
    if (lower.includes('vorbis')) return 'ogg';
    if (lower.includes('opus')) return 'opus';
    if (lower.includes('alac')) return 'alac';
    if (lower.includes('aiff')) return 'aiff';
    if (lower.includes('wma')) return 'wma';
    if (lower.includes('pcm')) return 'wav';
    return 'mp3';
  }

  async function analyzeFile(e) {
    e.preventDefault();
    if (!file) return;
    setAnalyzing(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/probe`, {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      setMetadata(data.metadata || null);

      // Initialize metadata edits structure from probe (global tags + per-stream tags)
      if (data.metadata) {
        const meta = data.metadata;
        const edits = { global: meta.format?.tags ? { ...meta.format.tags } : {}, streams: {} };
        (meta.streams || []).forEach((s, idx) => {
          edits.streams[idx] = s.tags ? { ...s.tags } : {};
        });
        setMetadataEdits(edits);
      } else {
        setMetadataEdits({ global: {}, streams: {} });
      }
      
      // Auto-populate form fields from metadata
      if (data.metadata) {
        const meta = data.metadata;
        const stream = meta.streams && meta.streams[0];
        const fmt = meta.format;
        
        const detectedFormat = detectFormatFromCodec(stream?.codec_name);
        
        setFormData(prev => ({
          ...prev,
          format: detectedFormat,
          sampleRate: stream?.sample_rate ? String(stream.sample_rate) : '',
          channels: stream?.channels ? String(stream.channels) : '2',
          bitrate: fmt?.bit_rate ? `${Math.round(Number(fmt.bit_rate)/1000)}` : ''
        }));
      }
    } catch (err) {
      console.error('Probe failed:', err);
      setMetadata(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('format', formData.format);
    form.append('codec', formData.codec);
    form.append('sampleRate', formData.sampleRate);
    form.append('bitrate', formData.bitrate);
    form.append('bitDepth', formData.bitDepth);
    form.append('channels', formData.channels);
    form.append('compression', formData.compression);
    form.append('normalize', formData.normalize ? 'true' : 'false');
    // Attach artwork and metadata edits when present
    if (artworkFile) {
      form.append('artwork', artworkFile);
    }
    if (metadataEdits) {
      try {
        form.append('metadata', JSON.stringify(metadataEdits));
      } catch (err) {
        console.warn('Failed to serialize metadata edits', err);
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/convert`, {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      setJobId(data.id);
      setStatus('queued');
      setDownloadUrl(null);
      setSidecarUrl(null);
      startPolling(data.id);
    } catch (err) {
      console.error('Conversion failed:', err);
      setStatus('error');
    }
  }

  function startPolling(id) {
    setPolling(true);
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/status/${id}`);
        if (!r.ok) return;
        const j = await r.json();
        setStatus(j.status);
        if (j.status === 'done') {
          clearInterval(iv);
          setPolling(false);
          setDownloadUrl(`${API_BASE}/api/download/${id}`);
          if (j.hasSidecar) {
            setSidecarUrl(`${API_BASE}/api/download/${id}?type=sidecar`);
          }
        }
        if (j.status === 'error') {
          clearInterval(iv);
          setPolling(false);
        }
      } catch (e) {
        console.error('Status check failed:', e);
      }
    }, 1000);
  }

  const fmt = currentFormat;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8 transition-colors">
      <div className="max-w-4xl mx-auto">
        {/* Header with Theme Toggle and Language Selector */}
        <div className="flex justify-between items-center mb-6">
          <div></div>
          <div className="flex gap-4">
            {/* Language Selector */}
            <select
              value={locale}
              onChange={(e) => changeLocale(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="bg">Български</option>
            </select>
            
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              title={t('themeToggle')}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 transition-colors">
          <h1 className="text-4xl font-bold mb-2 text-gray-800 dark:text-white">🎵 {t('header')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{t('subtitle')}</p>

          <form onSubmit={upload} className="space-y-6">
            {/* File Upload Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 p-6 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-500 transition-colors">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">📁 {t('selectFile')}</label>
              <input 
                type="file" 
                accept="audio/*" 
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full px-3 py-2 dark:bg-gray-600 dark:text-white dark:file:text-white dark:file:bg-indigo-600 accent-indigo-600"
              />
              <div className="mt-3">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">🖼 {t('selectCoverArt')}</label>
                <input type="file" accept="image/*" onChange={(e)=>setArtworkFile(e.target.files[0])} className="w-full px-3 py-2 dark:bg-gray-600 dark:text-white dark:file:text-white dark:file:bg-indigo-600 accent-indigo-600" />
                {artworkFile && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t('selectedArtwork', { name: artworkFile.name })}</p>}
              </div>
              {file && <p className="text-sm text-green-600 dark:text-green-400 mt-2">✓ {t('selected', { name: file.name })}</p>}
            </div>

            {/* Analyze Button */}
            <button 
              type="button" 
              onClick={analyzeFile} 
              disabled={!file || analyzing}
              className="w-full px-6 py-3 bg-indigo-600 dark:bg-indigo-700 text-white font-semibold rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {analyzing ? `⏳ ${t('analyzing')}` : `📊 ${t('analyzeButton')}`}
            </button>

            {/* Metadata Display */}
            {metadata && (
              <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-25 p-6 rounded-lg border-l-4 border-blue-500 dark:border-blue-400 transition-colors">
                <h3 className="font-semibold text-blue-900 dark:text-blue-400 mb-3">📊 {t('originalFile')}</h3>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('format')}</p>

                    <p className="font-medium text-gray-900 dark:text-white">{metadata.format?.format_name || t('unknown')}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('duration')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {metadata.format?.duration 
                        ? `${Number(metadata.format.duration).toFixed(2)}s` 
                        : t('na')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('bitRate')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {metadata.format?.bit_rate 
                        ? `${Math.round(Number(metadata.format.bit_rate)/1000)} kbps` 
                        : t('na')}
                    </p>
                  </div>
                  {metadata.streams?.[0] && (
                    <>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">{t('codec')}</p>
                        <p className="font-medium text-gray-900 dark:text-white">{metadata.streams[0].codec_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">{t('sampleRate')}</p>
                        <p className="font-medium text-gray-900 dark:text-white">{metadata.streams[0].sample_rate || t('na')} Hz</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">{t('channels_label')}</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {metadata.streams[0].channels === 1 
                            ? t('mono')
                            : metadata.streams[0].channels === 2 
                            ? t('stereo')
                            : metadata.streams[0].channels}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Metadata Editor */}
            <div className="mt-4">
              <MetadataEditor value={metadataEdits} onChange={setMetadataEdits} />
            </div>

            {/* Format Selection */}
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">🎯 {t('outputFormat')}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(formats).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, format: key }))}
                    className={`p-4 rounded-lg border-2 transition text-left ${
                      formData.format === key
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900 dark:bg-opacity-30'
                        : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 hover:border-indigo-400 dark:hover:border-indigo-400'
                    }`}
                  >
                    <div className="font-semibold text-gray-900 dark:text-white">{config.name}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t(`desc_${key}`)}</div>
                    <div className="flex gap-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        config.type === 'lossy' 
                          ? 'bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-40 text-yellow-800 dark:text-yellow-200' 
                          : 'bg-green-100 dark:bg-green-900 dark:bg-opacity-40 text-green-800 dark:text-green-200'
                      }`}>
                        {config.type === 'lossy' ? `📉 ${t('lossy')}` : `✓ ${t('lossless')}`}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 dark:bg-opacity-40 text-blue-800 dark:text-blue-200">
                        {t(`quality_${config.quality.replace(/\s+/g,'_').toLowerCase()}`)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Format-Specific Options */}
            {fmt && (
              <div className="bg-indigo-50 dark:bg-indigo-900 dark:bg-opacity-25 p-6 rounded-lg border-l-4 border-indigo-500 dark:border-indigo-400 transition-colors">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">⚙️ {t('conversionOptions')}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bitrate (for lossy formats) */}
                  {fmt.options.bitrate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {fmt.options.bitrate.label}
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({fmt.options.bitrate.unit})</span>
                      </label>
                      <select
                        value={formData.bitrate}
                        onChange={(e) => setFormData(prev => ({ ...prev, bitrate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-lg dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">{t('auto')}</option>
                        {fmt.options.bitrate.values.map(br => (
                          <option key={br} value={br}>{br} {fmt.options.bitrate.unit}</option>
                        ))}
                      </select>
                      {fmt.options.bitrate.help && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t('higherValuesHelp')}</p>
                      )}
                    </div>
                  )}

                  {/* Bit Depth (for lossless formats) */}
                  {fmt.options.bitDepth && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {fmt.options.bitDepth.label}
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({fmt.options.bitDepth.unit})</span>
                      </label>
                      <select
                        value={formData.bitDepth}
                        onChange={(e) => setFormData(prev => ({ ...prev, bitDepth: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-lg dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">{t('auto')}</option>
                        {fmt.options.bitDepth.values.map(bd => (
                          <option key={bd} value={bd}>{bd} {fmt.options.bitDepth.unit}</option>
                        ))}
                      </select>
                      {fmt.options.bitDepth.help && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">💡 {fmt.options.bitDepth.help}</p>
                      )}
                    </div>
                  )}

                  {/* Sample Rate */}
                  {fmt.options.sampleRate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {fmt.options.sampleRate.label}
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({fmt.options.sampleRate.unit})</span>
                      </label>
                      <select
                        value={formData.sampleRate}
                        onChange={(e) => setFormData(prev => ({ ...prev, sampleRate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-lg dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">{t('auto')}</option>
                        {fmt.options.sampleRate.values.map(sr => (
                          <option key={sr} value={sr}>{sr} {fmt.options.sampleRate.unit}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Channels */}
                  {fmt.options.channels && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {fmt.options.channels.label}
                      </label>
                      <select
                        value={formData.channels}
                        onChange={(e) => setFormData(prev => ({ ...prev, channels: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-lg dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">{t('auto')}</option>
                        {fmt.options.channels.values.map(ch => (
                          <option key={ch.value} value={ch.value}>{ch.value === 1 ? t('mono') : ch.value === 2 ? t('stereo') : ch.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Compression Level (for FLAC) */}
                  {fmt.options.compression && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {fmt.options.compression.label}
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({fmt.options.compression.unit})</span>
                      </label>
                      <select
                        value={formData.compression}
                        onChange={(e) => setFormData(prev => ({ ...prev, compression: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-lg dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">{t('autoDefault')}</option>
                        {fmt.options.compression.values.map(comp => (
                          <option key={comp} value={comp}>Level {comp}</option>
                        ))}
                      </select>
                      {fmt.options.compression.help && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">💡 {fmt.options.compression.help}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Normalize Checkbox */}
                <div className="mt-4 flex items-center">
                  <input
                    type="checkbox"
                    id="normalize"
                    checked={formData.normalize}
                    onChange={(e) => setFormData(prev => ({ ...prev, normalize: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <label htmlFor="normalize" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    🔊 Normalize Audio (EBU R128 loudness normalization)
                  </label>
                </div>
              </div>
            )}

            {/* Convert Button */}
            <button
              type="submit"
              className="w-full px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition text-lg"
            >
              🚀 Convert Now
            </button>
          </form>

          {/* Status and Download */}
          {(status || downloadUrl) && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">📈 Conversion Status</h3>
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
                <div className="flex items-center gap-3">
                  {polling && <div className="animate-spin">⏳</div>}
                  <p className="text-lg text-gray-900 dark:text-white">
                    <strong className="text-gray-800 dark:text-gray-300">Status:</strong>{' '}
                    <span className="capitalize text-indigo-600 dark:text-indigo-300">{status || 'idle'}</span>
                  </p>
                </div>

                {downloadUrl && (
                  <div className="mt-6 space-y-4">
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = downloadUrl;
                        link.download = `audio-converted.${formData.format}`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition text-lg"
                    >
                      ⬇️ Download Converted File
                    </button>
                    {sidecarUrl && (
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = sidecarUrl;
                          // preserve extension from URL
                          const extMatch = sidecarUrl.match(/\.(jpg|jpeg|png)$/i);
                          const ext = extMatch ? extMatch[0] : '';
                          link.download = `artwork${ext}`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="w-full px-6 py-3 bg-yellow-600 text-white font-bold rounded-lg hover:bg-yellow-700 transition text-lg"
                      >
                        🖼 Download Artwork
                      </button>
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      ⏰ File available for 5 minutes. You can download multiple times if needed.
                    </p>
                    <div className="bg-white dark:bg-gray-700 p-4 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">🎧 Preview:</p>
                      <audio ref={audioRef} controls src={downloadUrl} className="w-full" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-600 dark:text-gray-400">
          <p className="text-sm">{t('supports')}</p>
        </div>
      </div>
    </div>
  );
}

export default Home;
