/**
 * Comprehensive audio format configuration
 * Defines supported formats, codecs, and options for conversion
 */

export const formatConfig = {
  mp3: {
    name: 'MP3',
    extension: 'mp3',
    mimeType: 'audio/mpeg',
    codec: 'libmp3lame',
    type: 'lossy',
    quality: 'Good',
    description: 'Popular lossy format, widely supported',
    options: {
      bitrate: {
        type: 'select',
        label: 'Bitrate',
        unit: 'kbps',
        values: [64, 96, 128, 160, 192, 224, 256, 320],
        default: 192,
        help: 'Higher values = better quality'
      },
      sampleRate: {
        type: 'select',
        label: 'Sample Rate',
        unit: 'Hz',
        values: [8000, 16000, 22050, 32000, 44100, 48000, 96000],
        default: 44100
      },
      channels: {
        type: 'select',
        label: 'Channels',
        values: [
          { value: 1, label: 'Mono' },
          { value: 2, label: 'Stereo' }
        ],
        default: 2
      }
    }
  },

  aac: {
    name: 'AAC (M4A)',
    extension: 'm4a',
    mimeType: 'audio/mp4',
    codec: 'aac',
    type: 'lossy',
    quality: 'Very Good',
    description: 'Superior quality to MP3, used in iTunes and Apple devices',
    options: {
      bitrate: {
        type: 'select',
        label: 'Bitrate',
        unit: 'kbps',
        values: [64, 96, 128, 160, 192, 224, 256, 320],
        default: 192,
        help: 'AAC achieves better quality at lower bitrates than MP3'
      },
      sampleRate: {
        type: 'select',
        label: 'Sample Rate',
        unit: 'Hz',
        values: [8000, 16000, 22050, 32000, 44100, 48000, 96000],
        default: 44100
      },
      channels: {
        type: 'select',
        label: 'Channels',
        values: [
          { value: 1, label: 'Mono' },
          { value: 2, label: 'Stereo' }
        ],
        default: 2
      }
    }
  },

  wav: {
    name: 'WAV',
    extension: 'wav',
    mimeType: 'audio/wav',
    codec: 'pcm_s16le',
    type: 'lossless',
    quality: 'Lossless',
    description: 'Uncompressed lossless format - large file size',
    options: {
      bitDepth: {
        type: 'select',
        label: 'Bit Depth',
        unit: 'bit',
        values: [16, 24, 32],
        default: 16,
        help: '16-bit is CD quality, 24-bit for studio quality'
      },
      sampleRate: {
        type: 'select',
        label: 'Sample Rate',
        unit: 'Hz',
        values: [8000, 16000, 22050, 32000, 44100, 48000, 96000, 192000],
        default: 44100
      },
      channels: {
        type: 'select',
        label: 'Channels',
        values: [
          { value: 1, label: 'Mono' },
          { value: 2, label: 'Stereo' }
        ],
        default: 2
      }
    }
  },

  flac: {
    name: 'FLAC',
    extension: 'flac',
    mimeType: 'audio/flac',
    codec: 'flac',
    type: 'lossless',
    quality: 'Lossless',
    description: 'Compressed lossless format - good compromise between size and quality',
    options: {
      bitDepth: {
        type: 'select',
        label: 'Bit Depth',
        unit: 'bit',
        values: [16, 24, 32],
        default: 16,
        help: 'FLAC supports up to 32-bit'
      },
      sampleRate: {
        type: 'select',
        label: 'Sample Rate',
        unit: 'Hz',
        values: [8000, 16000, 22050, 32000, 44100, 48000, 96000, 192000],
        default: 44100
      },
      channels: {
        type: 'select',
        label: 'Channels',
        values: [
          { value: 1, label: 'Mono' },
          { value: 2, label: 'Stereo' }
        ],
        default: 2
      },
      compression: {
        type: 'select',
        label: 'Compression Level',
        unit: 'level',
        values: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        default: 5,
        help: 'Higher = better compression but slower'
      }
    }
  },

  ogg: {
    name: 'OGG Vorbis',
    extension: 'ogg',
    mimeType: 'audio/ogg',
    codec: 'libvorbis',
    type: 'lossy',
    quality: 'Very Good',
    description: 'Open-source lossy format, better quality than MP3',
    options: {
      bitrate: {
        type: 'select',
        label: 'Bitrate',
        unit: 'kbps',
        values: [64, 96, 128, 160, 192, 224, 256, 320],
        default: 192,
        help: 'Vorbis provides excellent quality at all bitrates'
      },
      sampleRate: {
        type: 'select',
        label: 'Sample Rate',
        unit: 'Hz',
        values: [8000, 16000, 22050, 32000, 44100, 48000, 96000],
        default: 44100
      },
      channels: {
        type: 'select',
        label: 'Channels',
        values: [
          { value: 1, label: 'Mono' },
          { value: 2, label: 'Stereo' }
        ],
        default: 2
      }
    }
  },

  opus: {
    name: 'Opus',
    extension: 'opus',
    mimeType: 'audio/opus',
    codec: 'libopus',
    type: 'lossy',
    quality: 'Excellent',
    description: 'Modern codec with excellent quality-to-size ratio',
    options: {
      bitrate: {
        type: 'select',
        label: 'Bitrate',
        unit: 'kbps',
        values: [32, 48, 64, 96, 128, 160, 192, 256],
        default: 128,
        help: 'Opus is extremely efficient at low bitrates'
      },
      sampleRate: {
        type: 'select',
        label: 'Sample Rate',
        unit: 'Hz',
        values: [8000, 16000, 22050, 32000, 44100, 48000],
        default: 48000
      },
      channels: {
        type: 'select',
        label: 'Channels',
        values: [
          { value: 1, label: 'Mono' },
          { value: 2, label: 'Stereo' }
        ],
        default: 2
      }
    }
  },

  alac: {
    name: 'ALAC',
    extension: 'm4a',
    mimeType: 'audio/mp4',
    codec: 'alac',
    type: 'lossless',
    quality: 'Lossless',
    description: 'Apple Lossless Audio Codec - lossless with compression',
    options: {
      bitDepth: {
        type: 'select',
        label: 'Bit Depth',
        unit: 'bit',
        values: [16, 24],
        default: 16
      },
      sampleRate: {
        type: 'select',
        label: 'Sample Rate',
        unit: 'Hz',
        values: [8000, 16000, 22050, 32000, 44100, 48000, 96000, 192000],
        default: 44100
      },
      channels: {
        type: 'select',
        label: 'Channels',
        values: [
          { value: 1, label: 'Mono' },
          { value: 2, label: 'Stereo' }
        ],
        default: 2
      }
    }
  },

  aiff: {
    name: 'AIFF',
    extension: 'aiff',
    mimeType: 'audio/aiff',
    codec: 'pcm_s16be',
    type: 'lossless',
    quality: 'Lossless',
    description: 'Uncompressed lossless format used in professional audio',
    options: {
      bitDepth: {
        type: 'select',
        label: 'Bit Depth',
        unit: 'bit',
        values: [16, 24, 32],
        default: 16
      },
      sampleRate: {
        type: 'select',
        label: 'Sample Rate',
        unit: 'Hz',
        values: [8000, 16000, 22050, 32000, 44100, 48000, 96000, 192000],
        default: 44100
      },
      channels: {
        type: 'select',
        label: 'Channels',
        values: [
          { value: 1, label: 'Mono' },
          { value: 2, label: 'Stereo' }
        ],
        default: 2
      }
    }
  },

  wma: {
    name: 'WMA',
    extension: 'wma',
    mimeType: 'audio/x-ms-wma',
    codec: 'wmav2',
    type: 'lossy',
    quality: 'Good',
    description: 'Windows Media Audio format',
    options: {
      bitrate: {
        type: 'select',
        label: 'Bitrate',
        unit: 'kbps',
        values: [64, 96, 128, 160, 192, 256, 320],
        default: 192
      },
      sampleRate: {
        type: 'select',
        label: 'Sample Rate',
        unit: 'Hz',
        values: [8000, 16000, 22050, 32000, 44100, 48000],
        default: 44100
      },
      channels: {
        type: 'select',
        label: 'Channels',
        values: [
          { value: 1, label: 'Mono' },
          { value: 2, label: 'Stereo' }
        ],
        default: 2
      }
    }
  }
};

// Validation rules for incompatible settings
export const validationRules = {
  bitrate: {
    validate: (value) => /^\d+k?$/.test(String(value)),
    message: 'Bitrate must be a number (e.g., 192 or 192k)'
  },
  bitDepth: {
    validate: (value) => [16, 24, 32].includes(Number(value)),
    message: 'Bit depth must be 16, 24, or 32'
  },
  sampleRate: {
    validate: (value) => [8000, 16000, 22050, 32000, 44100, 48000, 96000, 192000].includes(Number(value)),
    message: 'Invalid sample rate'
  },
  channels: {
    validate: (value) => [1, 2].includes(Number(value)),
    message: 'Channels must be 1 (Mono) or 2 (Stereo)'
  },
  compression: {
    validate: (value) => Number(value) >= 0 && Number(value) <= 8,
    message: 'Compression level must be 0-8'
  }
};

export const SUPPORTED_FORMATS = Object.keys(formatConfig);
