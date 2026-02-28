# Audio Converter

A modern, production-ready audio conversion web application with FFmpeg backend and Next.js frontend. Convert between 9 popular audio formats with full metadata preservation and optional cover-art embedding.

## 🎯 Features

- **Multi-Format Support**: Convert between MP3, AAC/M4A, WAV, FLAC, OGG, Opus, ALAC, AIFF, and WMA
- **Metadata Preservation**: Automatically preserve all metadata tags from source files
- **Metadata Editor**: View, edit, and customize all audio tags directly in the UI
- **Cover Art Handling**: Upload custom cover art — embedded for supported formats; for WAV/AIFF a separate sidecar image is generated and made available for download via the UI
- **Flexible Options**: Control bitrate, sample rate, bit depth, channels, and compression per format
- **Real-time Status**: Monitor conversion progress with job status updates
- **Safe FFmpeg**: Shell-free argument building prevents injection vulnerabilities
- **Docker Ready**: Complete Docker Compose setup with backend, frontend, and Redis
- **Responsive UI**: Clean, modern interface with Tailwind CSS

## 🎵 Supported Formats

| Format | Quality | Lossy/Lossless | Artwork Support |
|--------|---------|---|---|
| **MP3** | Good | Lossy | Embedded |
| **AAC (M4A)** | Very Good | Lossy | Embedded |
| **WAV** | Lossless | Lossless | Sidecar Only |
| **FLAC** | Lossless | Lossless | Embedded |
| **OGG Vorbis** | Very Good | Lossy | Embedded (Re-encoded) |
| **Opus** | Excellent | Lossy | Embedded (Re-encoded) |
| **ALAC** | Lossless | Lossless | Embedded |
| **AIFF** | Lossless | Lossless | Sidecar Only |
| **WMA** | Good | Lossy | Embedded |

## 🛠️ Tech Stack

### Frontend
- **Next.js 13** - React framework with SSR
- **React 18** - UI library
- **Tailwind CSS** - Utility-first CSS framework
- **Modern JavaScript (ES6+)** - Latest JavaScript features

### Backend
- **Node.js (18+)** - Runtime environment
- **Fastify** - High-performance web framework
- **@fastify/multipart** - File upload handling
- **FFmpeg / ffprobe** - Audio processing and metadata extraction
- **UUID** - Unique job IDs
- **Stream/Promises** - Async file handling

### Infrastructure
- **Docker & Docker Compose** - Containerization
- **Redis (optional)** - Job queue for production

## 📦 Project Structure

