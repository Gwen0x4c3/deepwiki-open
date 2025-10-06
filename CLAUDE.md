# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeepWiki-Open is an AI-powered wiki generation system that automatically creates beautiful, interactive documentation for any GitHub, GitLab, or BitBucket repository. The project uses a modern architecture with:

- **Backend**: Python FastAPI server with AI model integrations
- **Frontend**: Next.js React application with TypeScript
- **AI Features**: RAG-powered Q&A, multi-turn research, visual diagram generation

## Development Commands

### Backend Development

```bash
# Start the API server (recommended approach)
./run.sh
# Or manually:
uv run -m api.main

# Install Python dependencies
pip install -r api/requirements.txt
# Or using uv (preferred):
uv sync

# Run tests
pytest
# Run specific test categories
pytest -m unit        # Unit tests only
pytest -m integration # Integration tests only
pytest -m slow        # Slow tests only
```

### Frontend Development

```bash
# Install JavaScript dependencies
npm install
# or
yarn install

# Start development server
npm run dev
# or
yarn dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Docker Development

```bash
# Build and run with Docker Compose
docker-compose up

# Build Docker image locally
docker build -t deepwiki-open .

# Run container with environment variables
docker run -p 8001:8001 -p 3000:3000 \
  -e GOOGLE_API_KEY=your_google_api_key \
  -e OPENAI_API_KEY=your_openai_api_key \
  -v ~/.adalflow:/root/.adalflow \
  deepwiki-open
```

## Architecture

### Backend Structure (`/api`)

- **`main.py`**: FastAPI application entry point
- **`api.py`**: Core API endpoints and logic
- **`rag.py`**: Retrieval Augmented Generation system
- **`data_pipeline.py`**: Repository processing and indexing
- **`config.py`**: Configuration management
- **`logging_config.py`**: Centralized logging setup
- **Client Files**: AI model integrations (`openai_client.py`, `google_embedder_client.py`, etc.)
- **`websocket_wiki.py`**: Real-time wiki generation streaming
- **`simple_chat.py`**: Chat completion handling

### Frontend Structure (`/src`)

- **`app/`**: Next.js 15 app router pages
- **`components/`**: React components including Mermaid diagram renderer
- **`contexts/`**: React contexts for state management
- **`hooks/`**: Custom React hooks
- **`i18n.ts`**: Internationalization configuration
- **`messages/`**: Translation files for multiple languages
- **`types/`**: TypeScript type definitions
- **`utils/`**: Utility functions

### Configuration System

The project uses JSON configuration files in `api/config/`:

- **`generator.json`**: AI model provider configurations (OpenAI, Google, etc.)
- **`embedder.json`**: Embedding model settings for RAG
- **`repo.json`**: Repository processing rules and file filters
- **`lang.json`**: Language detection and processing settings

Environment variables can override configuration values using `${VAR_NAME}` syntax.

## AI Model Provider System

DeepWiki supports multiple AI providers through a flexible configuration system:

- **Google Gemini**: Default `gemini-2.5-flash`
- **OpenAI**: Default `gpt-5-nano`
- **OpenRouter**: Access to multiple models via unified API
- **Azure OpenAI**: Enterprise OpenAI models
- **Ollama**: Local open-source models
- **Custom Providers**: Extensible client architecture

## Key Features Implementation

### Wiki Generation Pipeline

1. Repository cloning (including private repos with tokens)
2. File structure analysis and filtering
3. Code embedding creation using configured embedder
4. AI-powered documentation generation
5. Mermaid diagram creation for visualizations
6. Structured wiki organization

### RAG System

- Text splitting with configurable chunk sizes (default: 350 words, 100 overlap)
- Vector storage using FAISS for similarity search
- Retrieval of top-k relevant documents (default: 20)
- Support for OpenAI, Google, and Ollama embeddings

### Real-time Features

- WebSocket streaming for live wiki generation updates
- Progressive rendering of generated content
- Real-time chat interface with repository context

## Environment Setup

Required environment variables:

```bash
# API Keys (at least one required)
GOOGLE_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_ENDPOINT=your_azure_openai_endpoint
AZURE_OPENAI_VERSION=your_azure_openai_version

# Configuration
DEEPWIKI_EMBEDDER_TYPE=openai|google|ollama  # Default: openai
DEEPWIKI_AUTH_MODE=true|false                 # Enable authorization
DEEPWIKI_AUTH_CODE=your_secret_code           # Required if auth enabled
OLLAMA_HOST=http://localhost:11434            # Custom Ollama host
PORT=8001                                     # API server port
SERVER_BASE_URL=http://localhost:8001         # Frontend API URL
DEEPWIKI_CONFIG_DIR=/path/to/config           # Custom config directory
LOG_LEVEL=INFO                                # Logging level
LOG_FILE_PATH=api/logs/application.log        # Log file location
```

## Testing

The project includes comprehensive test coverage:

- **Unit tests**: Individual component testing (`tests/unit/`)
- **Integration tests**: End-to-end workflow testing (`tests/integration/`)
- **API tests**: Backend endpoint testing (`tests/api/`)

Test configuration in `pytest.ini` with markers for different test categories.

## Data Storage

- **Repositories**: `~/.adalflow/repos/`
- **Embeddings**: `~/.adalflow/databases/`
- **Wiki cache**: `~/.adalflow/wikicache/`
- **Logs**: `api/logs/`

When using Docker, these paths are mounted as volumes for persistence.

## Development Notes

- The backend uses `uv` for Python dependency management (faster than pip)
- Frontend uses Next.js 15 with Turbopack for fast development
- Configuration supports environment variable substitution
- All AI client implementations follow a common interface for easy extension
- The system handles large repositories through chunked processing and streaming