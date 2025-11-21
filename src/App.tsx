import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DeviceSettings from './pages/DeviceSettings'
import Prompts from './pages/Prompts'
import Profile from './pages/Profile'
import Billings from './pages/Billings'
import SetStage from './pages/SetStage'
import ChatbotAI from './pages/ChatbotAI'
import WhatsAppBot from './pages/WhatsAppBot'
import FlowBuilder from './pages/FlowBuilder'
import FlowManager from './pages/FlowManager'
import Packages from './pages/Packages'
import Transactions from './pages/Transactions'
import UserRegister from './pages/UserRegister'
import Invoice from './pages/Invoice'
import Sequences from './pages/Sequences'
import BankImage from './pages/BankImage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Login />} />
          <Route path="/invoice" element={<Invoice />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/device-settings" element={<ProtectedRoute><DeviceSettings /></ProtectedRoute>} />
          <Route path="/prompts" element={<ProtectedRoute><Prompts /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/billings" element={<ProtectedRoute><Billings /></ProtectedRoute>} />
          <Route path="/set-stage" element={<ProtectedRoute><SetStage /></ProtectedRoute>} />
          <Route path="/chatbot-ai" element={<ProtectedRoute><ChatbotAI /></ProtectedRoute>} />
          <Route path="/whatsapp-bot" element={<ProtectedRoute><WhatsAppBot /></ProtectedRoute>} />
          <Route path="/flow-builder" element={<ProtectedRoute><FlowBuilder /></ProtectedRoute>} />
          <Route path="/flow-manager" element={<ProtectedRoute><FlowManager /></ProtectedRoute>} />
          <Route path="/packages" element={<ProtectedRoute><Packages /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
          <Route path="/user-register" element={<ProtectedRoute><UserRegister /></ProtectedRoute>} />
          <Route path="/sequences" element={<ProtectedRoute><Sequences /></ProtectedRoute>} />
          <Route path="/bank-image" element={<ProtectedRoute><BankImage /></ProtectedRoute>} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
