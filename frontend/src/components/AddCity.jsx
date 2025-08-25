import { useEffect, useMemo, useRef, useState } from 'react'

function uid(){
  const k = 'wd_uid'
  let v = localStorage.getItem(k)
  if(!v){ v = crypto.randomUUID(); localStorage.setItem(k, v) }
  return v
}

export default function AddCity({ onAdded }){
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const userId = useMemo(()=> uid(), [])
  const API = import.meta.env.VITE_API_BASE


  const debounceRef = useRef(null)

  async function doSearch(query){
    if(query.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try{
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    }catch{
      setResults([])
    }finally{
      setLoading(false)
    }
  }


  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(() => doSearch(q), 350) 
    return () => clearTimeout(debounceRef.current)
  }, [q])

 
  async function search(){ doSearch(q) }

  async function addCity(c){
    try{
      const res = await fetch(`${API}/api/cities`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-user-id': userId },
        body: JSON.stringify(c)
      })
      if(res.ok){
        setQ(''); setResults([]);
        onAdded && onAdded()
      } else {
        const e = await res.json()
        if (res.status === 409) alert('City already added.')
        else alert(e.error || 'Failed to add')
      }
    }catch{
      alert('Network error')
    }
  }

  return (
    <div className="card">
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Search city (e.g., Ranchi, Mumbai, London)"
          value={q}
          onChange={(e) => setQ(e.target.value)}         
          onKeyDown={(e) => e.key === 'Enter' && search()} 
        />
        <button className="btn" onClick={search} disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {}
      <div className="sr-only" aria-live="polite">
        {loading
          ? 'Searching…'
          : (q.trim().length >= 2
              ? (results.length ? `${results.length} results` : 'No results')
              : '')}
      </div>

      {}
      {q.trim().length > 0 && q.trim().length < 2 && (
        <div className="mt-2 text-sm text-gray-500">Type at least 2 characters to search.</div>
      )}

      {}
      {!loading && results.length > 0 && (
        <div className="mt-3 grid gap-2">
          {results.map((r, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => addCity(r)}
            >
              {r.name}{r.state ? `, ${r.state}` : ''} {r.country ? `(${r.country})` : ''}
            </button>
          ))}
        </div>
      )}

      {}
      {!loading && q.trim().length >= 2 && results.length === 0 && (
        <div className="mt-3 text-sm text-gray-500">No matches found. Try another spelling.</div>
      )}
    </div>
  )
}
