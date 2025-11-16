import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  Chatbot Automation Platform
                </h1>
                <p className="text-gray-600 text-lg">
                  System is being rebuilt from scratch
                </p>
                <p className="text-gray-500 mt-2">
                  Clean Supabase-only architecture
                </p>
              </div>
            </div>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
