import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  NodeMouseHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start' },
    position: { x: 400, y: 50 },
    style: {
      background: '#7c3aed',
      color: 'white',
      border: '2px solid #6d28d9',
      borderRadius: '12px',
      padding: '16px 24px',
      fontSize: '14px',
      fontWeight: '600',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
  },
]

const initialEdges: Edge[] = []

type NodeType = 'message' | 'ai' | 'condition' | 'image' | 'video' | 'audio' | 'file' | 'delay' | 'button' | 'quick_reply' | 'input'

export default function FlowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [flowName, setFlowName] = useState('')
  const [saving, setSaving] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [navMenuOpen, setNavMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { stroke: '#8b5cf6', strokeWidth: 2 },
    }, eds)),
    [setEdges]
  )

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    console.log('Node clicked:', node)
    // You can add node configuration modal here
    Swal.fire({
      title: 'Edit Node',
      html: `
        <div style="text-align: left;">
          <p><strong>Node Type:</strong> ${node.data.label}</p>
          <p><strong>Node ID:</strong> ${node.id}</p>
          <p style="color: #888; font-size: 12px;">Click and drag nodes to reposition them. Drag from edges to create connections.</p>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'OK'
    })
  }, [])

  const addNode = (type: NodeType) => {
    const nodeConfig: Record<NodeType, { label: string; icon: string; borderColor: string; bgColor: string }> = {
      message: { label: 'Send Message', icon: '💬', borderColor: '#2563eb', bgColor: 'bg-blue-100' },
      ai: { label: 'AI Response', icon: '🤖', borderColor: '#7c3aed', bgColor: 'bg-purple-100' },
      condition: { label: 'Condition', icon: '🔀', borderColor: '#059669', bgColor: 'bg-green-100' },
      image: { label: 'Send Image', icon: '🖼️', borderColor: '#ec4899', bgColor: 'bg-pink-100' },
      video: { label: 'Send Video', icon: '🎥', borderColor: '#f59e0b', bgColor: 'bg-amber-100' },
      audio: { label: 'Send Audio', icon: '🎵', borderColor: '#10b981', bgColor: 'bg-emerald-100' },
      file: { label: 'Send File', icon: '📎', borderColor: '#6366f1', bgColor: 'bg-indigo-100' },
      delay: { label: 'Add Delay', icon: '⏱️', borderColor: '#8b5cf6', bgColor: 'bg-violet-100' },
      button: { label: 'Add Buttons', icon: '🔘', borderColor: '#3b82f6', bgColor: 'bg-sky-100' },
      quick_reply: { label: 'Quick Reply', icon: '⚡', borderColor: '#06b6d4', bgColor: 'bg-cyan-100' },
      input: { label: 'User Input', icon: '✏️', borderColor: '#f43f5e', bgColor: 'bg-rose-100' },
    }

    const config = nodeConfig[type]
    const newNode: Node = {
      id: `${Date.now()}`,
      type: 'default',
      data: {
        label: `${config.icon} ${config.label}`
      },
      position: {
        x: 250 + Math.random() * 200,
        y: 150 + Math.random() * 200,
      },
      style: {
        background: 'white',
        border: `2px solid ${config.borderColor}`,
        borderRadius: '12px',
        padding: '16px 20px',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
        minWidth: '180px',
      },
    }
    setNodes((nds) => [...nds, newNode])
  }

  const saveFlow = async () => {
    if (!flowName.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'Flow Name Required',
        text: 'Please enter a flow name',
      })
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('chatbot_flows').insert({
        id: crypto.randomUUID(),
        id_device: '',
        name: flowName,
        niche: '',
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
      })

      if (error) throw error

      await Swal.fire({
        icon: 'success',
        title: 'Flow Saved!',
        text: 'Your flow has been saved successfully.',
        timer: 2000,
        showConfirmButton: false,
      })
      setFlowName('')
    } catch (error: any) {
      await Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: error.message || 'Failed to save flow',
      })
    } finally {
      setSaving(false)
    }
  }

  const clearCanvas = async () => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Clear Canvas?',
      text: 'Are you sure you want to clear the canvas?',
      showCancelButton: true,
      confirmButtonText: 'Yes, clear it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    })

    if (result.isConfirmed) {
      setNodes(initialNodes)
      setEdges([])
    }
  }

  const NodeButton = ({ type, icon, label, desc, color }: { type: NodeType; icon: string; label: string; desc: string; color: string }) => (
    <button
      onClick={() => addNode(type)}
      className={`w-full flex items-center gap-3 bg-white hover:${color}-50 border-2 ${color}-200 hover:border-${color}-400 text-gray-900 px-3 py-2.5 rounded-lg transition-all group`}
    >
      <div className={`w-9 h-9 rounded-lg ${color}-100 group-hover:${color}-200 flex items-center justify-center text-lg transition-colors`}>
        {icon}
      </div>
      <div className="text-left flex-1">
        <div className="font-semibold text-xs">{label}</div>
        <div className="text-[10px] text-gray-500">{desc}</div>
      </div>
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  )

  const navItems = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/device-settings', icon: '📱', label: 'Device Settings' },
    { path: '/profile', icon: '👤', label: 'Profile' },
    { path: '/billings', icon: '💳', label: 'Billings' },
    { path: '/set-stage', icon: '🎭', label: 'Set Stage' },
    { path: '/chatbot-ai', icon: '🤖', label: 'Chatbot AI' },
    { path: '/whatsapp-bot', icon: '💬', label: 'WhatsApp Bot' },
    { path: '/flow-builder', icon: '🔄', label: 'Flow Builder' },
    { path: '/flow-manager', icon: '📋', label: 'Flow Manager' },
  ]

  const showPackages = user?.role === 'admin'

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Navigation Menu Sidebar - Overlay */}
      {navMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setNavMenuOpen(false)}
          ></div>

          {/* Navigation Sidebar */}
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-white z-50 shadow-2xl flex flex-col">
            {/* Logo & Close Button */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🤖</span>
                <h1 className="text-xl font-black">
                  <span className="text-gray-900">Pening</span>
                  <span className="text-primary-600">Bot</span>
                </h1>
              </div>
              <button
                onClick={() => setNavMenuOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path)
                    setNavMenuOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    item.path === '/flow-builder'
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium text-sm">{item.label}</span>
                </button>
              ))}

              {showPackages && (
                <button
                  onClick={() => {
                    navigate('/packages')
                    setNavMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
                >
                  <span className="text-xl">📦</span>
                  <span className="font-medium text-sm">Packages</span>
                </button>
              )}
            </nav>

            {/* User Info & Logout */}
            <div className="p-4 border-t border-gray-200">
              <div className="mb-3 bg-primary-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
                    {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <p className="text-sm text-gray-900 font-semibold">{user?.full_name || user?.email?.split('@')[0]}</p>
                </div>
                <p className="text-xs text-gray-600 truncate ml-10">{user?.email}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <span>🚪</span>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Left Sidebar */}
      <div
        className={`bg-white border-r border-gray-200 transition-all duration-300 ${
          sidebarOpen ? 'w-80' : 'w-0'
        } overflow-hidden overflow-y-auto`}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Flow Builder</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Flow Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Flow Name
            </label>
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder="Enter flow name..."
              className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Messages Category */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Messages</h3>
            <div className="space-y-1.5">
              <NodeButton type="message" icon="💬" label="Text Message" desc="Send text" color="bg-blue" />
              <NodeButton type="image" icon="🖼️" label="Image" desc="Send image" color="bg-pink" />
              <NodeButton type="video" icon="🎥" label="Video" desc="Send video" color="bg-amber" />
              <NodeButton type="audio" icon="🎵" label="Audio" desc="Send audio" color="bg-emerald" />
              <NodeButton type="file" icon="📎" label="File" desc="Send document" color="bg-indigo" />
            </div>
          </div>

          {/* User Input Category */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">User Input</h3>
            <div className="space-y-1.5">
              <NodeButton type="button" icon="🔘" label="Buttons" desc="Add button choices" color="bg-sky" />
              <NodeButton type="quick_reply" icon="⚡" label="Quick Reply" desc="Quick responses" color="bg-cyan" />
              <NodeButton type="input" icon="✏️" label="User Input" desc="Collect user data" color="bg-rose" />
            </div>
          </div>

          {/* Logic Category */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Logic & AI</h3>
            <div className="space-y-1.5">
              <NodeButton type="ai" icon="🤖" label="AI Response" desc="Smart AI reply" color="bg-purple" />
              <NodeButton type="condition" icon="🔀" label="Condition" desc="If/else logic" color="bg-green" />
              <NodeButton type="delay" icon="⏱️" label="Delay" desc="Add wait time" color="bg-violet" />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-gray-200 space-y-2">
            <button
              onClick={saveFlow}
              disabled={saving}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving Flow...
                </span>
              ) : (
                'Save Flow'
              )}
            </button>

            <button
              onClick={clearCanvas}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg transition-colors"
            >
              Clear Canvas
            </button>
          </div>

          {/* Tips */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h4 className="font-semibold text-sm text-gray-900 mb-1">Quick Tips</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Click blocks to add them to canvas</li>
                  <li>• Drag to connect blocks together</li>
                  <li>• Use mouse wheel to zoom in/out</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Navigation Menu Button */}
              <button
                onClick={() => setNavMenuOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Open navigation menu"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Open flow builder sidebar"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {flowName || 'Untitled Flow'}
                </h1>
                <p className="text-sm text-gray-500">
                  {nodes.length} blocks • {edges.length} connections
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium">
                Preview
              </button>
              <button className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium">
                Export
              </button>
            </div>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1 bg-gray-50">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
            selectNodesOnDrag={false}
            fitView
            attributionPosition="bottom-left"
            minZoom={0.2}
            maxZoom={2}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: '#8b5cf6', strokeWidth: 2 },
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color="#d1d5db"
            />
            <Controls
              className="bg-white border border-gray-200 rounded-lg shadow-lg"
              showInteractive={false}
            />
            <MiniMap
              className="bg-white border border-gray-200 rounded-lg shadow-lg"
              nodeColor={(node) => {
                if (node.type === 'input') return '#7c3aed'
                return '#ffffff'
              }}
              maskColor="rgba(0, 0, 0, 0.05)"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
