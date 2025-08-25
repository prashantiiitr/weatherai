import { useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import AddCity from './components/AddCity'
import CityCard from './components/CityCard'

function uid(){
  const k = 'wd_uid'
  let v = localStorage.getItem(k)
  if(!v){ v = crypto.randomUUID(); localStorage.setItem(k, v) }
  return v
}

export default function App(){
  const API = import.meta.env.VITE_API_BASE
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const userId = useMemo(()=> uid(), [])

  async function load(){
    setLoading(true)
    try{
      const res = await fetch(`${API}/api/cities`, { headers: { 'x-user-id': userId } })
      const data = await res.json()
      
      setCities((Array.isArray(data) ? data : []).slice(0, 12))
    }catch{
      setCities([])
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [userId])

  return (
    <main className="container">
      <Header />
      <AddCity onAdded={load} />
      <div className="mt-6 grid gap-4">
        {loading && <div className="text-gray-600">Loading your cities…</div>}
        {!loading && cities.length===0 && <div className="card">No cities yet. Search above to add your first.</div>}
        {cities.map(c => (
          <CityCard key={c._id} city={c} onRemoved={load} API={API} userId={userId} />
        ))}
      </div>
    </main>
  )
}
