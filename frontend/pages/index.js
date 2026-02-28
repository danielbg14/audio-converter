import { useState, useRef, useEffect } from 'react';
import MetadataEditor from '../components/MetadataEditor';

export default function Home() {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-800">🎵 Audio Converter</h1>
          <p className="text-gray-600 mb-6">Convert your audio to any format with full control over quality settings</p>

          <form onSubmit={upload} className="space-y-6">
            {/* File Upload Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-dashed border-blue-300">
              <label className="block text-sm font-semibold text-gray-700 mb-2">📁 Select Audio File</label>
              <input 
                type="file" 
                accept="audio/*" 
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full"
              />
              <div className="mt-3">
                <label className="block text-sm font-semibold text-gray-700 mb-1">🖼 Optional Cover Art</label>
                <input type="file" accept="image/*" onChange={(e)=>setArtworkFile(e.target.files[0])} />
                {artworkFile && <p className="text-xs text-gray-600 mt-1">Selected artwork: {artworkFile.name}</p>}
              </div>
              {file && <p className="text-sm text-green-600 mt-2">✓ Selected: {file.name}</p>}
            </div>

            {/* Analyze Button */}
            <button 
              type="button" 
              onClick={analyzeFile} 
              disabled={!file || analyzing}
              className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {analyzing ? '⏳ Analyzing...' : '📊 Analyze File'}
            </button>

            {/* Metadata Display */}
            {metadata && (
              <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-500">
                <h3 className="font-semibold text-blue-900 mb-3">📊 Original File Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Format</p>
                    <p className="font-medium">{metadata.format?.format_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Duration</p>
                    <p className="font-medium">
                      {metadata.format?.duration 
                        ? `${Number(metadata.format.duration).toFixed(2)}s` 
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Bitrate</p>
                    <p className="font-medium">
                      {metadata.format?.bit_rate 
                        ? `${Math.round(Number(metadata.format.bit_rate)/1000)} kbps` 
                        : 'N/A'}
                    </p>
                  </div>
                  {metadata.streams?.[0] && (
                    <>
                      <div>
                        <p className="text-gray-600">Codec</p>
                        <p className="font-medium">{metadata.streams[0].codec_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Sample Rate</p>
                        <p className="font-medium">{metadata.streams[0].sample_rate || 'N/A'} Hz</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Channels</p>
                        <p className="font-medium">
                          {metadata.streams[0].channels === 1 
                            ? 'Mono' 
                            : metadata.streams[0].channels === 2 
                            ? 'Stereo' 
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
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">🎯 Output Format</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(formats).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, format: key }))}
                    className={`p-4 rounded-lg border-2 transition text-left ${
                      formData.format === key
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-300 bg-white hover:border-indigo-400'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{config.name}</div>
                    <div className="text-xs text-gray-600 mt-1">{config.description}</div>
                    <div className="flex gap-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        config.type === 'lossy' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {config.type === 'lossy' ? '📉 Lossy' : '✓ Lossless'}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                        {config.quality}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Format-Specific Options */}
            {fmt && (
              <div className="bg-indigo-50 p-6 rounded-lg border-l-4 border-indigo-500">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">⚙️ Conversion Options</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bitrate (for lossy formats) */}
                  {fmt.options.bitrate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {fmt.options.bitrate.label}
                        <span className="text-xs text-gray-500 ml-1">({fmt.options.bitrate.unit})</span>
                      </label>
                      <select
                        value={formData.bitrate}
                        onChange={(e) => setFormData(prev => ({ ...prev, bitrate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Auto</option>
                        {fmt.options.bitrate.values.map(br => (
                          <option key={br} value={br}>{br} {fmt.options.bitrate.unit}</option>
                        ))}
                      </select>
                      {fmt.options.bitrate.help && (
                        <p className="text-xs text-gray-600 mt-1">💡 {fmt.options.bitrate.help}</p>
                      )}
                    </div>
                  )}

                  {/* Bit Depth (for lossless formats) */}
                  {fmt.options.bitDepth && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {fmt.options.bitDepth.label}
                        <span className="text-xs text-gray-500 ml-1">({fmt.options.bitDepth.unit})</span>
                      </label>
                      <select
                        value={formData.bitDepth}
                        onChange={(e) => setFormData(prev => ({ ...prev, bitDepth: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Auto</option>
                        {fmt.options.bitDepth.values.map(bd => (
                          <option key={bd} value={bd}>{bd} {fmt.options.bitDepth.unit}</option>
                        ))}
                      </select>
                      {fmt.options.bitDepth.help && (
                        <p className="text-xs text-gray-600 mt-1">💡 {fmt.options.bitDepth.help}</p>
                      )}
                    </div>
                  )}

                  {/* Sample Rate */}
                  {fmt.options.sampleRate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {fmt.options.sampleRate.label}
                        <span className="text-xs text-gray-500 ml-1">({fmt.options.sampleRate.unit})</span>
                      </label>
                      <select
                        value={formData.sampleRate}
                        onChange={(e) => setFormData(prev => ({ ...prev, sampleRate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Auto</option>
                        {fmt.options.sampleRate.values.map(sr => (
                          <option key={sr} value={sr}>{sr} {fmt.options.sampleRate.unit}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Channels */}
                  {fmt.options.channels && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {fmt.options.channels.label}
                      </label>
                      <select
                        value={formData.channels}
                        onChange={(e) => setFormData(prev => ({ ...prev, channels: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Auto</option>
                        {fmt.options.channels.values.map(ch => (
                          <option key={ch.value} value={ch.value}>{ch.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Compression Level (for FLAC) */}
                  {fmt.options.compression && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {fmt.options.compression.label}
                        <span className="text-xs text-gray-500 ml-1">({fmt.options.compression.unit})</span>
                      </label>
                      <select
                        value={formData.compression}
                        onChange={(e) => setFormData(prev => ({ ...prev, compression: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Auto (default)</option>
                        {fmt.options.compression.values.map(comp => (
                          <option key={comp} value={comp}>Level {comp}</option>
                        ))}
                      </select>
                      {fmt.options.compression.help && (
                        <p className="text-xs text-gray-600 mt-1">💡 {fmt.options.compression.help}</p>
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
                  <label htmlFor="normalize" className="ml-2 text-sm font-medium text-gray-700">
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
              <h3 className="text-lg font-semibold mb-4 text-gray-800">📈 Conversion Status</h3>
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="flex items-center gap-3">
                  {polling && <div className="animate-spin">⏳</div>}
                  <p className="text-lg">
                    <strong>Status:</strong> <span className="capitalize">{status || 'idle'}</span>
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
                    <p className="text-xs text-gray-600">
                      ⏰ File available for 5 minutes. You can download multiple times if needed.
                    </p>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-sm text-gray-700 mb-2">🎧 Preview:</p>
                      <audio ref={audioRef} controls src={downloadUrl} className="w-full" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-600">
          <p className="text-sm">Supports MP3, AAC, WAV, FLAC, OGG, Opus, ALAC, AIFF, and WMA formats</p>
        </div>
      </div>
    </div>
  );
}
