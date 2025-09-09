# Frontend for video search app
## Steps to run:
  - ```npm install ```
  - ```npm run dev ```


## Approach

The frontend is built with **React + Vite** for a fast developer experience. It provides a simple UI for uploading videos and performing semantic search over transcripts.

### Components
- **UploadForm** – Handles file selection and metadata input, validates video before sending to backend.  
- **VideoSearch** – Allows querying transcripts and displays matching segments with timestamps.  

### API Layer
- **`api.ts`** – Encapsulates HTTP calls to the Django backend for video upload, transcription, and search.  

### Styling
- **`styles.css`** – Lightweight CSS for layout and responsiveness.

## Trade-offs

- Chose **Vite** for faster hot reload and smaller bundle size.  
- Used plain **CSS** instead of a UI library to keep the project lean. 

