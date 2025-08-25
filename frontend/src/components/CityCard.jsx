import { useEffect, useState } from 'react'
import Forecast from './Forecast'

export default function CityCard({ city, onRemoved, API, userId }){
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  async function load(){
    setLoading(true); setErr(null)
    try{
      const res = await fetch(`${API}/api/weather?cityId=${city._id}`)
      const d = await res.json()
      if(!res.ok) throw new Error(d.error || 'Failed')
      setData(d)
    }catch(e){ setErr(e.message) }
    finally{ setLoading(false) }
  }

  async function removeCity(){
    const res = await fetch(`${API}/api/cities?id=${city._id}`, { 
      method:'DELETE', 
      headers: { 'x-user-id': userId } 
    })
    if(res.ok) onRemoved && onRemoved(); else alert('Failed to remove')
  }

  useEffect(()=>{ load() }, [city._id])

  if(loading) return <div className="card">Loading {city.name}…</div>
  if(err) return (
    <div className="card">
      Error: {err} 
      <button className="ml-2 underline" onClick={load}>Retry</button>
    </div>
  )

  const cur = data.current
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xl font-semibold">
            {city.name}{' '}
            {city.country && <span className="text-gray-500 text-base">({city.country})</span>}
          </div>
          <div className="text-sm text-gray-500">
            Lat {city.lat?.toFixed(2)}, Lon {city.lon?.toFixed(2)}
          </div>
        </div>
        <button
          aria-label={`Remove ${city.name}`}
          className="text-red-600 hover:underline"
          onClick={removeCity}
        >
          Remove
        </button>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <img
          alt="icon"
          width={56}
          height={56}
          src={`https://openweathermap.org/img/wn/${cur?.weather?.[0]?.icon || '01d'}@2x.png`}
        />
        <div>
          {}
          <div className="temp text-3xl font-bold">
            {cur ? Math.round(cur.main.temp) : '--'}°C
          </div>
          {}
          <div className="muted text-sm">
            {cur
              ? `Feels ${Math.round(cur.main.feels_like)}°, ${cur.weather?.[0]?.description}`
              : '—'}
          </div>
        </div>

        {}
        <div className="ml-auto text-right text-sm muted">
          <div>Humidity: {cur?.main.humidity ?? '--'}%</div>
          <div>Wind: {cur ? Math.round(cur.wind.speed) : '--'} m/s</div>
          <div>Pressure: {cur?.main.pressure ?? '--'} hPa</div>
        </div>
      </div>

      {data?.forecast?.list && (
        <div className="mt-5">
          <Forecast list={data.forecast.list} />
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        Updated {new Date().toLocaleTimeString()}
      </div>
    </div>
  )
}
