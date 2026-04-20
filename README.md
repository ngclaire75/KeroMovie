# NFT Home Page with React and Go Backend

This project includes:

- React frontend built with Vite
- Simple Go backend serving API endpoints

## Files

- `index.html` — Vite entry point
- `src/main.jsx` — React app bootstrap
- `src/App.jsx` — homepage component
- `src/styles.css` — page styling
- `backend/go.mod` — Go module declaration
- `backend/main.go` — Go HTTP server

## Run locally

1. Install frontend dependencies:
   ```bash
   npm install
   ```

2. Start the React app:
   ```bash
   npm run dev
   ```

3. Start the Go backend in a separate terminal:
   ```bash
   cd backend
   go run main.go
   ```

4. Open the frontend in your browser:
   - `http://localhost:5173`

5. Check the backend API:
   - `http://localhost:8080/api/status`
   - `http://localhost:8080/api/hello`

## If `go` is not recognized

- Restart your terminal or restart VS Code after installing Go.
- If needed, add Go to your PATH manually:
  - `C:\Program Files\Go\bin`
- Verify with:
  ```powershell
  go version
  ```

## VS Code tasks

Open the Command Palette and run `Tasks: Run Task` to start:

- `npm: dev`
- `Go: run backend`
