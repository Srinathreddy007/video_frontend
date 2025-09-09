# Frontend for video search app
## Steps to run:
  - ```npm install ```
  - ```npm run dev ```
  - Run both client and server side applications and open url `http://localhost:5173/` in the browser


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

## Demo Pictures
<img width="1151" height="515" alt="Pasted Graphic 1" src="https://github.com/user-attachments/assets/1538aa94-a916-473d-9f6f-6728d6677a57" />
<img width="1252" height="684" alt="Pasted Graphic 2" src="https://github.com/user-attachments/assets/e28bf167-8936-4f94-a6d3-4d59f60fd00a" />
<img width="1234" height="753" alt="Pasted Graphic 3" src="https://github.com/user-attachments/assets/ad4d5e53-a1f4-41cb-99f6-aa5366857cb4" />