```
audio-converter/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── formats.js
│   │   ├── services/
│   │   │   └── ffmpeg.js
│   │   ├── utils/
│   │   │   └── fileUtils.js
│   │   └── index.js
│   ├── .dockerignore
│   ├── Dockerfile
│   └── package.json
-
├── frontend/
│   ├── components/
│   │   └── MetadataEditor.js
│   ├── pages/
│   │   ├── _app.js
│   │   └── index.js
│   ├── styles/
│   │   └── globals.css
│   ├── Dockerfile
│   ├── next.config.js
│   ├── package.json
│   ├── postcss.config.js
│   └── tailwind.config.js
|
├── .gitignore
├── README.md
└── docker-compose.yml
```

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** (download from [docker.com](https://www.docker.com/products/docker-desktop))
  - Or **Node.js 18+** for local development

### Docker Setup (Recommended)

```bash
# Navigate to project root
cd audio-converter

# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

The application will be available at:
- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001`

**Stop Services:**
```bash
docker-compose down
```

**View Logs:**
```bash
docker-compose logs -f
```

### Local Development Setup

#### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Ensure FFmpeg is installed
# macOS: brew install ffmpeg
# Ubuntu: apt-get install ffmpeg
# Windows: choco install ffmpeg or download from ffmpeg.org

# Start development server
npm run dev
```

Backend runs on `http://localhost:3001`

#### 2. Frontend Setup

```bash
# In a new terminal
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on `http://localhost:3000`

#### 3. Access the Application

Open your browser:
```
http://localhost:3000
```

## 📖 API Documentation

### Get Available Formats

**GET** `/api/formats`

Return list of all supported formats and their configuration options.

**Response:**
```json
{
  "formats": {
    "mp3": {
      "name": "MP3",
      "extension": "mp3",
      "codec": "libmp3lame",
      "type": "lossy",
      "quality": "Good",
      "options": { ... }
    },
    ...
  }
}
```

### Probe Audio Metadata

**POST** `/api/probe`

Extract metadata from an uploaded audio file without conversion.

**Request:**
- **Content-Type**: multipart/form-data
- **Body**: `file` (audio file, any supported format)

**Response (Success):**
```json
{
  "metadata": {
    "format": { "filename": "...", "duration": 283.04, ... },
    "streams": [{ "codec_type": "audio", "codec_name": "mp3", ... }]
  },
  "filename": "song.mp3"
}
```

**Response (Error):**
```json
{
  "error": "Failed to analyze file"
}
```

### Convert Audio

**POST** `/api/convert`

Convert audio file to target format with optional metadata and cover art.

**Request:**
- **Content-Type**: multipart/form-data
- **Body:**
  - `file` (required): Audio file to convert
  - `format` (required): Target format (mp3, aac, wav, flac, ogg, opus, alac, aiff, wma)
  - `codec` (optional): Specific codec override
  - `bitrate` (optional): Target bitrate in kbps
  - `sampleRate` (optional): Target sample rate in Hz
  - `bitDepth` (optional): Target bit depth (16, 24, 32) for lossless formats
  - `channels` (optional): 1 (mono) or 2 (stereo)
  - `compression` (optional): 0-8 for FLAC compression level
  - `normalize` (optional): "true" to apply loudness normalization
  - `artwork` (optional): Cover image file (JPEG/PNG)
  - `metadata` (optional): JSON string with edited tags

**Response (Success):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "statusUrl": "/api/status/550e8400-e29b-41d4-a716-446655440000",
  "downloadUrl": "/api/download/550e8400-e29b-41d4-a716-446655440000",
  "metadata": { ... }
}
```

**Response (Error):**
```json
{
  "error": "No file uploaded"
}
```

### Check Conversion Status

**GET** `/api/status/:id`

Get current status of a conversion job.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "done",
  "progress": 100,
  "createdAt": 1677033600000
}
```

**Status Values:**
- `queued` - Job pending
- `processing` - Conversion in progress
- `done` - Conversion complete
- `error` - Conversion failed

### Download Converted File

**GET** `/api/download/:id`

Download the converted audio file. To fetch a sidecar artwork image (WAV/AIFF only), add the query parameter `?type=sidecar`.

**Response:** Binary audio file or image with appropriate MIME type

## 🎨 Usage Guide

### Convert Audio

1. **Upload File**:
   - Drag & drop or click to select an audio file
   - Any common format supported (MP3, WAV, FLAC, etc.)

2. **Select Target Format**:
   - Choose from 9 available formats
   - Browse format cards to see quality and options

3. **View & Edit Metadata**:
   - Click "Analyze" to extract existing metadata
   - Use the Metadata Editor to add, edit, or remove tags
   - Title, Artist, Album, Genre, Year, Comments, etc.

4. **Add Cover Art (Optional)**:
   - Click to select a cover image (JPEG or PNG)
   - Will be embedded for MP3, M4A, FLAC, WMA, OGG, Opus
   - Saved as sidecar for WAV/AIFF (downloadable separately)

5. **Configure Conversion Options**:
   - **Bitrate**: Quality vs. file size (lossy formats)
   - **Sample Rate**: 44100 Hz (CD), 48000 Hz (video), 96000+ Hz (hi-fi)
   - **Bit Depth**: 16-bit (CD), 24-bit (hi-fi), 32-bit (studio) for lossless
   - **Channels**: Mono (1) or Stereo (2)
   - **Compression**: 0 (fast) to 8 (maximum) for FLAC
   - **Normalize**: Apply loudness standardization (loudnorm filter)

6. **Convert & Download**:
   - Click "Convert"
   - Monitor progress in real-time
   - Download converted file when ready

## 🎵 Artwork Handling by Format

| Format | Support | Details |
|--------|---------|---------|
| **MP3** | ✅ Embedded | ID3v2 attached picture |
| **AAC/M4A** | ✅ Embedded | MP4/iTunes metadata |
| **FLAC** | ✅ Embedded | Vorbis picture comment |
| **WMA** | ✅ Embedded | Windows Media metadata |
| **OGG** | ✅ Embedded | Re-encoded to PNG, Vorbis picture |
| **Opus** | ✅ Embedded | Re-encoded to PNG, Opus picture |
| **ALAC** | ✅ Embedded | MP4 atoms (iTunes) |
| **WAV** | ⚠️ Sidecar | Saved as `.wav.jpg` or `.wav.png` (download via link after conversion) |
| **AIFF** | ⚠️ Sidecar | Saved as `.aiff.jpg` or `.aiff.png` (download via link after conversion) |

## 🔧 Configuration

### Backend Environment Variables

**File**: `backend/.env` (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `NODE_ENV` | production | Node environment |

FFmpeg is auto-detected from `PATH`. Ensure `ffmpeg` and `ffprobe` commands are available.

### Frontend Environment Variables

**File**: `frontend/.env` (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | http://localhost:3001 | Backend API URL |

## 🐛 Troubleshooting

### Backend won't start
```bash
# Verify FFmpeg is installed
ffmpeg -version
ffprobe -version

# Check Node.js version (must be 18+)
node --version

# Check if port 3001 is in use
# Change PORT environment variable or kill process on port 3001
```

### Conversion fails with codec error
- Check server logs for ffmpeg stderr output
- May indicate format doesn't support the requested settings
- Try with default options or different target format

### Metadata not showing in editor
- Some formats store metadata differently (ID3 vs. Vorbis vs. MP4 atoms)
- FFmpeg may not detect all fields automatically
- You can manually add tags in the editor

### Cover art not embedding
- Verify artwork is JPEG or PNG format
- Check if target format supports embedded artwork (see table above)
- For WAV/AIFF, a separate sidecar image is generated when artwork is provided; use the "Download Artwork" button in the UI or check the outputs folder manually

### High memory usage or slow conversion
- Large audio files (>500MB) require more resources
- OGG/Opus with artwork slower due to PNG re-encoding
- Consider splitting large files or using a faster machine

### File upload fails or times out
- Check backend logs for multipart parsing errors
- Default max file size: 200MB
- If needed, adjust `fileSize` limit in `backend/src/index.js`

## 🔒 Security Considerations

- ✅ No shell execution — FFmpeg arguments passed as safe array
- ✅ File type validation (extension & MIME type checking)
- ✅ File size limits (200MB default, configurable)
- ✅ Automatic cleanup of old files (5-minute retention)
- ✅ UUID-based job IDs (not sequential/guessable)
- ✅ Error messages don't expose sensitive paths
- ⚠️ **For Production**: 
  - Use HTTPS/TLS
  - Implement rate limiting per IP
  - Add authentication/authorization
  - Run FFmpeg in sandboxed/chroot environment
  - Use Redis for persistent job store (not in-memory)
  - Set up proper file permissions and cleanup

## 📚 Core Dependencies

### Backend
- `fastify` - Lightweight HTTP server
- `@fastify/multipart` - Multipart file handling
- `@fastify/cors` - CORS support
- `uuid` - Unique identifiers

### Frontend
- `react` - Component library
- `next` - React framework
- `tailwindcss` - Styling

### Audio Processing
- `ffmpeg` - Audio conversion (system binary)
- `ffprobe` - Metadata extraction (system binary)

## 🚧 Future Enhancements

- [ ] Batch conversion support
- [ ] Audio normalization/loudness matching
- [ ] Real-time waveform visualization
- [ ] Additional audio filters (EQ, reverb, compression)
- [ ] Language packs for UI
- [ ] Dark mode
- [ ] WebAssembly-based FFmpeg (offline mode)

## 📄 License

MIT License - Feel free to use this project for personal and commercial purposes.

---

**Made with ❤️ for the community!**