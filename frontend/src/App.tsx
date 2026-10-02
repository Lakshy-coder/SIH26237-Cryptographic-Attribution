import { useState } from 'react'

function App() {
  const [tab, setTab] = useState('sender')

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <nav className="bg-gray-800 p-4 shadow-md flex gap-4">
        <button 
          className={`px-4 py-2 rounded ${tab === 'sender' ? 'bg-blue-600' : 'bg-gray-700'}`}
          onClick={() => setTab('sender')}
        >
          Sender
        </button>
        <button 
          className={`px-4 py-2 rounded ${tab === 'recipient' ? 'bg-blue-600' : 'bg-gray-700'}`}
          onClick={() => setTab('recipient')}
        >
          Recipient
        </button>
        <button 
          className={`px-4 py-2 rounded ${tab === 'investigator' ? 'bg-blue-600' : 'bg-gray-700'}`}
          onClick={() => setTab('investigator')}
        >
          Investigator
        </button>
      </nav>

      <main className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Antigravity SIH26237</h1>
        
        {tab === 'sender' && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">Sender (Upload Document)</h2>
            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Recipients (comma separated)</label>
              <input type="text" className="w-full bg-gray-700 p-2 rounded" placeholder="agent_A, agent_B" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Select PDF Document</label>
              <input type="file" className="w-full bg-gray-700 p-2 rounded" />
            </div>
            <button className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-semibold transition-colors">
              Encrypt & Distribute
            </button>
          </div>
        )}

        {tab === 'recipient' && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">Recipient (Decrypt)</h2>
            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Recipient ID</label>
              <input type="text" className="w-full bg-gray-700 p-2 rounded" placeholder="agent_A" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Document ID</label>
              <input type="text" className="w-full bg-gray-700 p-2 rounded" placeholder="doc_xyz" />
            </div>
            <button className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-semibold transition-colors">
              Decrypt & Save Watermarked PDF
            </button>
          </div>
        )}

        {tab === 'investigator' && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">Investigator (Analyze Leak)</h2>
            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Leaked PDF</label>
              <input type="file" className="w-full bg-gray-700 p-2 rounded" />
            </div>
            <button className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded font-semibold transition-colors">
              Extract Watermark & Trace
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
